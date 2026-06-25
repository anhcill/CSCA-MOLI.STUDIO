const db = require('../config/database');
const aiService = require('./aiService');

const GENERATING_SOURCE = 'generating';
const POLL_ATTEMPTS = 16;
const POLL_INTERVAL_MS = 500;
const STALE_GENERATION_MS = 2 * 60 * 1000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function getRecentLetters(giftDate) {
  const result = await db.query(
    `SELECT title, encouragement, study_reminder, blessing
     FROM daily_gift_letters
     WHERE gift_date < $1
       AND COALESCE(source_model, '') <> $2
     ORDER BY gift_date DESC
     LIMIT 7`,
    [giftDate, GENERATING_SOURCE],
  );
  return result.rows;
}

async function insertPlaceholder(giftDate) {
  const fallback = aiService.getDailyGiftFallback(giftDate);
  const result = await db.query(
    `INSERT INTO daily_gift_letters (
       gift_date, title, greeting, encouragement, study_reminder,
       blessing, mood, source_model, raw_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (gift_date) DO NOTHING
     RETURNING *`,
    [
      giftDate,
      fallback.title,
      fallback.greeting,
      fallback.encouragement,
      fallback.study_reminder,
      fallback.blessing,
      fallback.mood,
      GENERATING_SOURCE,
      JSON.stringify({ status: GENERATING_SOURCE, giftDate }),
    ],
  );
  return result.rows[0] || null;
}

async function saveGeneratedLetter(giftDate, letter) {
  const result = await db.query(
    `UPDATE daily_gift_letters
     SET title = $2,
         greeting = $3,
         encouragement = $4,
         study_reminder = $5,
         blessing = $6,
         mood = $7,
         source_model = $8,
         raw_payload = $9::jsonb,
         updated_at = NOW()
     WHERE gift_date = $1
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

async function generateAndStore(giftDate) {
  const recentLetters = await getRecentLetters(giftDate);
  const generated = await aiService.generateDailyGiftLetter(giftDate, { recentLetters });
  const saved = await saveGeneratedLetter(giftDate, generated);
  return mapLetter(saved) || mapLetter(await findLetter(giftDate));
}

function isGenerating(row) {
  return row?.source_model === GENERATING_SOURCE;
}

function isStaleGenerating(row) {
  if (!isGenerating(row)) return false;
  const updatedAt = new Date(row.updated_at || row.created_at || 0).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_GENERATION_MS;
}

async function waitForGeneratedLetter(giftDate) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await wait(POLL_INTERVAL_MS);
    const row = await findLetter(giftDate);
    if (row && !isGenerating(row)) return mapLetter(row);
  }
  return null;
}

async function getOrCreateDailyGiftLetter(giftDate = getVietnamDateKey()) {
  let existing = await findLetter(giftDate);
  if (existing && !isGenerating(existing)) return mapLetter(existing);

  if (!existing) {
    const inserted = await insertPlaceholder(giftDate);
    if (inserted) return generateAndStore(giftDate);
    existing = await findLetter(giftDate);
  }

  if (isStaleGenerating(existing)) {
    return generateAndStore(giftDate);
  }

  const generated = await waitForGeneratedLetter(giftDate);
  return generated || mapLetter(existing);
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
