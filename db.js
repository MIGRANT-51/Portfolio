// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Your original pool config — unchanged
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,   // your original key name kept
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
});

// Added: verify connection + ensure tables exist on startup
async function initDB() {
  try {
    const conn = await pool.getConnection();

    // Ensure contacts table exists — matches your exact SQL schema
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        email      VARCHAR(255) NOT NULL,
        message    TEXT         NOT NULL,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        status     ENUM('new', 'read', 'archived') DEFAULT 'new'
      )
    `);

    // Add index safely (ignore error if already exists on MySQL 5.x)
    await conn.query(`CREATE INDEX IF NOT EXISTS idx_email ON contacts(email)`).catch(() => {});

    conn.release();
    console.log('   Database ✓  connected, contacts table ready');
  } catch (err) {
    console.error('   Database ✗  ' + err.message);
    console.error('   → Check DB_HOST, DB_USER, DB_PASS, DB_NAME in your .env');
  }
}

module.exports = pool;           // default export unchanged — existing code won't break
module.exports.initDB = initDB;  // new named export used by server.js
