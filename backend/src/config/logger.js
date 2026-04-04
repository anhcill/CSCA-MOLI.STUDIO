/**
 * Lightweight structured logger (C5 fix)
 * - Development: colored, human-readable output
 * - Production: JSON lines for log aggregators (Datadog, Loki, etc.)
 * Zero dependencies — wraps console.
 */

const isProd = process.env.NODE_ENV === "production";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
    error: "\x1b[31m",   // red
    warn: "\x1b[33m",   // yellow
    info: "\x1b[36m",   // cyan
    debug: "\x1b[90m",   // gray
    reset: "\x1b[0m",
};

function log(level, message, meta = {}) {
    const ts = new Date().toISOString();

    if (isProd) {
        // JSON format — easy to parse by log aggregators
        process.stdout.write(
            JSON.stringify({ ts, level, message, ...meta }) + "\n",
        );
    } else {
        const color = COLORS[level] || "";
        const metaStr = Object.keys(meta).length
            ? " " + JSON.stringify(meta)
            : "";
        console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
            `${color}[${ts}] ${level.toUpperCase()}:${COLORS.reset} ${message}${metaStr}`,
        );
    }
}

const logger = {
    error: (msg, meta) => log("error", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    debug: (msg, meta) => log("debug", msg, meta),
};

module.exports = logger;
