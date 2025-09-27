// socket/index.js
const { WebSocketServer, WebSocket } = require("ws");

module.exports = function attachSocket(server, { path = "/ws" } = {}) {
  const wss = new WebSocketServer({ server, path });
  // roomName -> Set<WebSocket>
  const rooms = new Map();
  const DEFAULT_ROOM = "lobby";

  function joinRoom(ws, room) {
    if (ws._room && rooms.has(ws._room)) {
      rooms.get(ws._room).delete(ws);
      if (rooms.get(ws._room).size === 0) rooms.delete(ws._room);
    }
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

  function safeJSON(buf) {
    try {
      return JSON.parse(buf);
    } catch {
      return null;
    }
  }

  // heartbeat
  function heartbeat() {
    this.isAlive = true;
  }
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    // default room
    joinRoom(ws, DEFAULT_ROOM);
    ws.send(
      JSON.stringify({ type: "system", text: `Joined room: ${DEFAULT_ROOM}` })
    );

    ws.on("message", (raw) => {
      const msg = safeJSON(raw);
      if (!msg) {
        ws.send(JSON.stringify({ type: "error", text: "Invalid JSON" }));
        return;
      }

      const type = String(msg.type || "chat").toLowerCase();

      if (type === "join") {
        const target =
          (msg.room || msg.roomId || msg.room_id || "").toString().trim() ||
          DEFAULT_ROOM;
        joinRoom(ws, target);
        ws.send(
          JSON.stringify({ type: "system", text: `Joined room: ${target}` })
        );
        return;
      }

      if (type === "chat" && typeof msg.text === "string") {
        const now = Date.now();
        const user =
          typeof msg.user === "string" && msg.user.trim()
            ? msg.user.trim()
            : "Anonymous";
        const room =
          (typeof msg.room === "string" && msg.room.trim()) ||
          ws._room ||
          DEFAULT_ROOM;

        // (optional) DB moderation/persistence here
        // await q('INSERT INTO chat_logs ...', [room, user, msg.text, now]);

        broadcastToRoom(room, {
          type: "chat",
          room,
          user,
          text: msg.text,
          ts: now,
        });
        return;
      }

      ws.send(JSON.stringify({ type: "error", text: "Unknown message type" }));
    });

    ws.on("close", () => {
      if (ws._room && rooms.has(ws._room)) {
        rooms.get(ws._room).delete(ws);
        if (rooms.get(ws._room).size === 0) rooms.delete(ws._room);
      }
    });
  });

  wss.on("close", () => clearInterval(interval));

  return {
    wss,
    broadcastToRoom,
    stopHeartbeat: () => clearInterval(interval),
  };
};
