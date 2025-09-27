// src/socket/index.js
const { WebSocketServer, WebSocket } = require("ws");
const { safeParseJSON, isChatMessage, isJoinMessage } = require("./protocol");
const axios = require("axios");
const { q } = require("../DB_data/db.js");

const PORT = process.env.PORT || 3001;

/**
 * Attaches a WebSocketServer to an existing HTTP server.
 * Includes:
 *  - heartbeat pings
 *  - simple "rooms" so chats don't mix across groups
 *  - minimal protocol: {type:"chat", text, user?, room?} and {type:"join", room}
 */
module.exports = function attachSocket(server) {
  const wss = new WebSocketServer({ server });

  // roomName -> Set<WebSocket>
  const rooms = new Map();

  // Default room for new connections
  const DEFAULT_ROOM = "lobby";

  function heartbeat() {
    this.isAlive = true;
  }

  function joinRoom(ws, room) {
    // remove from previous room if any
    if (ws._room && rooms.has(ws._room)) {
      rooms.get(ws._room).delete(ws);
      if (rooms.get(ws._room).size === 0) rooms.delete(ws._room);
    }
    // add to new room
    ws._room = room;
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(ws);
  }

  function broadcastToRoom(room, payloadObj) {
    const set = rooms.get(room);
    if (!set) return;
    const payload = JSON.stringify(payloadObj);
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  function extractRoomName(msg) {
    if (typeof msg.room === "string") return msg.room.trim();
    if (typeof msg.roomId === "string") return msg.roomId.trim();
    if (typeof msg.room_id === "string") return msg.room_id.trim();
    return ""; // no room provided
  }

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    // put new client in the default room
    joinRoom(ws, DEFAULT_ROOM);

    ws.on("message", (raw) => {
      const msg = safeParseJSON(raw);
      //   console.log("part1_work", { raw: raw.toString(), parsed: msg });

      if (!msg) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "error", text: "Invalid JSON" }));
        }
        return;
      }

      const msgType = (msg.type || "").toString().toLowerCase();
      const roomName = extractRoomName(msg);

      if (msgType === "join") {
        if (!roomName) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: "error", text: "Join requires a 'room'." })
            );
          }
          return;
        }
        joinRoom(ws, roomName);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ type: "system", text: `Joined room: ${roomName}` })
          );
        }
        return;
      }

      if (isChatMessage(msg)) {
        (async () => {
          try {
            const now = Date.now();
            const user =
              typeof msg.user === "string" && msg.user.trim()
                ? msg.user.trim()
                : "Anonymous";
            const room = roomName || ws._room || DEFAULT_ROOM;

            // ✅ Call API first and await it
            const { data } = await axios.get(
              `http://localhost:${process.env.PORT || 3001}/api/test`,
              {
                params: { phase: "chat", room, user, text: msg.text },
                timeout: 5000,
              }
            );
            console.log(data);

            // Optional gating/transform from API
            const allow = data?.allow !== false; // default: allow
            const text = typeof data?.text === "string" ? data.text : msg.text;

            if (!allow) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "system",
                    text: "Message blocked by server policy.",
                  })
                );
              }
              return;
            }

            const payload = { type: "chat", user, text, room, ts: now };
            broadcastToRoom(room, payload);
          } catch (err) {
            console.error("CHAT /api/test failed:", err.message || err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  text: "Failed to validate message",
                })
              );
            }
          }
        })();

        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "error", text: "Unknown message type" })
        );
      }
    });

    ws.on("close", () => {
      // cleanup from room
      if (ws._room && rooms.has(ws._room)) {
        rooms.get(ws._room).delete(ws);
        if (rooms.get(ws._room).size === 0) rooms.delete(ws._room);
      }
    });
  });

  // Heartbeat: keep connections fresh & terminate dead peers
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  return {
    wss,
    stopHeartbeat: () => clearInterval(interval),
    broadcastToRoom, // exported in case your API wants to push events into rooms later
  };
};
