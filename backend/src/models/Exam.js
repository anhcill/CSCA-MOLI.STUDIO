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
          (SELECT COUNT(DISTINCT user_id) FROM exam_attempts WHERE exam_id = e.id),
          0
        ) as participants
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.start_time <= CURRENT_TIMESTAMP 
        AND e.end_time >= CURRENT_TIMESTAMP
    `;

    // 2. Upcoming Exams: start_time > NOW
    const upcomingQuery = `
      SELECT 
        e.*,
        s.name as subject_name,
        s.code as subject_code,
        COALESCE(
          (SELECT COUNT(DISTINCT user_id) FROM exam_attempts WHERE exam_id = e.id),
          0
        ) as registered
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.start_time > CURRENT_TIMESTAMP
      ORDER BY e.start_time ASC
      LIMIT 10
    `;

    // 3. Public Exams: start_time IS NULL (Practice/Mock tests without strict schedule)
    const publicQuery = `
      SELECT 
        e.*,
        s.name as subject_name,
        s.code as subject_code,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as question_count
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.status = 'published'
        AND e.start_time IS NULL
      ORDER BY e.publish_date DESC
      LIMIT 20
    `;

    const [liveResult, upcomingResult, publicResult] = await Promise.all([
      pool.query(liveQuery),
      pool.query(upcomingQuery),
      pool.query(publicQuery)
    ]);

    return {
      live: liveResult.rows,
      upcoming: upcomingResult.rows,
      public: publicResult.rows
    };
  },

  // Lấy tất cả đề thi theo môn học
  async getBySubject(subjectCode, userId = null, subjectSlug = null) {
    let query, result;

    if (subjectSlug) {
      // Filter by slug (URL-friendly slug like 'toan', 'vat-ly')
      query = `
        SELECT
          e.*,
          s.name as subject_name,
          s.code as subject_code,
          u.full_name as created_by_name,
          COUNT(DISTINCT q.id) as question_count,
          COALESCE(
            (SELECT COUNT(*) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_attempt_count,
          COALESCE(
            (SELECT MAX(total_score) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_best_score
        FROM exams e
        INNER JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE s.slug = $1 AND e.status = 'published'
        GROUP BY e.id, s.id, u.id
        ORDER BY e.publish_date DESC, e.created_at DESC
      `;
      result = await pool.query(query, [subjectSlug, userId]);
    } else {
      // Filter by subject code (MATH, PHYSICS, etc.)
      query = `
        SELECT
          e.*,
          s.name as subject_name,
          s.code as subject_code,
          u.full_name as created_by_name,
          COUNT(DISTINCT q.id) as question_count,
          COALESCE(
            (SELECT COUNT(*) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_attempt_count,
          COALESCE(
            (SELECT MAX(total_score) FROM exam_attempts
             WHERE exam_id = e.id AND user_id = $2 AND status = 'completed'),
            0
          ) as user_best_score
        FROM exams e
        INNER JOIN subjects s ON e.subject_id = s.id
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN questions q ON e.id = q.exam_id
        WHERE s.code = $1 AND e.status = 'published'
        GROUP BY e.id, s.id, u.id
        ORDER BY e.publish_date DESC, e.created_at DESC
      `;
      result = await pool.query(query, [subjectCode, userId]);
    }

    return result.rows;
  },

  // Lấy chi tiết đề thi kèm câu hỏi và đáp án
  async getById(examId, includeAnswers = false) {
    // Get exam info
    const examQuery = `
      SELECT e.*, s.name as subject_name, s.code as subject_code
      FROM exams e
      INNER JOIN subjects s ON e.subject_id = s.id
      WHERE e.id = $1
    `;
    const examResult = await pool.query(examQuery, [examId]);

    if (examResult.rows.length === 0) {
      return null;
    }

    const exam = examResult.rows[0];

    // Get questions
    const questionsQuery = `
      SELECT q.*, 
        ARRAY_AGG(
          json_build_object(
            'id', a.id,
            'answer_key', a.answer_key,
            'answer_text', a.answer_text,
            'answer_text_cn', a.answer_text_cn,
            'answer_text_en', a.answer_text_en,
            'is_correct', a.is_correct
          ) ORDER BY a.answer_key
        ) as answers
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      WHERE q.exam_id = $1
      GROUP BY q.id
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
  async delete(examId) {
    const query = "DELETE FROM exams WHERE id = $1 RETURNING *";
    const result = await pool.query(query, [examId]);
    return result.rows[0];
  },
};

module.exports = Exam;
