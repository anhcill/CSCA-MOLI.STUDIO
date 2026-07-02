const db = require("../config/database");

const toLimit = (value, fallback = 20, max = 50) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const normalizeEntityType = (type) => {
  if (["question", "material", "vocabulary", "exam"].includes(type)) return type;
  const error = new Error("Invalid bookmark type");
  error.statusCode = 400;
  throw error;
};

const SUBJECT_CONTENT_SLUG_BY_CODE = {
  MATH: "toan",
  PHYSICS: "vat-ly",
  CHEMISTRY: "hoa-hoc",
  CHINESE: "tieng-trung-xh",
  CHINESE_SOC: "tieng-trung-xh",
  CHINESE_SCI: "tieng-trung-tn",
};

const normalizeSubjectCode = (subjectCode) => {
  const normalized = String(subjectCode || "").trim().toUpperCase();
  return normalized || null;
};

const getContentSubjectSlug = (subjectCode) => {
  const normalized = normalizeSubjectCode(subjectCode);
  if (!normalized) return null;
  return SUBJECT_CONTENT_SLUG_BY_CODE[normalized] || String(subjectCode || "").trim();
};

const normalizePracticeScope = (scope) => {
  if (typeof scope === "string") {
    return { subjectCode: normalizeSubjectCode(scope), examId: null };
  }

  return {
    subjectCode: normalizeSubjectCode(scope?.subjectCode || scope?.subject),
    examId: Number(scope?.examId || scope?.exam_id) || null,
  };
};

async function resolvePracticeSubject(userId, scope = null) {
  const { subjectCode, examId } = normalizePracticeScope(scope);

  if (examId) {
    const result = await db.query(
      `
        SELECT s.id, s.code, s.name
        FROM exams e
        JOIN subjects s ON s.id = e.subject_id
        JOIN exam_attempts ea ON ea.exam_id = e.id
          AND ea.user_id = $2
          AND ea.status = 'completed'
        WHERE e.id = $1
        ORDER BY ea.submit_time DESC NULLS LAST
        LIMIT 1
      `,
      [examId, userId],
    );
    return result.rows[0] || null;
  }

  if (subjectCode) {
    const result = await db.query(
      `SELECT id, code, name FROM subjects WHERE code = $1 LIMIT 1`,
      [subjectCode],
    );
    return result.rows[0] || { id: null, code: subjectCode, name: subjectCode };
  }

  return null;
}

async function getWeakTopics(userId, limit = 5, subjectCode = null) {
  const params = [userId, limit];
  const subjectFilter = subjectCode ? "AND s.code = $3" : "";
  if (subjectCode) params.push(subjectCode);

  const result = await db.query(
    `
      SELECT
        uts.topic_id,
        qt.name AS topic_name,
        qt.name_cn AS topic_name_cn,
        s.id AS subject_id,
        s.code AS subject_code,
        s.name AS subject_name,
        uts.total_questions,
        uts.correct_answers,
        uts.incorrect_answers,
        uts.error_percentage
      FROM user_topic_stats uts
      JOIN question_topics qt ON qt.id = uts.topic_id
      JOIN subjects s ON s.id = uts.subject_id
      WHERE uts.user_id = $1
        AND uts.total_questions >= 2
        AND uts.error_percentage >= 35
        ${subjectFilter}
      ORDER BY uts.error_percentage DESC, uts.incorrect_answers DESC
      LIMIT $2
    `,
    params,
  );
  return result.rows;
}

async function getWrongQuestionIds(userId, limit = 20, subjectCode = null) {
  const normalizedSubjectCode = normalizeSubjectCode(subjectCode);
  const params = [userId];
  const subjectJoin = normalizedSubjectCode ? "JOIN exams e ON e.id = ea.exam_id JOIN subjects s ON s.id = e.subject_id" : "";
  const subjectFilter = normalizedSubjectCode ? `AND s.code = $${params.length + 1}` : "";
  if (normalizedSubjectCode) params.push(normalizedSubjectCode);
  params.push(toLimit(limit));

  const result = await db.query(
    `
      WITH latest_wrong AS (
        SELECT
          q.id,
          MAX(ea.submit_time) AS last_seen_at
        FROM user_answers ua
        JOIN exam_attempts ea ON ea.id = ua.attempt_id
        ${subjectJoin}
        JOIN questions q ON q.id = ua.question_id
        WHERE ea.user_id = $1
          AND ea.status = 'completed'
          AND ua.is_correct = FALSE
          AND q.deleted_at IS NULL
          ${subjectFilter}
        GROUP BY q.id
      )
      SELECT id
      FROM latest_wrong
      ORDER BY last_seen_at DESC NULLS LAST
      LIMIT $${params.length}
    `,
    params,
  );
  return result.rows.map((row) => Number(row.id));
}

