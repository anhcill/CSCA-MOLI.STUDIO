const db = require("../config/database");

const MIN_EASINESS = 1.3;
const DEFAULT_EASINESS = 2.5;

const clampQuality = (quality) => {
  const value = Number(quality);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
};

const toPositiveLimit = (value, fallback = 20, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const computeNextReview = (current, rawQuality) => {
  const quality = clampQuality(rawQuality);
  const easiness = Number(current?.easiness || DEFAULT_EASINESS);
  const previousRepetitions = Number(current?.repetitions || 0);
  const previousInterval = Number(current?.interval_days || 0);

  const nextEasiness = Math.max(
    MIN_EASINESS,
    easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (quality < 3) {
    return {
      quality,
      easiness: Number(nextEasiness.toFixed(2)),
      repetitions: 0,
      intervalDays: 1,
      lapses: Number(current?.lapses || 0) + 1,
      correctIncrement: 0,
      wrongIncrement: 1,
    };
  }

  const repetitions = previousRepetitions + 1;
  let intervalDays = 1;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(previousInterval * nextEasiness));

  return {
    quality,
    easiness: Number(nextEasiness.toFixed(2)),
    repetitions,
    intervalDays,
    lapses: Number(current?.lapses || 0),
    correctIncrement: 1,
    wrongIncrement: 0,
  };
};

const buildVocabularyWhere = ({ subject, topic, search, isVip }, params) => {
  const where = ["v.is_active = TRUE"];

  if (!isVip) {
    where.push("(v.is_premium = FALSE OR v.is_premium IS NULL)");
  }
  if (subject) {
    params.push(subject);
    where.push(`v.subject = $${params.length}`);
  }
  if (topic) {
    params.push(topic);
    where.push(`v.topic = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(v.word_cn ILIKE $${params.length} OR v.pinyin ILIKE $${params.length} OR v.word_vn ILIKE $${params.length})`);
  }

  return where.join(" AND ");
};

const getDashboard = async (userId, filters) => {
  const params = [userId];
  const where = buildVocabularyWhere(filters, params);

  const summary = await db.query(
    `
      SELECT
        COUNT(v.id)::int AS total_words,
        COUNT(r.id)::int AS started_words,
        COUNT(*) FILTER (WHERE r.due_at <= NOW())::int AS due_now,
        COUNT(*) FILTER (WHERE r.due_at <= date_trunc('day', NOW()) + INTERVAL '1 day')::int AS due_today,
        COUNT(*) FILTER (WHERE r.repetitions >= 4 AND r.interval_days >= 14)::int AS mastered_words,
        COUNT(*) FILTER (WHERE r.id IS NOT NULL AND (r.last_quality < 3 OR r.lapses > 0))::int AS weak_words,
        COUNT(*) FILTER (WHERE r.id IS NULL)::int AS new_words
      FROM vocabulary_items v
      LEFT JOIN vocabulary_user_reviews r
        ON r.vocabulary_id = v.id AND r.user_id = $1
      WHERE ${where}
    `,
    params,
  );

  const byTopic = await db.query(
    `
      SELECT
        v.subject,
        v.topic,
        COUNT(v.id)::int AS total_words,
        COUNT(r.id)::int AS started_words,
        COUNT(*) FILTER (WHERE r.due_at <= NOW())::int AS due_now,
        COUNT(*) FILTER (WHERE r.repetitions >= 4 AND r.interval_days >= 14)::int AS mastered_words,
        COUNT(*) FILTER (WHERE r.id IS NOT NULL AND (r.last_quality < 3 OR r.lapses > 0))::int AS weak_words
      FROM vocabulary_items v
      LEFT JOIN vocabulary_user_reviews r
        ON r.vocabulary_id = v.id AND r.user_id = $1
      WHERE ${where}
      GROUP BY v.subject, v.topic
      ORDER BY due_now DESC, weak_words DESC, total_words DESC
      LIMIT 20
    `,
    params,
  );

  return {
    summary: summary.rows[0],
    topics: byTopic.rows,
  };
};

const getReviewQueue = async (userId, filters) => {
  const limit = toPositiveLimit(filters.limit, 20, 50);
  const params = [userId];
  const where = buildVocabularyWhere(filters, params);
  params.push(limit);

  const result = await db.query(
    `
      SELECT
        v.id, v.word_cn, v.pinyin, v.word_vn, v.word_en, v.subject, v.topic,
        v.example_cn, v.example_vn, v.is_premium, v.vip_tier,
        r.easiness, r.interval_days, r.repetitions, r.lapses,
        r.last_quality, r.due_at, r.correct_count, r.wrong_count,
        CASE
          WHEN r.id IS NULL THEN 'new'
          WHEN r.due_at <= NOW() THEN 'due'
          ELSE 'scheduled'
        END AS review_state
      FROM vocabulary_items v
      LEFT JOIN vocabulary_user_reviews r
        ON r.vocabulary_id = v.id AND r.user_id = $1
      WHERE ${where}
        AND (r.id IS NULL OR r.due_at <= NOW())
      ORDER BY
        CASE WHEN r.id IS NULL THEN 0 ELSE 1 END,
        r.due_at ASC NULLS FIRST,
        v.id ASC
      LIMIT $${params.length}
    `,
    params,
  );

  return result.rows;
};

const recordReview = async (userId, vocabularyId, quality) => {
  const currentResult = await db.query(
    `
      SELECT r.*, v.id AS vocab_exists
      FROM vocabulary_items v
      LEFT JOIN vocabulary_user_reviews r
        ON r.vocabulary_id = v.id AND r.user_id = $1
      WHERE v.id = $2 AND v.is_active = TRUE
      LIMIT 1
    `,
    [userId, vocabularyId],
  );

  if (currentResult.rows.length === 0) {
    const err = new Error("Vocabulary item not found");
    err.statusCode = 404;
    throw err;
  }

  const next = computeNextReview(currentResult.rows[0], quality);
  const saved = await db.query(
    `
      INSERT INTO vocabulary_user_reviews (
        user_id, vocabulary_id, easiness, interval_days, repetitions,
        lapses, last_quality, correct_count, wrong_count,
        last_reviewed_at, due_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        NOW(), NOW() + ($4 * INTERVAL '1 day'), NOW()
      )
      ON CONFLICT (user_id, vocabulary_id)
      DO UPDATE SET
        easiness = EXCLUDED.easiness,
        interval_days = EXCLUDED.interval_days,
        repetitions = EXCLUDED.repetitions,
        lapses = EXCLUDED.lapses,
        last_quality = EXCLUDED.last_quality,
        correct_count = vocabulary_user_reviews.correct_count + EXCLUDED.correct_count,
        wrong_count = vocabulary_user_reviews.wrong_count + EXCLUDED.wrong_count,
        last_reviewed_at = NOW(),
        due_at = EXCLUDED.due_at,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      vocabularyId,
      next.easiness,
      next.intervalDays,
      next.repetitions,
      next.lapses,
      next.quality,
      next.correctIncrement,
      next.wrongIncrement,
    ],
  );

  await db.query(
    `
      UPDATE user_quests
      SET progress = LEAST(progress + 1, target)
      WHERE user_id = $1
        AND quest_type = 'learn_vocab'
        AND date = CURRENT_DATE
        AND progress < target
    `,
    [userId],
  ).catch(() => {});

  return saved.rows[0];
};

const getMiniTest = async (userId, filters) => {
  const limit = toPositiveLimit(filters.limit, 10, 30);
  const params = [userId];
  const where = buildVocabularyWhere(filters, params);
  params.push(limit);

  const words = await db.query(
    `
      SELECT v.id, v.word_cn, v.pinyin, v.word_vn, v.word_en, v.subject, v.topic
      FROM vocabulary_items v
      LEFT JOIN vocabulary_user_reviews r
        ON r.vocabulary_id = v.id AND r.user_id = $1
      WHERE ${where}
      ORDER BY
        CASE
          WHEN r.id IS NOT NULL AND (r.last_quality < 3 OR r.lapses > 0) THEN 0
          WHEN r.id IS NULL THEN 1
          ELSE 2
        END,
        random()
      LIMIT $${params.length}
    `,
    params,
  );

  if (words.rows.length === 0) return [];

  const optionResult = await db.query(
    `
      SELECT id, word_vn
      FROM vocabulary_items
      WHERE is_active = TRUE
      ORDER BY random()
      LIMIT 100
    `,
  );

  return words.rows.map((word) => {
    const distractors = optionResult.rows
      .filter((option) => option.id !== word.id && option.word_vn !== word.word_vn)
      .slice(0, 3)
      .map((option) => option.word_vn);
    const choices = [word.word_vn, ...distractors].sort(() => Math.random() - 0.5);

    return {
      vocabulary_id: word.id,
      word_cn: word.word_cn,
      pinyin: word.pinyin,
      word_en: word.word_en || null,
      subject: word.subject,
      topic: word.topic,
      choices,
    };
  });
};

const submitMiniTest = async (userId, answers) => {
  if (!Array.isArray(answers) || answers.length === 0) return { score: 0, total: 0, results: [] };

  const ids = answers.map((answer) => Number(answer.vocabulary_id)).filter(Boolean);
  if (ids.length === 0) return { score: 0, total: 0, results: [] };

  const rows = await db.query(
    `
      SELECT id, word_cn, pinyin, word_vn
      FROM vocabulary_items
      WHERE id = ANY($1::int[]) AND is_active = TRUE
    `,
    [ids],
  );

  const byId = new Map(rows.rows.map((row) => [Number(row.id), row]));
  const results = [];
  let score = 0;

  for (const answer of answers) {
    const vocabularyId = Number(answer.vocabulary_id);
    const item = byId.get(vocabularyId);
    if (!item) continue;

    const selected = String(answer.answer || "").trim();
    const correct = selected === item.word_vn;
    if (correct) score += 1;
    await recordReview(userId, vocabularyId, correct ? 4 : 1);

    results.push({
      vocabulary_id: vocabularyId,
      word_cn: item.word_cn,
      pinyin: item.pinyin,
      selected,
      correct_answer: item.word_vn,
      correct,
    });
  }

  return { score, total: results.length, results };
};

const getAdminReviewStats = async () => {
  const summary = await db.query(
    `
      SELECT
        COUNT(DISTINCT r.user_id)::int AS active_learners,
        COUNT(r.id)::int AS tracked_words,
        COALESCE(SUM(r.correct_count + r.wrong_count), 0)::int AS total_reviews,
        COUNT(*) FILTER (WHERE r.due_at <= NOW())::int AS due_now,
        COUNT(*) FILTER (WHERE r.last_quality < 3 OR r.lapses > 0)::int AS weak_reviews,
        COUNT(*) FILTER (WHERE r.repetitions >= 4 AND r.interval_days >= 14)::int AS mastered_reviews
      FROM vocabulary_user_reviews r
    `,
  );

  const topics = await db.query(
    `
      SELECT
        v.subject,
        v.topic,
        COUNT(DISTINCT r.user_id)::int AS learners,
        COUNT(r.id)::int AS tracked_words,
        COUNT(*) FILTER (WHERE r.due_at <= NOW())::int AS due_now,
        COUNT(*) FILTER (WHERE r.last_quality < 3 OR r.lapses > 0)::int AS weak_words,
        COUNT(*) FILTER (WHERE r.repetitions >= 4 AND r.interval_days >= 14)::int AS mastered_words
      FROM vocabulary_user_reviews r
      JOIN vocabulary_items v ON v.id = r.vocabulary_id
      GROUP BY v.subject, v.topic
      ORDER BY weak_words DESC, due_now DESC, tracked_words DESC
      LIMIT 20
    `,
  );

  return { summary: summary.rows[0], topics: topics.rows };
};

module.exports = {
  getDashboard,
  getReviewQueue,
  recordReview,
  getMiniTest,
  submitMiniTest,
  getAdminReviewStats,
};
