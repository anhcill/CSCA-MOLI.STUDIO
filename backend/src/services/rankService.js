const db = require("../config/database");
const gameService = require("./gameService");

function tierFromRating(rating) {
  if (rating >= 1800) return "Diamond";
  if (rating >= 1500) return "Platinum";
  if (rating >= 1250) return "Gold";
  if (rating >= 1050) return "Silver";
  return "Bronze";
}

async function getCurrentSeason() {
  let result = await db.query(
    `SELECT * FROM rank_seasons
     WHERE is_active = TRUE
       AND starts_at <= CURRENT_TIMESTAMP
       AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
     ORDER BY starts_at DESC
     LIMIT 1`,
  );
  if (result.rows[0]) return result.rows[0];

  result = await db.query(
    `INSERT INTO rank_seasons (name, starts_at, ends_at, is_active, reward_config)
     VALUES ('Mùa Khởi Động', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 days', TRUE,
             '{"bronze":20,"silver":40,"gold":80,"platinum":120,"diamond":200}'::jsonb)
     RETURNING *`,
  );
  return result.rows[0];
}

async function ensureRating(userId, seasonId, client = db) {
  const result = await client.query(
    `INSERT INTO rank_ratings (user_id, season_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, season_id) DO UPDATE SET updated_at = rank_ratings.updated_at
     RETURNING *`,
    [userId, seasonId],
  );
  return result.rows[0];
}

function scoreSubmission(questions, submittedAnswers = []) {
  const byRef = new Map(submittedAnswers.map((answer) => [String(answer.question_ref), String(answer.answer_key || "").trim()]));
  const total = questions.length || 1;
  let correct = 0;
  let combo = 0;
  let bestCombo = 0;

  questions.forEach((question) => {
    const answer = byRef.get(question.ref);
    const ok = answer && answer === String(question.correct_key || "").trim();
    if (ok) {
      correct += 1;
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
    } else {
      combo = 0;
    }
  });

  const accuracy = Math.round((correct / total) * 10000) / 100;
  const score = correct * 100 + bestCombo * 20;
  return { score, correct, total, accuracy };
}

async function getLeaderboard({ limit = 50 } = {}) {
  const season = await getCurrentSeason();
  const result = await db.query(
    `SELECT rr.user_id, u.full_name, u.username, u.avatar, rr.rating, rr.tier,
            rr.matches_played, rr.wins, rr.losses, rr.draws, rr.streak, rr.best_streak
     FROM rank_ratings rr
     JOIN users u ON u.id = rr.user_id
     WHERE rr.season_id = $1
     ORDER BY rr.rating DESC, rr.wins DESC, rr.matches_played ASC
     LIMIT $2`,
    [season.id, Math.min(Number(limit) || 50, 100)],
  );
  return { season, leaderboard: result.rows };
}

async function getMyRating(userId) {
  const season = await getCurrentSeason();
  const rating = await ensureRating(userId, season.id);
  return { season, rating };
}

async function createQuestionPayload() {
  const mode = await gameService.getModeBySlug("quiz-rush");
  if (!mode) throw new Error("Chưa có cấu hình Quiz Rush cho rank");
  const questions = await gameService.buildQuestions({ ...mode, question_count: 8, mode_type: "quiz" });
  if (questions.length === 0) {
    const error = new Error("Chưa có đủ câu hỏi cho rank");
    error.status = 409;
    throw error;
  }
  return { mode, questions };
}

