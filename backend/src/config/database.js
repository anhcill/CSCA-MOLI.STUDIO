const { Pool } = require("pg");
require("dotenv").config();

// ====================================
// PostgreSQL Connection Pool
// ====================================
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "csca_db",
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection could not be established
});

// ====================================
// Connection Event Handlers
// ====================================
// Log only errors, not every connection
// pool.on('connect') removed to reduce startup noise

pool.on("error", (err) => {
  // Log the error but do NOT kill the server — the pool will attempt to recover
  console.error("⚠️  Unexpected database pool error (non-fatal):", err.message);
});

// ====================================
// Query Helper Function
// ====================================
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Query logging disabled to reduce noise
    // Enable with DEBUG_QUERIES=1 if needed
    if (process.env.DEBUG_QUERIES) {
      console.log("Executed query", { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};

// ====================================
// Test Database Connection
// ====================================
const testConnection = async () => {
  try {
    const result = await pool.query(
      "SELECT NOW() as current_time, version() as version"
    );
    console.log("📊 Database Info:");
    console.log("   Time:", result.rows[0].current_time);
    console.log("   Version:", result.rows[0].version.split("\n")[0]);
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("   Please check your database configuration in .env file");
    return false;
  }
};

// testConnection() is called from index.js startup instead

// ====================================
// Export
// ====================================
module.exports = {
  query,
  pool,
  testConnection,
};
