const express = require("express");
const router = express.Router();
const adminQaController = require("../controllers/adminQaController");
const { authenticate, checkAnyAdmin } = require("../middleware/authMiddleware");

// Yêu cầu quyền admin (giáo vụ, nội dung, system admin...)
router.use(authenticate, checkAnyAdmin);

router.get("/tickets", adminQaController.getAllTickets);
router.get("/tickets/:id", adminQaController.getTicketDetail);
router.post("/tickets/:id/reply", adminQaController.replyTicket);
router.put("/tickets/:id/status", adminQaController.changeTicketStatus);

module.exports = router;
