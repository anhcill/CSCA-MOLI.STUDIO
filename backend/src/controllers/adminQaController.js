const Ticket = require("../models/Ticket");
const emailService = require("../services/emailService");
const pool = require("../config/database");

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

      // ── Sau khi response: gửi thông báo async ──────────────────
      setImmediate(async () => {
        try {
          // Lấy thông tin user sở hữu ticket
          const ownerRes = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.username FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
            [id]
          );
          const owner = ownerRes.rows[0];
          if (!owner) return;

          const advisorName = req.user.full_name || `Cố vấn CSCA`;

          // 1. Gửi email thông báo
          emailService.sendQaReplyEmail({
            email: owner.email,
            name: owner.full_name || owner.username || 'bạn',
            ticketId: id,
            preview: content,
            advisorName,
          }).catch(err => console.error('QA reply email error:', err.message));

          // 2. Tạo in-app notification
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link, is_read)
             VALUES ($1, 'qa_reply', $2, $3, $4, false)`,
            [
              owner.id,
              '💬 Cố vấn đã trả lời câu hỏi của bạn!',
              `${advisorName}: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
              `/hoi-dap/${id}`,
            ]
          );
        } catch (notifErr) {
          console.error('QA reply notification error:', notifErr.message);
        }
      });

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
