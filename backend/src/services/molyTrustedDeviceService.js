const crypto = require("crypto");
const {
  clearSsoBrowserCookie,
  readSsoCookie,
  setSsoBrowserCookie,
  shouldUseSecureSsoCookie,
} = require("../utils/ssoPathPolicy");

function resolveDb(db) {
  return db || require("../config/database");
}

const MOLY_TRUSTED_DEVICE_COOKIE = "moly_trusted_device";
const TRUSTED_DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const TOKEN_FORMAT_RE = /^[A-Za-z0-9_-]{32,256}$/;
const HEX_64_RE = /^[0-9a-f]{64}$/;

class MolyDeviceError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "MolyDeviceError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.errorCode = code;
    this.details = details;
  }
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function resolveProofSecret(env = process.env) {
  return String(env?.MOLY_DEVICE_PROOF_SECRET || env?.COURSE_LMS_HMAC_SECRET || "").trim();
}

function detectOperatingSystem(userAgent = "") {
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Trình duyệt";
}

function detectBrowser(userAgent = "") {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/CriOS|Chrome\//i.test(userAgent)) return "Chrome";
  if (/FxiOS|Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Web Browser";
}

function describeBrowserDevice(userAgent = "") {
  const ua = typeof userAgent === "string" ? userAgent.slice(0, 1000) : "";
  return `${detectOperatingSystem(ua)} · ${detectBrowser(ua)}`;
}

function detectDeviceType(userAgent = "") {
  const ua = String(userAgent || "").toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod/.test(ua) || (/android/.test(ua) && !/windows/.test(ua))) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
}

function extractClientIp(req) {
  if (!req) return null;
  const fwd = typeof req.get === "function" ? req.get("x-forwarded-for") : req.headers?.["x-forwarded-for"];
  const raw = fwd ? String(fwd).split(",")[0].trim() : String(req.ip || req.socket?.remoteAddress || "").trim();
  if (!raw) return null;
  return raw.replace(/^::ffff:/, "").slice(0, 64);
}

function setTrustedDeviceCookie(res, token, { secure = false } = {}) {
  setSsoBrowserCookie(res, {
    name: MOLY_TRUSTED_DEVICE_COOKIE,
    value: token,
    maxAgeSeconds: TRUSTED_DEVICE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    secure,
  });
}

function buildDeviceSlotProofCanonical({ externalUserId, molyDeviceTokenHash, issuedAt, nonce }) {
  return `v1:${String(externalUserId)}:${String(molyDeviceTokenHash)}:${String(issuedAt)}:${String(nonce)}`;
}

function buildDeviceSlotProof({
  externalUserId,
  molyDeviceTokenHash,
  deviceName = null,
  userAgent = "",
  ipAddress = null,
  now = () => Date.now(),
  env = process.env,
}) {
  const secret = resolveProofSecret(env);
  if (!secret) {
    throw new MolyDeviceError(500, "DEVICE_PROOF_NOT_CONFIGURED", "Device proof signing secret is not configured.");
  }
  const normalizedHash = String(molyDeviceTokenHash || "").trim().toLowerCase();
  if (!HEX_64_RE.test(normalizedHash)) {
    throw new MolyDeviceError(403, "UNTRUSTED_DEVICE_PROOF", "Invalid browser device token hash.");
  }
  const extUser = String(externalUserId || "").trim();
  const issuedAt = new Date(now()).toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = {
    v: 1,
    source: "moly",
    externalUserId: extUser,
    molyDeviceTokenHash: normalizedHash,
    deviceName: deviceName ? String(deviceName).slice(0, 160) : describeBrowserDevice(userAgent),
    userAgent: userAgent ? String(userAgent).slice(0, 1000) : "",
    ipAddress: ipAddress ? String(ipAddress).slice(0, 64) : null,
    issuedAt,
    nonce,
  };
  const signature = crypto
    .createHmac("sha256", secret)
    .update(buildDeviceSlotProofCanonical(payload))
    .digest("hex");
  const proofObject = { ...payload, signature };
  const proofHeader = Buffer.from(JSON.stringify(proofObject), "utf8").toString("base64url");
  return {
    proofObject,
    proofHeader,
  };
}

