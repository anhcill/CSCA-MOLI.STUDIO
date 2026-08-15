const pool = require("../config/database");

const Exam = {
  // Lấy danh sách sảnh thi (lobby)
  async getLobby() {
    // 1. Live Exams: starts_time <= NOW and end_time >= NOW
    const liveQuery = `
      SELECT 
        e.*,
        s.name as subject_name,
        s.code as subject_code,
        COALESCE(
          (SELECT COUNT(DISTINCT user_id) FROM exam_registrations WHERE exam_id = e.id AND status IN ('registered', 'approved', 'checked_in')),
          0
        ) as participants
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.deleted_at IS NULL
        AND e.start_time <= CURRENT_TIMESTAMP 
        AND e.end_time >= CURRENT_TIMESTAMP
        AND EXISTS (
          SELECT 1 FROM admin_exam_source_files sf
          WHERE sf.exam_id = e.id AND sf.is_exam_paper = TRUE
            AND sf.file_type = 'pdf' AND sf.file_data IS NOT NULL
        )
        AND EXISTS (
          SELECT 1 FROM questions q
          WHERE q.exam_id = e.id AND q.question_number > 0 AND q.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM questions q
          WHERE q.exam_id = e.id AND q.question_number > 0 AND q.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id AND a.is_correct = TRUE)
        )
    `;

    // 2. Upcoming Exams: start_time > NOW
    const upcomingQuery = `
      SELECT 
        e.*,
        s.name as subject_name,
        s.code as subject_code,
        COALESCE(
          (SELECT COUNT(DISTINCT user_id) FROM exam_registrations WHERE exam_id = e.id AND status IN ('registered', 'approved', 'checked_in')),
          0
        ) as registered
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.deleted_at IS NULL
        AND e.start_time > CURRENT_TIMESTAMP
        AND e.end_time > e.start_time
        AND EXISTS (
          SELECT 1 FROM admin_exam_source_files sf
          WHERE sf.exam_id = e.id AND sf.is_exam_paper = TRUE
            AND sf.file_type = 'pdf' AND sf.file_data IS NOT NULL
        )
        AND EXISTS (
          SELECT 1 FROM questions q
          WHERE q.exam_id = e.id AND q.question_number > 0 AND q.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM questions q
          WHERE q.exam_id = e.id AND q.question_number > 0 AND q.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.question_id = q.id AND a.is_correct = TRUE)
        )
      ORDER BY e.start_time ASC
      LIMIT 10
    `;

    // 3. Public Exams: start_time IS NULL (Practice/Mock tests without strict schedule)
    const publicQuery = `
      SELECT 
        e.*,
        s.name as subject_name,
        s.code as subject_code,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id AND question_number > 0 AND deleted_at IS NULL) as question_count
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.deleted_at IS NULL
        AND e.start_time IS NULL
      ORDER BY e.publish_date DESC
      LIMIT 20
    `;

    // 4. The most recently finished scheduled exam. This is deliberately
    // separate from the global leaderboard: the exam-room lobby must only show
    // results belonging to one completed room exam.
    const latestCompletedMockQuery = `
      SELECT
        e.id,
        e.title,
        e.title_cn,
        e.start_time,
        e.end_time,
        s.name as subject_name,
        s.code as subject_code
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.deleted_at IS NULL
        AND e.start_time IS NOT NULL
        AND e.end_time IS NOT NULL
        AND e.end_time < CURRENT_TIMESTAMP
      ORDER BY e.end_time DESC
      LIMIT 1
    `;

    const [liveResult, upcomingResult, publicResult, latestCompletedMockResult] = await Promise.all([
      pool.query(liveQuery),
      pool.query(upcomingQuery),
      pool.query(publicQuery),
      pool.query(latestCompletedMockQuery)
    ]);

    return {
      live: liveResult.rows,
      upcoming: upcomingResult.rows,
      public: publicResult.rows,
      latest_completed_mock: latestCompletedMockResult.rows[0] || null
    };
  },

  // Lấy tất cả đề thi theo môn học
  async getBySubject(subjectCode, userId = null, subjectSlug = null) {
    let query, params;

    if (subjectSlug) {
      // Filter by slug (URL-friendly slug like 'toan', 'vat-ly')
      query = `
        SELECT
          e.*,
          s.name as subject_name,
          s.code as subject_code,
          u.full_name as created_by_name,
          COUNT(DISTINCT CASE WHEN q.question_number > 0 AND q.deleted_at IS NULL THEN q.id END) as question_count,
          COALESCE(
            (SELECT COUNT(*) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_attempt_count,
          COALESCE(
            (SELECT MAX(total_score) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_best_score,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100) >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            (
              SELECT q.difficulty
              FROM exam_attempts ea2
              JOIN questions q ON ea2.exam_id = q.exam_id
              WHERE ea2.exam_id = e.id AND ea2.status = 'completed' AND q.difficulty IS NOT NULL AND q.deleted_at IS NULL
              GROUP BY q.difficulty
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ), e.difficulty_level
          ) as overall_difficulty,
          COALESCE(
            (
              SELECT total_score FROM exam_attempts
              WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'
              ORDER BY submit_time DESC
              LIMIT 1
            ), 0
          ) as user_last_score
        FROM exams e
        INNER JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN questions q ON e.id = q.exam_id AND q.deleted_at IS NULL
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        WHERE s.slug = $1 AND e.status = 'published' AND e.deleted_at IS NULL
        GROUP BY e.id, s.id, u.id
        ORDER BY e.publish_date DESC, e.created_at DESC
      `;
      params = [subjectSlug, userId];
    } else {
      // Filter by subject code (MATH, PHYSICS, etc.)
      query = `
        SELECT
          e.*,
          s.name as subject_name,
          s.code as subject_code,
          u.full_name as created_by_name,
          COUNT(DISTINCT CASE WHEN q.question_number > 0 AND q.deleted_at IS NULL THEN q.id END) as question_count,
          COALESCE(
            (SELECT COUNT(*) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_attempt_count,
          COALESCE(
            (SELECT MAX(total_score) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_best_score,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                COALESCE(ea.score_percentage, ea.total_score::DECIMAL / NULLIF(e.total_points, 0) * 100) >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            (
              SELECT q.difficulty
              FROM exam_attempts ea2
              JOIN questions q ON ea2.exam_id = q.exam_id
              WHERE ea2.exam_id = e.id AND ea2.status = 'completed' AND q.difficulty IS NOT NULL AND q.deleted_at IS NULL
              GROUP BY q.difficulty
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ), e.difficulty_level
          ) as overall_difficulty,
          COALESCE(
            (
              SELECT total_score FROM exam_attempts
              WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'
              ORDER BY submit_time DESC
              LIMIT 1
            ), 0
          ) as user_last_score
        FROM exams e
        INNER JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN questions q ON e.id = q.exam_id AND q.deleted_at IS NULL
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        WHERE s.code = $1 AND e.status = 'published' AND e.deleted_at IS NULL
        GROUP BY e.id, s.id, u.id
        ORDER BY e.publish_date DESC, e.created_at DESC
      `;
      params = [subjectCode, userId];
    }

    const result = await pool.query(query, params);
    return result.rows;
  },

  async getSummaryForUser(examId, userId = null) {
    const examResult = await pool.query(
      `SELECT e.*,
              s.name AS subject_name,
              s.code AS subject_code,
              EXISTS (
                SELECT 1 FROM admin_exam_source_files sf
                WHERE sf.exam_id = e.id
                  AND sf.is_exam_paper = TRUE
                  AND sf.file_type = 'pdf'
                  AND sf.file_data IS NOT NULL
              ) AS has_exam_pdf,
              COUNT(DISTINCT CASE WHEN q.question_number > 0 AND q.deleted_at IS NULL THEN q.id END)::int AS question_count,
              COALESCE(
                (SELECT COUNT(*) FROM exam_attempts
                 WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
                0
              )::int AS user_attempt_count,
              COALESCE(
                (SELECT MAX(total_score) FROM exam_attempts
                 WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
                0
              )::decimal AS user_best_score,
              (
                SELECT jsonb_build_object(
                  'id', ea.id,
                  'attempt_number', ea.attempt_number,
                  'start_time', ea.start_time,
                  'answered_count', COALESCE((
                    SELECT COUNT(*) FROM user_answers ua WHERE ua.attempt_id = ea.id
                  ), 0)
                )
                FROM exam_attempts ea
                WHERE ea.exam_id = e.id AND ea.user_id = $2 AND ea.status = 'in_progress'
                ORDER BY ea.start_time DESC
                LIMIT 1
              ) AS in_progress_attempt
       FROM exams e
       INNER JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN questions q ON q.exam_id = e.id AND q.deleted_at IS NULL
       WHERE e.id = $1 AND e.deleted_at IS NULL
       GROUP BY e.id, s.id`,
      [examId, userId],
    );

    return examResult.rows[0] || null;
  },

  // Lấy chi tiết đề thi kèm câu hỏi và đáp án
  async getById(examId, includeAnswers = false) {
    // Get exam info
    const examQuery = `
      SELECT e.*, s.name as subject_name, s.code as subject_code,
             EXISTS (
               SELECT 1 FROM admin_exam_source_files sf
               WHERE sf.exam_id = e.id
                 AND sf.is_exam_paper = TRUE
                 AND sf.file_type = 'pdf'
                 AND sf.file_data IS NOT NULL
             ) AS has_exam_pdf
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `;
    const examResult = await pool.query(examQuery, [examId]);

    if (examResult.rows.length === 0) {
      return null;
    }

    const exam = examResult.rows[0];

    // Get questions
    const answerCorrectField = includeAnswers ? `, 'is_correct', a.is_correct` : "";
    const questionsQuery = `
      SELECT q.*,
        COALESCE(
          q.passage_text,
          parent.passage_text
        ) as effective_passage_text,
        COALESCE(
          q.passage_image_url,
          parent.passage_image_url
        ) as effective_passage_image_url,
        COALESCE(
          q.linked_options,
          parent.linked_options
        ) as effective_linked_options,
        COALESCE(
          q.cloze_mode,
          parent.cloze_mode
        ) as effective_cloze_mode,
        COALESCE(
          jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'answer_key', a.answer_key,
            'answer_text', a.answer_text,
            'answer_text_cn', a.answer_text_cn,
            'answer_text_en', a.answer_text_en,
            'image_url', a.image_url
            ${answerCorrectField}
          ) ORDER BY a.answer_key
        ) FILTER (WHERE a.id IS NOT NULL), '[]'::jsonb) as answers
      FROM questions q
      LEFT JOIN questions parent ON parent.id = q.passage_group_id
      LEFT JOIN answers a ON q.id = a.question_id
      WHERE q.exam_id = $1
        AND q.deleted_at IS NULL
      GROUP BY q.id, parent.id
      ORDER BY q.question_number
    `;

    const questionsResult = await pool.query(questionsQuery, [examId]);
    exam.questions = questionsResult.rows;

    return exam;
  },

  // Tạo đề thi mới
  async create(examData) {
    const query = `
      INSERT INTO exams (
        subject_id, code, title, title_cn, description,
        duration, total_questions, total_points, difficulty_level,
        status, publish_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      examData.subject_id,
      examData.code,
      examData.title,
      examData.title_cn,
      examData.description,
      examData.duration,
      examData.total_questions,
      examData.total_points,
      examData.difficulty_level,
      examData.status || "draft",
      examData.publish_date,
      examData.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Tạo câu hỏi cho đề thi
  async createQuestion(questionData) {
    const query = `
      INSERT INTO questions (
        exam_id, question_number, question_type,
        question_text, question_text_cn, question_text_en,
        question_image_url, explanation, explanation_cn,
        points, difficulty
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      questionData.exam_id,
      questionData.question_number,
      questionData.question_type || "single_choice",
      questionData.question_text,
      questionData.question_text_cn,
      questionData.question_text_en,
      questionData.question_image_url,
      questionData.explanation,
      questionData.explanation_cn,
      questionData.points || 3.0,
      questionData.difficulty,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Tạo đáp án cho câu hỏi
  async createAnswer(answerData) {
    const query = `
      INSERT INTO answers (
        question_id, answer_key, answer_text,
        answer_text_cn, answer_text_en, is_correct
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      answerData.question_id,
      answerData.answer_key,
      answerData.answer_text,
      answerData.answer_text_cn,
      answerData.answer_text_en,
      answerData.is_correct,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Cập nhật đề thi
  async update(examId, examData) {
    const query = `
      UPDATE exams 
      SET title = $1, title_cn = $2, description = $3,
          duration = $4, difficulty_level = $5, status = $6,
          publish_date = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    const values = [
      examData.title,
      examData.title_cn,
      examData.description,
      examData.duration,
      examData.difficulty_level,
      examData.status,
      examData.publish_date,
      examId,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Xóa đề thi
  async delete(examId, deletedBy = null, reason = null) {
    const query = `
      UPDATE exams
      SET status = 'archived',
          deleted_at = NOW(),
          deleted_by = $2,
          delete_reason = NULLIF($3, ''),
          deletion_status = 'soft_deleted',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [examId, deletedBy, reason || ""]);
    return result.rows[0];
  },
};

module.exports = Exam;
