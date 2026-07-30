const fs = require("fs");
const fsPromises = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const BACKUP_PREFIX = "csca_database_backup_";
const BACKUP_EXTENSION = ".dump";
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

let activeBackup = null;

function getBackupDirectory() {
  const configured = String(process.env.DATABASE_BACKUP_DIR || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), "database_backup");
}

function getConnectionConfig() {
  const connectionString =
    process.env.DATABASE_BACKUP_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_PUBLIC_URL;

  if (connectionString) {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
      sslMode: url.searchParams.get("sslmode") || (url.hostname === "localhost" ? "prefer" : "require"),
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || "5432",
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "csca_db",
    sslMode: process.env.PGSSLMODE || "prefer",
  };
}

function getPgDumpCommand() {
  return String(process.env.PG_DUMP_PATH || "pg_dump").trim();
}

function formatTimestamp(date = new Date()) {
  const timeZone = process.env.DATABASE_BACKUP_TIMEZONE || "Asia/Ho_Chi_Minh";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}_${value.hour}-${value.minute}-${value.second}`;
}

function isBackupFileName(fileName) {
  return (
    typeof fileName === "string" &&
    fileName.startsWith(BACKUP_PREFIX) &&
    fileName.endsWith(BACKUP_EXTENSION) &&
    path.basename(fileName) === fileName
  );
}

async function ensureBackupDirectory() {
  const directory = getBackupDirectory();
  await fsPromises.mkdir(directory, { recursive: true });
  return directory;
}

function runPgDump(command, args, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill();
      settled = true;
      reject(new Error("Sao lưu quá thời gian cho phép."));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new Error("Không tìm thấy pg_dump. Hãy cài PostgreSQL client hoặc cấu hình PG_DUMP_PATH."));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pg_dump kết thúc với mã lỗi ${code}.`));
    });
  });
}

function getPgDumpStatus() {
  return new Promise((resolve) => {
    const child = spawn(getPgDumpCommand(), ["--version"], {
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    const timer = setTimeout(() => child.kill(), 5000);
    child.stdout.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(0, 300);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ available: false, version: null });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ available: code === 0, version: code === 0 ? output.trim() : null });
    });
  });
}

async function createBackup() {
  if (activeBackup) {
    const error = new Error("Một bản sao lưu khác đang được tạo. Vui lòng chờ hoàn tất.");
    error.code = "BACKUP_IN_PROGRESS";
    throw error;
  }

  activeBackup = (async () => {
    const directory = await ensureBackupDirectory();
    const connection = getConnectionConfig();
    const fileName = `${BACKUP_PREFIX}${formatTimestamp()}${BACKUP_EXTENSION}`;
    const finalPath = path.join(directory, fileName);
    const partialPath = `${finalPath}.partial`;
    const args = [
      "--format=custom",
      "--compress=9",
      "--no-owner",
      "--no-privileges",
      "--host",
      connection.host,
      "--port",
      String(connection.port),
      "--username",
      connection.user,
      "--dbname",
      connection.database,
      "--file",
      partialPath,
    ];
    const timeoutMs = Number(process.env.DATABASE_BACKUP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

    try {
      await runPgDump(getPgDumpCommand(), args, {
        ...process.env,
        PGPASSWORD: connection.password,
        PGSSLMODE: connection.sslMode,
      }, timeoutMs);
      await fsPromises.rename(partialPath, finalPath);
      const stats = await fsPromises.stat(finalPath);
      return {
        fileName,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
      };
    } catch (error) {
      await fsPromises.rm(partialPath, { force: true }).catch(() => {});
      throw error;
    }
  })();

  try {
    return await activeBackup;
  } finally {
    activeBackup = null;
  }
}

async function listBackups() {
  const directory = await ensureBackupDirectory();
  const entries = await fsPromises.readdir(directory, { withFileTypes: true });
  const backups = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && isBackupFileName(entry.name))
      .map(async (entry) => {
        const stats = await fsPromises.stat(path.join(directory, entry.name));
        return {
          fileName: entry.name,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      }),
  );
  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return backups;
}

function getBackupFilePath(fileName) {
  if (!isBackupFileName(fileName)) return null;
  const directory = getBackupDirectory();
  const resolved = path.resolve(directory, fileName);
  if (path.dirname(resolved) !== path.resolve(directory)) return null;
  return resolved;
}

async function getStatus() {
  const connection = getConnectionConfig();
  const directory = await ensureBackupDirectory();
  let directoryWritable = true;
  try {
    await fsPromises.access(directory, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    directoryWritable = false;
  }

  const pgDump = await getPgDumpStatus();

  return {
    directory,
    directoryWritable,
    database: connection.database,
    host: connection.host,
    inProgress: Boolean(activeBackup),
    pgDumpAvailable: pgDump.available,
    pgDumpVersion: pgDump.version,
    isRailway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
    backups: await listBackups(),
  };
}

module.exports = {
  createBackup,
  getBackupFilePath,
  getStatus,
  isBackupFileName,
};
