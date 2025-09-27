// socket/index.js
const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("crypto");

module.exports = function attachSocket(server, { path = "/ws" } = {}) {
  const wss = new WebSocketServer({ server, path });
  const rooms = new Map(); // roomName -> Set<WebSocket>
  const sockets = new Map(); // socketId -> ws (optional: for lookup)
  const DEFAULT_ROOM = "lobby";

  function joinRoom(ws, room) {
    // 1. If this socket (ws) is already in a room, remove it
    if (ws._room && rooms.has(ws._room)) {
      rooms.get(ws._room).delete(ws);

      // if the old room is now empty, delete it from the map
      if (rooms.get(ws._room).size === 0) rooms.delete(ws._room);
    }

    // 2. Set the new room name on the WebSocket object itself
    ws._room = room;

    // 3. If the target room doesn’t exist yet, create a Set for it
    if (!rooms.has(room)) rooms.set(room, new Set());

    // 4. Add this socket (ws) into the room’s Set
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

  wss.on("connection", (ws, req) => {
    ws.isAlive = true;
    ws.on("pong", heartbeat);

    // 1) give each client its own room (or allow ?room=XYZ)
    const url = new URL(req.url, "http://localhost");
    const requestedRoom = (url.searchParams.get("room") || "")
      .toString()
      .trim();

    console.log("?room=", requestedRoom);

    // if not provided, generate a unique per-client room id
    const socketId = crypto.randomUUID();
    sockets.set(socketId, ws);

    // if have ?room use it or socketId (random)
    const roomForThisClient = requestedRoom || `client:${socketId}`;

    joinRoom(ws, roomForThisClient);

    // tell the client which room they own
    ws.send(
      JSON.stringify({
        type: "system",
        text: `Joined private room: ${roomForThisClient}`,
        room: roomForThisClient,
        socketId,
      })
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
          JSON.stringify({
            type: "system",
            text: `Joined room: ${target}`,
            room: target,
          })
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
          roomForThisClient;

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
      sockets.delete(socketId);
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
