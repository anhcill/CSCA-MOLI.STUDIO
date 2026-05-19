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

function sanitizeExplanation(str) {
  if (typeof str !== "string") return str;
  return str.replace(/\0/g, "").trim();
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
    const textCn = (opt.textCn || "").trim();
    return {
      key: opt.key || String.fromCharCode(65 + i),
      text,
      textCn,
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
    "SELECT COALESCE(MAX(question_number), 0)::int + 1 AS position FROM questions WHERE exam_id = $1 AND question_number > 0 AND deleted_at IS NULL",
    [examId],
  );
  return result.rows[0].position || 1;
}

async function getNextContainerNumber(client, examId) {
  const result = await client.query(
    "SELECT COALESCE(MIN(question_number), 0)::int - 1 AS question_number FROM questions WHERE exam_id = $1 AND question_number < 0 AND deleted_at IS NULL",
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
     WHERE exam_id = $1::int AND question_number >= $2::int AND question_number > 0 AND deleted_at IS NULL`,
    [examId, fromPosition, offset],
  );
  await client.query(
    `UPDATE questions
     SET question_number = question_number - $3::int + $4::int
     WHERE exam_id = $1::int AND question_number >= ($2::int + $3::int) AND deleted_at IS NULL`,
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

function getExistingSubItemId(item) {
  const directId = Number.parseInt(item.id || item.questionId || item.question_id, 10);
  if (Number.isFinite(directId) && directId > 0) return directId;
  const match = String(item._localId || "").match(/saved-fill-item-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function conflictError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

async function syncFillBlankAnswers(client, questionId, linkedOptions, correctAnswerKey) {
  const existingRes = await client.query(
    `SELECT a.*,
            EXISTS (
              SELECT 1 FROM user_answers ua WHERE ua.selected_answer_id = a.id
            ) AS is_referenced
     FROM answers a
     WHERE a.question_id = $1
     ORDER BY a.answer_key ASC, a.id ASC
     FOR UPDATE`,
    [questionId],
  );

  const existingByKey = new Map();
  for (const answer of existingRes.rows) {
    const key = String(answer.answer_key || "").trim();
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(answer);
  }

  const activeKeys = new Set(linkedOptions.map((opt) => opt.key));
  for (const opt of linkedOptions) {
    const rows = existingByKey.get(opt.key) || [];
    const primary = rows[0];
    if (primary) {
      await client.query(
        `UPDATE answers
         SET answer_text = $1,
             answer_text_cn = $2,
             is_correct = $3
         WHERE id = $4`,
        [
          sanitize(opt.text),
          sanitize(opt.textCn),
          opt.key === correctAnswerKey,
          primary.id,
        ],
      );

      const duplicateIds = rows.slice(1).map((row) => row.id);
      if (duplicateIds.length) {
        const duplicateRefs = rows.slice(1).filter((row) => row.is_referenced);
        if (duplicateRefs.length) {
          throw conflictError("Không thể gộp lựa chọn vì đã có bài làm tham chiếu đáp án cũ.");
        }
        await client.query("DELETE FROM answers WHERE id = ANY($1::int[])", [duplicateIds]);
      }
    } else {
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

  const obsolete = existingRes.rows.filter((answer) => !activeKeys.has(String(answer.answer_key || "").trim()));
  const referencedObsolete = obsolete.filter((answer) => answer.is_referenced);
  if (referencedObsolete.length) {
    const keys = referencedObsolete.map((answer) => String(answer.answer_key || "").trim()).join(", ");
    throw conflictError(`Không thể xóa lựa chọn ${keys} vì đã có học viên chọn trong bài làm.`);
  }

  const obsoleteIds = obsolete.map((answer) => answer.id);
  if (obsoleteIds.length) {
    await client.query("DELETE FROM answers WHERE id = ANY($1::int[])", [obsoleteIds]);
  }
}

async function insertFillBlankSubItem(client, { examId, groupId, questionNumber, item, linkedOptions, clozeMode }) {
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
      item.explanation ? sanitizeExplanation(item.explanation) : null,
      item.explanationCn ? sanitizeExplanation(item.explanationCn) : null,
      QUESTION_TYPES.FILL_BLANK_ITEM,
      item.difficulty || "medium",
      item.subQuestionNumber || questionNumber,
      groupId,
    ],
  );

  const questionId = subResult.rows[0].id;
  await insertFillBlankAnswers(client, questionId, linkedOptions, item.correctAnswerKey);
  return { id: questionId, questionNumber, correctAnswerKey: item.correctAnswerKey };
}

async function insertSubItems(client, { examId, groupId, startQuestionNumber, subItems, linkedOptions, clozeMode }) {
  let questionNumber = startQuestionNumber - 1;
  const inserted = [];

  for (const item of subItems) {
    if (!item.correctAnswerKey) continue;
    if (!linkedOptions.some((o) => o.key === item.correctAnswerKey)) continue;

    questionNumber++;
    inserted.push(await insertFillBlankSubItem(client, {
      examId,
      groupId,
      questionNumber,
      item,
      linkedOptions,
      clozeMode,
    }));
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

        const oldItemsRes = await client.query(
          `SELECT q.*,
                  EXISTS (
                    SELECT 1 FROM user_answers ua WHERE ua.question_id = q.id
                  ) AS is_referenced
           FROM questions q
           WHERE q.passage_group_id = $1 AND q.question_type = $2 AND q.question_number > 0
           ORDER BY q.question_number ASC, q.id ASC
           FOR UPDATE`,
          [groupId, QUESTION_TYPES.FILL_BLANK_ITEM],
        );
        const oldItems = oldItemsRes.rows;
        const oldSubCount = oldItems.length;
        const oldStart = oldItems[0]?.question_number || await getAppendPosition(client, examId);
        const oldEnd = oldItems[oldItems.length - 1]?.question_number || (oldStart - 1);
        const delta = subItems.length - oldSubCount;

        if (delta > 0) {
          await shiftQuestionNumbers(client, examId, oldEnd + 1, delta);
        }

        const oldById = new Map(oldItems.map((item) => [Number(item.id), item]));
        const usedOldIds = new Set();
        const savedSubQuestions = [];

        for (let index = 0; index < subItems.length; index++) {
          const item = subItems[index];
          const questionNumber = oldStart + index;
          const requestedId = getExistingSubItemId(item);
          let existing = requestedId && oldById.has(requestedId) && !usedOldIds.has(requestedId)
            ? oldById.get(requestedId)
            : null;

          if (!existing) {
            existing = oldItems.find((oldItem, oldIndex) => oldIndex === index && !usedOldIds.has(Number(oldItem.id))) || null;
          }

          if (existing) {
            const questionId = Number(existing.id);
            const parsedPoints = clamp(parsePositiveNumber(item.points, 1), 0.1, MAX_POINTS_PER_QUESTION);
            const normQ = normalizeBilingualText(item.questionText, item.questionTextCn);
            const fallbackQuestionText = validation.normalizedClozeMode === CLOZE_MODES.PASSAGE
              ? `Blank ${item.subQuestionNumber || questionNumber}`
              : "";

            await client.query(
              `UPDATE questions
               SET question_number = $1,
                   question_text = $2,
                   question_text_cn = $3,
                   points = $4,
                   explanation = $5,
                   explanation_cn = $6,
                   difficulty = $7,
                   sub_question_number = $8,
                   passage_group_id = $9,
                   question_group_type = $10
               WHERE id = $11 AND exam_id = $12 AND question_type = $13`,
              [
                questionNumber,
                sanitize(normQ?.en || fallbackQuestionText),
                sanitize(normQ?.cn || fallbackQuestionText),
                parsedPoints,
                item.explanation ? sanitizeExplanation(item.explanation) : null,
                item.explanationCn ? sanitizeExplanation(item.explanationCn) : null,
                item.difficulty || "medium",
                item.subQuestionNumber || questionNumber,
                groupId,
                QUESTION_TYPES.FILL_BLANK_ITEM,
                questionId,
                examId,
                QUESTION_TYPES.FILL_BLANK_ITEM,
              ],
            );

            await syncFillBlankAnswers(client, questionId, validation.normalizedOpts, item.correctAnswerKey);
            usedOldIds.add(questionId);
            savedSubQuestions.push({ id: questionId, questionNumber, correctAnswerKey: item.correctAnswerKey });
          } else {
            savedSubQuestions.push(await insertFillBlankSubItem(client, {
              examId,
              groupId,
              questionNumber,
              item,
              linkedOptions: validation.normalizedOpts,
              clozeMode: validation.normalizedClozeMode,
            }));
          }
        }

        const removedItems = oldItems.filter((item) => !usedOldIds.has(Number(item.id)));
        const referencedRemoved = removedItems.filter((item) => item.is_referenced);
        if (referencedRemoved.length) {
          throw conflictError("Không thể xóa chỗ trống đã có học viên trả lời. Bạn có thể sửa nội dung hoặc đáp án, nhưng không nên giảm số chỗ trống đã có dữ liệu.");
        }

        const removedIds = removedItems.map((item) => Number(item.id));
        if (removedIds.length) {
          await client.query("DELETE FROM answers WHERE question_id = ANY($1::int[])", [removedIds]);
          await client.query("DELETE FROM questions WHERE id = ANY($1::int[])", [removedIds]);
        }

        if (delta < 0) {
          await shiftQuestionNumbers(client, examId, oldEnd + 1, delta);
        }

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

        res.json({
          message: "Nhóm điền trống đã được cập nhật",
          subQuestions: savedSubQuestions,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Update fill blank group error:", error);
      res.status(error.status || 500).json({
        message: error.message || "Không thể cập nhật nhóm điền trống",
      });
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

        const refsRes = await client.query(
          `SELECT
             EXISTS (
               SELECT 1
               FROM user_answers ua
               JOIN questions q ON q.id = ua.question_id
               WHERE q.passage_group_id = $1 OR q.id = $1
             ) AS has_question_refs,
             EXISTS (
               SELECT 1
               FROM user_answers ua
               JOIN answers a ON a.id = ua.selected_answer_id
               JOIN questions q ON q.id = a.question_id
               WHERE q.passage_group_id = $1 OR q.id = $1
             ) AS has_answer_refs`,
          [groupId],
        );
        if (refsRes.rows[0]?.has_question_refs || refsRes.rows[0]?.has_answer_refs) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            message: "Không thể xóa nhóm điền trống vì đã có học viên làm bài. Hãy sửa nội dung/đáp án thay vì xóa để giữ lịch sử.",
          });
        }

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
      res.status(error.status || 500).json({
        message: error.message || "Không thể xóa nhóm điền trống",
      });
    }
  },
};

module.exports = AdminFillBlankGroupController;
