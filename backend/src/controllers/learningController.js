const learningService = require("../services/learningService");
const assignmentService = require("../services/courseAssignmentService");
const discussionService = require("../services/courseDiscussionService");
const courseIntegrationRuntime = require("../services/courseIntegrationRuntime");
const { CourseApiError, sendData, sendCourseError } = require("../utils/courseResponses");

function handler(action) {
  return async (req, res) => {
    try {
      return sendData(res, await action(req, res));
    } catch (error) {
      return sendCourseError(res, error);
    }
  };
}

function sendExternalCourseError(res, error) {
  if (error instanceof CourseApiError) {
    const payload = {
      success: false,
      code: error.code,
      errorCode: error.code,
      message: error.message,
    };
    if (error.details !== undefined) payload.details = error.details;
    return res.status(error.status).json(payload);
  }
  return sendCourseError(res, error);
}

function externalHandler(action) {
  return async (req, res) => {
    try {
      return sendData(res, await action(req, res));
    } catch (error) {
      return sendExternalCourseError(res, error);
    }
  };
}

const listMyEnrollments = handler((req) => learningService.listMyEnrollments(req.user));
const getLearningCourse = handler((req) => learningService.getLearningCourse(req.params.courseId, req.user));
const getLearningLesson = handler((req) => learningService.getLearningLesson(req.params.lessonId, req.user));
const updateLessonProgress = handler((req) => learningService.updateLessonProgress(req.params.lessonId, req.body || {}, req.user));
const completeLesson = handler((req) => learningService.completeLesson(req.params.lessonId, req.user));
const getCourseProgress = handler((req) => learningService.getCourseProgress(req.params.courseId, req.user));
const submitAssignment = handler((req) => assignmentService.submitAssignment(
  req.params.lessonId, req.body || {}, req.files || [], req.user,
));
const listLessonQuestions = handler((req) => discussionService.listLearnerQuestions(req.params.lessonId, req.user));
const createLessonQuestion = handler((req) => discussionService.createLearnerQuestion(
  req.params.lessonId, req.body || {}, req.files || [], req.user,
));
const replyLessonQuestion = handler((req) => discussionService.replyAsLearner(
  req.params.lessonId, req.params.threadId, req.body || {}, req.files || [], req.user,
));

const getExternalWorkspace = handler((req, res) =>
  courseIntegrationRuntime.workspace.getExternalCourseWorkspace({
    courseSlugOrId: req.params.courseSlugOrId,
    profileId: req.query?.profileId || req.query?.profile_id || null,
    unitId: req.query?.unitId || req.query?.unit_id || null,
    user: req.user || null,
    req,
    res,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

const getExternalUnit = handler((req, res) =>
  courseIntegrationRuntime.workspace.getExternalUnitDetail({
    profileId: req.params.profileId,
    unitId: req.params.unitId,
    courseSlugOrId: req.query?.courseId || req.query?.courseSlug || null,
    user: req.user || null,
    req,
    res,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

const getExternalVideoPlaybackToken = handler((req, res) =>
  courseIntegrationRuntime.workspace.getExternalVideoPlaybackToken({
    profileId: req.params.profileId,
    unitId: req.params.unitId,
    videoId: req.params.videoId,
    ttlSeconds: req.body?.ttlSeconds ?? 60,
    delegatedSessionToken: req.headers["x-delegated-session"] || req.body?.sessionToken || null,
    user: req.user,
    req,
    res,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

const updateExternalVideoProgress = handler((req, res) =>
  courseIntegrationRuntime.workspace.updateExternalVideoProgress({
    profileId: req.params.profileId,
    unitId: req.params.unitId,
    videoId: req.params.videoId,
    payload: req.body || {},
    delegatedSessionToken: req.headers["x-delegated-session"] || req.body?.sessionToken || null,
    user: req.user,
    req,
    res,
    correlationId: req.headers["x-correlation-id"] || null,
  }),
);

// Day 5: Secure delegated file streaming / metadata
const streamExternalFile = async (req, res) => {
  try {
    const result = await courseIntegrationRuntime.workspace.streamExternalUnitFile({
      profileId: req.params.profileId,
      unitId: req.params.unitId,
      fileId: req.params.fileId,
      disposition: req.query?.disposition || "inline",
      mode: req.query?.mode || "stream",
      rangeHeader: req.headers.range || null,
      delegatedSessionToken: req.headers["x-delegated-session"] || null,
      user: req.user || null,
      req,
      res,
      correlationId: req.headers["x-correlation-id"] || null,
    });
    if (result?.mode === "metadata") {
      return sendData(res, result.data);
    }
    for (const [headerName, headerVal] of Object.entries(result.headers || {})) {
      if (headerVal != null) res.setHeader(headerName, headerVal);
    }
    return res.status(result.status || 200).send(result.bodyBuffer);
  } catch (error) {
    return sendExternalCourseError(res, error);
  }
};

function commonActionContext(req, res) {
  return {
    profileId: req.params.profileId,
    unitId: req.params.unitId,
    idempotencyKey: req.headers["idempotency-key"] || req.body?.idempotencyKey || null,
    delegatedSessionToken: req.headers["x-delegated-session"] || req.body?.sessionToken || null,
    user: req.user,
    req,
    res,
    correlationId: req.headers["x-correlation-id"] || null,
  };
}

// Day 6: Quizzes & Assignments
const getExternalQuiz = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.getExternalQuiz({
    ...commonActionContext(req, res),
    quizId: req.params.quizId,
  }),
);

const startExternalQuizAttempt = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.startExternalQuizAttempt({
    ...commonActionContext(req, res),
    quizId: req.params.quizId,
    newAttempt: Boolean(req.body?.newAttempt),
  }),
);

const saveExternalQuizAnswers = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.saveExternalQuizAnswers({
    ...commonActionContext(req, res),
    attemptId: req.params.attemptId,
    answers: req.body?.answers,
    questionId: req.body?.questionId,
    answer: req.body?.answer,
  }),
);

const submitExternalQuizAttempt = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.submitExternalQuizAttempt({
    ...commonActionContext(req, res),
    attemptId: req.params.attemptId,
  }),
);

const getExternalAssignment = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.getExternalAssignment({
    ...commonActionContext(req, res),
    assignmentId: req.params.assignmentId,
  }),
);

const submitExternalAssignment = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.submitExternalAssignment({
    ...commonActionContext(req, res),
    assignmentId: req.params.assignmentId,
    files: req.files || [],
    contentText: req.body?.contentText,
    fileAssetIds: req.body?.fileAssetIds,
    audioAssetId: req.body?.audioAssetId,
  }),
);

// Day 7: Notes, Bookmarks & Q&A
const listExternalNotes = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.listExternalNotes(commonActionContext(req, res)),
);

const createExternalNote = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.createExternalNote({
    ...commonActionContext(req, res),
    timestampSeconds: req.body?.timestampSeconds ?? 0,
    content: req.body?.content,
  }),
);

const updateExternalNote = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.updateExternalNote({
    ...commonActionContext(req, res),
    noteId: req.params.noteId,
    timestampSeconds: req.body?.timestampSeconds,
    content: req.body?.content,
    expectedRevision: req.body?.expectedRevision,
  }),
);

