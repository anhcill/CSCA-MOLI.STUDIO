const { CourseApiError } = require('../utils/courseResponses');

function couponError(code, message) { throw new CourseApiError(409, code, message); }

// Both checkout paths lock the user first, then the coupon, before creating a
// pending transaction. Pending metadata is the shared reservation ledger.
async function lockCoupon(client, { code, couponId = null, userId, excludeTransactionId = null, now = new Date(), honorReserved = false }) {
  const result = await client.query(`SELECT * FROM coupons WHERE
    ($2::int IS NOT NULL AND id=$2) OR ($2::int IS NULL AND UPPER(code)=UPPER($1)) FOR UPDATE`, [code,couponId]);
  const coupon = result.rows[0];
  if (!coupon) couponError('COUPON_INVALID', 'Voucher does not exist.');
  if (!honorReserved && (!coupon.is_active || (coupon.valid_from && new Date(coupon.valid_from) > now)
    || (coupon.valid_until && new Date(coupon.valid_until) <= now))) {
    couponError('COUPON_INVALID', 'Voucher is inactive or outside its validity period.');
  }
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM coupon_usages WHERE coupon_id = $1 AND user_id = $2) AS used_by_user,
      COUNT(*)::int AS reserved,
      COUNT(*) FILTER (WHERE t.user_id = $2)::int AS reserved_by_user
    FROM transactions t WHERE (t.raw_response->>'couponId' = $1::text
      OR (t.raw_response->>'couponId' IS NULL AND UPPER(t.raw_response->>'couponCode') = UPPER($3)))
      AND t.status IN ('pending','processing') AND ($4::int IS NULL OR t.id <> $4)
      AND NOT EXISTS (SELECT 1 FROM coupon_usages u WHERE u.transaction_id=t.id)
      AND (t.raw_response->>'commerceType' IN ('video','combo') OR t.created_at >= NOW() - INTERVAL '24 hours')`,
  [coupon.id, userId, coupon.code, excludeTransactionId]);
  const count = counts.rows[0];
  if (coupon.max_uses != null && Number(coupon.used_count) + Number(count.reserved) >= Number(coupon.max_uses)) {
    couponError('COUPON_LIMIT_REACHED', 'Voucher usage limit has been reached or reserved.');
  }
  if (coupon.user_limit != null && Number(count.used_by_user) + Number(count.reserved_by_user) >= Number(coupon.user_limit)) {
    couponError('COUPON_USER_LIMIT_REACHED', 'Voucher usage limit for this account has been reached or reserved.');
  }
  return coupon;
}

function couponDiscount(coupon, amount) {
  if (Number(coupon.min_order_amount || 0) > amount) couponError('COUPON_MINIMUM', 'Order does not meet the voucher minimum.');
  const value = Number(coupon.discount_value);
  if (!Number.isFinite(value) || value < 0 || !['percentage', 'fixed'].includes(coupon.discount_type)
    || (coupon.discount_type === 'percentage' && value > 100)) couponError('COUPON_INVALID', 'Invalid discount configuration.');
  let discount = coupon.discount_type === 'percentage' ? Math.floor(amount * value / 100) : value;
  if (coupon.max_discount_amount != null && Number(coupon.max_discount_amount) > 0) discount = Math.min(discount, Number(coupon.max_discount_amount));
  return Math.min(amount, Math.max(0, Math.floor(discount)));
}

async function consumeCoupon(client, transaction, { now = new Date() } = {}) {
  const meta = typeof transaction.raw_response === 'string' ? JSON.parse(transaction.raw_response) : transaction.raw_response || {};
  if (!meta.couponCode) return;
  const existing = await client.query('SELECT id FROM coupon_usages WHERE transaction_id = $1', [transaction.id]);
  if (existing.rows.length) return;
  const coupon = await lockCoupon(client, { code: meta.couponCode, couponId: meta.couponId, userId: transaction.user_id,
    excludeTransactionId: transaction.id, now, honorReserved: ['pending', 'processing'].includes(transaction.status) });
  await client.query(`INSERT INTO coupon_usages(coupon_id,user_id,transaction_id,discount_amount,final_amount,original_amount)
    VALUES ($1,$2,$3,$4,$5,$6)`, [coupon.id, transaction.user_id, transaction.id,
    meta.couponDiscountAmount || 0, transaction.amount, meta.originalAmount]);
  await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [coupon.id]);
}

module.exports = { lockCoupon, couponDiscount, consumeCoupon };
