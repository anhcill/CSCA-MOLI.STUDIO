const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// ─── Legacy endpoints ────────────────────────────────────────────────────────────
router.get('/analyze',          aiController.analyzeUserPerformance);  // GET /api/ai/analyze
router.post('/refresh',         aiController.refreshAnalysis);          // POST /api/ai/refresh

// ─── 7 Features mới ────────────────────────────────────────────────────────────

// 🥇 FEATURE 1: Phân tích kết quả bài thi (sau khi nộp)
router.post('/exam-result/:attemptId',  aiController.analyzeExamResult); // POST /api/ai/exam-result/:attemptId

// 🥈 FEATURE 2: Giải thích câu sai
router.get('/exam/:attemptId/explanations', aiController.explainWrongAnswers); // GET /api/ai/exam/:attemptId/explanations

// 🥉 FEATURE 3: Phân tích theo chủ đề
router.post('/topics',          aiController.analyzeTopics);             // POST /api/ai/topics

// 🔥 FEATURE 4: Gợi ý luyện tập
router.post('/practice',        aiController.getPracticeRecommendations); // POST /api/ai/practice

// 🚀 FEATURE 5: Chatbot hỏi đáp
router.post('/ask',             aiController.askAI);
router.post('/ask-stream',      aiController.askAIStream);

// 🧠 FEATURE 6: Phân tích tiến bộ
router.get('/progress',         aiController.analyzeProgress);           // GET /api/ai/progress

// ⚡ FEATURE 7: Gợi ý đề tiếp theo
router.get('/next-exam',       aiController.recommendNextExam);        // GET /api/ai/next-exam

// 📝 FEATURE 8: Chấm điểm tự luận / Dịch thuật
router.post('/grade-essay',   aiController.gradeEssay);              // POST /api/ai/grade-essay

// 🎓 FEATURE 9: Giảng lại lý thuyết
router.post('/teach-grammar', aiController.teachGrammar);             // POST /api/ai/teach-grammar

module.exports = router;
