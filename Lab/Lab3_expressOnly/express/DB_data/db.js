// DB_data/db.js
require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function ensureSchema() {
  await q(`
    CREATE TABLE IF NOT EXISTS chat_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room VARCHAR(100) NOT NULL,
      user VARCHAR(100) NOT NULL,
      text TEXT NOT NULL,
      ts BIGINT NOT NULL,
      INDEX idx_room_ts (room, ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

module.exports = { pool, q, ensureSchema };
