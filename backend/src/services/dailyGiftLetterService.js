const db = require('../config/database');
const {
  CURATED_DAILY_GIFT_SOURCE,
  getCuratedDailyGiftLetter,
} = require('./dailyGiftLetterBank');

let letterCache = null;
let letterCacheDate = null;
let letterRequest = null;

function getVietnamDateKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDateValue(value) {
  if (!value) return getVietnamDateKey();
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return getVietnamDateKey(value);
  return String(value).slice(0, 10);
}

function mapLetter(row) {
  if (!row) return null;
  return {
    id: row.id,
    gift_date: formatDateValue(row.gift_date),
    title: row.title,
    greeting: row.greeting,
    encouragement: row.encouragement,
    study_reminder: row.study_reminder,
    blessing: row.blessing,
    mood: row.mood,
    source_model: row.source_model,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findLetter(giftDate) {
  const result = await db.query(
    `SELECT *
     FROM daily_gift_letters
     WHERE gift_date = $1
     LIMIT 1`,
    [giftDate],
  );
  return result.rows[0] || null;
}

async function upsertCuratedLetter(giftDate) {
  const letter = getCuratedDailyGiftLetter(giftDate);
  const result = await db.query(
    `INSERT INTO daily_gift_letters (
       gift_date, title, greeting, encouragement, study_reminder,
       blessing, mood, source_model, raw_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (gift_date) DO UPDATE
       SET title = EXCLUDED.title,
           greeting = EXCLUDED.greeting,
           encouragement = EXCLUDED.encouragement,
           study_reminder = EXCLUDED.study_reminder,
           blessing = EXCLUDED.blessing,
           mood = EXCLUDED.mood,
           source_model = EXCLUDED.source_model,
           raw_payload = EXCLUDED.raw_payload,
           updated_at = NOW()
     RETURNING *`,
    [
      giftDate,
      letter.title,
      letter.greeting,
      letter.encouragement,
      letter.study_reminder,
      letter.blessing,
      letter.mood,
      letter.source_model,
      JSON.stringify(letter.raw_payload || {}),
    ],
  );
  return result.rows[0] || null;
}

async function getOrCreateDailyGiftLetter(giftDate = getVietnamDateKey()) {
  if (letterCacheDate === giftDate && letterCache) return letterCache;
  if (letterRequest?.giftDate === giftDate) return letterRequest.promise;

  const promise = (async () => {
    const existing = await findLetter(giftDate);
    const letter = existing?.source_model === CURATED_DAILY_GIFT_SOURCE
      ? mapLetter(existing)
      : mapLetter(await upsertCuratedLetter(giftDate));
    letterCacheDate = giftDate;
    letterCache = letter;
    return letter;
  })();
  letterRequest = { giftDate, promise };
  try {
    return await promise;
  } finally {
    if (letterRequest?.promise === promise) letterRequest = null;
  }
}

async function hasOpened(userId, giftDate = getVietnamDateKey()) {
  const result = await db.query(
    `SELECT 1
     FROM daily_gift_letter_opens
     WHERE user_id = $1 AND gift_date = $2
     LIMIT 1`,
    [userId, giftDate],
  );
  return result.rows.length > 0;
}

async function markOpened(userId, giftDate = getVietnamDateKey()) {
  await db.query(
    `INSERT INTO daily_gift_letter_opens (user_id, gift_date)
     VALUES ($1, $2)
     ON CONFLICT (user_id, gift_date) DO UPDATE
       SET opened_at = daily_gift_letter_opens.opened_at`,
    [userId, giftDate],
  );
}

module.exports = {
  getVietnamDateKey,
  getOrCreateDailyGiftLetter,
  hasOpened,
  markOpened,
};