async function getWrongQuestions(userId, limit = 20) {
  const result = await db.query(
    `
      WITH latest_wrong AS (
        SELECT DISTINCT ON (q.id)
          q.id AS question_id,
          ua.attempt_id,
          ua.selected_answer_key,
          ua.time_spent_seconds,
          ea.exam_id,
          ea.submit_time,
          e.title AS exam_title,
          s.name AS subject_name,
          s.code AS subject_code
        FROM user_answers ua
        JOIN exam_attempts ea ON ea.id = ua.attempt_id
        JOIN questions q ON q.id = ua.question_id
        JOIN exams e ON e.id = ea.exam_id
        JOIN subjects s ON s.id = e.subject_id
        WHERE ea.user_id = $1
          AND ea.status = 'completed'
          AND ua.is_correct = FALSE
          AND q.deleted_at IS NULL
        ORDER BY q.id, ea.submit_time DESC
      )
      SELECT
        lw.*,
        q.question_number,
        q.question_text,
        q.question_text_cn,
        q.difficulty,
        q.question_category,
        q.explanation,
        ca.answer_key AS correct_answer_key,
        ca.answer_text AS correct_answer_text,
        n.note,
        (b.id IS NOT NULL) AS is_bookmarked
      FROM latest_wrong lw
      JOIN questions q ON q.id = lw.question_id
      LEFT JOIN answers ca ON ca.question_id = q.id AND ca.is_correct = TRUE
      LEFT JOIN user_question_notes n ON n.user_id = $1 AND n.question_id = q.id
      LEFT JOIN user_bookmarks b ON b.user_id = $1 AND b.entity_type = 'question' AND b.entity_id = q.id
      ORDER BY lw.submit_time DESC
      LIMIT $2
    `,
    [userId, toLimit(limit)],
  );
  return result.rows;
}

async function getQuestionDetails(userId, questionIds) {
  if (!questionIds.length) return [];

  const result = await db.query(
    `
      SELECT
        q.id,
        q.exam_id,
        q.question_number,
        q.question_text,
        q.question_text_cn,
        q.question_type,
        q.question_category,
        q.points,
        q.difficulty,
        q.image_url,
        q.explanation,
        e.title AS exam_title,
        s.name AS subject_name,
        s.code AS subject_code,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'answer_key', a.answer_key,
              'answer_text', a.answer_text,
              'answer_text_cn', a.answer_text_cn,
              'is_correct', a.is_correct
            )
            ORDER BY a.answer_key
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS answers,
        n.note,
        (b.id IS NOT NULL) AS is_bookmarked
      FROM questions q
      JOIN exams e ON e.id = q.exam_id
      JOIN subjects s ON s.id = e.subject_id
      LEFT JOIN answers a ON a.question_id = q.id
      LEFT JOIN user_question_notes n ON n.user_id = $1 AND n.question_id = q.id
      LEFT JOIN user_bookmarks b ON b.user_id = $1 AND b.entity_type = 'question' AND b.entity_id = q.id
      WHERE q.id = ANY($2::int[])
        AND q.deleted_at IS NULL
      GROUP BY q.id, e.id, s.id, n.note, b.id
      ORDER BY array_position($2::int[], q.id)
    `,
    [userId, questionIds],
  );
  return result.rows;
}

