const crypto = require("crypto");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
const db = require("../config/database");

const ISSUER = process.env.ADMIN_MFA_ISSUER || "CSCA Moly";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const BACKUP_CODE_COUNT = 10;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function deriveEncryptionKey() {
  const source =
    process.env.MFA_ENCRYPTION_KEY ||
    process.env.ADMIN_MFA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!source) {
    throw new Error("Missing MFA_ENCRYPTION_KEY or JWT_SECRET");
  }
  return crypto.createHash("sha256").update(String(source)).digest();
}

function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${base64url(iv)}:${base64url(tag)}:${base64url(encrypted)}`;
}

function fromBase64url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function decryptSecret(encryptedValue) {
  const [version, ivPart, tagPart, encryptedPart] = String(encryptedValue || "").split(":");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted MFA secret");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveEncryptionKey(), fromBase64url(ivPart));
  decipher.setAuthTag(fromBase64url(tagPart));
  return Buffer.concat([
    decipher.update(fromBase64url(encryptedPart)),
    decipher.final(),
  ]).toString("utf8");
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input) {
  const clean = String(input || "").replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

function verifyTotpCode(secretBase32, code, lastUsedStep = null) {
  const normalized = String(code || "").replace(/\D/g, "");
  if (normalized.length !== DIGITS) return { valid: false };

  const currentStep = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const step = currentStep + offset;
    if (lastUsedStep !== null && Number.isFinite(Number(lastUsedStep)) && step <= Number(lastUsedStep)) {
      continue;
    }
    const expected = hotp(secretBase32, step);
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized));
    if (ok) return { valid: true, step };
  }
  return { valid: false };
}

function normalizeBackupCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatBackupCode(raw) {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function generateBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    formatBackupCode(base64url(crypto.randomBytes(6)).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8).padEnd(8, "7")),
  );
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(normalizeBackupCode(code), 10)));
}

async function getMfaRecord(userId) {
  const { rows } = await db.query(
    `SELECT *
     FROM admin_mfa_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function isMfaEnabled(userId) {
  const record = await getMfaRecord(userId);
  return Boolean(record?.totp_enabled && record?.totp_secret_encrypted);
}

function buildOtpAuthUrl({ email, secret }) {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

async function createSetupChallenge(user) {
  const secret = base32Encode(crypto.randomBytes(20));
  const encrypted = encryptSecret(secret);
  await db.query(
    `INSERT INTO admin_mfa_settings (user_id, pending_secret_encrypted, totp_enabled, updated_at)
     VALUES ($1, $2, FALSE, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET pending_secret_encrypted = EXCLUDED.pending_secret_encrypted,
                   updated_at = NOW()`,
    [user.id, encrypted],
  );

  const otpauthUrl = buildOtpAuthUrl({ email: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });

  return {
    issuer: ISSUER,
    accountName: user.email,
    manualKey: secret,
    otpauthUrl,
    qrDataUrl,
  };
}

async function confirmSetup(user, code) {
  const record = await getMfaRecord(user.id);
  if (!record?.pending_secret_encrypted) {
    return { success: false, message: "Chưa có mã QR cần xác nhận." };
  }

  const secret = decryptSecret(record.pending_secret_encrypted);
  const verified = verifyTotpCode(secret, code, null);
  if (!verified.valid) {
    return { success: false, message: "Mã Microsoft Authenticator không đúng." };
  }

  const backupCodes = generateBackupCodes();
  const backupCodeHashes = await hashBackupCodes(backupCodes);
  await db.query(
    `UPDATE admin_mfa_settings
     SET totp_secret_encrypted = $2,
         pending_secret_encrypted = NULL,
         backup_codes_hash = $3::jsonb,
         totp_enabled = TRUE,
         confirmed_at = NOW(),
         last_totp_step = $4,
         updated_at = NOW()
     WHERE user_id = $1`,
    [user.id, encryptSecret(secret), JSON.stringify(backupCodeHashes), verified.step],
  );

  return { success: true, backupCodes };
}

async function verifyLoginCode(user, code) {
  const record = await getMfaRecord(user.id);
  if (!record?.totp_enabled || !record?.totp_secret_encrypted) {
    return { success: false, setupRequired: true, message: "Admin chưa bật Microsoft Authenticator." };
  }

  const backupInput = normalizeBackupCode(code);
  const backupHashes = Array.isArray(record.backup_codes_hash) ? record.backup_codes_hash : [];
  if (backupInput.length >= 8 && backupHashes.length > 0) {
    for (let index = 0; index < backupHashes.length; index++) {
      // eslint-disable-next-line no-await-in-loop
      const match = await bcrypt.compare(backupInput, backupHashes[index]);
      if (match) {
        const nextHashes = backupHashes.filter((_, i) => i !== index);
        await db.query(
          `UPDATE admin_mfa_settings
           SET backup_codes_hash = $2::jsonb, updated_at = NOW()
           WHERE user_id = $1`,
          [user.id, JSON.stringify(nextHashes)],
        );
        return { success: true, usedBackupCode: true, remainingBackupCodes: nextHashes.length };
      }
    }
  }

  const secret = decryptSecret(record.totp_secret_encrypted);
  const verified = verifyTotpCode(secret, code, record.last_totp_step);
  if (!verified.valid) {
    return { success: false, message: "Mã Microsoft Authenticator không đúng hoặc đã được dùng." };
  }

  await db.query(
    `UPDATE admin_mfa_settings
     SET last_totp_step = $2, updated_at = NOW()
     WHERE user_id = $1`,
    [user.id, verified.step],
  );
  return { success: true };
}

async function resetMfaForUser(userId) {
  await db.query(
    `DELETE FROM admin_mfa_settings WHERE user_id = $1`,
    [userId],
  );
}

module.exports = {
  createSetupChallenge,
  confirmSetup,
  getMfaRecord,
  isMfaEnabled,
  resetMfaForUser,
  verifyLoginCode,
};
