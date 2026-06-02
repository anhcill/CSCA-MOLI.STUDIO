const Ticket = require("../models/Ticket");

const hasText = (value) => String(value || "").trim().length > 0;

const qaController = {
  async createTicket(req, res) {
    try {
      const user = req.user;

      const { category, referenceUrl, content, imageUrl } = req.body;
      if (!hasText(content) && !hasText(imageUrl)) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập nội dung góp ý, câu hỏi hoặc đính kèm ảnh.",
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
      res.status(500).json({ success: false, message: "Lỗi máy chủ khi gửi góp ý." });
    }
  },

  async getMyTickets(req, res) {
    try {
      const tickets = await Ticket.getUserTickets(req.user.id);
      res.json({ success: true, data: tickets });
    } catch (error) {
      console.error("Get My Tickets Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy lịch sử góp ý." });
    }
  },

  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getById(id, req.user.id, false);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy góp ý hoặc bạn không có quyền xem.",
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
        return res.status(404).json({ success: false, message: "Không tìm thấy hội thoại để trả lời." });
      }
      if (ticket.status === "closed") {
        return res.status(400).json({
          success: false,
          message: "Hội thoại đã đóng, không thể gửi thêm tin nhắn.",
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
