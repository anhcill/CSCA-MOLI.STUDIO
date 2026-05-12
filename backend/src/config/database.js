const { Pool } = require("pg");
require("dotenv").config();

// ====================================
// PostgreSQL Connection Pool
// Support both Railway (DATABASE_URL) and manual config
// ====================================
const getPoolConfig = () => {
  const railwayConnectionString =
    process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

  if (railwayConnectionString) {
    // Parse DATABASE_URL to extract individual components for better control
    let parsedDbName = "postgres"; // Railway default DB name
    try {
      const url = new URL(railwayConnectionString);
      parsedDbName = url.pathname.replace("/", "") || "postgres";
    } catch (_) {
      // fallback to default
    }

    return {
      host: (() => {
        try { return new URL(railwayConnectionString).hostname; } catch { return "localhost"; }
      })(),
      port: (() => {
        try { return Number(new URL(railwayConnectionString).port); } catch { return 5432; }
      })(),
      user: (() => {
        try { return new URL(railwayConnectionString).username; } catch { return "postgres"; }
      })(),
      password: (() => {
        try { return new URL(railwayConnectionString).password; } catch { return ""; }
      })(),
      database: parsedDbName,
      max: 10,               // Reduced for Railway proxy — avoids exhausting the proxy
      min: 0,                // Don't hold idle connections (Railway sleeps DB)
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 30000, // 30s — Railway can be slow to wake from sleep
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
  console.error("Unexpected database pool error (non-fatal):", err.message);
});

// ====================================
// Query Helper Function with Retry
// ====================================
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const query = async (text, params, attempt = 1) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.DEBUG_QUERIES) {
      console.log("Executed query", { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    // Retry only on timeout / connection errors (not on bad SQL, constraints, etc.)
    const isRetryable =
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      (error.message && error.message.includes("timeout exceeded")) ||
      (error.message && error.message.includes("Connection terminated")) ||
      (error.message && error.message.includes("Connection refused")) ||
      (error.message && error.message.includes("too many connections"));

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      console.warn(
        `Database query retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms: ${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return query(text, params, attempt + 1);
    }

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
    console.log("Database Info:");
    console.log("   Time:", result.rows[0].current_time);
    console.log("   Version:", result.rows[0].version.split("\n")[0]);

    // Additional check: verify the DB name matches expectation
    try {
      const dbResult = await pool.query("SELECT current_database() as db_name");
      console.log("   Database:", dbResult.rows[0].db_name);
    } catch (_) {}

    return true;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    console.error(
      "   Please check DATABASE_URL / DATABASE_PUBLIC_URL or local DB_* variables"
    );

    // Common Railway mistake: wrong database name
    if (error.message.includes("timeout")) {
      console.error(
        "   TIP: If using Railway, the database name might be 'postgres', not 'railway'."
      );
      console.error(
        "   Check your Railway PostgreSQL connection variable."
      );
    }

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
