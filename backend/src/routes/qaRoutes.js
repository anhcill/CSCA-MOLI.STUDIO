const express = require("express");
const router = express.Router();
const qaController = require("../controllers/qaController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.post("/feedback", qaController.createFeedbackTicket);
router.get("/feedback/my-tickets", qaController.getMyFeedbackTickets);
router.get("/feedback/:id", qaController.getFeedbackDetail);
router.post("/feedback/:id/reply", qaController.replyFeedbackTicket);

router.post("/create", qaController.createTicket);
router.get("/my-tickets", qaController.getMyTickets);
router.get("/:id", qaController.getTicketDetail);
router.post("/:id/reply", qaController.replyTicket);

module.exports = router;