async function createWrongQuestionPractice(userId, limit = 20, scope = null) {
  const subject = await resolvePracticeSubject(userId, scope);
  const subjectCode = subject?.code || normalizePracticeScope(scope).subjectCode;
  const ids = await getWrongQuestionIds(userId, toLimit(limit), subjectCode);
  if (!ids.length) {
    const error = new Error("No wrong questions found");
    error.statusCode = 404;
    throw error;
  }

  const subjectName = subject?.name || null;
  const title = subjectName
    ? `Luyện lại ${ids.length} câu sai môn ${subjectName}`
    : `Luyện lại ${ids.length} câu sai`;
  const description = subjectName
    ? `Gom những câu bạn từng làm sai trong các đề ${subjectName}. Luyện lại cho chắc tay nhé.`
    : "Gom những câu bạn từng làm sai gần đây. Luyện lại cho chắc tay nhé.";

  const result = await db.query(
    `
      INSERT INTO user_practice_sets (user_id, set_type, title, description, subject_id, question_ids)
      VALUES ($1, 'wrong_questions', $2, $3, $4, $5::int[])
      RETURNING *
    `,
    [
      userId,
      title,
      description,
      subject?.id || null,
      ids,
    ],
  );
  return result.rows[0];
}

async function createPracticeSet({
  userId,
  setType,
  title,
  description,
  questionIds,
  subjectId = null,
  sourceTopicId = null,
}) {
  const result = await db.query(
    `
      INSERT INTO user_practice_sets (
        user_id, set_type, title, description, subject_id, source_topic_id, question_ids
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::int[])
      RETURNING *
    `,
    [userId, setType, title, description, subjectId, sourceTopicId, questionIds],
  );
  return result.rows[0];
}

async function getSubjectPracticeQuestionIds(userId, subjectId, limit = 20) {
  if (!subjectId) return [];
  const result = await db.query(
    `
      SELECT q.id
      FROM questions q
      JOIN exams e ON e.id = q.exam_id
      LEFT JOIN user_answers ua ON ua.question_id = q.id
      LEFT JOIN exam_attempts ea ON ea.id = ua.attempt_id AND ea.user_id = $1
      WHERE e.subject_id = $2
        AND q.deleted_at IS NULL
      GROUP BY q.id
      ORDER BY
        COUNT(*) FILTER (WHERE ua.is_correct = FALSE) DESC,
        MAX(ea.submit_time) DESC NULLS LAST,
        random()
      LIMIT $3
    `,
    [userId, subjectId, toLimit(limit)],
  );
  return result.rows.map((row) => Number(row.id));
}

async function createWeakTopicPractice(userId, topicId, limit = 20, subjectCode = null) {
  const weakTopics = await getWeakTopics(userId, 20, subjectCode);
  const target = weakTopics.find((topic) => Number(topic.topic_id) === Number(topicId)) || weakTopics[0];
  if (!target) {
    const fallbackIds = await getWrongQuestionIds(userId, toLimit(limit), subjectCode);
    if (fallbackIds.length) {
      return createPracticeSet({
        userId,
        setType: "weak_topic",
        title: `De luyen chu de can on`,
        description: "Chua du du lieu chu de yeu, he thong tam lay cac cau ban hay sai gan day.",
        questionIds: fallbackIds,
      });
    }

    const error = new Error("No weak topic found");
    error.statusCode = 404;
    throw error;
  }

  const questions = await db.query(
    `
      SELECT q.id
      FROM questions q
      JOIN question_topic_mapping qtm ON qtm.question_id = q.id
      LEFT JOIN user_answers ua ON ua.question_id = q.id
      LEFT JOIN exam_attempts ea ON ea.id = ua.attempt_id AND ea.user_id = $1
      WHERE qtm.topic_id = $2
        AND q.deleted_at IS NULL
      GROUP BY q.id
      ORDER BY
        COUNT(*) FILTER (WHERE ua.is_correct = FALSE) DESC,
        random()
      LIMIT $3
    `,
    [userId, target.topic_id, toLimit(limit)],
  );
  let ids = questions.rows.map((row) => Number(row.id));
  if (!ids.length) {
    ids = await getWrongQuestionIds(userId, toLimit(limit), target.subject_code);
  }
  if (!ids.length) {
    ids = await getSubjectPracticeQuestionIds(userId, target.subject_id, limit);
  }
  if (!ids.length) {
    const error = new Error("No questions for weak topic");
    error.statusCode = 404;
    throw error;
  }

  return createPracticeSet({
    userId,
    setType: "weak_topic",
    title: `De luyen chu de yeu: ${target.topic_name}`,
    description: `Tap trung chu de ${target.topic_name} (${Number(target.error_percentage).toFixed(1)}% ti le sai).`,
    subjectId: target.subject_id,
    sourceTopicId: target.topic_id,
    questionIds: ids,
  });
}

