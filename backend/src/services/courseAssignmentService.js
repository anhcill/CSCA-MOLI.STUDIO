const repository = require("../repositories/courseAssignmentRepository");
const courseService = require("./courseService");
const storage = require("./courseFileStorageService");
const { CourseApiError } = require("../utils/courseResponses");

function id(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new CourseApiError(422, "COURSE_ID_INVALID", `${field} is invalid.`);
  return parsed;
}

function text(value, field, max, { required = false } = {}) {
  if (value == null) {
    if (required) throw new CourseApiError(422, "COURSE_ASSIGNMENT_INVALID", `${field} is required.`);
    return null;
  }
  const normalized = String(value).trim();
  if (required && !normalized) throw new CourseApiError(422, "COURSE_ASSIGNMENT_INVALID", `${field} is required.`);
  if (normalized.length > max) throw new CourseApiError(422, "COURSE_ASSIGNMENT_INVALID", `${field} is too long.`);
  return normalized || null;
}

function mapFile(row) {
  return {
    id: Number(row.id), originalName: row.original_name || row.title || "File",
    mimeType: row.mime_type || "application/octet-stream", fileKind: row.file_kind || "document",
    kind: row.resource_type === "link" ? "link" : "file",
    title: row.title || row.original_name || "File", url: row.url, sizeBytes: Number(row.size_bytes || 0),
  };
}

function mapSubmission(row) {
  if (!row) return null;
  return {
    id: Number(row.id), assignmentId: Number(row.assignment_id), userId: Number(row.user_id),
    studentName: row.student_name || null, studentEmail: row.student_email || null,
    textContent: row.text_content || "", status: row.status,
    submittedAt: row.submitted_at, score: row.score == null ? null : Number(row.score),
    teacherFeedback: row.teacher_feedback || "", gradedAt: row.graded_at,
    attachments: (row.attachments || []).map(mapFile),
  };
}

async function mapAssignment(row, { includeSubmissions = false, userId = null } = {}) {
  if (!row) return null;
  const [attachments, submissions, submission] = await Promise.all([
    repository.listAssignmentAttachments(row.id),
    includeSubmissions ? repository.listSubmissions(row.id) : Promise.resolve([]),
    userId ? repository.findUserSubmission(row.id, userId) : Promise.resolve(null),
  ]);
  return {
    id: Number(row.id), lessonId: Number(row.lesson_id), title: row.title,
    instructions: row.instructions || "", dueAt: row.due_at,
    maxScore: Number(row.max_score), isPublished: row.is_published === true,
    attachments: attachments.map(mapFile),
    ...(includeSubmissions ? { submissions: submissions.map(mapSubmission) } : {}),
    ...(userId ? { submission: mapSubmission(submission) } : {}),
  };
}

async function requireAdminLesson(courseIdValue, lessonIdValue) {
  const courseId = id(courseIdValue, "courseId");
  const lessonId = id(lessonIdValue, "lessonId");
  const lesson = await repository.findLesson(courseId, lessonId);
  if (!lesson) throw new CourseApiError(404, "ADMIN_COURSE_LESSON_NOT_FOUND", "Lesson not found in this course.");
  return { courseId, lessonId, lesson };
}

