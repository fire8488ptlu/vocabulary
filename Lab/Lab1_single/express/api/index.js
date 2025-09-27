// src/api/index.js
const express = require("express");

const app = express();
app.use(express.json());

// Example health route
app.get("/health", (_req, res) => res.json({ ok: true }));

// Example API route (extend freely)
app.post("/api/echo", (req, res) => {
  res.json({ youSent: req.body || null });
});

app.get("/api/test", (req, res) => {
  res.json({ youSent: "test" });
});

module.exports = app;
