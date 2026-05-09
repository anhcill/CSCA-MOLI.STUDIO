const { pool } = require("../config/database");
const { cache } = require("../config/cache");
const UserActivity = require("../models/UserActivity");

// ─── P1 Security: XSS sanitization (strip HTML tags, allow plain text only) ─────
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

// ─── P1: Validate question points ──────────────────────────────────────────────
const MAX_POINTS_PER_QUESTION = 100;
const MAX_QUESTIONS_PER_EXAM = 200;

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
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

// ─── Question types cho đề tiếng Trung ────────────────────────────────────────────
const QUESTION_TYPES = {
  SINGLE_CHOICE:     'single_choice',       // Trắc nghiệm A-B-C-D (câu 1-10, 26-33, 49-70)
  FILL_BLANK_POOL:   'fill_blank_pool',      // Điền từ đầu nhóm, có pool A-F (câu 11-25)
  FILL_BLANK_ITEM:   'fill_blank_item',     // Điền từ con trong nhóm, dùng linked_options cha
  READING_PASSAGE:    'reading_passage',      // Đọc hiểu đầu đoạn (câu 34, 71...)
  READING_ITEM:       'reading_item',         // Câu con trong đoạn đọc hiểu (35, 36, 72...)
  TRUE_FALSE:        'true_false',           // Đúng/Sai
};

