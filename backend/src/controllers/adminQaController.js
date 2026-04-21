const Ticket = require("../models/Ticket");

const adminQaController = {
  // Lấy tất cả tickets
  async getAllTickets(req, res) {
    try {
      const { status } = req.query; // 'all', 'pending', 'answered', 'closed'
      const tickets = await Ticket.getAllForAdmin(status || 'all');
      res.json({ success: true, data: tickets });
    } catch (error) {
      console.error("Admin Get Tickets Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy danh sách câu hỏi." });
    }
  },

  // Xem chi tiết câu hỏi & hội thoại
  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getById(id, null, true); // isAdmin = true
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy ticket." });
      }
      res.json({ success: true, data: ticket });
    } catch (error) {
      console.error("Admin Get Ticket Detail:", error);
      res.status(500).json({ success: false, message: "Lỗi nội bộ máy chủ." });
    }
  },

  // Gửi trả lời từ Admin (Cố vấn học tập)
  async replyTicket(req, res) {
    try {
      const { id } = req.params;
      const { content, imageUrl } = req.body;

      if (!content || content.trim() === "") {
        return res.status(400).json({ success: false, message: "Trống tin nhắn." });
      }

      const reply = await Ticket.addReply(id, req.user.id, true, content, imageUrl);
      res.status(201).json({ success: true, data: reply });
    } catch (error) {
      console.error("Admin Reply Ticket:", error);
      res.status(500).json({ success: false, message: "Lỗi trả lời." });
    }
  },

  // Đóng/Mở ticket
  async changeTicketStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await Ticket.updateStatus(id, status);
      res.json({ success: true, data: updated });
    } catch (error) {
       console.error("Change status:", error);
       res.status(500).json({ success: false, message: "Lỗi thay đổi trạng thái." });
    }
  },

  // Xóa ticket (và toàn bộ replies)
  async deleteTicket(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Ticket.deleteTicket(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Ticket không tồn tại." });
      }
      res.json({ success: true, message: "Đã xóa ticket thành công." });
    } catch (error) {
      console.error("Delete ticket:", error);
      res.status(500).json({ success: false, message: "Lỗi xóa ticket." });
    }
  }
};

module.exports = adminQaController;
