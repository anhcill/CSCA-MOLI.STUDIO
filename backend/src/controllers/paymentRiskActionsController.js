const { pool } = require('../config/database');
const AuditLog = require('../utils/auditLog');
const UserActivity = require('../models/UserActivity');

/**
 * Risk Center  Phase C: Payment Risk Actions
 * Strong actions require risk_center.manage permission
 */

const PaymentRiskActions = {
  //  GET /payment-risks/:id  Get single transaction detail
  async getPaymentRiskDetail(req, res) {
    try {
      const { id } = req.params;

      const txResult = await pool.query(`
        SELECT
          t.*,
          u.full_name AS user_name, u.email AS user_email,
          u.is_vip, u.subscription_tier, u.coins AS user_coins,
          u.vip_expires_at AS user_vip_expires,
          vp.name AS package_display_name, vp.tier AS package_tier,
          vp.duration_days AS package_duration_days
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN vip_packages vp ON vp.id = t.package_id
        WHERE t.id = $1
      `, [id]);

      if (!txResult.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

      // Recent transactions from same user (fraud pattern detection)
      const recentTx = await pool.query(`
        SELECT id, amount, status, payment_method, transaction_code, created_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      `, [txResult.rows[0].user_id]);

      // Audit history for this transaction
      const audits = await pool.query(`
        SELECT al.*, adm.full_name AS admin_name
        FROM admin_audit_logs al
        LEFT JOIN users adm ON adm.id = al.admin_id
        WHERE al.entity_type = 'transaction' AND al.entity_id = $1
        ORDER BY al.created_at DESC
        LIMIT 50
      `, [id]);

      // Check for duplicate transaction codes
      const duplicates = txResult.rows[0].transaction_code ? await pool.query(`
        SELECT id, user_id, amount, status, created_at
        FROM transactions
        WHERE transaction_code = $1 AND id != $2
      `, [txResult.rows[0].transaction_code, id]) : { rows: [] };

      res.json({
        success: true,
        data: {
          ...txResult.rows[0],
          recentTransactions: recentTx.rows,
          auditHistory: audits.rows,
          duplicates: duplicates.rows,
        },
      });
    } catch (error) {
      console.error('[RiskCenter] getPaymentRiskDetail error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /payment-risks/:id/resolve
  async resolvePayment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const before = await pool.query('SELECT status, risk_flag FROM transactions WHERE id = $1', [id]);
      if (!before.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

      await pool.query(`
        UPDATE transactions
        SET risk_flag = 'resolved', risk_note = $2,
            reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id, reason || null, req.user.id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'resolve_payment', entityType: 'transaction',
        entityId: parseInt(id), beforeData: before.rows[0],
        afterData: { risk_flag: 'resolved' }, reason, ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] resolvePayment error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /payment-risks/:id/mark-suspicious
  async markSuspicious(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      await pool.query(`
        UPDATE transactions
        SET risk_flag = 'suspicious', risk_note = $2,
            reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id, reason.trim(), req.user.id]);

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'mark_suspicious', entityType: 'transaction',
        entityId: parseInt(id), afterData: { risk_flag: 'suspicious' },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[RiskCenter] markSuspicious error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /payment-risks/:id/sync
  async syncPayment(req, res) {
    try {
      const { id } = req.params;

      // For now, just re-read raw_response and note the sync attempt
      // Real payment gateway sync would go here
      const tx = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
      if (!tx.rows[0]) return res.status(404).json({ success: false, message: 'Transaction not found' });

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'sync_payment', entityType: 'transaction',
        entityId: parseInt(id), afterData: { synced_at: new Date().toISOString() },
        ...meta,
      });

      res.json({
        success: true,
        data: {
          id: tx.rows[0].id,
          status: tx.rows[0].status,
          raw_response: tx.rows[0].raw_response,
          message: 'Sync attempt logged. Manual payment gateway check may be needed.',
        },
      });
    } catch (error) {
      console.error('[RiskCenter] syncPayment error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  //  POST /payment-risks/:id/manual-credit-coins
  async manualCreditCoins(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });
      const coinAmount = parseInt(amount);
      if (!coinAmount || coinAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid coin amount' });

      await client.query('BEGIN');

      const tx = await client.query('SELECT user_id FROM transactions WHERE id = $1', [id]);
      if (!tx.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const userId = tx.rows[0].user_id;
      const before = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const beforeCoins = before.rows[0]?.coins || 0;

      await client.query('UPDATE users SET coins = coins + $2 WHERE id = $1', [userId, coinAmount]);

      // Write coin ledger entry if table exists
      try {
        await client.query(`
          INSERT INTO coin_ledger (user_id, amount, balance_after, type, description, reference_type, reference_id)
          VALUES ($1, $2, $3, 'admin_credit', $4, 'transaction', $5)
        `, [userId, coinAmount, beforeCoins + coinAmount, `Admin credit: ${reason.trim()}`, parseInt(id)]);
      } catch { /* coin_ledger may not exist */ }

      await client.query('COMMIT');

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'manual_credit_coins', entityType: 'transaction',
        entityId: parseInt(id),
        beforeData: { userId, coins: beforeCoins },
        afterData: { userId, coins: beforeCoins + coinAmount, credited: coinAmount },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true, data: { userId, beforeCoins, afterCoins: beforeCoins + coinAmount } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RiskCenter] manualCreditCoins error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      client.release();
    }
  },

  //  POST /payment-risks/:id/manual-grant-vip
  async manualGrantVip(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { reason, duration_days, tier } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });
      const days = parseInt(duration_days) || 30;
      const vipTier = tier || 'vip';

      await client.query('BEGIN');

      const tx = await client.query('SELECT user_id, package_id FROM transactions WHERE id = $1', [id]);
      if (!tx.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const userId = tx.rows[0].user_id;
      const before = await client.query(
        'SELECT is_vip, subscription_tier, vip_expires_at FROM users WHERE id = $1 FOR UPDATE', [userId]
      );

      const newExpires = new Date();
      // Extend from current expiry if still active
      if (before.rows[0]?.vip_expires_at && new Date(before.rows[0].vip_expires_at) > newExpires) {
        newExpires.setTime(new Date(before.rows[0].vip_expires_at).getTime());
      }
      newExpires.setDate(newExpires.getDate() + days);

      await client.query(`
        UPDATE users
        SET is_vip = TRUE, subscription_tier = $2, vip_expires_at = $3,
            vip_package_id = COALESCE($4, vip_package_id)
        WHERE id = $1
      `, [userId, vipTier, newExpires, tx.rows[0].package_id]);

      // Create entitlement if table exists
      try {
        await client.query(`
          INSERT INTO user_vip_entitlements (user_id, package_id, tier, is_active, expires_at, allowed_subjects, granted_by)
          VALUES ($1, $2, $3, TRUE, $4, ARRAY['*']::text[], $5)
        `, [userId, tx.rows[0].package_id, vipTier, newExpires, req.user.id]);
      } catch { /* entitlements table may not exist or constraint issue */ }

      // Update transaction status
      await client.query(`
        UPDATE transactions SET status = 'completed', paid_at = NOW(), updated_at = NOW() WHERE id = $1
      `, [id]);

      await client.query('COMMIT');

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'manual_grant_vip', entityType: 'transaction',
        entityId: parseInt(id),
        beforeData: { userId, ...before.rows[0] },
        afterData: { userId, is_vip: true, tier: vipTier, vip_expires_at: newExpires, duration_days: days },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true, data: { userId, tier: vipTier, expires: newExpires } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RiskCenter] manualGrantVip error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      client.release();
    }
  },

  //  POST /payment-risks/:id/revoke-coins
  async revokeCoins(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });
      const coinAmount = parseInt(amount);
      if (!coinAmount || coinAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid coin amount' });

      await client.query('BEGIN');

      const tx = await client.query('SELECT user_id FROM transactions WHERE id = $1', [id]);
      if (!tx.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const userId = tx.rows[0].user_id;
      const before = await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const beforeCoins = before.rows[0]?.coins || 0;
      const afterCoins = Math.max(0, beforeCoins - coinAmount);

      await client.query('UPDATE users SET coins = $2 WHERE id = $1', [userId, afterCoins]);

      try {
        await client.query(`
          INSERT INTO coin_ledger (user_id, amount, balance_after, type, description, reference_type, reference_id)
          VALUES ($1, $2, $3, 'admin_revoke', $4, 'transaction', $5)
        `, [userId, -coinAmount, afterCoins, `Admin revoke: ${reason.trim()}`, parseInt(id)]);
      } catch { /* coin_ledger may not exist */ }

      await client.query('COMMIT');

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'revoke_coins', entityType: 'transaction',
        entityId: parseInt(id),
        beforeData: { userId, coins: beforeCoins },
        afterData: { userId, coins: afterCoins, revoked: coinAmount },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true, data: { userId, beforeCoins, afterCoins } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RiskCenter] revokeCoins error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      client.release();
    }
  },

  //  POST /payment-risks/:id/revoke-vip
  async revokeVip(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Reason required' });

      await client.query('BEGIN');

      const tx = await client.query('SELECT user_id FROM transactions WHERE id = $1', [id]);
      if (!tx.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      const userId = tx.rows[0].user_id;
      const before = await client.query(
        'SELECT is_vip, subscription_tier, vip_expires_at FROM users WHERE id = $1 FOR UPDATE', [userId]
      );

      await client.query(`
        UPDATE users
        SET is_vip = FALSE, subscription_tier = 'basic', vip_expires_at = NULL, vip_package_id = NULL
        WHERE id = $1
      `, [userId]);

      // Deactivate entitlements
      try {
        await client.query(`
          UPDATE user_vip_entitlements SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE
        `, [userId]);
      } catch { /* table may not exist */ }

      await client.query('COMMIT');

      const meta = AuditLog.reqMeta(req);
      await AuditLog.log({
        adminId: req.user.id, action: 'revoke_vip', entityType: 'transaction',
        entityId: parseInt(id),
        beforeData: { userId, ...before.rows[0] },
        afterData: { userId, is_vip: false, subscription_tier: 'basic' },
        reason: reason.trim(), ...meta,
      });

      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RiskCenter] revokeVip error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      client.release();
    }
  },
};

module.exports = PaymentRiskActions;