async function getPracticeSet(userId, setId) {
  const setResult = await db.query(
    `SELECT * FROM user_practice_sets WHERE id = $1 AND user_id = $2`,
    [setId, userId],
  );
  if (!setResult.rows.length) {
    const error = new Error("Practice set not found");
    error.statusCode = 404;
    throw error;
  }
  const set = setResult.rows[0];
  const questions = await getQuestionDetails(userId, set.question_ids.map(Number));
  return { ...set, questions };
}

async function upsertBookmark(userId, payload) {
  const entityType = normalizeEntityType(payload.entity_type);
  const entityId = Number(payload.entity_id);
  if (!entityId) {
    const error = new Error("Invalid bookmark entity");
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `
      INSERT INTO user_bookmarks (user_id, entity_type, entity_id, title, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, entity_type, entity_id)
      DO UPDATE SET title = COALESCE(EXCLUDED.title, user_bookmarks.title),
                    metadata = EXCLUDED.metadata,
                    created_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [userId, entityType, entityId, payload.title || null, payload.metadata || {}],
  );
  return result.rows[0];
}

async function deleteBookmark(userId, entityType, entityId) {
  normalizeEntityType(entityType);
  await db.query(
    `DELETE FROM user_bookmarks WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [userId, entityType, Number(entityId)],
  );
}

async function listBookmarks(userId, type) {
  const params = [userId];
  let where = "WHERE b.user_id = $1";
  if (type) {
    normalizeEntityType(type);
    params.push(type);
    where += ` AND b.entity_type = $${params.length}`;
  }

  const result = await db.query(
    `
      SELECT b.*
      FROM user_bookmarks b
      ${where}
      ORDER BY b.created_at DESC
      LIMIT 100
    `,
    params,
  );
  return result.rows;
}

