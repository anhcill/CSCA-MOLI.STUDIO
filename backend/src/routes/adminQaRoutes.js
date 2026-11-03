const express = require("express");
const router = express.Router();
const adminQaController = require("../controllers/adminQaController");
const { authenticate, authorizePermission } = require("../middleware/authMiddleware");

router.use(authenticate, authorizePermission('reports.manage'));

router.get("/tickets", adminQaController.getAllTickets);
router.get("/tickets/:id", adminQaController.getTicketDetail);
router.post("/tickets/:id/reply", adminQaController.replyTicket);
router.put("/tickets/:id/status", adminQaController.changeTicketStatus);
router.delete("/tickets/:id", adminQaController.deleteTicket);

module.exports = router;
