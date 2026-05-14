const Ticket = require("../models/Ticket");
const emailService = require("../services/emailService");
const pool = require("../config/database");

const hasText = (value) => String(value || "").trim().length > 0;

const adminQaController = {
  async getAllTickets(req, res) {
    try {
      const { status } = req.query;
      const tickets = await Ticket.getAllForAdmin(status || "all");
      res.json({ success: true, data: tickets });
    } catch (error) {
      console.error("Admin Get Tickets Error:", error);
      res.status(500).json({ success: false, message: "Lỗi lấy danh sách câu hỏi." });
    }
  },

  async getTicketDetail(req, res) {
    try {
      const { id } = req.params;
      const ticket = await Ticket.getById(id, null, true);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy ticket." });
      }
      res.json({ success: true, data: ticket });
    } catch (error) {
      console.error("Admin Get Ticket Detail:", error);
      res.status(500).json({ success: false, message: "Lỗi nội bộ máy chủ." });
    }
  },

  async replyTicket(req, res) {
    try {
      const { id } = req.params;
      const { content, imageUrl } = req.body;

      if (!hasText(content) && !hasText(imageUrl)) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung hoặc đính kèm ảnh." });
      }

      const ticket = await Ticket.getById(id, null, true);
      if (!ticket) {
        return res.status(404).json({ success: false, message: "Không tìm thấy ticket." });
      }
      if (ticket.status === "closed") {
        return res.status(400).json({ success: false, message: "Ticket đã đóng, hãy mở lại trước khi trả lời." });
      }

      const reply = await Ticket.addReply(id, req.user.id, true, content, imageUrl);
      res.status(201).json({ success: true, data: reply });

      setImmediate(async () => {
        try {
          const ownerRes = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.username
             FROM support_tickets t
             JOIN users u ON u.id = t.user_id
             WHERE t.id = $1`,
            [id],
          );
          const owner = ownerRes.rows[0];
          if (!owner) return;

          const advisorName = req.user.full_name || "Giảng viên CSCA";
          const preview = String(content || "Đã gửi ảnh đính kèm.");

          emailService.sendQaReplyEmail({
            email: owner.email,
            name: owner.full_name || owner.username || "bạn",
            ticketId: id,
            preview,
            advisorName,
          }).catch((err) => console.error("QA reply email error:", err.message));

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link, is_read)
             VALUES ($1, 'qa_reply', $2, $3, $4, false)`,
            [
              owner.id,
              "Giảng viên đã trả lời câu hỏi của bạn",
              `${advisorName}: "${preview.substring(0, 100)}${preview.length > 100 ? "..." : ""}"`,
              `/hoi-dap/${id}`,
            ],
          );
        } catch (notifErr) {
          console.error("QA reply notification error:", notifErr.message);
        }
      });
    } catch (error) {
      console.error("Admin Reply Ticket:", error);
      res.status(500).json({ success: false, message: "Lỗi trả lời." });
    }
  },

  async changeTicketStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!["pending", "answered", "closed"].includes(status)) {
        return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });
      }
      const updated = await Ticket.updateStatus(id, status);
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Change status:", error);
      res.status(500).json({ success: false, message: "Lỗi thay đổi trạng thái." });
    }
  },

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
  },
};

module.exports = adminQaController;
