const db = require("../config/database");
const coinService = require("./coinService");

function sanitizeQuestion(question) {
  const { correct_key, ...safe } = question;
  return safe;
}

function sanitizeQuestions(questions = []) {
  return questions.map(sanitizeQuestion);
}

function toModeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

async function listModes() {
  const result = await db.query(
    `SELECT id, slug, name, description, mode_type, is_active, entry_fee_coins,
            reward_coins, daily_reward_cap, question_count, time_limit_seconds,
            min_accuracy_reward, sort_order, config
     FROM game_modes
     ORDER BY sort_order ASC, id ASC`,
  );
  return result.rows;
}

async function getModeBySlug(slug) {
  const result = await db.query(
    `SELECT * FROM game_modes WHERE slug = $1 LIMIT 1`,
    [toModeSlug(slug)],
  );
  return result.rows[0] || null;
}

async function fetchQuizQuestions(limit, modeType) {
  const difficultyClause = modeType === "boss" ? "AND COALESCE(q.difficulty, 'medium') IN ('hard','advanced','medium')" : "";
  const result = await db.query(
    `
      SELECT q.id, q.question_text, q.question_text_cn, q.image_url,
             q.points, q.difficulty, e.title AS exam_title,
             json_agg(json_build_object(
               'key', a.answer_key,
               'text', a.answer_text,
               'text_cn', a.answer_text_cn,
               'image_url', a.image_url
             ) ORDER BY a.answer_key) AS answers,
             MAX(CASE WHEN a.is_correct THEN a.answer_key ELSE NULL END) AS correct_key
      FROM questions q
      JOIN answers a ON a.question_id = q.id
      LEFT JOIN exams e ON e.id = q.exam_id
      WHERE q.question_type IN ('single_choice', 'true_false', 'reading_item', 'fill_blank_item')
        ${difficultyClause}
      GROUP BY q.id, e.title
      HAVING COUNT(a.id) >= 2 AND MAX(CASE WHEN a.is_correct THEN 1 ELSE 0 END) = 1
      ORDER BY random()
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row, index) => ({
    ref: `q:${row.id}`,
    source: "question",
    index: index + 1,
    question_id: row.id,
    prompt: row.question_text,
    prompt_cn: row.question_text_cn,
    image_url: row.image_url,
    exam_title: row.exam_title,
    difficulty: row.difficulty || "medium",
    answers: row.answers || [],
    correct_key: String(row.correct_key || "").trim(),
  }));
}

async function fetchVocabularyQuestions(limit) {
  const words = await db.query(
    `SELECT id, word_cn, pinyin, word_vn, word_en, topic
     FROM vocabulary_items
     WHERE is_active = TRUE
     ORDER BY random()
     LIMIT $1`,
    [limit],
  );

  if (words.rows.length === 0) return [];

  const distractors = await db.query(
    `SELECT word_vn FROM vocabulary_items WHERE is_active = TRUE ORDER BY random() LIMIT $1`,
    [Math.max(40, limit * 4)],
  );
  const pool = distractors.rows.map((row) => row.word_vn).filter(Boolean);

  return words.rows.map((row, index) => {
    const choices = new Set([row.word_vn]);
    for (const item of pool) {
      if (choices.size >= 4) break;
      if (item !== row.word_vn) choices.add(item);
    }
    const answers = Array.from(choices)
      .sort(() => Math.random() - 0.5)
      .map((text, answerIndex) => ({
        key: String.fromCharCode(65 + answerIndex),
        text,
        text_cn: null,
        image_url: null,
      }));
    const correct = answers.find((answer) => answer.text === row.word_vn)?.key || "A";

    return {
      ref: `v:${row.id}`,
      source: "vocabulary",
      index: index + 1,
      vocabulary_id: row.id,
      prompt: row.word_cn,
      prompt_cn: row.pinyin,
      topic: row.topic,
      answers,
      correct_key: correct,
    };
  });
}

async function buildQuestions(mode) {
  const limit = Math.max(1, Math.min(Number(mode.question_count) || 10, 30));
  if (mode.mode_type === "vocabulary") {
    const vocab = await fetchVocabularyQuestions(limit);
    return vocab.length > 0 ? vocab : fetchQuizQuestions(limit, "quiz");
  }
  if (mode.mode_type === "mixed") {
    const vocabCount = Math.ceil(limit / 2);
    const quizCount = limit - vocabCount;
    const [quiz, vocab] = await Promise.all([
      fetchQuizQuestions(quizCount, "quiz"),
      fetchVocabularyQuestions(vocabCount),
    ]);
    return [...quiz, ...vocab].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, index: idx + 1 }));
  }
  return fetchQuizQuestions(limit, mode.mode_type);
}

async function startSession(userId, modeSlug) {
  const mode = await getModeBySlug(modeSlug);
  if (!mode || !mode.is_active) {
    const error = new Error("Mini game chưa sẵn sàng hoặc đã bị tắt");
    error.status = 404;
    throw error;
  }

  const questions = await buildQuestions(mode);
  if (questions.length === 0) {
    const error = new Error("Chưa có đủ dữ liệu câu hỏi cho mini game này");
    error.status = 409;
    throw error;
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    if (Number(mode.entry_fee_coins) > 0) {
      await coinService.debit(userId, Number(mode.entry_fee_coins), "game_entry", {
        description: `Vào chơi ${mode.name}`,
        metadata: { mode: mode.slug },
        client,
      });
    }

    const session = await client.query(
      `INSERT INTO game_sessions (
         user_id, mode_id, total_questions, question_payload, metadata
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING id, user_id, mode_id, status, total_questions, started_at`,
      [
        userId,
        mode.id,
        questions.length,
        JSON.stringify(questions),
        JSON.stringify({ time_limit_seconds: mode.time_limit_seconds }),
      ],
    );

    await client.query("COMMIT");

    return {
      session: session.rows[0],
      mode,
      questions: sanitizeQuestions(questions),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSessionForUser(sessionId, userId) {
  const result = await db.query(
    `SELECT gs.*, gm.slug, gm.name, gm.reward_coins, gm.daily_reward_cap,
            gm.min_accuracy_reward, gm.time_limit_seconds
     FROM game_sessions gs
     JOIN game_modes gm ON gm.id = gs.mode_id
     WHERE gs.id = $1 AND gs.user_id = $2`,
    [sessionId, userId],
  );
  return result.rows[0] || null;
}

async function answerQuestion(userId, sessionId, questionRef, answerKey, timeSpent = 0) {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) {
    const error = new Error("Không tìm thấy phiên chơi");
    error.status = 404;
    throw error;
  }
  if (session.status !== "active") {
    const error = new Error("Phiên chơi đã kết thúc");
    error.status = 409;
    throw error;
  }

  const questions = Array.isArray(session.question_payload) ? session.question_payload : [];
  const question = questions.find((item) => item.ref === questionRef);
  if (!question) {
    const error = new Error("Câu hỏi không thuộc phiên chơi này");
    error.status = 400;
    throw error;
  }

  const normalized = String(answerKey || "").trim();
  const isCorrect = normalized === String(question.correct_key || "").trim();

  await db.query(
    `INSERT INTO game_session_answers (session_id, question_ref, answer_key, is_correct, time_spent_seconds)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, question_ref)
     DO UPDATE SET answer_key = EXCLUDED.answer_key,
                   is_correct = EXCLUDED.is_correct,
                   time_spent_seconds = EXCLUDED.time_spent_seconds,
                   created_at = CURRENT_TIMESTAMP`,
    [sessionId, questionRef, normalized, isCorrect, Math.max(Number(timeSpent) || 0, 0)],
  );

  return {
    question_ref: questionRef,
    is_correct: isCorrect,
    correct_key: question.correct_key,
  };
}

function computeCombo(answers) {
  let current = 0;
  let best = 0;
  answers.forEach((answer) => {
    if (answer.is_correct) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
}

async function finishSession(userId, sessionId) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query(
      `SELECT gs.*, gm.slug, gm.name, gm.reward_coins, gm.daily_reward_cap,
              gm.min_accuracy_reward, gm.time_limit_seconds
       FROM game_sessions gs
       JOIN game_modes gm ON gm.id = gs.mode_id
       WHERE gs.id = $1 AND gs.user_id = $2
       FOR UPDATE`,
      [sessionId, userId],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      const error = new Error("Không tìm thấy phiên chơi");
      error.status = 404;
      throw error;
    }

    if (session.status === "completed") {
      await client.query("COMMIT");
      return { session, alreadyCompleted: true };
    }

    const answersResult = await client.query(
      `SELECT question_ref, answer_key, is_correct, time_spent_seconds
       FROM game_session_answers
       WHERE session_id = $1
       ORDER BY id ASC`,
      [sessionId],
    );

    const answers = answersResult.rows;
    const total = Number(session.total_questions) || 1;
    const correct = answers.filter((answer) => answer.is_correct).length;
    const wrong = Math.max(answers.length - correct, 0);
    const accuracy = Math.round((correct / total) * 10000) / 100;
    const comboMax = computeCombo(answers);
    const timeSpent = answers.reduce((sum, answer) => sum + (Number(answer.time_spent_seconds) || 0), 0);
    const speedBonus = Math.max(0, Number(session.time_limit_seconds || 0) - timeSpent);
    const score = correct * 100 + comboMax * 15 + Math.min(speedBonus, 120);

    let coinsEarned = 0;
    if (accuracy >= Number(session.min_accuracy_reward || 0)) {
      const capResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS earned
         FROM coin_ledger
         WHERE user_id = $1
           AND source = 'game_reward'
           AND (metadata->>'mode') = $2
           AND created_at::date = CURRENT_DATE`,
        [userId, session.slug],
      );
      const earnedToday = Math.max(Number(capResult.rows[0]?.earned) || 0, 0);
      const capLeft = Math.max(Number(session.daily_reward_cap || 0) - earnedToday, 0);
      coinsEarned = Math.min(Number(session.reward_coins || 0), capLeft);
      if (coinsEarned > 0) {
        await coinService.credit(userId, coinsEarned, "game_reward", {
          description: `Thưởng mini game ${session.name}`,
          metadata: { mode: session.slug, sessionId, score, accuracy },
          idempotencyKey: `game:${sessionId}:reward`,
          client,
        });
      }
    }

    const updated = await client.query(
      `UPDATE game_sessions
       SET status = 'completed',
           score = $1,
           correct_count = $2,
           wrong_count = $3,
           time_spent_seconds = $4,
           combo_max = $5,
           coins_earned = $6,
           completed_at = CURRENT_TIMESTAMP,
           metadata = metadata || $7::jsonb
       WHERE id = $8
       RETURNING *`,
      [
        score,
        correct,
        wrong,
        timeSpent,
        comboMax,
        coinsEarned,
        JSON.stringify({ accuracy }),
        sessionId,
      ],
    );

    await client.query(
      `UPDATE user_quests
       SET progress = LEAST(progress + 1, target)
       WHERE user_id = $1 AND quest_type = 'game_play' AND date = CURRENT_DATE AND progress < target`,
      [userId],
    );
    if (accuracy >= 80) {
      await client.query(
        `UPDATE user_quests
         SET progress = LEAST(progress + 1, target)
         WHERE user_id = $1 AND quest_type = 'game_accuracy' AND date = CURRENT_DATE AND progress < target`,
        [userId],
      );
    }

    await client.query("COMMIT");
    return { session: updated.rows[0], answers, accuracy };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMyRecentSessions(userId, limit = 10) {
  const result = await db.query(
    `SELECT gs.id, gm.slug, gm.name, gs.status, gs.score, gs.correct_count,
            gs.total_questions, gs.combo_max, gs.coins_earned, gs.started_at, gs.completed_at
     FROM game_sessions gs
     JOIN game_modes gm ON gm.id = gs.mode_id
     WHERE gs.user_id = $1
     ORDER BY gs.started_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 10, 30)],
  );
  return result.rows;
}

module.exports = {
  listModes,
  getModeBySlug,
  buildQuestions,
  startSession,
  answerQuestion,
  finishSession,
  getMyRecentSessions,
  sanitizeQuestions,
};
