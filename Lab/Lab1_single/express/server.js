// src/server.js
// Run: node src/server.js
require("dotenv").config();
const http = require("http");
const apiApp = require("./api");
const attachSocket = require("./socket");

const PORT = process.env.PORT || 3001;

// responsible for API part
const server = http.createServer(apiApp);

// attach WebSocket server onto the HTTP server
const { wss, stopHeartbeat } = attachSocket(server);

server.listen(PORT, () => {
  console.log(`HTTP/WebSocket server listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// graceful shutdown (optional)
process.on("SIGINT", () => {
  console.log("Shutting down...");
  stopHeartbeat?.();
  wss?.close?.();
  server.close(() => process.exit(0));
});
