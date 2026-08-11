const learningRepository = require("../repositories/learningRepository");
const assignmentRepository = require("../repositories/courseAssignmentRepository");
const repository = require("../repositories/courseDiscussionRepository");
const courseService = require("./courseService");
const storage = require("./courseFileStorageService");
const { CourseApiError } = require("../utils/courseResponses");

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CourseApiError(422, "COURSE_QUESTION_INVALID", `${field} is invalid.`);
  }
  return parsed;
}

function normalizedText(value, field, max, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new CourseApiError(422, "COURSE_QUESTION_INVALID", `${field} is required.`);
  if (result.length > max) throw new CourseApiError(422, "COURSE_QUESTION_INVALID", `${field} is too long.`);
  return result || null;
}

function mapFile(row) {
  return {
    id: Number(row.id), originalName: row.original_name, mimeType: row.mime_type,
    fileKind: row.file_kind, url: row.url, sizeBytes: Number(row.size_bytes || 0),
  };
}

function mapThread(row, viewerId) {
  return {
    id: Number(row.id), lessonId: Number(row.lesson_id), subject: row.subject,
    status: row.status, studentId: Number(row.created_by), studentName: row.student_name,
    studentEmail: row.student_email, isOwner: Number(row.created_by) === Number(viewerId),
    createdAt: row.created_at, updatedAt: row.updated_at,
    messages: (row.messages || []).map((message) => ({
      id: Number(message.id), authorId: Number(message.author_id), authorKind: message.author_kind,
      authorName: message.author_name, body: message.body || "", createdAt: message.created_at,
      isMine: Number(message.author_id) === Number(viewerId),
      attachments: (message.attachments || []).map(mapFile),
    })),
  };
}

async function requireLearnerLesson(lessonIdValue, user) {
  const lessonId = positiveId(lessonIdValue, "lessonId");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Không tìm thấy bài học.");
  await courseService.requireLearningAccess(lesson.course_id, user);
  return lesson;
}

async function requireTeacherLesson(courseIdValue, lessonIdValue) {
  const courseId = positiveId(courseIdValue, "courseId");
  const lessonId = positiveId(lessonIdValue, "lessonId");
  const lesson = await assignmentRepository.findLesson(courseId, lessonId);
  if (!lesson) throw new CourseApiError(404, "ADMIN_COURSE_LESSON_NOT_FOUND", "Không tìm thấy bài học trong khóa học này.");
  return { courseId, lessonId };
}

async function listLearnerQuestions(lessonIdValue, user) {
  const lesson = await requireLearnerLesson(lessonIdValue, user);
  return (await repository.listThreads(lesson.id, user.id)).map((row) => mapThread(row, user.id));
}

async function createLearnerQuestion(lessonIdValue, body, files, user) {
  const lesson = await requireLearnerLesson(lessonIdValue, user);
  const subject = normalizedText(body.subject, "subject", 255, true);
  const content = normalizedText(body.body, "body", 20000);
  if (!content && !files?.length) {
    throw new CourseApiError(422, "COURSE_QUESTION_EMPTY", "Hãy nhập câu hỏi hoặc chọn ít nhất một file.");
  }
  const uploaded = await storage.uploadMany(files || [], `csca/courses/${lesson.course_id}/lessons/${lesson.id}/questions/${user.id}`);
  try {
    await repository.createThread({ lessonId: lesson.id, userId: user.id, subject, body: content, files: uploaded });
    return (await repository.listThreads(lesson.id, user.id)).map((row) => mapThread(row, user.id));
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function replyAsLearner(lessonIdValue, threadIdValue, body, files, user) {
  const lesson = await requireLearnerLesson(lessonIdValue, user);
  const threadId = positiveId(threadIdValue, "threadId");
  const thread = await repository.findThread(threadId);
  if (!thread || Number(thread.lesson_id) !== Number(lesson.id) || Number(thread.created_by) !== Number(user.id)) {
    throw new CourseApiError(404, "COURSE_QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi của bạn.");
  }
  const content = normalizedText(body.body, "body", 20000);
  if (!content && !files?.length) throw new CourseApiError(422, "COURSE_QUESTION_EMPTY", "Hãy nhập nội dung hoặc chọn ít nhất một file.");
  const uploaded = await storage.uploadMany(files || [], `csca/courses/${lesson.course_id}/lessons/${lesson.id}/questions/${user.id}`);
  try {
    await repository.createReply({ threadId, authorId: user.id, authorKind: "student", body: content, files: uploaded, nextStatus: "open" });
    return (await repository.listThreads(lesson.id, user.id)).map((row) => mapThread(row, user.id));
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function listTeacherQuestions(courseIdValue, lessonIdValue, user) {
  const { lessonId } = await requireTeacherLesson(courseIdValue, lessonIdValue);
  return (await repository.listThreads(lessonId)).map((row) => mapThread(row, user.id));
}

async function requireTeacherThread(courseIdValue, lessonIdValue, threadIdValue) {
  const { courseId, lessonId } = await requireTeacherLesson(courseIdValue, lessonIdValue);
  const threadId = positiveId(threadIdValue, "threadId");
  const thread = await repository.findThread(threadId);
  if (!thread || Number(thread.lesson_id) !== lessonId || Number(thread.course_id) !== courseId) {
    throw new CourseApiError(404, "COURSE_QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi trong bài học này.");
  }
  return { courseId, lessonId, threadId };
}

async function replyAsTeacher(courseIdValue, lessonIdValue, threadIdValue, body, files, user) {
  const { courseId, lessonId, threadId } = await requireTeacherThread(courseIdValue, lessonIdValue, threadIdValue);
  const content = normalizedText(body.body, "body", 20000);
  if (!content && !files?.length) throw new CourseApiError(422, "COURSE_QUESTION_EMPTY", "Hãy nhập nội dung hoặc chọn ít nhất một file.");
  const uploaded = await storage.uploadMany(files || [], `csca/courses/${courseId}/lessons/${lessonId}/questions/teacher-${user.id}`);
  try {
    await repository.createReply({ threadId, authorId: user.id, authorKind: "teacher", body: content, files: uploaded, nextStatus: "answered" });
    return (await repository.listThreads(lessonId)).map((row) => mapThread(row, user.id));
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function updateTeacherStatus(courseIdValue, lessonIdValue, threadIdValue, body, user) {
  const { lessonId, threadId } = await requireTeacherThread(courseIdValue, lessonIdValue, threadIdValue);
  const status = String(body.status || "");
  if (!["open", "answered", "resolved"].includes(status)) {
    throw new CourseApiError(422, "COURSE_QUESTION_STATUS_INVALID", "Trạng thái hỏi đáp không hợp lệ.");
  }
  await repository.updateStatus(threadId, status);
  return (await repository.listThreads(lessonId)).map((row) => mapThread(row, user.id));
}

module.exports = {
  listLearnerQuestions, createLearnerQuestion, replyAsLearner,
  listTeacherQuestions, replyAsTeacher, updateTeacherStatus,
};
