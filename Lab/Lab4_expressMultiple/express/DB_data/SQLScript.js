const { pool } = require("./db");

async function dbInfo() {
  const result = await pool.query(
    "SELECT DATABASE() AS db, USER() AS user, VERSION() AS version"
  );

  return result;
}

module.exports = { dbInfo };
