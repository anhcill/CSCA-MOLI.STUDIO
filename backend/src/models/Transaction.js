const db = require("../config/database");

/**
 * Transaction Model
 * Handles all database operations related to payments and transactions
 */
class Transaction {
  /**
   * Create a new transaction
   */
  static async create(data) {
    const { user_id, amount, payment_method, package_id, package_duration, package_name, transaction_code, coupon_code } = data;
    const rawResponse = coupon_code ? JSON.stringify({ couponCode: coupon_code }) : null;
    try {
      const result = await db.query(
        `INSERT INTO transactions (user_id, amount, payment_method, package_id, package_duration, package_name, transaction_code, status, raw_response)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING *`,
        [user_id, amount, payment_method, package_id, package_duration, package_name, transaction_code, rawResponse]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find transaction by ID
   */
  static async findById(id) {
    try {
      const result = await db.query("SELECT * FROM transactions WHERE id = $1", [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find transaction by transaction code (e.g., from Webhook/Bank transfer memo)
   */
  static async findByTransactionCode(code) {
    try {
      const result = await db.query("SELECT * FROM transactions WHERE transaction_code = $1", [code]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get transaction history for a user
   */
  static async findByUserId(user_id) {
    try {
      const result = await db.query(
        "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC",
        [user_id]
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  static async updateStatus(id, status) {
    try {
      const result = await db.query(
        "UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a specific field
   */
  static async updateField(id, field, value) {
    try {
      const result = await db.query(
        `UPDATE transactions SET ${field} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [value, id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update transaction as completed (with full payment info)
   */
  static async updateComplete(id, data) {
    try {
      const {
        status = 'completed',
        payment_channel,
        trans_id,
        raw_response,
        paid_at,
        vip_expires_at,
      } = data;

      const result = await db.query(
        `UPDATE transactions SET
           status = $1,
           payment_channel = COALESCE($2, payment_channel),
           trans_id = COALESCE($3, trans_id),
           raw_response = COALESCE($4, raw_response),
           paid_at = COALESCE($5, paid_at),
           vip_expires_at = COALESCE($6, vip_expires_at),
           updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [status, payment_channel, trans_id, JSON.stringify(raw_response), paid_at, vip_expires_at, id]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Transaction;