async function findOrCreateMatch(userId) {
  const season = await getCurrentSeason();
  await ensureRating(userId, season.id);

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const waiting = await client.query(
      `SELECT *
       FROM rank_matches
       WHERE season_id = $1
         AND status IN ('waiting', 'waiting_opponent')
         AND user_a_id <> $2
         AND user_b_id IS NULL
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [season.id, userId],
    );

    if (waiting.rows[0]) {
      const updated = await client.query(
        `UPDATE rank_matches
         SET user_b_id = $1, status = 'active'
         WHERE id = $2
         RETURNING *`,
        [userId, waiting.rows[0].id],
      );
      await client.query("COMMIT");
      return {
        season,
        match: updated.rows[0],
        questions: gameService.sanitizeQuestions(updated.rows[0].question_payload),
      };
    }

    const { mode, questions } = await createQuestionPayload();
    const created = await client.query(
      `INSERT INTO rank_matches (season_id, mode_id, user_a_id, status, question_payload)
       VALUES ($1, $2, $3, 'waiting', $4::jsonb)
       RETURNING *`,
      [season.id, mode.id, userId, JSON.stringify(questions)],
    );

    await client.query("COMMIT");
    return {
      season,
      match: created.rows[0],
      questions: gameService.sanitizeQuestions(questions),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function ratingDelta(result) {
  if (result === "win") return 25;
  if (result === "loss") return -18;
  return 5;
}

async function applyRating(client, userId, seasonId, result) {
  const current = await ensureRating(userId, seasonId, client);
  const nextRating = Math.max(100, Number(current.rating) + ratingDelta(result));
  const nextStreak = result === "win" ? Number(current.streak || 0) + 1 : result === "loss" ? 0 : Number(current.streak || 0);
  const updated = await client.query(
    `UPDATE rank_ratings
     SET rating = $1,
         tier = $2,
         matches_played = matches_played + 1,
         wins = wins + CASE WHEN $3 = 'win' THEN 1 ELSE 0 END,
         losses = losses + CASE WHEN $3 = 'loss' THEN 1 ELSE 0 END,
         draws = draws + CASE WHEN $3 = 'draw' THEN 1 ELSE 0 END,
         streak = $4,
         best_streak = GREATEST(best_streak, $4),
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $5 AND season_id = $6
     RETURNING *`,
    [nextRating, tierFromRating(nextRating), result, nextStreak, userId, seasonId],
  );
  return updated.rows[0];
}

async function submitMatch(userId, matchId, answers) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const matchResult = await client.query(
      `SELECT * FROM rank_matches WHERE id = $1 FOR UPDATE`,
      [matchId],
    );
    const match = matchResult.rows[0];
    if (!match || (match.user_a_id !== userId && match.user_b_id !== userId)) {
      const error = new Error("Không tìm thấy trận rank");
      error.status = 404;
      throw error;
    }
    if (match.status === "completed") {
      const error = new Error("Trận rank đã hoàn tất");
      error.status = 409;
      throw error;
    }

    const isUserA = match.user_a_id === userId;
    if ((isUserA && match.user_a_score !== null) || (!isUserA && match.user_b_score !== null)) {
      const error = new Error("Bạn đã nộp trận này rồi");
      error.status = 409;
      throw error;
    }

    const questions = Array.isArray(match.question_payload) ? match.question_payload : [];
    const result = scoreSubmission(questions, answers);
    const updateSql = isUserA
      ? `UPDATE rank_matches SET user_a_score = $1, user_a_accuracy = $2 WHERE id = $3 RETURNING *`
      : `UPDATE rank_matches SET user_b_score = $1, user_b_accuracy = $2 WHERE id = $3 RETURNING *`;
    let updated = (await client.query(updateSql, [result.score, result.accuracy, matchId])).rows[0];

    const hasBoth = updated.user_a_score !== null && updated.user_b_score !== null;
    let rating = null;
    if (hasBoth) {
      let winner = null;
      let resultA = "draw";
      let resultB = "draw";
      if (Number(updated.user_a_score) > Number(updated.user_b_score)) {
        winner = updated.user_a_id;
        resultA = "win";
        resultB = "loss";
      } else if (Number(updated.user_b_score) > Number(updated.user_a_score)) {
        winner = updated.user_b_id;
        resultA = "loss";
        resultB = "win";
      }

      const ratingA = await applyRating(client, updated.user_a_id, updated.season_id, resultA);
      const ratingB = await applyRating(client, updated.user_b_id, updated.season_id, resultB);
      if (winner) {
        await client.query(
          `UPDATE user_quests
           SET progress = LEAST(progress + 1, target)
           WHERE user_id = $1 AND quest_type = 'rank_win' AND date = CURRENT_DATE AND progress < target`,
          [winner],
        );
      }

      updated = (await client.query(
        `UPDATE rank_matches
         SET status = 'completed', winner_user_id = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [winner, matchId],
      )).rows[0];
      rating = userId === updated.user_a_id ? ratingA : ratingB;
    } else {
      updated = (await client.query(
        `UPDATE rank_matches SET status = 'waiting_opponent' WHERE id = $1 RETURNING *`,
        [matchId],
      )).rows[0];
      rating = await ensureRating(userId, updated.season_id, client);
    }

    await client.query("COMMIT");
    return { match: updated, submission: result, rating };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getMyMatches(userId, limit = 10) {
  const result = await db.query(
    `SELECT rm.*, ua.full_name AS user_a_name, ub.full_name AS user_b_name
     FROM rank_matches rm
     LEFT JOIN users ua ON ua.id = rm.user_a_id
     LEFT JOIN users ub ON ub.id = rm.user_b_id
     WHERE rm.user_a_id = $1 OR rm.user_b_id = $1
     ORDER BY rm.created_at DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 10, 30)],
  );
  return result.rows;
}

module.exports = {
  tierFromRating,
  getCurrentSeason,
  getMyRating,
  getLeaderboard,
  findOrCreateMatch,
  submitMatch,
  getMyMatches,
};
