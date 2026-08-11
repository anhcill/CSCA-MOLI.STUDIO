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

async function findThread(threadId, client = null) {
  const result = await executor(client).query(
    `SELECT t.*, l.course_id
     FROM lesson_question_threads t
     JOIN course_lessons l ON l.id = t.lesson_id
     WHERE t.id = $1 LIMIT 1`,
    [threadId],
  );
  return result.rows[0] || null;
}

async function insertAttachments(messageId, files, client) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    await client.query(
      `INSERT INTO lesson_question_attachments (
         message_id, original_name, mime_type, file_kind, url, storage_public_id, size_bytes, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [messageId, file.originalName, file.mimeType, file.fileKind, file.url,
        file.storagePublicId, file.sizeBytes, index],
    );
  }
}

async function createThread({ lessonId, userId, subject, body, files }) {
  return transaction(async (client) => {
    const thread = (await client.query(
      `INSERT INTO lesson_question_threads (lesson_id, created_by, subject)
       VALUES ($1,$2,$3) RETURNING *`,
      [lessonId, userId, subject],
    )).rows[0];
    const message = (await client.query(
      `INSERT INTO lesson_question_messages (thread_id, author_id, author_kind, body)
       VALUES ($1,$2,'student',$3) RETURNING *`,
      [thread.id, userId, body],
    )).rows[0];
    await insertAttachments(message.id, files, client);
    return thread;
  });
}

async function createReply({ threadId, authorId, authorKind, body, files, nextStatus }) {
  return transaction(async (client) => {
    const message = (await client.query(
      `INSERT INTO lesson_question_messages (thread_id, author_id, author_kind, body)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [threadId, authorId, authorKind, body],
    )).rows[0];
    await insertAttachments(message.id, files, client);
    await client.query(
      `UPDATE lesson_question_threads SET status = $2, updated_at = NOW() WHERE id = $1`,
      [threadId, nextStatus],
    );
    return message;
  });
}

async function updateStatus(threadId, status) {
  const result = await db.query(
    `UPDATE lesson_question_threads SET status = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [threadId, status],
  );
  return result.rows[0] || null;
}

async function listThreads(lessonId, ownerId = null) {
  const threadResult = await db.query(
    `SELECT t.*, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS student_name,
       u.email AS student_email
     FROM lesson_question_threads t
     JOIN users u ON u.id = t.created_by
     WHERE t.lesson_id = $1 AND ($2::int IS NULL OR t.created_by = $2)
     ORDER BY t.updated_at DESC, t.id DESC`,
    [lessonId, ownerId],
  );
  if (!threadResult.rows.length) return [];
  const threadIds = threadResult.rows.map((row) => row.id);
  const messageResult = await db.query(
    `SELECT m.*, COALESCE(NULLIF(u.full_name, ''), u.username, u.email) AS author_name,
       u.email AS author_email
     FROM lesson_question_messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.thread_id = ANY($1::bigint[])
     ORDER BY m.created_at, m.id`,
    [threadIds],
  );
  const messageIds = messageResult.rows.map((row) => row.id);
  const attachmentResult = messageIds.length ? await db.query(
    `SELECT * FROM lesson_question_attachments
     WHERE message_id = ANY($1::bigint[]) ORDER BY sort_order, id`,
    [messageIds],
  ) : { rows: [] };
  const attachmentsByMessage = new Map();
  attachmentResult.rows.forEach((row) => {
    const key = String(row.message_id);
    if (!attachmentsByMessage.has(key)) attachmentsByMessage.set(key, []);
    attachmentsByMessage.get(key).push(row);
  });
  const messagesByThread = new Map();
  messageResult.rows.forEach((row) => {
    const key = String(row.thread_id);
    if (!messagesByThread.has(key)) messagesByThread.set(key, []);
    messagesByThread.get(key).push({ ...row, attachments: attachmentsByMessage.get(String(row.id)) || [] });
  });
  return threadResult.rows.map((row) => ({ ...row, messages: messagesByThread.get(String(row.id)) || [] }));
}

module.exports = { findThread, createThread, createReply, updateStatus, listThreads };
