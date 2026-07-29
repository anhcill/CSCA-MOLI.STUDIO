const crypto = require('crypto');
const pool = require('../config/database');

const TOKEN_VERSION = 'v1';

function getTokenSecret() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET is not configured');
  }
  return secret;
}

function sign(value) {
  return crypto
    .createHmac('sha256', getTokenSecret())
    .update(value)
    .digest('base64url');
}

function createUnsubscribeToken(userId) {
  const normalizedUserId = Number.parseInt(userId, 10);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error('Invalid unsubscribe user');
  }
  const payload = `${TOKEN_VERSION}.${normalizedUserId}`;
  return `${payload}.${sign(payload)}`;
}

function parseUnsubscribeToken(token) {
  const match = String(token || '').match(/^v1\.(\d+)\.([A-Za-z0-9_-]{43})$/);
  if (!match) return null;

  const payload = `${TOKEN_VERSION}.${match[1]}`;
  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(match[2]);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  const userId = Number.parseInt(match[1], 10);
  return Number.isInteger(userId) && userId > 0 ? { userId } : null;
}

async function unsubscribeByToken(token, source = 'one_click') {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) return null;

  const result = await pool.query(
    `INSERT INTO user_email_preferences
       (user_id, marketing_enabled, unsubscribed_at, unsubscribe_source, updated_at)
     SELECT id, FALSE, NOW(), $2, NOW()
     FROM users
     WHERE id = $1
     ON CONFLICT (user_id) DO UPDATE
       SET marketing_enabled = FALSE,
           unsubscribed_at = COALESCE(user_email_preferences.unsubscribed_at, NOW()),
           unsubscribe_source = EXCLUDED.unsubscribe_source,
           updated_at = NOW()
     RETURNING user_id, marketing_enabled, unsubscribed_at`,
    [parsed.userId, source],
  );

  return result.rows[0] || null;
}

module.exports = {
  createUnsubscribeToken,
  parseUnsubscribeToken,
  unsubscribeByToken,
};
