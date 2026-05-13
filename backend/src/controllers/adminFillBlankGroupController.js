const { pool } = require("../config/database");
const { cache } = require("../config/cache");
const UserActivity = require("../models/UserActivity");

const QUESTION_TYPES = {
  FILL_BLANK_POOL: "fill_blank_pool",
  FILL_BLANK_ITEM: "fill_blank_item",
};

const CLOZE_MODES = {
  SENTENCES: "sentences",
  PASSAGE: "passage",
};

const MAX_POINTS_PER_QUESTION = 100;

function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/<[^>]*>/g, "").trim();
}

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

function normalizeLinkedOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return null;
  const normalized = rawOptions
    .map((opt, i) => {
    const text = (opt.text || "").trim();
    const textCn = (opt.textCn || opt.text || "").trim();
    return {
      key: opt.key || String.fromCharCode(65 + i),
      text: text || textCn,
      textCn: textCn || text,
    };
  })
    .filter((opt) => opt.text || opt.textCn);

  return normalized.length >= 2 ? normalized : null;
}

function normalizeClozeMode(mode) {
  return mode === CLOZE_MODES.PASSAGE ? CLOZE_MODES.PASSAGE : CLOZE_MODES.SENTENCES;
}

function countClozeBlanks(text) {
  if (!text || typeof text !== "string") return 0;
  return (text.match(/_{2,}|＿+/g) || []).length;
}

async function getAppendPosition(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MAX(question_number), 0)::int + 1 AS position FROM questions WHERE exam_id = $1 AND question_number > 0",
    [examId],
  );
  return result.rows[0].position || 1;
}

async function getNextContainerNumber(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MIN(question_number), 0)::int - 1 AS question_number FROM questions WHERE exam_id = $1 AND question_number < 0",
    [examId],
  );
  return result.rows[0].question_number || -1;
}

async function shiftQuestionNumbers(client, examId, fromPosition, delta) {
  if (!delta) return;
  const offset = 10000;
  await client.query(
    `UPDATE questions
     SET question_number = question_number + $3::int
     WHERE exam_id = $1::int AND question_number >= $2::int AND question_number > 0`,
    [examId, fromPosition, offset],
  );
  await client.query(
    `UPDATE questions
     SET question_number = question_number - $3::int + $4::int
     WHERE exam_id = $1::int AND question_number >= ($2::int + $3::int)`,
    [examId, fromPosition, offset, delta],
  );
}

function validateGroup({ passageText, clozeMode, linkedOptions, subItems }) {
  const normalizedClozeMode = normalizeClozeMode(clozeMode);
  const normalizedOpts = normalizeLinkedOptions(linkedOptions || []);

  if (normalizedClozeMode === CLOZE_MODES.PASSAGE && (!passageText || !passageText.trim())) {
    return { error: "Dang doan van can co passageText" };
  }

  if (!normalizedOpts || normalizedOpts.length < 2) {
    return { error: "Can it nhat 2 tu chon A-F co noi dung" };
  }

  if (!Array.isArray(subItems) || subItems.length === 0) {
    return { error: "Can it nhat 1 cho trong de cham dap an" };
  }

  const optionKeys = new Set(normalizedOpts.map((opt) => opt.key));
  for (const item of subItems) {
    if (!item.correctAnswerKey || !optionKeys.has(item.correctAnswerKey)) {
      return { error: "Moi cho trong phai chon dap an dung nam trong danh sach tu chon" };
    }

    if (
      normalizedClozeMode === CLOZE_MODES.SENTENCES
      && !normalizeBilingualText(item.questionText, item.questionTextCn)
    ) {
      return { error: "Dang cau roi can co noi dung cho tung cau" };
    }
  }

  if (normalizedClozeMode === CLOZE_MODES.PASSAGE) {
    const blankCount = countClozeBlanks(passageText);
    if (blankCount > 0 && blankCount !== subItems.length) {
      return { error: `So cho trong trong doan (${blankCount}) khong khop so dap an (${subItems.length})` };
    }
  }

  return { normalizedClozeMode, normalizedOpts };
}

