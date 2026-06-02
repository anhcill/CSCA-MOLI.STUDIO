const pool = require("../config/database");

const Ticket = {
  // Setup script to run once
  async initTables() {
    const query = `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) DEFAULT 'general',
        reference_url VARCHAR(255),
        content TEXT NOT NULL,
        image_url VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS support_replies (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_admin_reply BOOLEAN DEFAULT false,
        content TEXT NOT NULL,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
  },

  async create(data) {
    const content = String(data.content || "").trim();
    const query = `
      INSERT INTO support_tickets (user_id, category, reference_url, content, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.userId,
      data.category || 'general',
      data.referenceUrl || null,
      content,
      data.imageUrl || null
    ]);
    return result.rows[0];
  },

  async getUserTickets(userId, categories = null) {
    const params = [userId];
    const query = `
      SELECT t.*,
        (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as reply_count
      FROM support_tickets t
      WHERE user_id = $1
      ${Array.isArray(categories) && categories.length > 0 ? "AND category = ANY($2)" : ""}
      ORDER BY updated_at DESC, created_at DESC
    `;
    if (Array.isArray(categories) && categories.length > 0) params.push(categories);
    const result = await pool.query(query, params);
    return result.rows;
  },

  async getById(ticketId, userId = null, isAdmin = false, categories = null) {
    // If not admin, ensure user_id matches
    let query = `
      SELECT t.*, u.full_name as author_name, u.avatar_url as author_avatar, u.email as author_email
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1
    `;
    const params = [ticketId];
    if (!isAdmin) {
      query += ` AND t.user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (Array.isArray(categories) && categories.length > 0) {
      query += ` AND t.category = ANY($${params.length + 1})`;
      params.push(categories);
    }
    const ticketRes = await pool.query(query, params);
    if (ticketRes.rows.length === 0) return null;

    const ticket = ticketRes.rows[0];

    // Fetch replies
    const repliesQuery = `
      SELECT r.*, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM support_replies r
      LEFT JOIN users u ON r.sender_id = u.id
      WHERE r.ticket_id = $1
      ORDER BY r.created_at ASC
    `;
    const repliesRes = await pool.query(repliesQuery, [ticketId]);
    ticket.replies = repliesRes.rows;

    return ticket;
  },

  async addReply(ticketId, senderId, isAdmin, content, imageUrl) {
    const message = String(content || "").trim();
    const query = `
      INSERT INTO support_replies (ticket_id, sender_id, is_admin_reply, content, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [ticketId, senderId, isAdmin, message, imageUrl || null]);

    // Update ticket timestamp and status
    const newStatus = isAdmin ? 'answered' : 'pending';
    await pool.query(
      `UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newStatus, ticketId]
    );

    return result.rows[0];
  },

  async updateStatus(ticketId, status) {
    const query = `
      UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *
    `;
    const result = await pool.query(query, [status, ticketId]);
    return result.rows[0];
  },

  async getAllForAdmin(statusFilter = 'all', categories = null) {
    const params = [];
    const conditions = [];
    let query = `
      SELECT t.*, u.full_name as author_name, u.email as author_email,
        (SELECT COUNT(*) FROM support_replies WHERE ticket_id = t.id) as reply_count
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
    `;
    if (statusFilter !== 'all') {
      params.push(statusFilter);
      conditions.push(`t.status = $${params.length}`);
    }
    if (Array.isArray(categories) && categories.length > 0) {
      params.push(categories);
      conditions.push(`t.category = ANY($${params.length})`);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    query += ` ORDER BY t.updated_at DESC, t.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  },

  async deleteTicket(ticketId) {
    // support_replies will be auto-deleted via ON DELETE CASCADE
    const result = await pool.query(
      `DELETE FROM support_tickets WHERE id = $1 RETURNING id`,
      [ticketId]
    );
    return result.rows[0];
  }
};

module.exports = Ticket;
