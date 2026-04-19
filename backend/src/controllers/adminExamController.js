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
      const { title, subjectId, duration, totalPoints, description, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ message: "Title and subject required" });
      }

      const parsedTotalPoints = parsePositiveNumber(totalPoints, 100);

      const examCode = `EXAM-${subjectId}-${Date.now()}`;

      const result = await pool.query(
        `INSERT INTO exams (code, title, subject_id, duration, total_points, total_questions, description, status, publish_date, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier)
         VALUES ($1, $2, $3, $4, $5, 0, $6, 'draft', NOW(), $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          examCode,
          title,
          subjectId,
          duration || 90,
          parsedTotalPoints,
          description || "",
          is_premium === true,
          solution_video_url || null,
          solution_description || null,
          shuffle_mode === true,
          vip_tier || 'basic',
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
      const { examId } = req.params;
      const { title, duration, totalPoints, description, status, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier } = req.body;
      const parsedTotalPoints =
        totalPoints === undefined
          ? undefined
          : parsePositiveNumber(totalPoints, 100);

      // Build dynamic update to handle shuffle_mode boolean properly
      const updates = [];
      const params = [];
      let idx = 1;
      if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
      if (duration !== undefined) { updates.push(`duration = $${idx++}`); params.push(duration); }
      if (parsedTotalPoints !== undefined) { updates.push(`total_points = $${idx++}`); params.push(parsedTotalPoints); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
      if (is_premium !== undefined) { updates.push(`is_premium = $${idx++}`); params.push(is_premium === true); }
      if (solution_video_url !== undefined) { updates.push(`solution_video_url = $${idx++}`); params.push(solution_video_url); }
      if (solution_description !== undefined) { updates.push(`solution_description = $${idx++}`); params.push(solution_description); }
      if (shuffle_mode !== undefined) { updates.push(`shuffle_mode = $${idx++}`); params.push(shuffle_mode === true); }
      if (vip_tier !== undefined) { updates.push(`vip_tier = $${idx++}`); params.push(vip_tier); }
      updates.push(`updated_at = NOW()`);
      params.push(examId);

      const result = await pool.query(
        `UPDATE exams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
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
          e.total_questions as questions_count,
                    e.status,
                    e.is_premium,
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
  // ── Ngày 11-12: Quản lý lịch thi (Live / Upcoming schedule) ──────────────
  // GET /api/admin/exams/:examId/schedule - Get current schedule
  async getSchedule(req, res) {
    try {
      const { examId } = req.params;
      const result = await pool.query(
        `SELECT id, title, status, start_time, end_time, max_participants,
                (SELECT json_agg(l ORDER BY l.changed_at DESC) FROM (
                  SELECT changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason, changed_at
                  FROM exam_schedule_logs WHERE exam_id = $1 ORDER BY changed_at DESC LIMIT 10
                ) l) as change_log
         FROM exams WHERE id = $1`,
        [examId]
      );
      if (!result.rows[0]) return res.status(404).json({ message: 'Exam not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ message: 'Failed to get schedule' });
    }
  },

  // PUT /api/admin/exams/:examId/schedule - Set or update schedule
  async setSchedule(req, res) {
    try {
      const { examId } = req.params;
      const { startTime, endTime, maxParticipants, reason } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.full_name || req.user.username || `User#${adminId}`;

      if (!startTime || !endTime) {
        return res.status(400).json({ message: 'startTime và endTime là bắt buộc' });
      }
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ message: 'Thời gian không hợp lệ: end_time phải sau start_time' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lấy lịch cũ để ghi log diff
        const oldRes = await client.query('SELECT start_time, end_time FROM exams WHERE id = $1', [examId]);
        if (!oldRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found' }); }
        const old = oldRes.rows[0];

        await client.query(
          `UPDATE exams SET start_time = $1, end_time = $2, max_participants = COALESCE($3, max_participants), updated_at = NOW() WHERE id = $4`,
          [start, end, maxParticipants || null, examId]
        );

        // Ghi audit log
        await client.query(
          `INSERT INTO exam_schedule_logs (exam_id, changed_by, changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [examId, adminId, adminName, old.start_time, old.end_time, start, end, reason || null]
        );

        await client.query(
          `INSERT INTO audit_logs (
             actor_id,
             action,
             target_type,
             target_id,
             old_value,
             new_value,
             ip_address,
             user_agent,
             metadata
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb)`,
          [
            adminId,
            "exam_schedule_set",
            "exam",
            Number.parseInt(examId, 10),
            JSON.stringify({
              start_time: old.start_time,
              end_time: old.end_time,
            }),
            JSON.stringify({
              start_time: start,
              end_time: end,
              max_participants: maxParticipants || null,
            }),
            req.ip || null,
            req.headers["user-agent"] || null,
            JSON.stringify({ reason: reason || null }),
          ]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Cập nhật lịch thi thành công' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Set schedule error:', error);
      res.status(500).json({ message: 'Failed to set schedule' });
    }
  },

  // DELETE /api/admin/exams/:examId/schedule - Clear schedule (makes exam a free practice test)
  async clearSchedule(req, res) {
    try {
      const { examId } = req.params;
      const adminId = req.user.id;
      const adminName = req.user.full_name || req.user.username || `User#${adminId}`;
      const { reason } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const oldRes = await client.query('SELECT start_time, end_time FROM exams WHERE id = $1', [examId]);
        if (!oldRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found' }); }
        const old = oldRes.rows[0];

        await client.query(
          'UPDATE exams SET start_time = NULL, end_time = NULL, max_participants = 0, updated_at = NOW() WHERE id = $1',
          [examId]
        );
        await client.query(
          `INSERT INTO exam_schedule_logs (exam_id, changed_by, changed_by_name, old_start_time, old_end_time, new_start_time, new_end_time, reason)
           VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6)`,
          [examId, adminId, adminName, old.start_time, old.end_time, reason || 'Xóa lịch thi']
        );

        await client.query(
          `INSERT INTO audit_logs (
             actor_id,
             action,
             target_type,
             target_id,
             old_value,
             new_value,
             ip_address,
             user_agent,
             metadata
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb)`,
          [
            adminId,
            "exam_schedule_clear",
            "exam",
            Number.parseInt(examId, 10),
            JSON.stringify({
              start_time: old.start_time,
              end_time: old.end_time,
            }),
            JSON.stringify({
              start_time: null,
              end_time: null,
              max_participants: 0,
            }),
            req.ip || null,
            req.headers["user-agent"] || null,
            JSON.stringify({ reason: reason || "Xóa lịch thi" }),
          ]
        );
        await client.query('COMMIT');
        res.json({ success: true, message: 'Đã xóa lịch thi, đổi thành đề thi tự do' });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Clear schedule error:', error);
      res.status(500).json({ message: 'Failed to clear schedule' });
    }
  },
};

module.exports = AdminExamController;
