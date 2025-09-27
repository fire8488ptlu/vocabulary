// src/socket/protocol.js

function safeParseJSON(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

function isChatMessage(msg) {
  return msg && msg.type === "chat" && typeof msg.text === "string";
}

function isJoinMessage(msg) {
  // { type: "join", room: "roomId", user?: "David" }
  return (
    msg &&
    msg.type === "join" &&
    typeof msg.room === "string" &&
    msg.room.length > 0
  );
}

module.exports = { safeParseJSON, isChatMessage, isJoinMessage };