async function hasMolyTrustedDeviceTable(db) {
  try {
    const res = await db.query(`SELECT to_regclass('moly_trusted_browser_devices') IS NOT NULL AS has_tbl`);
    return Boolean(res.rows?.[0]?.has_tbl);
  } catch {
    return false;
  }
}

async function assertUserNotDeviceLimitLocked(db, userId) {
  const numericUserId = Number(userId);
  if (!Number.isSafeInteger(numericUserId) || numericUserId <= 0) return;
  let lockRow = null;
  try {
    const res = await db.query(
      `SELECT device_limit_locked_at FROM users WHERE id = $1 LIMIT 1`,
      [numericUserId],
    );
    lockRow = res.rows?.[0] || null;
  } catch (err) {
    // Allow legacy fixtures whose minimal `users` stub lacks `device_limit_locked_at`.
    if (err?.code === "42703" || err?.code === "42P01") return;
    throw err;
  }
  if (lockRow?.device_limit_locked_at) {
    throw new MolyDeviceError(
      403,
      "DEVICE_LIMIT_LOCKED",
      "Tài khoản đã bị khóa do vượt quá giới hạn thiết bị tin cậy. Vui lòng liên hệ quản trị viên.",
    );
  }
}

async function ensureMolyTrustedDevice({
  req,
  res = null,
  user,
  db = resolveDb(),
  env = process.env,
  now = () => Date.now(),
  allowRotateRevoked = false,
} = {}) {
  const userId = user?.id ? Number(user.id) : null;
  if (!userId) return null;

  const hasTable = await hasMolyTrustedDeviceTable(db);
  if (!hasTable) return null;

  await assertUserNotDeviceLimitLocked(db, userId);

  const secureCookie = shouldUseSecureSsoCookie(req, env);
  const userAgent = typeof req?.get === "function"
    ? req.get("user-agent") || ""
    : String(req?.headers?.["user-agent"] || "");
  const ipAddress = extractClientIp(req);
  const deviceName = describeBrowserDevice(userAgent);
  const deviceType = detectDeviceType(userAgent);

  // Never trust browser-supplied x-device-id / localStorage; only use server-minted HttpOnly cookie.
  const rawCookie = readSsoCookie(req, MOLY_TRUSTED_DEVICE_COOKIE);
  const candidateToken = rawCookie && TOKEN_FORMAT_RE.test(String(rawCookie).trim())
    ? String(rawCookie).trim()
    : null;

  if (candidateToken) {
    const candidateHash = sha256Hex(candidateToken);
    const existingRes = await db.query(
      `SELECT id, user_id, device_token_hash, device_name, device_type, revoked_at, revoked_reason
       FROM moly_trusted_browser_devices
       WHERE user_id = $1 AND device_token_hash = $2
       ORDER BY id DESC
       LIMIT 1`,
      [userId, candidateHash],
    );
    const existing = existingRes.rows?.[0] || null;

    if (existing && !existing.revoked_at) {
      await db.query(
        `UPDATE moly_trusted_browser_devices
         SET last_seen_at = NOW(),
             last_ip = COALESCE($2, last_ip),
             user_agent = COALESCE(NULLIF($3, ''), user_agent),
             device_name = COALESCE(NULLIF($4, ''), device_name)
         WHERE id = $1`,
        [existing.id, ipAddress, userAgent.slice(0, 1000), deviceName],
      );
      return {
        deviceRow: existing,
        deviceTokenHash: existing.device_token_hash,
        deviceName: existing.device_name || deviceName,
        userAgent,
        ipAddress,
        isNewCookie: false,
        buildProof: ({ externalUserId = String(userId) } = {}) => buildDeviceSlotProof({
          externalUserId,
          molyDeviceTokenHash: existing.device_token_hash,
          deviceName: existing.device_name || deviceName,
          userAgent,
          ipAddress,
          now,
          env,
        }),
      };
    }

    if (existing && existing.revoked_at && !allowRotateRevoked) {
      if (res) {
        clearSsoBrowserCookie(res, {
          name: MOLY_TRUSTED_DEVICE_COOKIE,
          path: "/",
          secure: secureCookie,
        });
      }
      throw new MolyDeviceError(
        403,
        "DEVICE_BINDING_REVOKED",
        "Thiết bị này đã bị thu hồi quyền truy cập. Vui lòng đăng nhập lại.",
      );
    }
  }

  const freshToken = crypto.randomBytes(32).toString("base64url");
  const freshHash = sha256Hex(freshToken);
  const insRes = await db.query(
    `INSERT INTO moly_trusted_browser_devices
       (user_id, device_token_hash, device_name, device_type, user_agent, first_ip, last_ip)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING id, user_id, device_token_hash, device_name, device_type`,
    [userId, freshHash, deviceName, deviceType, userAgent.slice(0, 1000) || null, ipAddress],
  );
  const created = insRes.rows[0];
  if (res) {
    setTrustedDeviceCookie(res, freshToken, { secure: secureCookie });
  }

  return {
    deviceRow: created,
    deviceTokenHash: created.device_token_hash,
    deviceName: created.device_name || deviceName,
    userAgent,
    ipAddress,
    isNewCookie: true,
    buildProof: ({ externalUserId = String(userId) } = {}) => buildDeviceSlotProof({
      externalUserId,
      molyDeviceTokenHash: created.device_token_hash,
      deviceName: created.device_name || deviceName,
      userAgent,
      ipAddress,
      now,
      env,
    }),
  };
}