const deleteExternalNote = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.deleteExternalNote({
    ...commonActionContext(req, res),
    noteId: req.params.noteId,
    expectedRevision: req.body?.expectedRevision ?? req.query?.expectedRevision,
  }),
);

const listExternalBookmarks = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.listExternalBookmarks(commonActionContext(req, res)),
);

const createExternalBookmark = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.createExternalBookmark({
    ...commonActionContext(req, res),
    videoAssetId: req.body?.videoAssetId ?? null,
    timestampSeconds: req.body?.timestampSeconds ?? 0,
    label: req.body?.label ?? "",
  }),
);

const deleteExternalBookmark = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.deleteExternalBookmark({
    ...commonActionContext(req, res),
    bookmarkId: req.params.bookmarkId,
  }),
);

const listExternalQaThreads = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.listExternalQaThreads(commonActionContext(req, res)),
);

const createExternalQaThread = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.createExternalQaThread({
    ...commonActionContext(req, res),
    title: req.body?.title,
    body: req.body?.body,
  }),
);

const replyExternalQaThread = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.replyExternalQaThread({
    ...commonActionContext(req, res),
    threadId: req.params.threadId,
    body: req.body?.body,
    expectedRevision: req.body?.expectedRevision,
  }),
);

const updateExternalQaThreadStatus = externalHandler((req, res) =>
  courseIntegrationRuntime.workspace.updateExternalQaThreadStatus({
    ...commonActionContext(req, res),
    threadId: req.params.threadId,
    status: req.body?.status,
    isPinned: req.body?.isPinned,
    markRead: req.body?.markRead,
    expectedRevision: req.body?.expectedRevision,
  }),
);

module.exports = {
  listMyEnrollments, getLearningCourse, getLearningLesson,
  updateLessonProgress, completeLesson, getCourseProgress,
  submitAssignment,
  listLessonQuestions, createLessonQuestion, replyLessonQuestion,
  getExternalWorkspace, getExternalUnit,
  getExternalVideoPlaybackToken, updateExternalVideoProgress,
  streamExternalFile,
  getExternalQuiz,
  startExternalQuizAttempt,
  saveExternalQuizAnswers,
  submitExternalQuizAttempt,
  getExternalAssignment,
  submitExternalAssignment,
  listExternalNotes,
  createExternalNote,
  updateExternalNote,
  deleteExternalNote,
  listExternalBookmarks,
  createExternalBookmark,
  deleteExternalBookmark,
  listExternalQaThreads,
  createExternalQaThread,
  replyExternalQaThread,
  updateExternalQaThreadStatus,
};
