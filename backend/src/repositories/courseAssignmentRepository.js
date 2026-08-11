const db = require("../config/database");

function executor(client) {
  return client || db;
}

async function transaction(work) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findLesson(courseId, lessonId, client = null) {
  const result = await executor(client).query(
    `SELECT id, course_id, title, is_published FROM course_lessons WHERE id = $1 AND course_id = $2 LIMIT 1`,
    [lessonId, courseId],
  );
  return result.rows[0] || null;
}

async function listResources(lessonId, client = null) {
  const result = await executor(client).query(
    `SELECT id, lesson_id, title, resource_type, url, is_downloadable, sort_order,
       original_name, mime_type, size_bytes, storage_public_id, file_kind
     FROM lesson_resources WHERE lesson_id = $1 ORDER BY sort_order, id`,
    [lessonId],
  );
  return result.rows;
}

async function insertResources(lessonId, files, client = null) {
  const run = executor(client);
  const existing = await run.query(
    `SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM lesson_resources WHERE lesson_id = $1`,
    [lessonId],
  );
  const start = Number(existing.rows[0]?.max_order || 0) + 1;
  const rows = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const result = await run.query(
      `INSERT INTO lesson_resources (
         lesson_id, title, resource_type, url, is_downloadable, sort_order,
         original_name, mime_type, size_bytes, storage_public_id, file_kind
       ) VALUES ($1,$2,'file',$3,TRUE,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [lessonId, file.originalName, file.url, start + index, file.originalName,
        file.mimeType, file.sizeBytes, file.storagePublicId, file.fileKind],
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function deleteResource(courseId, lessonId, resourceId) {
  const result = await db.query(
    `DELETE FROM lesson_resources r USING course_lessons l
     WHERE r.id = $1 AND r.lesson_id = $2 AND l.id = r.lesson_id AND l.course_id = $3
     RETURNING r.*`,
    [resourceId, lessonId, courseId],
  );
  return result.rows[0] || null;
}

async function findAssignmentByLesson(lessonId, { publishedOnly = false, client = null } = {}) {
  const result = await executor(client).query(
    `SELECT * FROM lesson_assignments
     WHERE lesson_id = $1${publishedOnly ? " AND is_published = TRUE" : ""} LIMIT 1`,
    [lessonId],
  );
  return result.rows[0] || null;
}

async function listAssignmentAttachments(assignmentId, client = null) {
  const result = await executor(client).query(
    `SELECT * FROM assignment_attachments WHERE assignment_id = $1 ORDER BY sort_order, id`,
    [assignmentId],
  );
  return result.rows;
}

async function upsertAssignment(lessonId, values, client = null) {
  const result = await executor(client).query(
    `INSERT INTO lesson_assignments (lesson_id, title, instructions, due_at, max_score, is_published, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (lesson_id) DO UPDATE SET
       title = EXCLUDED.title, instructions = EXCLUDED.instructions, due_at = EXCLUDED.due_at,
       max_score = EXCLUDED.max_score, is_published = EXCLUDED.is_published, updated_at = NOW()
     RETURNING *`,
    [lessonId, values.title, values.instructions, values.dueAt, values.maxScore,
      values.isPublished, values.createdBy],
  );
  return result.rows[0];
}

async function insertAssignmentAttachments(assignmentId, files, client = null) {
  const run = executor(client);
  const existing = await run.query(
    `SELECT COALESCE(MAX(sort_order), -1)::int AS max_order FROM assignment_attachments WHERE assignment_id = $1`,
    [assignmentId],
  );
  const start = Number(existing.rows[0]?.max_order || 0) + 1;
  const rows = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const result = await run.query(
      `INSERT INTO assignment_attachments (
         assignment_id, original_name, mime_type, file_kind, url, storage_public_id, size_bytes, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [assignmentId, file.originalName, file.mimeType, file.fileKind, file.url,
        file.storagePublicId, file.sizeBytes, start + index],
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function deleteAssignmentAttachment(courseId, lessonId, attachmentId) {
  const result = await db.query(
    `DELETE FROM assignment_attachments aa USING lesson_assignments a, course_lessons l
     WHERE aa.id = $1 AND aa.assignment_id = a.id AND a.lesson_id = $2
       AND l.id = a.lesson_id AND l.course_id = $3 RETURNING aa.*`,
    [attachmentId, lessonId, courseId],
  );
  return result.rows[0] || null;
}

async function listSubmissions(assignmentId) {
  const result = await db.query(
    `SELECT s.*, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS student_name,
       u.email AS student_email
     FROM lesson_submissions s JOIN users u ON u.id = s.user_id
     WHERE s.assignment_id = $1 ORDER BY s.submitted_at DESC, s.id DESC`,
    [assignmentId],
  );
  if (!result.rows.length) return [];
  const ids = result.rows.map((row) => row.id);
  const attachments = await db.query(
    `SELECT * FROM submission_attachments WHERE submission_id = ANY($1::bigint[]) ORDER BY sort_order, id`,
    [ids],
  );
  const bySubmission = new Map();
  attachments.rows.forEach((row) => {
    const key = String(row.submission_id);
    if (!bySubmission.has(key)) bySubmission.set(key, []);
    bySubmission.get(key).push(row);
  });
  return result.rows.map((row) => ({ ...row, attachments: bySubmission.get(String(row.id)) || [] }));
}

async function findUserSubmission(assignmentId, userId, client = null) {
  const result = await executor(client).query(
    `SELECT * FROM lesson_submissions WHERE assignment_id = $1 AND user_id = $2 LIMIT 1`,
    [assignmentId, userId],
  );
  const row = result.rows[0] || null;
  if (!row) return null;
  row.attachments = (await executor(client).query(
    `SELECT * FROM submission_attachments WHERE submission_id = $1 ORDER BY sort_order, id`,
    [row.id],
  )).rows;
  return row;
}

async function replaceSubmission(assignmentId, userId, textContent, files) {
  return transaction(async (client) => {
    const previous = await findUserSubmission(assignmentId, userId, client);
    const result = await client.query(
      `INSERT INTO lesson_submissions (assignment_id, user_id, text_content, status, submitted_at)
       VALUES ($1,$2,$3,'submitted',NOW())
       ON CONFLICT (assignment_id, user_id) DO UPDATE SET
         text_content = EXCLUDED.text_content, status = 'submitted', submitted_at = NOW(),
         score = NULL, teacher_feedback = NULL, graded_by = NULL, graded_at = NULL, updated_at = NOW()
       RETURNING *`,
      [assignmentId, userId, textContent],
    );
    const submission = result.rows[0];
    await client.query(`DELETE FROM submission_attachments WHERE submission_id = $1`, [submission.id]);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      await client.query(
        `INSERT INTO submission_attachments (
           submission_id, original_name, mime_type, file_kind, url, storage_public_id, size_bytes, sort_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [submission.id, file.originalName, file.mimeType, file.fileKind, file.url,
          file.storagePublicId, file.sizeBytes, index],
      );
    }
    return { submission: await findUserSubmission(assignmentId, userId, client), replacedFiles: previous?.attachments || [] };
  });
}

async function gradeSubmission(courseId, lessonId, submissionId, values) {
  const result = await db.query(
    `UPDATE lesson_submissions s SET status = 'graded', score = $4, teacher_feedback = $5,
       graded_by = $6, graded_at = NOW(), updated_at = NOW()
     FROM lesson_assignments a, course_lessons l
     WHERE s.id = $1 AND s.assignment_id = a.id AND a.lesson_id = $2
       AND l.id = a.lesson_id AND l.course_id = $3 AND $4 <= a.max_score
     RETURNING s.*`,
    [submissionId, lessonId, courseId, values.score, values.feedback, values.gradedBy],
  );
  return result.rows[0] || null;
}

module.exports = {
  transaction, findLesson, listResources, insertResources, deleteResource,
  findAssignmentByLesson, listAssignmentAttachments, upsertAssignment,
  insertAssignmentAttachments, deleteAssignmentAttachment, listSubmissions,
  findUserSubmission, replaceSubmission, gradeSubmission,
};