async function revokeMolyTrustedDevicesByHashes({
  db = resolveDb(),
  hashes = [],
  userIds = [],
  reason = "remote_device_revoked",
  revokedAt = null,
} = {}) {
  const cleanHashes = [...new Set(
    (Array.isArray(hashes) ? hashes : [])
      .map((h) => String(h || "").trim().toLowerCase())
      .filter((h) => HEX_64_RE.test(h)),
  )];
  const cleanUserIds = [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  )];
  if (!cleanHashes.length && !cleanUserIds.length) {
    return { revokedCount: 0 };
  }

  const hasTable = await hasMolyTrustedDeviceTable(db);
  if (!hasTable) return { revokedCount: 0 };

  const revokedTs = revokedAt ? new Date(revokedAt).toISOString() : new Date().toISOString();
  let res;
  if (cleanHashes.length && cleanUserIds.length) {
    res = await db.query(
      `UPDATE moly_trusted_browser_devices
       SET revoked_at = COALESCE(revoked_at, $3::timestamptz),
           revoked_reason = COALESCE(revoked_reason, $4)
       WHERE revoked_at IS NULL
         AND (device_token_hash = ANY($1::char(64)[]) OR user_id = ANY($2::integer[]))`,
      [cleanHashes, cleanUserIds, revokedTs, String(reason).slice(0, 255)],
    );
  } else if (cleanHashes.length) {
    res = await db.query(
      `UPDATE moly_trusted_browser_devices
       SET revoked_at = COALESCE(revoked_at, $2::timestamptz),
           revoked_reason = COALESCE(revoked_reason, $3)
       WHERE revoked_at IS NULL
         AND device_token_hash = ANY($1::char(64)[])`,
      [cleanHashes, revokedTs, String(reason).slice(0, 255)],
    );
  } else {
    res = await db.query(
      `UPDATE moly_trusted_browser_devices
       SET revoked_at = COALESCE(revoked_at, $2::timestamptz),
           revoked_reason = COALESCE(revoked_reason, $3)
       WHERE revoked_at IS NULL
         AND user_id = ANY($1::integer[])`,
      [cleanUserIds, revokedTs, String(reason).slice(0, 255)],
    );
  }

  return { revokedCount: res?.rowCount || 0 };
}

