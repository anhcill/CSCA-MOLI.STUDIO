const learningActionService = require("../services/learningActionService");

const handleError = (res, error, label) => {
  console.error(`${label} error:`, error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode === 404 ? "Khong co du lieu phu hop" : error.message || "Loi server",
  });
};

exports.getSummary = async (req, res) => {
  try {
    const data = await learningActionService.getActionSummary(req.user.id, req.query.subject || null);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Learning action summary");
  }
};

exports.getWrongQuestions = async (req, res) => {
  try {
    const data = await learningActionService.getWrongQuestions(req.user.id, req.query.limit);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Wrong questions");
  }
};

exports.createWrongPractice = async (req, res) => {
  try {
    const data = await learningActionService.createWrongQuestionPractice(req.user.id, req.body.limit, {
      subject: req.body.subject || null,
      examId: req.body.examId || req.body.exam_id || null,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Create wrong practice");
  }
};

exports.createWeakTopicPractice = async (req, res) => {
  try {
    const data = await learningActionService.createWeakTopicPractice(
      req.user.id,
      req.body.topic_id,
      req.body.limit,
      req.body.subject || null,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Create weak topic practice");
  }
};

exports.getPracticeSet = async (req, res) => {
  try {
    const data = await learningActionService.getPracticeSet(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get practice set");
  }
};

exports.listBookmarks = async (req, res) => {
  try {
    const data = await learningActionService.listBookmarks(req.user.id, req.query.type);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "List bookmarks");
  }
};

exports.saveBookmark = async (req, res) => {
  try {
    const data = await learningActionService.upsertBookmark(req.user.id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Save bookmark");
  }
};

exports.deleteBookmark = async (req, res) => {
  try {
    await learningActionService.deleteBookmark(req.user.id, req.params.type, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Delete bookmark");
  }
};

exports.listNotes = async (req, res) => {
  try {
    const data = await learningActionService.listQuestionNotes(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "List notes");
  }
};

exports.saveQuestionNote = async (req, res) => {
  try {
    const data = await learningActionService.upsertQuestionNote(
      req.user.id,
      req.params.questionId,
      req.body.note,
      req.body.source_attempt_id,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Save question note");
  }
};

exports.getNextLessons = async (req, res) => {
  try {
    const data = await learningActionService.getNextLessons(req.user.id, req.query.subject || null);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Next lessons");
  }
};

