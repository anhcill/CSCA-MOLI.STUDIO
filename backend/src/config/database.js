const { Pool } = require("pg");
require("dotenv").config();

// ====================================
// PostgreSQL Connection Pool
// Support both Railway (DATABASE_URL) and manual config
// ====================================
const getPoolConfig = () => {
  // Railway may expose DATABASE_URL or DATABASE_PUBLIC_URL depending on setup
  const railwayConnectionString =
    process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (railwayConnectionString) {
    return {
      connectionString: railwayConnectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Manual configuration (local development)
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "csca_db",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
};

const pool = new Pool(getPoolConfig());

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
    console.error(
      "   Please check DATABASE_URL / DATABASE_PUBLIC_URL or local DB_* variables"
    );
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