async function getAdminWork(courseIdValue, lessonIdValue) {
  const { lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const [resources, assignment] = await Promise.all([
    repository.listResources(lessonId),
    repository.findAssignmentByLesson(lessonId),
  ]);
  return { resources: resources.map(mapFile), assignment: await mapAssignment(assignment, { includeSubmissions: true }) };
}

async function uploadLessonResources(courseIdValue, lessonIdValue, files) {
  const { courseId, lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  if (!files?.length) throw new CourseApiError(422, "COURSE_FILES_REQUIRED", "Vui lòng chọn ít nhất một file.");
  const uploaded = await storage.uploadMany(files, `csca/courses/${courseId}/lessons/${lessonId}/resources`);
  try {
    const rows = await repository.insertResources(lessonId, uploaded);
    return rows.map(mapFile);
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function deleteLessonResource(courseIdValue, lessonIdValue, resourceIdValue) {
  const { courseId, lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const removed = await repository.deleteResource(courseId, lessonId, id(resourceIdValue, "resourceId"));
  if (!removed) throw new CourseApiError(404, "COURSE_RESOURCE_NOT_FOUND", "File đính kèm không tồn tại.");
  await storage.remove(removed).catch(() => undefined);
  return { id: Number(removed.id), deleted: true };
}

async function saveAssignment(courseIdValue, lessonIdValue, body, user) {
  const { lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const title = text(body.title, "title", 255, { required: true });
  const instructions = text(body.instructions, "instructions", 20000);
  const maxScore = Number(body.maxScore ?? 10);
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
    throw new CourseApiError(422, "COURSE_ASSIGNMENT_INVALID", "maxScore must be between 0 and 1000.");
  }
  let dueAt = null;
  if (body.dueAt) {
    const parsed = new Date(body.dueAt);
    if (Number.isNaN(parsed.getTime())) throw new CourseApiError(422, "COURSE_ASSIGNMENT_INVALID", "dueAt is invalid.");
    dueAt = parsed.toISOString();
  }
  const row = await repository.upsertAssignment(lessonId, {
    title, instructions, dueAt, maxScore,
    isPublished: body.isPublished === true, createdBy: user.id,
  });
  return mapAssignment(row, { includeSubmissions: true });
}

async function uploadAssignmentAttachments(courseIdValue, lessonIdValue, files) {
  const { courseId, lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const assignment = await repository.findAssignmentByLesson(lessonId);
  if (!assignment) throw new CourseApiError(409, "COURSE_ASSIGNMENT_SAVE_FIRST", "Hãy lưu bài tập trước khi tải ảnh hoặc file đề.");
  if (!files?.length) throw new CourseApiError(422, "COURSE_FILES_REQUIRED", "Vui lòng chọn ít nhất một file.");
  const uploaded = await storage.uploadMany(files, `csca/courses/${courseId}/lessons/${lessonId}/assignment`);
  try {
    return (await repository.insertAssignmentAttachments(assignment.id, uploaded)).map(mapFile);
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function deleteAssignmentAttachment(courseIdValue, lessonIdValue, attachmentIdValue) {
  const { courseId, lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const removed = await repository.deleteAssignmentAttachment(courseId, lessonId, id(attachmentIdValue, "attachmentId"));
  if (!removed) throw new CourseApiError(404, "COURSE_ATTACHMENT_NOT_FOUND", "Ảnh hoặc file đề không tồn tại.");
  await storage.remove(removed).catch(() => undefined);
  return { id: Number(removed.id), deleted: true };
}

async function getLearnerAssignment(lessonIdValue, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await repository.findAssignmentByLesson(lessonId, { publishedOnly: true });
  if (!lesson) return null;
  return mapAssignment(lesson, { userId: user.id });
}

async function submitAssignment(lessonIdValue, body, files, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await requirePublishedLessonAccess(lessonId, user);
  const assignment = await repository.findAssignmentByLesson(lesson.id, { publishedOnly: true });
  if (!assignment) throw new CourseApiError(404, "COURSE_ASSIGNMENT_NOT_FOUND", "Bài học này chưa có bài tập đang mở.");
  const textContent = text(body.textContent, "textContent", 20000);
  if (!textContent && !files?.length) throw new CourseApiError(422, "COURSE_SUBMISSION_EMPTY", "Hãy nhập nội dung hoặc chọn ít nhất một file bài làm.");
  const uploaded = await storage.uploadMany(files || [], `csca/courses/${lesson.course_id}/lessons/${lessonId}/submissions/${user.id}`);
  try {
    const result = await repository.replaceSubmission(assignment.id, user.id, textContent, uploaded);
    Promise.allSettled(result.replacedFiles.map(storage.remove)).catch(() => undefined);
    return mapSubmission(result.submission);
  } catch (error) {
    await Promise.allSettled(uploaded.map(storage.remove));
    throw error;
  }
}

async function requirePublishedLessonAccess(lessonId, user) {
  const learningRepository = require("../repositories/learningRepository");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  await courseService.requireLearningAccess(lesson.course_id, user);
  return lesson;
}

async function gradeSubmission(courseIdValue, lessonIdValue, submissionIdValue, body, user) {
  const { courseId, lessonId } = await requireAdminLesson(courseIdValue, lessonIdValue);
  const assignment = await repository.findAssignmentByLesson(lessonId);
  if (!assignment) throw new CourseApiError(404, "COURSE_ASSIGNMENT_NOT_FOUND", "Bài tập không tồn tại.");
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > Number(assignment.max_score)) {
    throw new CourseApiError(422, "COURSE_GRADE_INVALID", `Điểm phải từ 0 đến ${Number(assignment.max_score)}.`);
  }
  const feedback = text(body.feedback, "feedback", 10000);
  const row = await repository.gradeSubmission(courseId, lessonId, id(submissionIdValue, "submissionId"), {
    score, feedback, gradedBy: user.id,
  });
  if (!row) throw new CourseApiError(404, "COURSE_SUBMISSION_NOT_FOUND", "Không tìm thấy bài nộp trong bài học này.");
  row.attachments = (await repository.findUserSubmission(row.assignment_id, row.user_id))?.attachments || [];
  return mapSubmission(row);
}

module.exports = {
  getAdminWork, uploadLessonResources, deleteLessonResource, saveAssignment,
  uploadAssignmentAttachments, deleteAssignmentAttachment, getLearnerAssignment,
  submitAssignment, gradeSubmission, mapAssignment, mapSubmission,
};
