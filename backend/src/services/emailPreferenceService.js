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

function verifyBrevoWebhookSecret(value) {
  const secret = String(process.env.BREVO_WEBHOOK_SECRET || '');
  const provided = String(value || '');
  if (secret.length < 32 || provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}

async function recordBrevoEvents(payload) {
  const events = Array.isArray(payload) ? payload : [payload];
  let recorded = 0;

  for (const item of events) {
    const email = String(item?.email || '').trim().toLowerCase().slice(0, 320);
    const event = String(item?.event || '');
    const reason = {
      unsubscribe: 'unsubscribe',
      unsubscribed: 'unsubscribe',
      hard_bounce: 'hard_bounce',
      hardBounce: 'hard_bounce',
      spam: 'complaint',
    }[event];
    if (!email || !email.includes('@') || !reason) continue;

    await pool.query(
      `INSERT INTO email_suppressions
         (email, reason, source, details, updated_at)
       VALUES ($1, $2, 'brevo_marketing', $3::jsonb, NOW())
       ON CONFLICT (email) DO UPDATE
         SET reason = EXCLUDED.reason,
             source = EXCLUDED.source,
             details = EXCLUDED.details,
             updated_at = NOW()`,
      [
        email,
        reason,
        JSON.stringify({
          event,
          campaignId: item?.camp_id || item?.campaign_id || null,
          eventTimestamp: item?.ts_event || item?.ts || null,
        }),
      ],
    );

    if (reason === 'unsubscribe') {
      await pool.query(
        `INSERT INTO user_email_preferences
           (user_id, marketing_enabled, unsubscribed_at, unsubscribe_source, updated_at)
         SELECT id, FALSE, NOW(), 'brevo_marketing', NOW()
         FROM users
         WHERE LOWER(email) = $1
         ON CONFLICT (user_id) DO UPDATE
           SET marketing_enabled = FALSE,
               unsubscribed_at = COALESCE(user_email_preferences.unsubscribed_at, NOW()),
               unsubscribe_source = EXCLUDED.unsubscribe_source,
               updated_at = NOW()`,
        [email],
      );
    }
    recorded += 1;
  }

  return recorded;
}

module.exports = {
  createUnsubscribeToken,
  parseUnsubscribeToken,
  unsubscribeByToken,
  verifyBrevoWebhookSecret,
  recordBrevoEvents,
};
