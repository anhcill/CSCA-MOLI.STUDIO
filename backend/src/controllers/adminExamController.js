const { pool } = require("../config/database");

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBilingualText(en, cn) {
  const enText = (en || "").trim();
  const cnText = (cn || "").trim();
  if (!enText && !cnText) return null;
  return {
    en: enText || cnText,
    cn: cnText || enText,
  };
}

const AdminExamController = {
  // Create new exam
  async createExam(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { title, subjectId, duration, totalPoints, description } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ message: "Title and subject required" });
      }

      const parsedTotalPoints = parsePositiveNumber(totalPoints, 100);

      const examCode = `EXAM-${subjectId}-${Date.now()}`;

      const result = await pool.query(
        `INSERT INTO exams (code, title, subject_id, duration, total_points, total_questions, description, status, publish_date)
         VALUES ($1, $2, $3, $4, $5, 0, $6, 'draft', NOW())
         RETURNING *`,
        [
          examCode,
          title,
          subjectId,
          duration || 90,
          parsedTotalPoints,
          description || "",
        ],
      );

      res.status(201).json({
        message: "Exam created",
        exam: result.rows[0],
      });
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({ message: "Failed to create exam" });
    }
  },

  // Update exam
  async updateExam(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { examId } = req.params;
      const { title, duration, totalPoints, description, status } = req.body;
      const parsedTotalPoints =
        totalPoints === undefined
          ? undefined
          : parsePositiveNumber(totalPoints, 100);

      const result = await pool.query(
        `UPDATE exams 
         SET title = COALESCE($1, title),
             duration = COALESCE($2, duration),
             total_points = COALESCE($3, total_points),
             description = COALESCE($4, description),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [title, duration, parsedTotalPoints, description, status, examId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json({ message: "Exam updated", exam: result.rows[0] });
    } catch (error) {
      console.error("Update exam error:", error);
      res.status(500).json({ message: "Failed to update exam" });
    }
  },

  // Delete exam
  async deleteExam(req, res) {
    try {
      const { examId } = req.params;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "DELETE FROM user_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = $1)",
          [examId],
        );
        await client.query("DELETE FROM exam_attempts WHERE exam_id = $1", [
          examId,
        ]);
        await client.query(
          "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = $1)",
          [examId],
        );
        await client.query("DELETE FROM questions WHERE exam_id = $1", [
          examId,
        ]);
        const result = await client.query(
          "DELETE FROM exams WHERE id = $1 RETURNING id",
          [examId],
        );
        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Exam not found" });
        }
        await client.query("COMMIT");
        res.json({ message: "Exam deleted successfully" });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Delete exam error:", error);
      res.status(500).json({ message: "Failed to delete exam" });
    }
  },

  // Add question to exam
  async addQuestion(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { examId } = req.params;
      const {
        questionText,
        questionTextCn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,
        correctAnswer,
      } = req.body;

      const normalizedQuestion = normalizeBilingualText(
        questionText,
        questionTextCn,
      );
      if (!normalizedQuestion || !answers || answers.length !== 4) {
        return res
          .status(400)
          .json({
            message:
              "Question text (English or Chinese) and 4 answers required",
          });
      }

      const normalizedAnswers = answers.map((answer = {}) =>
        normalizeBilingualText(answer.text, answer.textCn),
      );

      if (normalizedAnswers.some((answer) => !answer)) {
        return res
          .status(400)
          .json({ message: "Each answer must have English or Chinese text" });
      }

      const parsedPoints = parsePositiveNumber(points, 1);

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Get next question number
        const countResult = await client.query(
          "SELECT COUNT(*) as count FROM questions WHERE exam_id = $1",
          [examId],
        );
        const questionNumber = parseInt(countResult.rows[0].count) + 1;

        // Insert question
        const questionResult = await client.query(
          `INSERT INTO questions (exam_id, question_number, question_text, question_text_cn, points, explanation, explanation_cn, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            examId,
            questionNumber,
            normalizedQuestion.en,
            normalizedQuestion.cn,
            parsedPoints,
            explanation,
            explanationCn,
            imageUrl,
          ],
        );

        const questionId = questionResult.rows[0].id;

        // Insert answers
        const answerKeys = ["A", "B", "C", "D"];
        for (let i = 0; i < 4; i++) {
          const answer = answers[i];
          await client.query(
            `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              questionId,
              answerKeys[i],
              normalizedAnswers[i].en,
              normalizedAnswers[i].cn,
              answerKeys[i] === correctAnswer,
              answer?.imageUrl,
            ],
          );
        }

        // Update exam total_questions
        await client.query(
          "UPDATE exams SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1",
          [examId],
        );

        await client.query("COMMIT");

        res.status(201).json({ message: "Question added", questionId });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Add question error:", error);
      res.status(500).json({ message: "Failed to add question" });
    }
  },

  // Update question
  async updateQuestion(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { questionId } = req.params;
      const {
        questionText,
        questionTextCn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,
        correctAnswer,
      } = req.body;

      const hasQuestionTextPayload =
        questionText !== undefined || questionTextCn !== undefined;
      const normalizedQuestion = hasQuestionTextPayload
        ? normalizeBilingualText(questionText, questionTextCn)
        : null;

      if (hasQuestionTextPayload && !normalizedQuestion) {
        return res
          .status(400)
          .json({ message: "Question text cannot be empty in both languages" });
      }

      const parsedPoints =
        points === undefined ? undefined : parsePositiveNumber(points, 1);

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Update question
        await client.query(
          `UPDATE questions 
           SET question_text = COALESCE($1, question_text),
               question_text_cn = COALESCE($2, question_text_cn),
               image_url = $3,
               points = COALESCE($4, points),
               explanation = $5,
               explanation_cn = $6
           WHERE id = $7`,
          [
            normalizedQuestion?.en,
            normalizedQuestion?.cn,
            imageUrl,
            parsedPoints,
            explanation,
            explanationCn,
            questionId,
          ],
        );

        // Update answers
        if (answers && answers.length === 4) {
          const normalizedAnswers = answers.map((answer = {}) =>
            normalizeBilingualText(answer.text, answer.textCn),
          );

          if (normalizedAnswers.some((answer) => !answer)) {
            await client.query("ROLLBACK");
            return res
              .status(400)
              .json({
                message: "Each answer must have English or Chinese text",
              });
          }

          const answerKeys = ["A", "B", "C", "D"];
          for (let i = 0; i < 4; i++) {
            const answer = answers[i];
            await client.query(
              `UPDATE answers 
               SET answer_text = $1, answer_text_cn = $2, is_correct = $3, image_url = $4
               WHERE question_id = $5 AND answer_key = $6`,
              [
                normalizedAnswers[i].en,
                normalizedAnswers[i].cn,
                answerKeys[i] === correctAnswer,
                answer?.imageUrl,
                questionId,
                answerKeys[i],
              ],
            );
          }
        }

        await client.query("COMMIT");

        res.json({ message: "Question updated" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Update question error:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  },

  // Delete question
  async deleteQuestion(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { questionId } = req.params;

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const examResult = await client.query(
          "SELECT exam_id FROM questions WHERE id = $1",
          [questionId],
        );

        if (examResult.rows.length === 0) {
          return res.status(404).json({ message: "Question not found" });
        }

        const examId = examResult.rows[0].exam_id;

        await client.query("DELETE FROM questions WHERE id = $1", [questionId]);
        await client.query(
          "UPDATE exams SET total_questions = total_questions - 1, updated_at = NOW() WHERE id = $1",
          [examId],
        );

        await client.query("COMMIT");

        res.json({ message: "Question deleted" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Delete question error:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  },

  // Get all exams (for admin dashboard)
  async getAllExams(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await pool.query(
        "SELECT COUNT(*) as total FROM exams",
      );
      const totalExams = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalExams / limit);

      // Get exams with subject info
      const examsResult = await pool.query(
        `SELECT 
                    e.id,
                    e.code,
                    e.title,
                    e.duration,
                    e.total_points,
                    e.total_questions,
                    e.status,
                    e.created_at,
                    s.name as subject_name,
                    s.code as subject_code,
                    COUNT(DISTINCT ea.id) as attempts_count
                FROM exams e
                LEFT JOIN subjects s ON e.subject_id = s.id
                LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
                GROUP BY e.id, s.name, s.code
                ORDER BY e.created_at DESC
                LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        exams: examsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalExams,
          limit,
        },
      });
    } catch (error) {
      console.error("Get all exams error:", error);
      res.status(500).json({ message: "Failed to get exams" });
    }
  },

  // Get exam with questions
  async getExamWithQuestions(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { examId } = req.params;

      const examResult = await pool.query("SELECT * FROM exams WHERE id = $1", [
        examId,
      ]);

      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const questionsResult = await pool.query(
        `SELECT 
          q.*,
          json_agg(
            json_build_object(
              'id', a.id,
              'answer_key', a.answer_key,
              'answer_text', a.answer_text,
              'answer_text_cn', a.answer_text_cn,
              'image_url', a.image_url,
              'is_correct', a.is_correct
            ) ORDER BY a.answer_key
          ) as answers
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id
        WHERE q.exam_id = $1
        GROUP BY q.id
        ORDER BY q.question_number`,
        [examId],
      );

      res.json({
        exam: examResult.rows[0],
        questions: questionsResult.rows,
      });
    } catch (error) {
      console.error("Get exam error:", error);
      res.status(500).json({ message: "Failed to get exam" });
    }
  },
};

module.exports = AdminExamController;
