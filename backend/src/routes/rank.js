const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const rankService = require("../services/rankService");

const router = express.Router();

function handleError(res, error) {
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Lỗi hệ thống rank",
    code: error.code,
  });
}

router.get("/seasons/current", authenticate, async (req, res) => {
  try {
    const data = await rankService.getMyRating(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/matchmaking", authenticate, async (req, res) => {
  try {
    const data = await rankService.findOrCreateMatch(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/matches/:id/submit", authenticate, async (req, res) => {
  try {
    const data = await rankService.submitMatch(req.user.id, req.params.id, req.body.answers || []);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/leaderboard", authenticate, async (req, res) => {
  try {
    const data = await rankService.getLeaderboard({ limit: req.query.limit });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/matches/me", authenticate, async (req, res) => {
  try {
    const matches = await rankService.getMyMatches(req.user.id, req.query.limit);
    res.json({ success: true, data: { matches } });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