async function prepareSsoBrowserDevice({
  req = null,
  db = resolveDb(),
  env = process.env,
  now = () => Date.now(),
} = {}) {
  const hasTable = await hasMolyTrustedDeviceTable(db);
  if (!hasTable) return null;

  const userAgent = typeof req?.get === "function"
    ? req.get("user-agent") || ""
    : String(req?.headers?.["user-agent"] || "");
  const ipAddress = extractClientIp(req);
  const deviceName = describeBrowserDevice(userAgent);
  const deviceType = detectDeviceType(userAgent);

  const rawCookie = readSsoCookie(req, MOLY_TRUSTED_DEVICE_COOKIE);
  const candidateToken = rawCookie && TOKEN_FORMAT_RE.test(String(rawCookie).trim())
    ? String(rawCookie).trim()
    : null;

  if (candidateToken) {
    const candidateHash = sha256Hex(candidateToken);
    const res = await db.query(
      `SELECT id, user_id, device_token_hash, device_name, device_type, revoked_at
       FROM moly_trusted_browser_devices
       WHERE device_token_hash = $1
       ORDER BY revoked_at NULLS FIRST, id DESC
       LIMIT 1`,
      [candidateHash],
    );
    const row = res.rows?.[0] || null;
    if (row && !row.revoked_at) {
      return {
        deviceTokenHash: row.device_token_hash,
        rawToken: null,
        existingDeviceId: row.id,
        existingUserId: row.user_id,
        deviceName: row.device_name || deviceName,
        deviceType: row.device_type || deviceType,
        userAgent,
        ipAddress,
        canSignProof: () => Boolean(resolveProofSecret(env)),
        buildProof: ({ externalUserId }) => buildDeviceSlotProof({
          externalUserId,
          molyDeviceTokenHash: row.device_token_hash,
          deviceName: row.device_name || deviceName,
          userAgent,
          ipAddress,
          now,
          env,
        }),
      };
    }
  }

  const freshToken = crypto.randomBytes(32).toString("base64url");
  const freshHash = sha256Hex(freshToken);
  return {
    deviceTokenHash: freshHash,
    rawToken: freshToken,
    existingDeviceId: null,
    existingUserId: null,
    deviceName,
    deviceType,
    userAgent,
    ipAddress,
    canSignProof: () => Boolean(resolveProofSecret(env)),
    buildProof: ({ externalUserId }) => buildDeviceSlotProof({
      externalUserId,
      molyDeviceTokenHash: freshHash,
      deviceName,
      userAgent,
      ipAddress,
      now,
      env,
    }),
  };
}

async function finalizeSsoBrowserDevice({
  req = null,
  res = null,
  db = resolveDb(),
  userId,
  devicePrep = null,
  env = process.env,
} = {}) {
  const numericUserId = Number(userId);
  if (!devicePrep || !Number.isSafeInteger(numericUserId) || numericUserId <= 0) {
    return null;
  }
  const hasTable = await hasMolyTrustedDeviceTable(db);
  if (!hasTable) return null;

  await assertUserNotDeviceLimitLocked(db, numericUserId);

  const existingRes = await db.query(
    `SELECT id, revoked_at
     FROM moly_trusted_browser_devices
     WHERE user_id = $1 AND device_token_hash = $2
     ORDER BY id DESC
     LIMIT 1`,
    [numericUserId, devicePrep.deviceTokenHash],
  );
  const existing = existingRes.rows?.[0] || null;
  if (existing && !existing.revoked_at) {
    await db.query(
      `UPDATE moly_trusted_browser_devices
       SET last_seen_at = NOW(),
           last_ip = COALESCE($2, last_ip),
           user_agent = COALESCE(NULLIF($3, ''), user_agent),
           device_name = COALESCE(NULLIF($4, ''), device_name)
       WHERE id = $1`,
      [existing.id, devicePrep.ipAddress, devicePrep.userAgent.slice(0, 1000), devicePrep.deviceName],
    );
  } else {
    await db.query(
      `INSERT INTO moly_trusted_browser_devices
         (user_id, device_token_hash, device_name, device_type, user_agent, first_ip, last_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        numericUserId,
        devicePrep.deviceTokenHash,
        devicePrep.deviceName,
        devicePrep.deviceType || "desktop",
        devicePrep.userAgent ? devicePrep.userAgent.slice(0, 1000) : null,
        devicePrep.ipAddress,
      ],
    );
  }

  if (devicePrep.rawToken && res) {
    setTrustedDeviceCookie(res, devicePrep.rawToken, {
      secure: shouldUseSecureSsoCookie(req, env),
    });
  }
  return devicePrep.deviceTokenHash;
}

module.exports = {
  MOLY_TRUSTED_DEVICE_COOKIE,
  MolyDeviceError,
  describeBrowserDevice,
  detectDeviceType,
  buildDeviceSlotProof,
  ensureMolyTrustedDevice,
  prepareSsoBrowserDevice,
  finalizeSsoBrowserDevice,
  revokeMolyTrustedDevicesByHashes,
};
