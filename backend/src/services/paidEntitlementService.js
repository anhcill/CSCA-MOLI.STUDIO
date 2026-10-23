"use strict";

const db = require("../config/database");

// Historical successful purchases intentionally keep the device policy active
// after expiry/logout. Revocation does not erase proof that the account paid.
async function hasPaidEntitlementHistory(userId, client = db) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.user_id = $1
         AND COALESCE(u.role, 'student') <> 'admin'
         AND t.status = 'completed'
         AND COALESCE(t.amount, 0) > 0
         AND t.paid_at IS NOT NULL
     )
     OR EXISTS (
       SELECT 1
       FROM user_vip_entitlements e
       JOIN transactions t ON t.id = e.transaction_id
       JOIN users u ON u.id = e.user_id
       WHERE e.user_id = $1
         AND COALESCE(u.role, 'student') <> 'admin'
         AND e.source = 'payment'
         AND e.transaction_id IS NOT NULL
         AND (t.status = 'completed' OR t.paid_at IS NOT NULL)
     )
     OR EXISTS (
       SELECT 1
       FROM user_video_entitlements e
       LEFT JOIN transactions t ON t.id = e.transaction_id
       JOIN users u ON u.id = e.user_id
       WHERE e.user_id = $1
         AND COALESCE(u.role, 'student') <> 'admin'
         AND e.source = 'payment'
         AND e.transaction_id IS NOT NULL
         AND (t.status = 'completed' OR t.paid_at IS NOT NULL)
     ) AS has_paid`,
    [userId],
  );
  return rows[0]?.has_paid === true;
}

module.exports = { hasPaidEntitlementHistory };
