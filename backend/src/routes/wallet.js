const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const coinService = require("../services/coinService");

const router = express.Router();

router.get("/ledger", authenticate, async (req, res) => {
  try {
    const [balance, entries] = await Promise.all([
      coinService.getBalance(req.user.id),
      coinService.getLedger(req.user.id, req.query),
    ]);
    res.json({ success: true, data: { balance, entries } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Không tải được ví xu" });
  }
});

module.exports = router;
