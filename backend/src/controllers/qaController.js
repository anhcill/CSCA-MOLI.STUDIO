const Ticket = require("../models/Ticket");
const { canChatWithInstructor } = require("../middleware/authMiddleware");

const hasText = (value) => String(value || "").trim().length > 0;

const qaController = {
  async createTicket(req, res) {
    try {
      const user = req.user;

      if (!canChatWithInstructor(user)) {
        return res.status(403).json({
          success: false,
          code: "PREMIUM_REQUIRED",
          message: "Tính năng Hỏi giảng viên 1:1 chỉ dành cho thành viên Pre.",
        });
      }

      const { category, referenceUrl, content, imageUrl } = req.body;
      if (!hasText(content) && !hasText(imageUrl)) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập nội dung hoặc đính kèm ảnh câu hỏi.",
        });
      }

      const ticket = await Ticket.create({
        userId: user.id,
        category,
        referenceUrl,
        content: String(content || "").trim(),
        imageUrl,
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      console.error("Create Ticket Error:", error);
      res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo câu hỏi." });
    }
  },

  async getMyTickets(req, res) {
    try {
      const tickets = await Ticket.getUserTickets(req.user.id);
      res.json({ success: true, data: tickets });
    } catch (error) {
      console.error("Get My Tickets Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy lịch sử câu hỏi." });
    }
  },

  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getById(id, req.user.id, false);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy câu hỏi hoặc bạn không có quyền xem.",
        });
      }
      res.json({ success: true, data: ticket });
    } catch (error) {
      console.error("Get Ticket Detail Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy chi tiết." });
    }
  },

  async replyTicket(req, res) {
    try {
      const { id } = req.params;
      const { content, imageUrl } = req.body;

      const ticket = await Ticket.getById(id, req.user.id, false);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi để trả lời." });
      }
      if (ticket.status === "closed") {
        return res.status(400).json({
          success: false,
          message: "Cuộc tư vấn đã đóng, không thể gửi thêm tin nhắn.",
        });
      }
      if (!hasText(content) && !hasText(imageUrl)) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập tin nhắn hoặc đính kèm ảnh.",
        });
      }

      const reply = await Ticket.addReply(id, req.user.id, false, content, imageUrl);
      res.status(201).json({ success: true, data: reply });
    } catch (error) {
      console.error("Reply Ticket Error:", error);
      res.status(500).json({ success: false, message: "Lỗi gửi tin nhắn." });
    }
  },
};

module.exports = qaController;
