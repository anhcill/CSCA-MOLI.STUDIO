const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const gameService = require("../services/gameService");
const coinService = require("../services/coinService");

const router = express.Router();

function handleError(res, error) {
  const status = error.status || error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message || "Lỗi hệ thống game",
    code: error.code,
  });
}

router.get("/", authenticate, async (req, res) => {
  try {
    const [modes, recent, balance] = await Promise.all([
      gameService.listModes(),
      gameService.getMyRecentSessions(req.user.id, 8),
      coinService.getBalance(req.user.id),
    ]);
    res.json({ success: true, data: { modes, recent, balance } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/:mode/start", authenticate, async (req, res) => {
  try {
    const data = await gameService.startSession(req.user.id, req.params.mode);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/sessions/:id/answer", authenticate, async (req, res) => {
  try {
    const data = await gameService.answerQuestion(
      req.user.id,
      req.params.id,
      req.body.question_ref,
      req.body.answer_key,
      req.body.time_spent_seconds,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/sessions/:id/finish", authenticate, async (req, res) => {
  try {
    const data = await gameService.finishSession(req.user.id, req.params.id);
    const balance = await coinService.getBalance(req.user.id);
    res.json({ success: true, data: { ...data, balance } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/sessions/:id/finish-external", authenticate, async (req, res) => {
  try {
    const data = await gameService.finishExternalSession(req.user.id, req.params.id, req.body || {});
    const balance = await coinService.getBalance(req.user.id);
    res.json({ success: true, data: { ...data, balance } });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