async function insertFillBlankAnswers(client, questionId, linkedOptions, correctAnswerKey) {
  for (const opt of linkedOptions) {
    await client.query(
      `INSERT INTO answers (question_id, answer_key, answer_text, answer_text_cn, is_correct)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        questionId,
        opt.key,
        sanitize(opt.text),
        sanitize(opt.textCn),
        opt.key === correctAnswerKey,
      ],
    );
  }
}

async function insertSubItems(client, { examId, groupId, startQuestionNumber, subItems, linkedOptions, clozeMode }) {
  let questionNumber = startQuestionNumber - 1;
  const inserted = [];

  for (const item of subItems) {
    if (!item.correctAnswerKey) continue;
    if (!linkedOptions.some((o) => o.key === item.correctAnswerKey)) continue;

    questionNumber++;
    const parsedPoints = clamp(parsePositiveNumber(item.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
    const normQ = normalizeBilingualText(item.questionText, item.questionTextCn);
    const fallbackQuestionText = clozeMode === CLOZE_MODES.PASSAGE
      ? `Blank ${item.subQuestionNumber || questionNumber}`
      : "";

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
        examId,
        questionNumber,
        QUESTION_TYPES.FILL_BLANK_ITEM,
        sanitize(normQ?.en || fallbackQuestionText),
        sanitize(normQ?.cn || fallbackQuestionText),
        parsedPoints,
        item.explanation ? sanitize(item.explanation) : null,
        item.explanationCn ? sanitize(item.explanationCn) : null,
        QUESTION_TYPES.FILL_BLANK_ITEM,
        item.difficulty || "medium",
        item.subQuestionNumber || questionNumber,
        groupId,
      ],
    );

    const questionId = subResult.rows[0].id;
    await insertFillBlankAnswers(client, questionId, linkedOptions, item.correctAnswerKey);
    inserted.push({ id: questionId, questionNumber, correctAnswerKey: item.correctAnswerKey });
  }

  return inserted;
}

const AdminFillBlankGroupController = {
  async insertFillBlankGroup(req, res) {
    try {
      const { examId } = req.params;
      const { passageText, passageImageUrl, clozeMode, linkedOptions, subItems, insertPosition } = req.body;
      const validation = validateGroup({ passageText, clozeMode, linkedOptions, subItems });
      if (validation.error) return res.status(400).json({ message: validation.error });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId, 10)]);

        const targetPosition = Number.isFinite(Number(insertPosition)) && Number(insertPosition) > 0
          ? Number(insertPosition)
          : await getAppendPosition(client, examId);
        await shiftQuestionNumbers(client, examId, targetPosition, subItems.length);
        const containerNumber = await getNextContainerNumber(client, examId);

        const poolResult = await client.query(
          `INSERT INTO questions (
             exam_id, question_number, question_type,
             question_text, question_text_cn,
             points, passage_text, passage_image_url,
             question_group_type, difficulty,
             linked_options, sub_question_number, passage_group_id, cloze_mode
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            examId,
            containerNumber,
            QUESTION_TYPES.FILL_BLANK_POOL,
            "Dien tu",
            "填空",
            0,
            passageText ? sanitize(passageText) : null,
            passageImageUrl ? sanitize(passageImageUrl) : null,
            QUESTION_TYPES.FILL_BLANK_POOL,
            "medium",
            JSON.stringify(validation.normalizedOpts),
            null,
            null,
            validation.normalizedClozeMode,
          ],
        );
        const groupId = poolResult.rows[0].id;

        await client.query("UPDATE questions SET passage_group_id = id WHERE id = $1", [groupId]);

        const insertedSubQuestions = await insertSubItems(client, {
          examId,
          groupId,
          startQuestionNumber: targetPosition,
          subItems,
          linkedOptions: validation.normalizedOpts,
          clozeMode: validation.normalizedClozeMode,
        });

        await client.query(
          "UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2",
          [insertedSubQuestions.length, examId],
        );

        await client.query("COMMIT");
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, "admin.insert_fill_blank_group", {
          examId,
          groupId,
          subQuestions: insertedSubQuestions.length,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json({
          message: "Nhom dien tu da duoc tao",
          groupId,
          questionNumber: targetPosition,
          subQuestions: insertedSubQuestions,
          totalItems: insertedSubQuestions.length,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Insert fill blank group error:", error);
      res.status(500).json({ message: "Failed to create fill blank group" });
    }
  },

  async updateFillBlankGroup(req, res) {
    try {
      const { examId, groupId } = req.params;
      const { passageText, passageImageUrl, clozeMode, linkedOptions, subItems } = req.body;
      const validation = validateGroup({ passageText, clozeMode, linkedOptions, subItems });
      if (validation.error) return res.status(400).json({ message: validation.error });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId, 10)]);

        const updateResult = await client.query(
          `UPDATE questions
           SET passage_text = $1,
               passage_image_url = $2,
               linked_options = $3,
               cloze_mode = $4
           WHERE id = $5 AND exam_id = $6 AND question_type = $7`,
          [
            passageText ? sanitize(passageText) : null,
            passageImageUrl ? sanitize(passageImageUrl) : null,
            JSON.stringify(validation.normalizedOpts),
            validation.normalizedClozeMode,
            groupId,
            examId,
            QUESTION_TYPES.FILL_BLANK_POOL,
          ],
        );

        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Fill blank group not found" });
        }

        const oldCountRes = await client.query(
          `SELECT COUNT(*)::int as count,
                  COALESCE(MIN(question_number), 0)::int as start_num,
                  COALESCE(MAX(question_number), 0)::int as end_num
           FROM questions
           WHERE passage_group_id = $1 AND question_type = $2 AND question_number > 0`,
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM],
        );
        const oldSubCount = oldCountRes.rows[0].count || 0;
        const oldStart = oldCountRes.rows[0].start_num || await getAppendPosition(client, examId);
        const oldEnd = oldCountRes.rows[0].end_num || (oldStart - 1);

        await client.query(
          "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1 AND question_type = $2)",
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM],
        );
        await client.query(
          "DELETE FROM questions WHERE passage_group_id = $1 AND question_type = $2",
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM],
        );

        const delta = subItems.length - oldSubCount;
        await shiftQuestionNumbers(client, examId, oldEnd + 1, delta);

        const insertedSubQuestions = await insertSubItems(client, {
          examId,
          groupId,
          startQuestionNumber: oldStart,
          subItems,
          linkedOptions: validation.normalizedOpts,
          clozeMode: validation.normalizedClozeMode,
        });

        await client.query(
          "UPDATE exams SET total_questions = total_questions + $1, updated_at = NOW() WHERE id = $2",
          [delta, examId],
        );

        await client.query("COMMIT");
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, "admin.update_fill_blank_group", {
          examId,
          groupId,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ message: "Nhom dien tu da duoc cap nhat" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Update fill blank group error:", error);
      res.status(500).json({ message: "Failed to update fill blank group" });
    }
  },

  async deleteFillBlankGroup(req, res) {
    try {
      const { examId, groupId } = req.params;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [parseInt(examId, 10)]);

        const countRes = await client.query(
          `SELECT COUNT(*)::int as count,
                  COALESCE(MAX(question_number), 0)::int as end_num
           FROM questions
           WHERE passage_group_id = $1 AND question_type = $2 AND question_number > 0`,
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM],
        );
        const totalDelete = countRes.rows[0].count || 0;
        const oldEnd = countRes.rows[0].end_num || 0;

        await client.query(
          "DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE passage_group_id = $1 OR id = $1)",
          [groupId],
        );
        await client.query("DELETE FROM questions WHERE passage_group_id = $1", [groupId]);
        await client.query("DELETE FROM questions WHERE id = $1", [groupId]);
        if (totalDelete > 0) {
          await shiftQuestionNumbers(client, examId, oldEnd + 1, -totalDelete);
        }
        await client.query(
          "UPDATE exams SET total_questions = GREATEST(0, total_questions - $1), updated_at = NOW() WHERE id = $2",
          [totalDelete, examId],
        );

        await client.query("COMMIT");
        cache.delByPrefix("exams:");
        cache.del("exams:lobby");

        UserActivity.log(req.user.id, "admin.delete_fill_blank_group", {
          examId,
          groupId,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ message: "Nhom dien tu da duoc xoa" });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Delete fill blank group error:", error);
      res.status(500).json({ message: "Failed to delete fill blank group" });
    }
  },
};

module.exports = AdminFillBlankGroupController;