async function upsertQuestionNote(userId, questionId, note, sourceAttemptId = null) {
  const text = String(note || "").trim();
  const result = await db.query(
    `
      INSERT INTO user_question_notes (user_id, question_id, source_attempt_id, note)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, question_id)
      DO UPDATE SET note = EXCLUDED.note,
                    source_attempt_id = COALESCE(EXCLUDED.source_attempt_id, user_question_notes.source_attempt_id),
                    updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [userId, Number(questionId), sourceAttemptId ? Number(sourceAttemptId) : null, text],
  );
  return result.rows[0];
}

async function listQuestionNotes(userId) {
  const result = await db.query(
    `
      SELECT n.*, q.question_number, q.question_text, e.id AS exam_id, e.title AS exam_title
      FROM user_question_notes n
      JOIN questions q ON q.id = n.question_id
      JOIN exams e ON e.id = q.exam_id
      WHERE n.user_id = $1
        AND q.deleted_at IS NULL
      ORDER BY n.updated_at DESC
      LIMIT 100
    `,
    [userId],
  );
  return result.rows;
}

async function getNextLessons(userId, subjectCode = null) {
  const weakTopics = await getWeakTopics(userId, 5, subjectCode);
  if (!weakTopics.length) return [];

  const subjectCodes = weakTopics.map((topic) => topic.subject_code);
  const contentSubjects = weakTopics.map((topic) => getContentSubjectSlug(topic.subject_code)).filter(Boolean);
  const topicNames = weakTopics.map((topic) => topic.topic_name);
  const params = [subjectCodes, contentSubjects, topicNames];
  const materials = await db.query(
    `
      SELECT id, title, description, category, subject, topic, file_type, is_premium
      FROM materials
      WHERE is_active = TRUE
        AND (subject = ANY($1::text[]) OR subject = ANY($2::text[]) OR topic = ANY($3::text[]))
      ORDER BY created_at DESC
      LIMIT 12
    `,
    params,
  );

  const vocabulary = await db.query(
    `
      SELECT subject, topic, COUNT(*)::int AS word_count
      FROM vocabulary_items
      WHERE is_active = TRUE
        AND (subject = ANY($1::text[]) OR subject = ANY($2::text[]) OR topic = ANY($3::text[]))
      GROUP BY subject, topic
      ORDER BY word_count DESC
      LIMIT 8
    `,
    params,
  );

  return weakTopics.map((topic) => ({
    topicId: topic.topic_id,
    topicName: topic.topic_name,
    subjectCode: topic.subject_code,
    subjectName: topic.subject_name,
    errorPercentage: Number(topic.error_percentage),
    materials: materials.rows
      .filter((m) => m.topic === topic.topic_name || m.subject === topic.subject_code || m.subject === getContentSubjectSlug(topic.subject_code))
      .slice(0, 3),
    vocabulary: vocabulary.rows
      .filter((v) => v.topic === topic.topic_name || v.subject === topic.subject_code || v.subject === getContentSubjectSlug(topic.subject_code))
      .slice(0, 2),
  }));
}

async function getActionSummary(userId, subjectCode = null) {
  const wrongParams = [userId];
  let subjectJoin = "";
  let subjectFilter = "";
  if (subjectCode) {
    wrongParams.push(subjectCode);
    subjectJoin = "JOIN exams e ON e.id = ea.exam_id JOIN subjects s ON s.id = e.subject_id";
    subjectFilter = `AND s.code = $${wrongParams.length}`;
  }
  const normalizedSubjectCode = normalizeSubjectCode(subjectCode);
  const contentSubject = getContentSubjectSlug(subjectCode);

  const [weakTopics, wrongCount, bookmarks, notes, nextLessons] = await Promise.all([
    getWeakTopics(userId, 5, subjectCode),
    db.query(
      `
        SELECT COUNT(DISTINCT ua.question_id)::int AS count
        FROM user_answers ua
        JOIN exam_attempts ea ON ea.id = ua.attempt_id
        ${subjectJoin}
        JOIN questions q ON q.id = ua.question_id
        WHERE ea.user_id = $1
          AND ea.status = 'completed'
          AND ua.is_correct = FALSE
          AND q.deleted_at IS NULL
          ${subjectFilter}
      `,
      wrongParams,
    ),
    normalizedSubjectCode
      ? db.query(
        `
          SELECT COUNT(*)::int AS count
          FROM user_bookmarks b
          WHERE b.user_id = $1
            AND (
              (b.entity_type = 'question' AND EXISTS (
                SELECT 1
                FROM questions q
                JOIN exams e ON e.id = q.exam_id
                JOIN subjects s ON s.id = e.subject_id
                WHERE q.id = b.entity_id AND s.code = $2
              ))
              OR (b.entity_type = 'exam' AND EXISTS (
                SELECT 1
                FROM exams e
                JOIN subjects s ON s.id = e.subject_id
                WHERE e.id = b.entity_id AND s.code = $2
              ))
              OR (b.entity_type = 'material' AND EXISTS (
                SELECT 1
                FROM materials m
                WHERE m.id = b.entity_id AND (m.subject = $2 OR m.subject = $3)
              ))
              OR (b.entity_type = 'vocabulary' AND EXISTS (
                SELECT 1
                FROM vocabulary_items v
                WHERE v.id = b.entity_id AND (v.subject = $2 OR v.subject = $3)
              ))
            )
        `,
        [userId, normalizedSubjectCode, contentSubject],
      )
      : db.query(`SELECT COUNT(*)::int AS count FROM user_bookmarks WHERE user_id = $1`, [userId]),
    normalizedSubjectCode
      ? db.query(
        `
          SELECT COUNT(*)::int AS count
          FROM user_question_notes n
          JOIN questions q ON q.id = n.question_id
          JOIN exams e ON e.id = q.exam_id
          JOIN subjects s ON s.id = e.subject_id
          WHERE n.user_id = $1 AND s.code = $2
        `,
        [userId, normalizedSubjectCode],
      )
      : db.query(`SELECT COUNT(*)::int AS count FROM user_question_notes WHERE user_id = $1`, [userId]),
    getNextLessons(userId, subjectCode),
  ]);

  return {
    wrongQuestionCount: wrongCount.rows[0]?.count || 0,
    weakTopics,
    bookmarkCount: bookmarks.rows[0]?.count || 0,
    noteCount: notes.rows[0]?.count || 0,
    nextLessons,
  };
}

module.exports = {
  getActionSummary,
  getWrongQuestions,
  createWrongQuestionPractice,
  createWeakTopicPractice,
  getPracticeSet,
  upsertBookmark,
  deleteBookmark,
  listBookmarks,
  upsertQuestionNote,
  listQuestionNotes,
  getNextLessons,
};

