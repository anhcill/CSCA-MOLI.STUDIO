require("dotenv").config();

const db = require("../src/config/database");
const DeviceSessionService = require("../src/services/deviceSessionService");

async function main() {
  const count = await DeviceSessionService.removeAllSessions();
  console.log(`Revoked ${count} active sessions.`);
}

main()
  .catch((error) => {
    console.error("Failed to revoke active sessions:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.pool && typeof db.pool.end === "function") {
      await db.pool.end();
    }
  });
