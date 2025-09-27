// server.js
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createPool } from "mysql2/promise";
import { ajv } from "./lib/ajv.js";
import { ExplainBatchSchema } from "./schemas/explainBatch.js";
import { v4 as uuid } from "uuid";

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }, // tighten in prod
});

const db = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: "vocab_app",
  connectionLimit: 5,
});

// Simple auth example: clients send a token and join a private room
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // TODO: verify token/JWT
  if (!token) return next(new Error("unauthorized"));
  socket.data.userId = "user-" + token; // demo
  next();
});

io.on("connection", (socket) => {
  const room = socket.data.userId;
  socket.join(room);
  socket.emit("connected", { ok: true });
});

// -------------- Ingestion API --------------
app.post("/api/ingest", async (req, res) => {
  const { chapter_ID, data } = req.body || {};
  if (!chapter_ID || !Array.isArray(data)) {
    return res.status(400).json({ error: "chapter_ID and data[] required" });
  }

  try {
    // Stored procedure from the previous answer
    const [rows] = await db.query("CALL sp_ingest_chapter_payload(?)", [
      JSON.stringify({ chapter_ID, data }),
    ]);

    // Return a jobId so the UI can track progress via WS
    const jobId = uuid();
    // Optionally persist jobId ↔ userId for permission checks, omitted for brevity
    res.json({ ok: true, jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ingest_failed" });
  }
});

// -------------- Background Worker --------------
// Polls queued items, calls LLM, validates, writes, and emits via WS.
const validateExplainBatch = ajv.getSchema("ExplainBatch");

async function fetchQueuedBatch(limit = 20) {
  const [rows] = await db.query(
    `SELECT q.v_id, v.v_title
     FROM ai_explain_queue q
     JOIN vocabulary v ON v.v_id = q.v_id
     WHERE q.status = 'queued'
     ORDER BY q.requested_at
     LIMIT ?`,
    [limit]
  );
  return rows;
}

// Fake LLM caller (replace with real API call to ChatGPT)
async function callLLMExplain(batch) {
  // expected to return array of {v_id, v_title, explain}
  return batch.map((x) => ({
    v_id: x.v_id,
    v_title: x.v_title,
    explain:
      x.v_title.toLowerCase() === "chic"
        ? "'Chic' /ʃiːk/ means elegantly and stylishly fashionable."
        : `Definition for "${x.v_title}" (demo).`,
  }));
}

async function writeSuccess(db, item, meta = {}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert ai_explain_result
    await conn.query(
      `INSERT INTO ai_explain_result
       (v_id, explain_text, source_model, model_version, confidence, is_reviewed)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         explain_text = VALUES(explain_text),
         source_model = VALUES(source_model),
         model_version= VALUES(model_version),
         confidence   = VALUES(confidence),
         created_at   = CURRENT_TIMESTAMP`,
      [
        item.v_id,
        item.explain,
        meta.model || "gpt-5-thinking",
        meta.model_ver || null,
        90,
      ]
    );

    // Copy into vocabulary.explain
    await conn.query(`UPDATE vocabulary SET \`explain\`=? WHERE v_id=?`, [
      item.explain,
      item.v_id,
    ]);

    // Mark queue done
    await conn.query(
      `UPDATE ai_explain_queue SET status='done', processed_at=NOW() WHERE v_id=?`,
      [item.v_id]
    );

    // Log success
    await conn.query(
      `INSERT INTO ai_completion_log
       (v_id, job_type, model, request_payload, response_payload,
        prompt_tokens, completion_tokens, total_tokens, latency_ms,
        http_status, status, error_message)
       VALUES (?, 'explain', ?, ?, ?, ?, ?, ?, ?, ?, 'success', NULL)`,
      [
        item.v_id,
        meta.model || "gpt-5-thinking",
        JSON.stringify(meta.request || {}),
        JSON.stringify(item),
        meta.prompt_tokens || 0,
        meta.completion_tokens || 0,
        meta.total_tokens || 0,
        meta.latency_ms || 0,
        meta.http_status || 200,
      ]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function writeError(db, v_id, err, meta = {}) {
  await db.query(
    `UPDATE ai_explain_queue
     SET status='error', attempts=attempts+1, last_error=LEFT(?, 2000)
     WHERE v_id=?`,
    [String(err?.message || err), v_id]
  );

  await db.query(
    `INSERT INTO ai_completion_log
     (v_id, job_type, model, request_payload, response_payload,
      http_status, status, error_message)
     VALUES (?, 'explain', ?, ?, NULL, ?, 'error', ?)`,
    [
      v_id,
      meta.model || "gpt-5-thinking",
      JSON.stringify(meta.request || {}),
      meta.http_status || 500,
      String(err?.message || err),
    ]
  );
}

// Emit helper (broadcast to all users; in prod, target by room/ownership)
function emitResult(payload) {
  io.emit("explain_result", payload);
}

async function workerLoop() {
  try {
    const batch = await fetchQueuedBatch(25);
    if (batch.length === 0) return;

    const requestId = uuid();
    const t0 = Date.now();

    let llmOut = [];
    try {
      llmOut = await callLLMExplain(batch);
    } catch (e) {
      // mark all as error
      await Promise.all(
        batch.map((b) => writeError(db, b.v_id, e, { http_status: 500 }))
      );
      return;
    }

    // ----- Ajv validation BEFORE DB writes -----
    if (!validateExplainBatch(llmOut)) {
      const errMsg = ajv.errorsText(validateExplainBatch.errors);
      // mark all as error for retry
      await Promise.all(
        batch.map((b) =>
          writeError(db, b.v_id, new Error("Schema invalid: " + errMsg), {
            http_status: 422,
          })
        )
      );
      // Emit one schema error message
      emitResult({
        type: "explain_batch_error",
        requestId,
        message: "Schema validation failed",
        details: validateExplainBatch.errors,
      });
      return;
    }

    // Write each item; emit result progressively
    for (const item of llmOut) {
      try {
        await writeSuccess(db, item, {
          model: "gpt-5-thinking",
          total_tokens: 100, // demo numbers
          latency_ms: Date.now() - t0,
          http_status: 200,
          request: { requestId, count: batch.length },
        });

        emitResult({
          type: "explain_item",
          requestId,
          item, // { v_id, v_title, explain }
          at: new Date().toISOString(),
        });
      } catch (e) {
        await writeError(db, item.v_id, e, { http_status: 500 });
        emitResult({
          type: "explain_item_error",
          requestId,
          v_id: item.v_id,
          message: e.message || "write failed",
        });
      }
    }

    emitResult({
      type: "explain_batch_done",
      requestId,
      count: llmOut.length,
      elapsedMs: Date.now() - t0,
    });
  } catch (err) {
    console.error("workerLoop error:", err);
  }
}

// Kick off a simple interval worker
setInterval(workerLoop, 1500);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server listening on " + PORT));
