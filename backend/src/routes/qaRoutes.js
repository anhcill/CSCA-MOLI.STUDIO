const express = require("express");
const router = express.Router();
const qaController = require("../controllers/qaController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);

router.post("/create", qaController.createTicket);
router.get("/my-tickets", qaController.getMyTickets);
router.get("/:id", qaController.getTicketDetail);
router.post("/:id/reply", qaController.replyTicket);

module.exports = router;