// ─── Helper: lấy passage_group_id của câu cha gần nhất ───────────────────────
async function getLatestPassageGroupId(client, examId) {
  const r = await client.query(
    `SELECT id FROM questions
     WHERE exam_id = $1 AND passage_group_id IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    [examId],
  );
  return r.rows[0]?.id ?? null;
}

// ─── Helper: normalize linked_options (pool A-F) ─────────────────────────────────
// Frontend convention: text = Tiếng Việt, textCn = Tiếng Trung
// Backend: nếu text rỗng thì dùng textCn làm fallback cho cả hai
function normalizeLinkedOptions(rawOptions) {
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) return null;
  return rawOptions.map((opt, i) => {
    const text = (opt.text || '').trim();
    const textCn = (opt.textCn || opt.text || '').trim();
    return {
      key:   opt.key || String.fromCharCode(65 + i),
      text:  text || textCn,
      textCn: textCn || text,
    };
  });
}

const AdminExamController = {
  // Create new exam
  async createExam(req, res) {
    try {
      // P0: destructure titleCn
      const { title, titleCn, subjectId, duration, totalPoints, description, descriptionCn, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated, difficulty_level } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ message: "Title and subject required" });
      }

      // P1: validate subjectId exists
      const subjectCheck = await pool.query("SELECT id FROM subjects WHERE id = $1", [subjectId]);
      if (subjectCheck.rows.length === 0) {
        return res.status(400).json({ message: "Subject not found" });
      }

      const parsedTotalPoints = parsePositiveNumber(totalPoints, 100);

      // P1: sanitize all text inputs to prevent XSS
      const examCode = `EXAM-${subjectId}-${Date.now()}`;
      const safeTitle = sanitize(title);
      const safeTitleCn = titleCn ? sanitize(titleCn) : null;
      const safeDescription = description ? sanitize(description) : "";

      const result = await pool.query(
        `INSERT INTO exams (code, title, title_cn, subject_id, duration, total_points, total_questions, description, difficulty_level, status, publish_date, is_premium, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'draft', NOW(), $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          examCode,
          safeTitle,
          safeTitleCn,
          subjectId,
          duration || 90,
          parsedTotalPoints,
          safeDescription,
          difficulty_level || 'medium',
          is_premium === true,
          solution_video_url ? sanitize(solution_video_url) : null,
          solution_description ? sanitize(solution_description) : null,
          shuffle_mode === true,
          vip_tier || 'basic',
          is_simulated === true,
        ],
      );

      cache.delByPrefix("exams:");
      cache.del("exams:lobby");

      UserActivity.log(req.user.id, 'admin.create_exam', { examId: result.rows[0].id, title, ip: req.ip, userAgent: req.headers['user-agent'] });

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
      // P0: destructure titleCn, descriptionCn
      const { title, titleCn, duration, totalPoints, description, difficulty_level, status, is_premium, allow_download, solution_video_url, solution_description, shuffle_mode, vip_tier, is_simulated } = req.body;
      const parsedTotalPoints =
        totalPoints === undefined
          ? undefined
          : parsePositiveNumber(totalPoints, 100);

      const updates = [];
      const params = [];
      let idx = 1;
      // P1: sanitize all text fields + P0: handle titleCn/descriptionCn
      if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(sanitize(title)); }
      if (titleCn !== undefined) { updates.push(`title_cn = $${idx++}`); params.push(titleCn ? sanitize(titleCn) : null); }
      if (duration !== undefined) { updates.push(`duration = $${idx++}`); params.push(duration); }
      if (parsedTotalPoints !== undefined) { updates.push(`total_points = $${idx++}`); params.push(parsedTotalPoints); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description ? sanitize(description) : null); }
      if (difficulty_level !== undefined) { updates.push(`difficulty_level = $${idx++}`); params.push(difficulty_level); }
      if (status !== undefined) { updates.push(`status = $${idx++}`); params.push(status); }
      if (is_premium !== undefined) { updates.push(`is_premium = $${idx++}`); params.push(is_premium === true); }
      if (allow_download !== undefined) { updates.push(`allow_download = $${idx++}`); params.push(allow_download === true); }
      if (solution_video_url !== undefined) { updates.push(`solution_video_url = $${idx++}`); params.push(solution_video_url ? sanitize(solution_video_url) : null); }
      if (solution_description !== undefined) { updates.push(`solution_description = $${idx++}`); params.push(solution_description ? sanitize(solution_description) : null); }
      if (shuffle_mode !== undefined) { updates.push(`shuffle_mode = $${idx++}`); params.push(shuffle_mode === true); }
      if (vip_tier !== undefined) { updates.push(`vip_tier = $${idx++}`); params.push(vip_tier); }
      if (is_simulated !== undefined) { updates.push(`is_simulated = $${idx++}`); params.push(is_simulated === true); }
      updates.push(`updated_at = NOW()`);
      params.push(examId);

      const result = await pool.query(
        `UPDATE exams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Clear exam list caches when exam data changes (especially on publish/unpublish)
      if (status !== undefined) {
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");
      }

      UserActivity.log(req.user.id, 'admin.update_exam', { examId, updates: req.body, ip: req.ip, userAgent: req.headers['user-agent'] });


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
        UserActivity.log(req.user.id, 'admin.delete_exam', { examId, ip: req.ip, userAgent: req.headers['user-agent'] });

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

  // ─── ADD QUESTION (hỗ trợ 6 loại câu hỏi) ──────────────────────────────
  async addQuestion(req, res) {
    try {
      const { examId } = req.params;
      const {
        questionType,        // Loại câu hỏi: single_choice | fill_blank_pool | fill_blank_item | reading_passage | reading_item
        questionText,       // Nội dung câu hỏi (tiếng Anh, optional)
        questionTextCn,     // Nội dung câu hỏi (tiếng Trung)
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,           // Mảng [{text, textCn, isCorrect}] — cho single_choice / reading_item
        correctAnswer,     // Key đúng: 'A','B','C','D' — cho single_choice / reading_item
        passageText,       // Đoạn văn đọc hiểu / điền từ
        passageImageUrl,
        passageGroupType,  // legacy alias cho questionType
        difficulty,
        linkedOptions,      // Pool A-F cho fill_blank_pool
        correctAnswerKey,   // 'A'/'B'... cho fill_blank_item
        subQuestionNumber,  // Số câu con trong đoạn (34, 35, 36...)
      } = req.body;

      // Resolve question type (hỗ trợ cả tên cũ)
      const qType = questionType || passageGroupType || QUESTION_TYPES.SINGLE_CHOICE;

      // Validation cơ bản
      if (qType !== QUESTION_TYPES.FILL_BLANK_ITEM && qType !== QUESTION_TYPES.FILL_BLANK_POOL && qType !== QUESTION_TYPES.READING_PASSAGE) {
        // Câu điền từ con, điền từ pool & đọc hiểu đầu đoạn KHÔNG bắt buộc questionText
        // (nội dung nằm trong passageText)
        const normQ = normalizeBilingualText(questionText, questionTextCn);
        if (!normQ) {
          return res.status(400).json({ message: "Câu hỏi phải có nội dung (Tiếng Anh hoặc Tiếng Trung)" });
        }
      }

      // Đọc hiểu: bắt buộc có passageText
      if (qType === QUESTION_TYPES.READING_PASSAGE) {
        if (!passageText || !passageText.trim()) {
          return res.status(400).json({ message: "Đọc hiểu cần có đoạn văn (passageText)" });
        }
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // ── Kiểm tra max questions ──
        const countResult = await client.query(
          "SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1",
          [examId],
        );
        if (countResult.rows[0].count >= MAX_QUESTIONS_PER_EXAM) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `Đề thi đã đạt giới hạn ${MAX_QUESTIONS_PER_EXAM} câu` });
        }

        const questionNumber = countResult.rows[0].count + 1;

        // ── Xác định passage_group_id và sub_question_number ──
        let passageGroupId = null;
        let subQn = null;

        if (qType === QUESTION_TYPES.READING_ITEM || qType === QUESTION_TYPES.FILL_BLANK_ITEM) {
          // Câu con: lấy group của câu cha gần nhất
          passageGroupId = await getLatestPassageGroupId(client, examId);
          if (!passageGroupId) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Không tìm thấy nhóm câu cha. Vui lòng thêm câu bắt đầu nhóm trước." });
          }
        }

        if (qType === QUESTION_TYPES.READING_ITEM || qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_ITEM) {
          // Đọc hiểu & Điền từ: số câu con
          subQn = subQuestionNumber || questionNumber;
        }

        // ── Normalize linked_options cho fill_blank_pool ──
        let linkedOpts = null;
        if (qType === QUESTION_TYPES.FILL_BLANK_POOL) {
          if (!passageText || !passageText.trim()) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Điền từ cần có đoạn văn với chỗ trống (passageText)" });
          }
          linkedOpts = normalizeLinkedOptions(linkedOptions || []);
          if (!linkedOpts || linkedOpts.length < 2) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Điền từ cần ít nhất 2 lựa chọn A-F" });
          }
        }

        // ── Validate answers: single_choice / reading_item ──
        if ((qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) && qType !== QUESTION_TYPES.FILL_BLANK_ITEM) {
          const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
          if (normAnswers.some(a => !a) || normAnswers.length < 2 || normAnswers.length > 8) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Cần từ 2 đến 8 đáp án" });
          }
        }

        // ── Validate correct answer: single_choice / reading_item ──
        if ((qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) && !correctAnswer) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Cần chọn đáp án đúng (correctAnswer)" });
        }

        // ── Validate correct answer: fill_blank_item ──
        if (qType === QUESTION_TYPES.FILL_BLANK_ITEM && !correctAnswerKey) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Câu điền từ cần chỉ định đáp án đúng (correctAnswerKey)" });
        }

        // ── INSERT câu hỏi ──
        const normQ = normalizeBilingualText(questionText, questionTextCn);
        const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

        const questionResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, explanation, explanation_cn,
             image_url,
             passage_text, passage_image_url,
             question_group_type, difficulty,
             linked_options, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING id`,
          [
            examId,
            questionNumber,
            qType,
            sanitize(normQ?.en || ''),
            sanitize(normQ?.cn || ''),
            parsedPoints,
            explanation ? sanitize(explanation) : null,
            explanationCn ? sanitize(explanationCn) : null,
            imageUrl ? sanitize(imageUrl) : null,
            passageText ? sanitize(passageText) : null,
            passageImageUrl ? sanitize(passageImageUrl) : null,
            qType,
            difficulty || null,
            linkedOpts ? JSON.stringify(linkedOpts) : null,
            subQn,
            passageGroupId,
          ],
        );

        const questionId = questionResult.rows[0].id;

        // ── UPDATE passage_group_id cho câu đầu đoạn ──
        if (qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_POOL) {
          await client.query(
            "UPDATE questions SET passage_group_id = id WHERE id = $1",
            [questionId],
          );
        }

        // ── INSERT answers: single_choice / reading_item ──
        if (qType === QUESTION_TYPES.SINGLE_CHOICE || qType === QUESTION_TYPES.READING_ITEM) {
          const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < normAnswers.length; i++) {
            const key = answerKeys[i];
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                questionId,
                key,
                sanitize(normAnswers[i].en),
                sanitize(normAnswers[i].cn),
                key === correctAnswer,
                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
              ],
            );
          }
        }

        // ── UPDATE exam total_questions ──
        await client.query(
          "UPDATE exams SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1",
          [examId],
        );

        await client.query("COMMIT");

        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, 'admin.add_question', {
          examId, questionId, questionType: qType,
          ip: req.ip, userAgent: req.headers['user-agent']
        });

        res.status(201).json({
          message: "Question added",
          questionId,
          questionType: qType,
          questionNumber,
          passageGroupId: qType === QUESTION_TYPES.READING_PASSAGE || qType === QUESTION_TYPES.FILL_BLANK_POOL ? questionId : passageGroupId,
        });
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

  // Update question (hỗ trợ đủ 6 loại câu hỏi)
  async updateQuestion(req, res) {
    try {
      const { questionId } = req.params;
      const {
        questionType,
        questionText,
        questionTextCn,
        imageUrl,
        points,
        explanation,
        explanationCn,
        answers,
        correctAnswer,
        passageText,
        passageImageUrl,
        questionGroupType,
        difficulty,
        linkedOptions,
        correctAnswerKey,
        subQuestionNumber,
      } = req.body;

      const hasQuestionTextPayload = questionText !== undefined || questionTextCn !== undefined;
      const normalizedQuestion = hasQuestionTextPayload ? normalizeBilingualText(questionText, questionTextCn) : null;

      if (hasQuestionTextPayload && !normalizedQuestion) {
        return res.status(400).json({ message: "Câu hỏi không thể trống ở cả hai ngôn ngữ" });
      }

      const parsedPoints = points !== undefined
        ? clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION)
        : undefined;

      // Normalize linked_options
      let linkedOpts = undefined;
      if (linkedOptions !== undefined) {
        if (linkedOptions === null || linkedOptions === '') {
          linkedOpts = null;
        } else {
          linkedOpts = normalizeLinkedOptions(linkedOptions);
        }
      }

      const qType = questionType || questionGroupType;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Update question (sanitized) — chỉ update fields được gửi lên
        const fields = [];
        const vals = [];
        let idx = 1;

        if (normalizedQuestion) {
          fields.push(`question_text = $${idx++}`);
          vals.push(sanitize(normalizedQuestion.en));
          fields.push(`question_text_cn = $${idx++}`);
          vals.push(sanitize(normalizedQuestion.cn));
        }
        if (imageUrl !== undefined) {
          fields.push(`image_url = $${idx++}`);
          vals.push(imageUrl ? sanitize(imageUrl) : null);
        }
        if (parsedPoints !== undefined) {
          fields.push(`points = $${idx++}`);
          vals.push(parsedPoints);
        }
        if (explanation !== undefined) {
          fields.push(`explanation = $${idx++}`);
          vals.push(explanation ? sanitize(explanation) : null);
        }
        if (explanationCn !== undefined) {
          fields.push(`explanation_cn = $${idx++}`);
          vals.push(explanationCn ? sanitize(explanationCn) : null);
        }
        if (passageText !== undefined) {
          fields.push(`passage_text = $${idx++}`);
          vals.push(passageText ? sanitize(passageText) : null);
        }
        if (passageImageUrl !== undefined) {
          fields.push(`passage_image_url = $${idx++}`);
          vals.push(passageImageUrl ? sanitize(passageImageUrl) : null);
        }
        if (qType !== undefined) {
          fields.push(`question_type = $${idx++}`);
          vals.push(qType);
          fields.push(`question_group_type = $${idx++}`);
          vals.push(qType);
        }
        if (difficulty !== undefined) {
          fields.push(`difficulty = $${idx++}`);
          vals.push(difficulty || null);
        }
        if (linkedOpts !== undefined) {
          fields.push(`linked_options = $${idx++}`);
          vals.push(linkedOpts ? JSON.stringify(linkedOpts) : null);
        }
        if (subQuestionNumber !== undefined) {
          fields.push(`sub_question_number = $${idx++}`);
          vals.push(subQuestionNumber || null);
        }

        if (fields.length > 0) {
          vals.push(questionId);
          await client.query(
            `UPDATE questions SET ${fields.join(', ')} WHERE id = $${idx}`,
            vals,
          );
        }

        // Update answers — chỉ cho single_choice / reading_item
        if (answers && answers.length >= 2 && answers.length <= 8) {
          if (qType === 'fill_blank_pool' || qType === 'fill_blank_item') {
            // Điền từ: không dùng bảng answers
          } else {
            const normalizedAnswers = answers.map(a => normalizeBilingualText(a.text, a.textCn));
            if (normalizedAnswers.some(a => !a)) {
              await client.query("ROLLBACK");
              return res.status(400).json({ message: "Mỗi đáp án phải có nội dung" });
            }
            await client.query("DELETE FROM answers WHERE question_id = $1", [questionId]);
            const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
            for (let i = 0; i < answers.length; i++) {
              const key = answerKeys[i];
              await client.query(
                `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  questionId,
                  key,
                  sanitize(normalizedAnswers[i].en),
                  sanitize(normalizedAnswers[i].cn),
                  key === correctAnswer,
                  answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
                ],
              );
            }
          }
        }

        await client.query("COMMIT");
        UserActivity.log(req.user.id, 'admin.update_question', { questionId, ip: req.ip, userAgent: req.headers['user-agent'] });
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
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Question not found" });
        }

        const examId = examResult.rows[0].exam_id;

        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        await client.query("DELETE FROM questions WHERE id = $1", [questionId]);
        await client.query(
          "UPDATE exams SET total_questions = total_questions - 1, updated_at = NOW() WHERE id = $1",
          [examId],
        );

        await client.query("COMMIT");

        UserActivity.log(req.user.id, 'admin.delete_question', { examId, questionId, ip: req.ip, userAgent: req.headers['user-agent'] });

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

    // ── Question insertion at specific position ────────────────────────────────
    // POST /api/admin/exams/:examId/questions/insert
    // Body: { questionData: {...}, afterQuestionId?: number, atPosition?: number }
    // afterQuestionId: insert AFTER this question ID (shifts all after by +1)
    // atPosition: insert at this question_number (shifts all >= atPosition by +1)
    async insertQuestion(req, res) {
        const MAX_RETRIES = 5;

        const { examId } = req.params;
        const { questionData, afterQuestionId, atPosition } = req.body || {};

        if (!questionData) {
            return res.status(400).json({ message: "questionData là bắt buộc" });
        }

        const {
            questionType, questionText, questionTextCn, imageUrl,
            points, explanation, explanationCn, answers, correctAnswer,
            passageText, passageImageUrl, difficulty, linkedOptions,
            correctAnswerKey, subQuestionNumber,
        } = questionData;

        const qType = questionType || 'single_choice';

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                // ── Serialize concurrent inserts to the same exam ──
                await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

                // ── Determine target position ──
                let targetPosition;
                if (atPosition !== undefined && atPosition > 0) {
                    targetPosition = atPosition;
                } else if (afterQuestionId) {
                    const afterRes = await client.query(
                        "SELECT question_number FROM questions WHERE id = $1 AND exam_id = $2",
                        [afterQuestionId, examId],
                    );
                    if (afterRes.rows.length === 0) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Không tìm thấy câu hỏi để chèn sau" });
                    }
                    targetPosition = afterRes.rows[0].question_number + 1;
                } else {
                    // Default: append at end
                    const countRes = await client.query(
                        "SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1",
                        [examId],
                    );
                    targetPosition = countRes.rows[0].count + 1;
                }

                // ── Shift all questions at or after targetPosition by +1 ──
                await client.query(
                    `UPDATE questions AS q
                     SET question_number = q.question_number + 1
                     FROM (
                         SELECT id FROM questions
                         WHERE exam_id = $1 AND question_number >= $2
                         ORDER BY question_number DESC
                     ) AS sub
                     WHERE q.id = sub.id`,
                    [examId, targetPosition],
                );

                // ── Handle passage_group for sub-questions ──
                let passageGroupId = null;
                let subQn = subQuestionNumber || targetPosition;

                if (qType === 'reading_item' || qType === 'fill_blank_item') {
                    passageGroupId = await getLatestPassageGroupId(client, examId);
                    if (!passageGroupId) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Không tìm thấy nhóm câu cha" });
                    }
                }

                if (qType === 'reading_passage' || qType === 'fill_blank_pool') {
                    // Will self-assign after insert
                }

                // ── Normalize linked_options ──
                let linkedOpts = null;
                if (qType === 'fill_blank_pool') {
                    linkedOpts = normalizeLinkedOptions(linkedOptions || []);
                    if (!linkedOpts || linkedOpts.length < 2) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Điền từ cần ít nhất 2 lựa chọn" });
                    }
                }

                // ── Validation ──
                if (qType !== 'fill_blank_item' && qType !== 'fill_blank_pool' && qType !== 'reading_passage') {
                    const normQ = normalizeBilingualText(questionText, questionTextCn);
                    if (!normQ) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Câu hỏi phải có nội dung" });
                    }
                }

                if (qType === 'fill_blank_pool') {
                    if (!passageText || !passageText.trim()) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Điền từ cần có đoạn văn với chỗ trống (passageText)" });
                    }
                }

                if (qType === 'reading_passage') {
                    if (!passageText || !passageText.trim()) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Đọc hiểu cần có đoạn văn (passageText)" });
                    }
                }

                if ((qType === 'single_choice' || qType === 'reading_item') && qType !== 'fill_blank_item') {
                    const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
                    if (normAnswers.some(a => !a) || normAnswers.length < 2) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Cần ít nhất 2 đáp án" });
                    }
                    if (!correctAnswer) {
                        await client.query("ROLLBACK");
                        return res.status(400).json({ message: "Cần chọn đáp án đúng (correctAnswer)" });
                    }
                }

                // ── Insert the new question ──
                const normQ = normalizeBilingualText(questionText, questionTextCn);
                const parsedPoints = clamp(parsePositiveNumber(points, 1), 0.1, MAX_POINTS_PER_QUESTION);

                const questionResult = await client.query(
                    `INSERT INTO questions (
                        exam_id, question_number, question_type,
                        question_text, question_text_cn,
                        points, explanation, explanation_cn,
                        image_url, passage_text, passage_image_url,
                        question_group_type, difficulty,
                        linked_options, sub_question_number, passage_group_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING id`,
                    [
                        examId, targetPosition, qType,
                        sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
                        parsedPoints,
                        explanation ? sanitize(explanation) : null,
                        explanationCn ? sanitize(explanationCn) : null,
                        imageUrl ? sanitize(imageUrl) : null,
                        passageText ? sanitize(passageText) : null,
                        passageImageUrl ? sanitize(passageImageUrl) : null,
                        qType, difficulty || null,
                        linkedOpts ? JSON.stringify(linkedOpts) : null,
                        subQn, passageGroupId,
                    ],
                );

                const questionId = questionResult.rows[0].id;

                // Self-assign passage_group_id for passage-starting questions
                if (qType === 'reading_passage' || qType === 'fill_blank_pool') {
                    await client.query(
                        "UPDATE questions SET passage_group_id = id WHERE id = $1",
                        [questionId],
                    );
                }

                // ── Insert answers ──
                if (qType === 'single_choice' || qType === 'reading_item') {
                    const normAnswers = (answers || []).map(a => normalizeBilingualText(a.text, a.textCn));
                    const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                    for (let i = 0; i < normAnswers.length; i++) {
                        const key = answerKeys[i];
                        await client.query(
                            `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [
                                questionId, key,
                                sanitize(normAnswers[i].en), sanitize(normAnswers[i].cn),
                                key === correctAnswer,
                                answers[i]?.imageUrl ? sanitize(answers[i].imageUrl) : null,
                            ],
                        );
                    }
                }

                // ── Update exam total_questions ──
                await client.query(
                    "UPDATE exams SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1",
                    [examId],
                );

                await client.query("COMMIT");

                cache.delByPrefix("exams:");
                cache.del("exams:lobby");

                UserActivity.log(req.user.id, 'admin.insert_question', {
                    examId, questionId, targetPosition, questionType: qType,
                    ip: req.ip, userAgent: req.headers['user-agent']
                });

                res.status(201).json({
                    message: "Câu hỏi đã được chèn",
                    questionId,
                    questionNumber: targetPosition,
                    questionType: qType,
                });
            } catch (error) {
                await client.query("ROLLBACK");
                // Chỉ retry khi gặp duplicate key (23505), không retry các lỗi khác
                const isDuplicateKey =
                    error.code === '23505' &&
                    error.constraint === 'questions_exam_id_question_number_key';

                if (isDuplicateKey) {
                    console.warn(`[insertQuestion] Duplicate key on attempt ${attempt + 1}, retrying...`);
                    client.release();
                    continue; // thử lại với vị trí mới
                }

                console.error("Insert question error:", error);
                client.release();
                return res.status(500).json({ message: "Failed to insert question" });
            }
        } // end for

        // Nếu hết retries mà vẫn lỗi
        return res.status(500).json({ message: "Failed to insert question after retries" });
    },

    // ── P2: Question reordering ─────────────────────────────────────────────────
    // PUT /api/admin/exams/:examId/questions/reorder
    // Body: { orderedIds: [id1, id2, id3, ...] }
    async reorderQuestions(req, res) {
        try {
            const { examId } = req.params;
            const { orderedIds } = req.body;

            if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
                return res.status(400).json({ message: "orderedIds phải là mảng không rỗng" });
            }

            const client = await pool.connect();
            try {
                await client.query("BEGIN");

                // ── Serialize concurrent operations on the same exam ──
                await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

                // Verify all questions belong to this exam
                const verifyResult = await client.query(
                    `SELECT id FROM questions WHERE exam_id = $1 AND id = ANY($2::int[])`,
                    [examId, orderedIds],
                );
                if (verifyResult.rows.length !== orderedIds.length) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ message: "Một số câu hỏi không thuộc đề thi này" });
                }

                // Update question_number for each question
                for (let i = 0; i < orderedIds.length; i++) {
                    await client.query(
                        "UPDATE questions SET question_number = $1 WHERE id = $2",
                        [i + 1, orderedIds[i]],
                    );
                }

                await client.query("COMMIT");

                UserActivity.log(req.user.id, 'admin.reorder_questions', {
                    examId, orderedIds,
                    ip: req.ip, userAgent: req.headers['user-agent']
                });

                res.json({ message: "Sắp xếp lại thứ tự câu hỏi thành công" });
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Reorder questions error:", error);
            res.status(500).json({ message: "Failed to reorder questions" });
        }
    },

  // Get all exams (for admin dashboard)
  async getAllExams(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const type = req.query.type; // 'phong-thi' | 'tu-do' | 'mo-phong' | undefined (all)

      let whereClause = '';
      if (type === 'phong-thi') {
        whereClause = 'WHERE e.start_time IS NOT NULL';
      } else if (type === 'tu-do') {
        whereClause = 'WHERE e.start_time IS NULL AND e.is_simulated = false';
      } else if (type === 'mo-phong') {
        whereClause = 'WHERE e.start_time IS NULL AND e.is_simulated = true';
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM exams e ${whereClause}`,
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
                    e.vip_tier,
                    e.is_simulated,
                    e.start_time,
                    e.end_time,
                    e.created_at,
                    s.name as subject_name,
                    s.code as subject_code,
                    COUNT(DISTINCT ea.id) as attempts_count
                FROM exams e
                LEFT JOIN subjects s ON e.subject_id = s.id
                LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
                ${whereClause}
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

  // GET /api/admin/exams/stats - Tổng hợp thống kê tất cả đề thi
  async getStats(req, res) {
    try {
      // Stats tổng quan
      const overviewQuery = `
        SELECT
          COUNT(DISTINCT e.id)::INTEGER as total_exams,
          COUNT(DISTINCT CASE WHEN e.status = 'published' THEN e.id END)::INTEGER as published_exams,
          COUNT(DISTINCT CASE WHEN e.start_time IS NOT NULL THEN e.id END)::INTEGER as phong_thi_count,
          COUNT(DISTINCT CASE WHEN e.start_time IS NULL THEN e.id END)::INTEGER as tu_do_count,
          COUNT(DISTINCT ea.id)::INTEGER as total_attempts,
          COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END)::INTEGER as completed_attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT ea.id), 0) * 100, 1
            ), 0
          )::DECIMAL as completion_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_score_percentage,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
          )::DECIMAL as avg_score_points
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
      `;
      const overviewResult = await pool.query(overviewQuery);
      const overview = overviewResult.rows[0];

      // Top 5 đề thi có nhiều lượt thi nhất
      const topExamsQuery = `
        SELECT
          e.id,
          e.title,
          s.name as subject_name,
          e.difficulty_level,
          COUNT(DISTINCT ea.id)::INTEGER as attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_percentage,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END), 0
          )::DECIMAL as avg_score_points
        FROM exams e
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        LEFT JOIN subjects s ON e.subject_id = s.id
        GROUP BY e.id, e.title, s.name, e.difficulty_level
        HAVING COUNT(DISTINCT ea.id) > 0
        ORDER BY attempts DESC
        LIMIT 5
      `;
      const topExamsResult = await pool.query(topExamsQuery);

      // Stats theo môn
      const subjectStatsQuery = `
        SELECT
          s.id as subject_id,
          s.name as subject_name,
          s.code as subject_code,
          COUNT(DISTINCT e.id)::INTEGER as exam_count,
          COUNT(DISTINCT ea.id)::INTEGER as total_attempts,
          COALESCE(
            ROUND(
              COUNT(DISTINCT CASE WHEN
                ea.status = 'completed' AND
                ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100 >= 60
              THEN ea.id END)::DECIMAL /
              NULLIF(COUNT(DISTINCT CASE WHEN ea.status = 'completed' THEN ea.id END), 0) * 100, 1
            ), 0
          )::DECIMAL as pass_rate,
          COALESCE(
            AVG(CASE WHEN ea.status = 'completed'
              THEN ea.total_score::DECIMAL / NULLIF(e.total_questions, 0) * 100
            END), 0
          )::DECIMAL as avg_percentage
        FROM subjects s
        LEFT JOIN exams e ON e.subject_id = s.id AND e.status = 'published'
        LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
        GROUP BY s.id, s.name, s.code
        HAVING COUNT(DISTINCT ea.id) > 0
        ORDER BY total_attempts DESC
      `;
      const subjectStatsResult = await pool.query(subjectStatsQuery);

      res.json({
        success: true,
        data: {
          overview: {
            totalExams: parseInt(overview.total_exams) || 0,
            publishedExams: parseInt(overview.published_exams) || 0,
            phongThiCount: parseInt(overview.phong_thi_count) || 0,
            tuDoCount: parseInt(overview.tu_do_count) || 0,
            totalAttempts: parseInt(overview.total_attempts) || 0,
            completedAttempts: parseInt(overview.completed_attempts) || 0,
            completionRate: parseFloat(overview.completion_rate) || 0,
            avgScorePercentage: parseFloat(overview.avg_score_percentage) || 0,
            avgScorePoints: parseFloat(overview.avg_score_points) || 0,
          },
          topExams: topExamsResult.rows.map((r) => ({
            id: r.id,
            title: r.title,
            subjectName: r.subject_name,
            difficultyLevel: r.difficulty_level,
            attempts: parseInt(r.attempts) || 0,
            passRate: parseFloat(r.pass_rate) || 0,
            avgPercentage: parseFloat(r.avg_percentage) || 0,
            avgScorePoints: parseFloat(r.avg_score_points) || 0,
          })),
          subjectStats: subjectStatsResult.rows.map((r) => ({
            subjectId: r.subject_id,
            subjectName: r.subject_name,
            subjectCode: r.subject_code,
            examCount: parseInt(r.exam_count) || 0,
            totalAttempts: parseInt(r.total_attempts) || 0,
            passRate: parseFloat(r.pass_rate) || 0,
            avgPercentage: parseFloat(r.avg_percentage) || 0,
          })),
        },
      });
    } catch (error) {
      console.error("Get exam stats error:", error);
      res.status(500).json({ message: "Failed to get exam stats" });
    }
  },

  // GET /api/admin/exams/counts - Get exam counts by type
  async getCounts(req, res) {
    try {
      const [total, phongThi, tuDo, moPhong] = await Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM exams'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE start_time IS NOT NULL'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE start_time IS NULL AND is_simulated = false'),
        pool.query('SELECT COUNT(*)::int as count FROM exams WHERE start_time IS NULL AND is_simulated = true'),
      ]);
      res.json({
        all: parseInt(total.rows[0].count),
        phongThi: parseInt(phongThi.rows[0].count),
        tuDo: parseInt(tuDo.rows[0].count),
        moPhong: parseInt(moPhong.rows[0].count),
      });
    } catch (error) {
      console.error("Get exam counts error:", error);
      res.status(500).json({ message: "Failed to get counts" });
    }
  },

  // Get exam with questions
  async getExamWithQuestions(req, res) {
    try {
      const { examId } = req.params;

      const examResult = await pool.query("SELECT * FROM exams WHERE id = $1", [examId]);
      if (examResult.rows.length === 0) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Lấy câu hỏi + đáp án + linked_options (từ cha cho fill_blank_item)
      const questionsResult = await pool.query(
        `SELECT
           q.id,
           q.exam_id,
           q.question_number,
           q.question_type,
           q.question_text,
           q.question_text_cn,
           q.image_url,
           q.points,
           q.explanation,
           q.explanation_cn,
           q.passage_text,
           q.passage_image_url,
           q.question_group_type,
           q.difficulty,
           q.linked_options,
           q.sub_question_number,
           q.passage_group_id,
           -- Lấy linked_options từ câu cha (fill_blank_item → fill_blank_pool)
           COALESCE(
             q.linked_options,
             (SELECT linked_options FROM questions parent
              WHERE parent.id = q.passage_group_id
                AND parent.question_type = 'fill_blank_pool')
           ) as effective_linked_options,
           -- Lấy passage_text từ câu cha (cho reading_item / fill_blank_item)
           COALESCE(
             q.passage_text,
             (SELECT passage_text FROM questions parent
              WHERE parent.id = q.passage_group_id
                AND parent.passage_text IS NOT NULL
              ORDER BY parent.id LIMIT 1)
           ) as effective_passage_text,
           json_agg(
             json_build_object(
               'id', a.id,
               'answer_key', a.answer_key,
               'answer_text', a.answer_text,
               'answer_text_cn', a.answer_text_cn,
               'image_url', a.image_url,
               'is_correct', a.is_correct
             ) ORDER BY a.answer_key
           ) FILTER (WHERE a.id IS NOT NULL) as answers
         FROM questions q
         LEFT JOIN answers a ON q.id = a.question_id
         WHERE q.exam_id = $1
         GROUP BY q.id
         ORDER BY q.question_number, q.id`,
        [examId],
      );

      // Parse linked_options từ JSONB string
      const questions = questionsResult.rows.map(q => ({
        ...q,
        linked_options: q.linked_options
          ? (typeof q.linked_options === 'string' ? JSON.parse(q.linked_options) : q.linked_options)
          : null,
        effective_linked_options: q.effective_linked_options
          ? (typeof q.effective_linked_options === 'string' ? JSON.parse(q.effective_linked_options) : q.effective_linked_options)
          : null,
      }));

      res.json({
        exam: examResult.rows[0],
        questions,
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
      // P0 fix: accept BOTH startTime (old) and start_time (frontend camelCase standard)
      const { startTime, endTime, start_time, end_time, maxParticipants, reason } = req.body;
      const adminId = req.user.id;
      const adminName = req.user.full_name || req.user.username || `User#${adminId}`;

      const sTime = startTime || start_time;
      const eTime = endTime || end_time;
      if (!sTime || !eTime) {
        return res.status(400).json({ message: 'start_time và end_time là bắt buộc' });
      }
      const start = new Date(sTime);
      const end = new Date(eTime);
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

  // ── FILL BLANK GROUP (pool + sub-items) ────────────────────────────────────
  // POST /api/admin/exams/:examId/fill-blank-group
  async insertFillBlankGroup(req, res) {
    try {
      const { examId } = req.params;
      const {
        passageText,
        passageImageUrl,
        linkedOptions,
        subItems,
      } = req.body;

      if (!passageText || !passageText.trim()) {
        return res.status(400).json({ message: 'Điền từ cần có đoạn văn (passageText)' });
      }

      const normalizedOpts = normalizeLinkedOptions(linkedOptions || []);
      if (!normalizedOpts || normalizedOpts.length < 2) {
        return res.status(400).json({ message: 'Cần ít nhất 2 từ chọn A-F có nội dung' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        // Count existing questions
        const countRes = await client.query(
          'SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1',
          [examId]
        );
        let questionNumber = countRes.rows[0].count + 1;
        const startNumber = questionNumber;

        // Insert the FILL_BLANK_POOL question (passage + pool)
        const poolResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, passage_text, passage_image_url,
             question_group_type, difficulty,
             linked_options, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            examId, questionNumber, QUESTION_TYPES.FILL_BLANK_POOL,
            'Điền từ', '填空',
            0,  // pool không tính điểm
            sanitize(passageText),
            passageImageUrl ? sanitize(passageImageUrl) : null,
            QUESTION_TYPES.FILL_BLANK_POOL, 'medium',
            JSON.stringify(normalizedOpts), null, null,
          ]
        );
        const poolId = poolResult.rows[0].id;

        // Self-assign passage_group_id
        await client.query(
          'UPDATE questions SET passage_group_id = id WHERE id = $1',
          [poolId]
        );

        // Insert sub-items (fill_blank_items)
        const insertedSubQuestions = [];
        const validSubItems = Array.isArray(subItems) ? subItems.filter(
          item => item.correctAnswerKey && normalizedOpts.some(o => o.key === item.correctAnswerKey)
        ) : [];

        for (const item of validSubItems) {
          questionNumber++;
          const parsedPoints = clamp(parsePositiveNumber(item.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
          const normQ = normalizeBilingualText(item.questionText, item.questionTextCn);
          const subResult = await client.query(
            `INSERT INTO questions (
               exam_id, question_number, question_type,
               question_text, question_text_cn,
               points, explanation, explanation_cn,
               question_group_type, difficulty,
               sub_question_number, passage_group_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              examId, questionNumber, QUESTION_TYPES.FILL_BLANK_ITEM,
              sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
              parsedPoints,
              item.explanation ? sanitize(item.explanation) : null,
              item.explanationCn ? sanitize(item.explanationCn) : null,
              QUESTION_TYPES.FILL_BLANK_ITEM,
              item.difficulty || 'medium',
              item.subQuestionNumber || questionNumber,
              poolId,
            ]
          );
          insertedSubQuestions.push({
            id: subResult.rows[0].id,
            questionNumber,
            correctAnswerKey: item.correctAnswerKey,
          });
        }

        // Update exam total_questions
        await client.query(
          'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
          [1 + insertedSubQuestions.length, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.insert_fill_blank_group', {
          examId, poolId, subQuestions: insertedSubQuestions.length,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.status(201).json({
          message: 'Nhóm điền từ đã được tạo',
          groupId: poolId,
          questionNumber: startNumber,
          subQuestions: insertedSubQuestions,
          totalItems: 1 + insertedSubQuestions.length,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Insert fill blank group error:', error);
      res.status(500).json({ message: 'Failed to create fill blank group' });
    }
  },

  // PUT /api/admin/exams/:examId/fill-blank-group/:groupId
  async updateFillBlankGroup(req, res) {
    try {
      const { examId, groupId } = req.params;
      const {
        passageText,
        passageImageUrl,
        linkedOptions,
        subItems,
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        // Update pool question
        const updates = [];
        const vals = [];
        let idx = 1;

        if (passageText !== undefined) {
          updates.push(`passage_text = $${idx++}`);
          vals.push(passageText ? sanitize(passageText) : null);
        }
        if (passageImageUrl !== undefined) {
          updates.push(`passage_image_url = $${idx++}`);
          vals.push(passageImageUrl ? sanitize(passageImageUrl) : null);
        }
        if (linkedOptions !== undefined) {
          const normalizedOpts = normalizeLinkedOptions(linkedOptions || []);
          updates.push(`linked_options = $${idx++}`);
          vals.push(normalizedOpts ? JSON.stringify(normalizedOpts) : null);
        }

        if (updates.length > 0) {
          vals.push(groupId);
          await client.query(
            `UPDATE questions SET ${updates.join(', ')} WHERE id = $${idx}`,
            vals
          );
        }

        // Update sub-items
        if (Array.isArray(subItems)) {
          // Delete existing sub-items
          await client.query(
            'DELETE FROM questions WHERE passage_group_id = $1 AND question_type = $2',
            [groupId, QUESTION_TYPES.FILL_BLANK_ITEM]
          );

          // Get current max question_number for this exam
          const countRes = await client.query(
            'SELECT COALESCE(MAX(question_number), 0)::int as max_num FROM questions WHERE exam_id = $1',
            [examId]
          );
          let questionNumber = countRes.rows[0].max_num;

          const normalizedOpts = normalizeLinkedOptions(linkedOptions || []) || [];
          const insertedSubs = [];

          for (const item of subItems) {
            if (!item.correctAnswerKey) continue;
            if (normalizedOpts.length > 0 && !normalizedOpts.some(o => o.key === item.correctAnswerKey)) continue;

            questionNumber++;
            const parsedPoints = clamp(parsePositiveNumber(item.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
            const normQ = normalizeBilingualText(item.questionText, item.questionTextCn);

            const subResult = await client.query(
              `INSERT INTO questions (
                 exam_id, question_number, question_type,
                 question_text, question_text_cn,
                 points, explanation, explanation_cn,
                 question_group_type, difficulty,
                 sub_question_number, passage_group_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               RETURNING id`,
              [
                examId, questionNumber, QUESTION_TYPES.FILL_BLANK_ITEM,
                sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
                parsedPoints,
                item.explanation ? sanitize(item.explanation) : null,
                item.explanationCn ? sanitize(item.explanationCn) : null,
                QUESTION_TYPES.FILL_BLANK_ITEM,
                item.difficulty || 'medium',
                item.subQuestionNumber || questionNumber,
                groupId,
              ]
            );
            insertedSubs.push({ id: subResult.rows[0].id, questionNumber });
          }

          // Update exam total_questions
          const netChange = 1 + insertedSubs.length;
          await client.query(
            'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
            [netChange, examId]
          );
        }

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.update_fill_blank_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Nhóm điền từ đã được cập nhật' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update fill blank group error:', error);
      res.status(500).json({ message: 'Failed to update fill blank group' });
    }
  },

  // DELETE /api/admin/exams/:examId/fill-blank-group/:groupId
  async deleteFillBlankGroup(req, res) {
    try {
      const { examId, groupId } = req.params;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        // Count sub-questions to update total
        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM questions
           WHERE passage_group_id = $1 AND question_type = $2`,
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM]
        );
        const subCount = countRes.rows[0].count;
        const totalDelete = 1 + subCount;

        // Delete sub-questions first
        await client.query(
          'DELETE FROM questions WHERE passage_group_id = $1',
          [groupId]
        );
        // Delete pool question
        await client.query('DELETE FROM questions WHERE id = $1', [groupId]);

        // Update exam total
        await client.query(
          'UPDATE exams SET total_questions = GREATEST(0, total_questions - $1), updated_at = NOW() WHERE id = $2',
          [totalDelete, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.delete_fill_blank_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Nhóm điền từ đã được xóa' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Delete fill blank group error:', error);
      res.status(500).json({ message: 'Failed to delete fill blank group' });
    }
  },

  // ── READING PASSAGE GROUP (passage + sub-questions) ──────────────────────────
  // POST /api/admin/exams/:examId/reading-passage-group
  async insertReadingPassageGroup(req, res) {
    try {
      const { examId } = req.params;
      const {
        passageText,
        passageImageUrl,
        subQuestions,
      } = req.body;

      if (!passageText || !passageText.trim()) {
        return res.status(400).json({ message: 'Đọc hiểu cần có đoạn văn (passageText)' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        const countRes = await client.query(
          'SELECT COUNT(*)::int as count FROM questions WHERE exam_id = $1',
          [examId]
        );
        let questionNumber = countRes.rows[0].count + 1;
        const startNumber = questionNumber;

        // Insert READING_PASSAGE question
        const passageResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, passage_text, passage_image_url,
             question_group_type, sub_question_number, passage_group_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            examId, questionNumber, QUESTION_TYPES.READING_PASSAGE,
            'Đoạn văn đọc hiểu', '阅读理解',
            0, sanitize(passageText),
            passageImageUrl ? sanitize(passageImageUrl) : null,
            QUESTION_TYPES.READING_PASSAGE, null, null,
          ]
        );
        const passageId = passageResult.rows[0].id;
        await client.query(
          'UPDATE questions SET passage_group_id = id WHERE id = $1',
          [passageId]
        );

        // Insert sub-questions
        const insertedSubs = [];
        const validSubQs = Array.isArray(subQuestions) ? subQuestions.filter(
          q => q.correctAnswer && Array.isArray(q.answers) && q.answers.length >= 2
        ) : [];

        for (const q of validSubQs) {
          questionNumber++;
          const parsedPoints = clamp(parsePositiveNumber(q.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
          const normQ = normalizeBilingualText(q.questionText, q.questionTextCn);

          const subResult = await client.query(
            `INSERT INTO questions (
               exam_id, question_number, question_type,
               question_text, question_text_cn,
               points, explanation, explanation_cn,
               question_group_type, difficulty,
               sub_question_number, passage_group_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
              examId, questionNumber, QUESTION_TYPES.READING_ITEM,
              sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
              parsedPoints,
              q.explanation ? sanitize(q.explanation) : null,
              q.explanationCn ? sanitize(q.explanationCn) : null,
              QUESTION_TYPES.READING_ITEM,
              q.difficulty || 'medium',
              q.subQuestionNumber || questionNumber,
              passageId,
            ]
          );
          const subId = subResult.rows[0].id;

          // Insert answers
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          for (let i = 0; i < q.answers.length; i++) {
            const normA = normalizeBilingualText(q.answers[i].text, q.answers[i].textCn);
            if (!normA) continue;
            await client.query(
              `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                subId, answerKeys[i],
                sanitize(normA.en), sanitize(normA.cn),
                answerKeys[i] === q.correctAnswer,
                q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
              ]
            );
          }

          insertedSubs.push({ id: subId, questionNumber, correctAnswer: q.correctAnswer });
        }

        await client.query(
          'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
          [1 + insertedSubs.length, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.insert_reading_passage_group', {
          examId, passageId, subQuestions: insertedSubs.length,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.status(201).json({
          message: 'Đoạn đọc hiểu đã được tạo',
          groupId: passageId,
          questionNumber: startNumber,
          subQuestions: insertedSubs,
          totalItems: 1 + insertedSubs.length,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Insert reading passage group error:', error);
      res.status(500).json({ message: 'Failed to create reading passage group' });
    }
  },

  // PUT /api/admin/exams/:examId/reading-passage-group/:groupId
  async updateReadingPassageGroup(req, res) {
    try {
      const { examId, groupId } = req.params;
      const {
        passageText,
        passageImageUrl,
        subQuestions,
      } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        // Update passage
        const updates = [];
        const vals = [];
        let idx = 1;

        if (passageText !== undefined) {
          updates.push(`passage_text = $${idx++}`);
          vals.push(passageText ? sanitize(passageText) : null);
        }
        if (passageImageUrl !== undefined) {
          updates.push(`passage_image_url = $${idx++}`);
          vals.push(passageImageUrl ? sanitize(passageImageUrl) : null);
        }

        if (updates.length > 0) {
          vals.push(groupId);
          await client.query(
            `UPDATE questions SET ${updates.join(', ')} WHERE id = $${idx}`,
            vals
          );
        }

        // Update sub-questions
        if (Array.isArray(subQuestions)) {
          await client.query(
            'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1 AND question_type = $2)',
            [groupId, QUESTION_TYPES.READING_ITEM]
          );
          await client.query(
            'DELETE FROM questions WHERE passage_group_id = $1 AND question_type = $2',
            [groupId, QUESTION_TYPES.READING_ITEM]
          );

          const countRes = await client.query(
            'SELECT COALESCE(MAX(question_number), 0)::int as max_num FROM questions WHERE exam_id = $1',
            [examId]
          );
          let questionNumber = countRes.rows[0].max_num;
          const answerKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const insertedSubs = [];

          for (const q of subQuestions) {
            if (!q.correctAnswer || !Array.isArray(q.answers)) continue;

            questionNumber++;
            const parsedPoints = clamp(parsePositiveNumber(q.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
            const normQ = normalizeBilingualText(q.questionText, q.questionTextCn);

            const subResult = await client.query(
              `INSERT INTO questions (
                 exam_id, question_number, question_type,
                 question_text, question_text_cn,
                 points, explanation, explanation_cn,
                 question_group_type, difficulty,
                 sub_question_number, passage_group_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               RETURNING id`,
              [
                examId, questionNumber, QUESTION_TYPES.READING_ITEM,
                sanitize(normQ?.en || ''), sanitize(normQ?.cn || ''),
                parsedPoints,
                q.explanation ? sanitize(q.explanation) : null,
                q.explanationCn ? sanitize(q.explanationCn) : null,
                QUESTION_TYPES.READING_ITEM,
                q.difficulty || 'medium',
                q.subQuestionNumber || questionNumber,
                groupId,
              ]
            );
            const subId = subResult.rows[0].id;

            for (let i = 0; i < q.answers.length; i++) {
              const normA = normalizeBilingualText(q.answers[i].text, q.answers[i].textCn);
              if (!normA) continue;
              await client.query(
                `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct, image_url)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  subId, answerKeys[i],
                  sanitize(normA.en), sanitize(normA.cn),
                  answerKeys[i] === q.correctAnswer,
                  q.answers[i]?.imageUrl ? sanitize(q.answers[i].imageUrl) : null,
                ]
              );
            }
            insertedSubs.push({ id: subId, questionNumber });
          }

          const netChange = 1 + insertedSubs.length;
          await client.query(
            'UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2',
            [netChange, examId]
          );
        }

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.update_reading_passage_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Đoạn đọc hiểu đã được cập nhật' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update reading passage group error:', error);
      res.status(500).json({ message: 'Failed to update reading passage group' });
    }
  },

  // DELETE /api/admin/exams/:examId/reading-passage-group/:groupId
  async deleteReadingPassageGroup(req, res) {
    try {
      const { examId, groupId } = req.params;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId)]);

        const countRes = await client.query(
          `SELECT COUNT(*)::int as count FROM questions
           WHERE passage_group_id = $1`,
          [groupId]
        );
        const totalCount = countRes.rows[0].count;

        await client.query(
          'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1)',
          [groupId]
        );
        await client.query('DELETE FROM questions WHERE passage_group_id = $1', [groupId]);
        await client.query('DELETE FROM questions WHERE id = $1', [groupId]);

        await client.query(
          'UPDATE exams SET total_questions = GREATEST(0, total_questions - $1), updated_at = NOW() WHERE id = $2',
          [totalCount, examId]
        );

        await client.query('COMMIT');
        cache.delByPrefix('exams:');
        cache.del('exams:lobby');

        UserActivity.log(req.user.id, 'admin.delete_reading_passage_group', {
          examId, groupId,
          ip: req.ip, userAgent: req.headers['user-agent'],
        });

        res.json({ message: 'Đoạn đọc hiểu đã được xóa' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Delete reading passage group error:', error);
      res.status(500).json({ message: 'Failed to delete reading passage group' });
    }
  },
};

module.exports = AdminExamController;

