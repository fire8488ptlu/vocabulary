// server.js
require("dotenv").config();
const express = require("express");
const attachSocket = require("./socket"); // ← our WS module
const { pool } = require("./DB_data/db");
const { dbInfo } = require("./DB_data/SQLScript");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// sample API
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Start Express and CAPTURE the http.Server it returns
const server = app.listen(PORT, () => {
  console.log(`HTTP/WebSocket server: http://localhost:${PORT}`);
  console.log(`WebSocket endpoint:   ws://localhost:${PORT}/ws`);
});

// Attach WebSocket to the same server/port
const { broadcastToRoom, stopHeartbeat, wss } = attachSocket(server, {
  path: "/ws",
});

app.get("/api/sqltest", async (req, res) => {
  const result = await dbInfo();
  res.json(result);
});
// optional: broadcast via HTTP
// localhost:3001/api/broadcast will work
app.post("/api/broadcast", (req, res) => {
  const { room = "lobby", text = "778899", user = "System" } = req.body || {};
  broadcastToRoom(room, { type: "chat", room, user, text, ts: Date.now() });
  res.json({ ok: true });
});

// graceful shutdown
function shutdown() {
  console.log("Shutting down…");
  try {
    stopHeartbeat?.();
  } catch {}
  try {
    wss?.close?.();
  } catch {}
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// (optional) tweak timeouts
server.keepAliveTimeout = 60_000;
server.headersTimeout = 65_000;
