const Ticket = require("../models/Ticket");
const { checkVipAccess } = require("../middleware/authMiddleware");

const qaController = {
  // 1. Tạo ticket mới (Gửi câu hỏi)
  async createTicket(req, res) {
    try {
      const user = req.user;
      
      // Chặn nếu không có Premium/VIP
      if (!checkVipAccess(user)) {
        return res.status(403).json({
          success: false,
          code: "VIP_REQUIRED",
          message: "Tính năng Hỏi-Đáp 1:1 chỉ dành cho thành viên VIP.",
        });
      }

      const { category, referenceUrl, content, imageUrl } = req.body;
      if (!content || content.trim() === "") {
        return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung câu hỏi." });
      }

      const ticket = await Ticket.create({
        userId: user.id,
        category,
        referenceUrl,
        content,
        imageUrl
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      console.error("Create Ticket Error:", error);
      res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo câu hỏi." });
    }
  },

  // 2. Lấy danh sách câu hỏi của tôi
  async getMyTickets(req, res) {
    try {
      const tickets = await Ticket.getUserTickets(req.user.id);
      res.json({ success: true, data: tickets });
    } catch (error) {
      console.error("Get My Tickets Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lịch sử câu hỏi." });
    }
  },

  // 3. Xem chi tiết 1 Box chat
  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getById(id, req.user.id, false);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi hoặc bạn không có quyền xem." });
      }
      res.json({ success: true, data: ticket });
    } catch (error) {
      console.error("Get Ticket Detail Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy chi tiết." });
    }
  },

  // 4. Sinh viên trả lời/Gửi thêm tin nhắn trong box chat
  async replyTicket(req, res) {
    try {
      const { id } = req.params;
      const { content, imageUrl } = req.body;
      
      const ticket = await Ticket.getById(id, req.user.id, false);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi để trả lời." });
      }

      const reply = await Ticket.addReply(id, req.user.id, false, content, imageUrl);
      res.status(201).json({ success: true, data: reply });
    } catch (error) {
      console.error("Reply Ticket Error:", error);
      res.status(500).json({ success: false, message: "Lỗi gửi tin nhắn." });
    }
  }
};

module.exports = qaController;
