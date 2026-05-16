const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { authenticate } = require('../middleware/authMiddleware');
const db = require('../config/database');
const coinService = require('../services/coinService');

const COIN_VALUE_VND = 100;
const MAX_COIN_DISCOUNT_RATIO = 0.2;

// ── In-memory rate limiter (simple, per IP) ────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 phút
const RATE_LIMIT_MAX = 10; // tối đa 10 request/phút/IP

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.ts > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, ts: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ── Package config ────────────────────────────────────────────────────────────
const PACKAGES = {
  vip_90:   { name: 'VIP 3 Tháng',    tier: 'vip',     amount: 99000  },
  vip_365:  { name: 'VIP 1 Năm',     tier: 'vip',     amount: 249000 },
  pre_90:   { name: 'Premium 3 Tháng', tier: 'premium', amount: 249000 },
  pre_365:  { name: 'Premium 1 Năm',  tier: 'premium', amount: 699000 },
};

// Duration lookup map
const DURATION_PACKAGES = {
  90:  { vip: 'vip_90',   pre: 'pre_90'   },
  365: { vip: 'vip_365',  pre: 'pre_365'  },
};

// ── MOMO CONFIG ───────────────────────────────────────────────────────────────
const MOMO = {
  endpoint:   process.env.MOMO_ENDPOINT    || 'https://test-payment.momo.vn/v2/gateway/api/create',
  partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMOTEST',
  accessKey:  process.env.MOMO_ACCESS_KEY  || 'F8BBD362',
  secretKey:  process.env.MOMO_SECRET_KEY   || '',
  redirectUrl: process.env.MOMO_REDIRECT_URL  || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`,
  ipnUrl:     process.env.MOMO_IPN_URL      || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payments/momo-webhook`,
};

// ── VNPAY CONFIG ─────────────────────────────────────────────────────────────
const VNPAY = {
  url:       process.env.VNPAY_URL       || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  tmnCode:   process.env.VNPAY_TMN_CODE  || 'TESTVNPAY',
  hashSecret:process.env.VNPAY_HASH_SECRET || '',
  returnUrl:  process.env.VNPAY_RETURN_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: lấy IP client thật
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

function timingSafeEqualString(a = '', b = '') {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySePayApiKey(authHeader, apiKeyHeader) {
  const expectedKey = process.env.SEPAY_API_KEY;
  if (!expectedKey) {
    return { ok: false, status: 503, message: 'SePay webhook is not configured' };
  }

  const prefix = 'Apikey ';
  const header = String(authHeader || '');
  const directKey = String(apiKeyHeader || '');
  if (directKey && timingSafeEqualString(directKey, expectedKey)) {
    return { ok: true };
  }

  if (!header.toLowerCase().startsWith(prefix.toLowerCase())) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const providedKey = header.slice(prefix.length);
  if (!timingSafeEqualString(providedKey, expectedKey)) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true };
}

function normalizeBankAccount(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePaymentCode(value) {
  return String(value || '').trim().toUpperCase();
}

function buildSePaySearchText(payload) {
  return [
    payload?.content,
    payload?.description,
    payload?.code,
    payload?.referenceCode,
    payload?.transactionContent,
    payload?.transactionCode,
  ]
    .filter(Boolean)
    .map(value => String(value))
    .join(' ')
    .trim();
}

function extractBankTransferOrderCode(value) {
  const match = String(value || '').toUpperCase().match(/CSCA\d+T\d{8,}/);
  return match?.[0] || '';
}

function getBankConfig() {
  const bankCode = process.env.BANK_CODE;
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER;
  const accountName = process.env.BANK_ACCOUNT_NAME;

  if (!bankCode || !accountNumber || !accountName) {
    return null;
  }

  return { bankCode, accountNumber, accountName };
}

// ─────────────────────────────────────────────────────────────────────────────
async function createMoMoPayment(userId, durationDays, amount, tier, pkgName) {
  const orderId = `CSCA${userId}M${Date.now()}`;
  const orderInfo = `CSCA ${pkgName} - ${durationDays} ngày`;

  const extraDataRaw = { userId, durationDays, tier, createdAt: Date.now() };
  const extraData = Buffer.from(JSON.stringify(extraDataRaw)).toString('base64');

  const rawSig = [
    `accessKey=${MOMO.accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${MOMO.ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${MOMO.partnerCode}`,
    `redirectUrl=${MOMO.redirectUrl}`,
    `requestId=${orderId}`,
    `requestType=captureWallet`,
  ].join('&');

  const signature = crypto.createHmac('sha256', MOMO.secretKey).update(rawSig).digest('hex');

  const body = {
    partnerCode: MOMO.partnerCode,
    partnerName: 'CSCA Platform',
    storeId: 'CSCAStore',
    requestId: orderId,
    amount: String(amount),
    orderId,
    orderInfo,
    redirectUrl: MOMO.redirectUrl,
    ipnUrl: MOMO.ipnUrl,
    lang: 'vi',
    requestType: 'captureWallet',
    autoCapture: true,
    extraData,
    signature,
  };

  const response = await axios.post(MOMO.endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  return { orderId, payUrl: response.data?.payUrl, transId: response.data?.transId };
}

// ─────────────────────────────────────────────────────────────────────────────
function formatVNPayDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') map[type] = value;
  });
  return `${map.year}${map.month}${map.day}${map.hour}${map.minute}${map.second}`;
}

function createVNPayUrl(userId, durationDays, amount, clientIp) {
  const orderId = `CSCA${userId}V${Date.now()}`;
  const orderInfo = `CSCA VIP ${PACKAGES[durationDays]?.name || 'Gói VIP'} - ${durationDays} ngày`;

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY.tmnCode,
    vnp_Amount: String(Math.round(amount) * 100),
    vnp_BankCode: '',
    vnp_CreateDate: formatVNPayDate(new Date()),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: clientIp || '127.0.0.1',
    vnp_Locale: 'vn',
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'billpayment',
    vnp_ReturnUrl: VNPAY.returnUrl,
    vnp_TxnRef: orderId,
    vnp_ExpireDate: formatVNPayDate(new Date(Date.now() + 2 * 3600000)),
  };

  const sortedKeys = Object.keys(vnpParams).sort();
  const signData = sortedKeys
    .filter(k => vnpParams[k] !== '' && vnpParams[k] !== null && vnpParams[k] !== undefined)
    .map(k => `${k}=${vnpParams[k]}`)
    .join('&');

  const secureHash = crypto
    .createHmac('sha512', VNPAY.hashSecret)
    .update(signData)
    .digest('hex');

  const vnpUrl = new URL(VNPAY.url);
  Object.entries(vnpParams).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) vnpUrl.searchParams.set(k, String(v));
  });
  vnpUrl.searchParams.set('vnp_SecureHash', secureHash);

  return { orderId, payUrl: vnpUrl.toString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: lấy couponCode từ transaction raw_response
function getStoredCouponCode(transaction) {
  if (!transaction.raw_response) return null;
  try {
    const raw = typeof transaction.raw_response === 'string'
      ? JSON.parse(transaction.raw_response)
      : transaction.raw_response;
    return raw?.couponCode || null;
  } catch (_) { return null; }
}

function getStoredPaymentMeta(transaction) {
  if (!transaction?.raw_response) return {};
  try {
    return typeof transaction.raw_response === 'string'
      ? JSON.parse(transaction.raw_response)
      : transaction.raw_response;
  } catch (_) {
    return {};
  }
}

function getStoredCoinSpend(transaction) {
  const raw = getStoredPaymentMeta(transaction);
  const coinsUsed = Number.parseInt(raw?.coinsUsed, 10);
  const coinDiscountAmount = Number.parseInt(raw?.coinDiscountAmount, 10);
  return {
    coinsUsed: Number.isFinite(coinsUsed) && coinsUsed > 0 ? coinsUsed : 0,
    coinDiscountAmount: Number.isFinite(coinDiscountAmount) && coinDiscountAmount > 0 ? coinDiscountAmount : 0,
  };
}

async function getReservedCoins(userId) {
  const reservedRes = await db.query(
    `SELECT COALESCE(SUM((raw_response->>'coinsUsed')::int), 0) AS reserved
     FROM transactions
     WHERE user_id = $1
       AND status = 'pending'
       AND created_at >= NOW() - INTERVAL '24 hours'
       AND raw_response ? 'coinsUsed'`,
    [userId]
  );
  return Number.parseInt(reservedRes.rows[0]?.reserved, 10) || 0;
}

async function applyCoinSpend(transaction) {
  const { coinsUsed } = getStoredCoinSpend(transaction);
  if (!coinsUsed) return;

  await coinService.debit(transaction.user_id, coinsUsed, 'vip_discount', {
    description: 'Dùng xu giảm giá VIP/khóa học',
    metadata: {
      transactionId: transaction.id,
      transactionCode: transaction.transaction_code,
      coinsUsed,
    },
    idempotencyKey: `payment:${transaction.id}:coins`,
  });
}

async function getPaymentUser(userId) {
  try {
    const userRes = await db.query(
      `SELECT id, email, username, full_name, vip_expires_at, subscription_tier
       FROM users
       WHERE id = $1`,
      [userId]
    );
    return userRes.rows[0] || null;
  } catch (err) {
    console.error('[SePay] Full payment user lookup failed, using fallback:', err.message);
    const fallbackRes = await db.query(
      `SELECT id, email, username, full_name, vip_expires_at
       FROM users
       WHERE id = $1`,
      [userId]
    );
    return fallbackRes.rows[0] ? { ...fallbackRes.rows[0], subscription_tier: 'vip' } : null;
  }
}

async function markTransactionCompletedFallback(transaction, payload) {
  try {
    await db.query(
      `UPDATE transactions
       SET status = 'completed',
           raw_response = COALESCE($1, raw_response),
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(payload || {}), transaction.id]
    );
  } catch (err) {
    console.error('[SePay] Fallback transaction completion failed, using status-only update:', err.message);
    await Transaction.updateStatus(transaction.id, 'completed');
  }
}

async function updateVipStatusForPayment(userId, durationDays, tier) {
  try {
    return await User.updateVipStatus(userId, durationDays, tier);
  } catch (err) {
    console.error('[SePay] User.updateVipStatus failed, using direct fallback:', err.message);
    const days = Number.parseInt(durationDays, 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 0;
    const fallbackRes = await db.query(
      `UPDATE users
       SET is_vip = TRUE,
           vip_expires_at = CASE
             WHEN $2::int > 0 THEN GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + ($2::int * INTERVAL '1 day')
             ELSE vip_expires_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_vip, vip_expires_at`,
      [userId, safeDays]
    );
    return fallbackRes.rows[0] || null;
  }
}

async function completeClaimedBankTransfer(transaction, providerPayload = {}) {
  await incrementCouponUsage(transaction).catch(err => {
    console.error('[Payment] Coupon usage update failed, continuing payment completion:', err.message);
  });
  await applyCoinSpend(transaction).catch(err => {
    console.error('[Payment] Coin spend update failed, continuing payment completion:', err.message);
  });

  const tier = transaction.package_id
    ? (await db.query(`SELECT COALESCE(tier,'vip') as tier FROM vip_packages WHERE id = $1`, [transaction.package_id])).rows[0]?.tier || 'vip'
    : (transaction.package_name?.toLowerCase().includes('pre') ? 'premium' : 'vip');

  await updateVipStatusForPayment(transaction.user_id, transaction.package_duration, tier);
  const updatedUser = await getPaymentUser(transaction.user_id);
  if (!updatedUser) {
    throw new Error(`Payment user not found: ${transaction.user_id}`);
  }

  const sepayTransId = providerPayload.referenceCode || providerPayload.reference_number || providerPayload.id?.toString() || `SEPAY_${Date.now()}`;
  try {
    await Transaction.updateComplete(transaction.id, {
      status: 'completed',
      payment_channel: 'bank_transfer',
      trans_id: sepayTransId,
      raw_response: providerPayload,
      paid_at: new Date(),
      vip_expires_at: updatedUser?.vip_expires_at || null,
    });
  } catch (completeErr) {
    console.error('[Payment] Full transaction completion failed, using fallback:', completeErr.message);
    await markTransactionCompletedFallback(transaction, providerPayload);
  }

  Promise.all([
    emailService.sendPaymentConfirmation({
      email: updatedUser.email,
      name: updatedUser.full_name || updatedUser.username,
      packageName: transaction.package_name,
      amount: transaction.amount,
      durationDays: transaction.package_duration,
      transactionCode: transaction.transaction_code,
      method: 'bank_transfer',
    }),
    emailService.sendVipActivatedEmail({
      email: updatedUser.email,
      name: updatedUser.full_name || updatedUser.username,
      packageName: transaction.package_name,
      durationDays: transaction.package_duration,
      expiresAt: updatedUser?.vip_expires_at || null,
    }),
  ]).catch(err => console.error('Payment email error:', err.message));

  console.log(`[Payment] ✅ Bank transfer completed: user=${transaction.user_id}, tx=${transaction.transaction_code}, tier=${tier}`);
  return { updatedUser, tier };
}

function getSePayApiToken() {
  return process.env.SEPAY_API_TOKEN || process.env.SEPAY_API_KEY || '';
}

function mapSePayApiTransactionToWebhookPayload(row) {
  return {
    id: row.id,
    referenceCode: row.reference_number,
    transferType: row.transfer_type || 'in',
    transferAmount: Number(row.amount_in || 0),
    accountNumber: row.va || row.account_number,
    content: row.transaction_content || row.code || row.reference_number,
    description: row.transaction_content,
    code: row.code,
    bankBrandName: row.bank_brand_name,
    bankAccountId: row.bank_account_id,
    vaId: row.va_id,
    source: 'sepay_api_reconcile',
  };
}

function isMatchingSePayApiTransaction(row, transaction) {
  const searchText = buildSePaySearchText({
    content: row.transaction_content,
    description: row.transaction_content,
    code: row.code,
    referenceCode: row.reference_number,
  }).toUpperCase();
  if (!searchText.includes(String(transaction.transaction_code || '').toUpperCase())) return false;

  const amountIn = Number(row.amount_in || 0);
  if (!Number.isFinite(amountIn) || amountIn < Number(transaction.amount)) return false;

  const bankConfig = getBankConfig();
  if (bankConfig) {
    const expectedAccount = normalizeBankAccount(bankConfig.accountNumber);
    const receivedAccount = normalizeBankAccount(row.va || row.account_number);
    if (receivedAccount && expectedAccount && receivedAccount !== expectedAccount) return false;

    const expectedBank = String(bankConfig.bankCode || '').toUpperCase();
    const receivedBank = String(row.bank_brand_name || '').toUpperCase();
    if (receivedBank && expectedBank && receivedBank !== expectedBank) return false;
  }

  return String(row.transfer_type || 'in').toLowerCase() === 'in';
}

async function findSePayApiTransaction(transaction) {
  const token = getSePayApiToken();
  if (!token) return null;

  const response = await axios.get('https://userapi.sepay.vn/v2/transactions', {
    params: {
      q: transaction.transaction_code,
      transfer_type: 'in',
      amount_in_min: Number(transaction.amount),
      amount_in_max: Number(transaction.amount),
      per_page: 5,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  const rows = Array.isArray(response.data?.data) ? response.data.data : [];
  return rows.find(row => isMatchingSePayApiTransaction(row, transaction)) || null;
}

async function reconcilePendingBankTransfer(transaction) {
  if (!transaction || transaction.status !== 'pending' || transaction.payment_method !== 'bank_transfer') {
    return transaction;
  }

  try {
    const sepayTransaction = await findSePayApiTransaction(transaction);
    if (!sepayTransaction) return transaction;

    const claimedTransaction = await Transaction.claimPending(transaction.id);
    if (!claimedTransaction) {
      return await Transaction.findByTransactionCode(transaction.transaction_code);
    }

    await completeClaimedBankTransfer(
      claimedTransaction,
      mapSePayApiTransactionToWebhookPayload(sepayTransaction)
    );
    return await Transaction.findByTransactionCode(transaction.transaction_code);
  } catch (err) {
    console.error('[SePay] API reconcile failed:', err.message);
    return transaction;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/payments/create
 * @desc Tạo thanh toán MoMo hoặc VNPay — đọc giá từ DB vip_packages
 * @access Private
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      });
    }

    const { package_id, payment_method = 'momo', coupon_code, idempotency_key, use_coins, coins_to_use } = req.body;
    const userId = req.user.id;

    // ── Input validation ────────────────────────────────────────────────────
    if (!package_id) {
      return res.status(400).json({ success: false, message: 'Thiếu package_id.' });
    }
    const pkgId = parseInt(package_id, 10);
    if (isNaN(pkgId) || pkgId <= 0) {
      return res.status(400).json({ success: false, message: 'package_id không hợp lệ.' });
    }

    const allowedMethods = ['momo', 'vnpay', 'bank_transfer'];
    if (!allowedMethods.includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ.' });
    }

    // ── Idempotency: tránh tạo transaction trùng lặp ──────────────────────
    if (idempotency_key) {
      const idemKey = `IDEM_${userId}_${Buffer.from(idempotency_key).toString('hex').slice(0, 16)}`;
      const existingTx = await Transaction.findByTransactionCode(idemKey);
      if (existingTx && existingTx.status === 'pending') {
        return res.json({
          success: true,
          payUrl: null,
          orderId: existingTx.transaction_code,
          message: 'Transaction đã tồn tại.',
          appliedCoupon: null,
        });
      }
    }

    // Lấy gói từ DB
    const pkgRes = await db.query(
      `SELECT id, name, tier, duration_days, price, is_active FROM vip_packages WHERE id = $1 AND is_active = TRUE`,
      [pkgId]
    );

    if (!pkgRes.rows[0]) {
      return res.status(400).json({ success: false, message: 'Gói không tồn tại hoặc đã bị tắt.' });
    }

    const pkg = pkgRes.rows[0];

    // Kiểm tra xem người dùng có VIP vĩnh viễn chưa
    const userCheck = await db.query(
      `SELECT is_vip, vip_expires_at, COALESCE(coins, 0) AS coins FROM users WHERE id = $1`,
      [userId]
    );
    const user = userCheck.rows[0];
    if (user && user.is_vip && user.vip_expires_at === null) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có VIP vĩnh viễn, không cần đăng ký thêm.',
      });
    }

    // Sanitize: đảm bảo giá là số dương
    if (typeof pkg.price !== 'number' || pkg.price <= 0) {
      return res.status(400).json({ success: false, message: 'Giá gói không hợp lệ.' });
    }

    const tier = pkg.tier || 'vip';
    const orderId = `CSCA${userId}T${Date.now()}`;

    let finalAmount = Number(pkg.price);
    let discountAmount = 0;
    let appliedCoupon = null;

    // ── Áp dụng coupon nếu có (CHỈ validation, chưa increment) ───────────
    if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim().length > 0) {
      const couponRes = await db.query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
        [coupon_code.trim()]
      );

      if (couponRes.rows[0]) {
        const c = couponRes.rows[0];
        const now = new Date();

        const validFrom = c.valid_from ? new Date(c.valid_from) : null;
        const validUntil = c.valid_until ? new Date(c.valid_until) : null;

        const notStarted = validFrom && now < validFrom;
        const expired = validUntil && now > validUntil;
        const maxedOut = c.max_uses !== null && c.used_count >= c.max_uses;

        if (!notStarted && !expired && !maxedOut) {
          const pkgTier = tier;
          let applicable = true;

          if (c.applicable_packages && c.applicable_packages.length > 0 && !c.applicable_packages.includes('all')) {
            applicable = c.applicable_packages.includes(pkg.id);
          }
          if (c.applicable_tiers && c.applicable_tiers.length > 0 && !c.applicable_tiers.includes('all')) {
            applicable = applicable && c.applicable_tiers.includes(pkgTier);
          }
          if (c.min_order_amount && c.min_order_amount > pkg.price) {
            applicable = false;
          }

          if (applicable) {
            if (c.discount_type === 'percentage') {
              discountAmount = Math.floor(pkg.price * c.discount_value / 100);
              if (c.max_discount_amount) {
                discountAmount = Math.min(discountAmount, c.max_discount_amount);
              }
            } else {
              discountAmount = Math.min(Number(c.discount_value), pkg.price);
            }
            finalAmount = Math.max(0, Math.round(pkg.price - discountAmount));
            appliedCoupon = c;
          }
        }
      }
    }

    let coinsUsed = 0;
    let coinDiscountAmount = 0;
    if (use_coins === true || Number.parseInt(coins_to_use, 10) > 0) {
      const requestedCoins = Number.parseInt(coins_to_use, 10);
      const reservedCoins = await getReservedCoins(userId);
      const availableCoins = Math.max(0, Number(user?.coins || 0) - reservedCoins);
      const maxCoinsByOrder = Math.floor((finalAmount * MAX_COIN_DISCOUNT_RATIO) / COIN_VALUE_VND);
      const maxUsableCoins = Math.max(0, Math.min(availableCoins, maxCoinsByOrder));
      coinsUsed = Number.isFinite(requestedCoins) && requestedCoins > 0
        ? Math.min(requestedCoins, maxUsableCoins)
        : maxUsableCoins;
      coinDiscountAmount = coinsUsed * COIN_VALUE_VND;
      finalAmount = Math.max(0, finalAmount - coinDiscountAmount);
    }

    // Lưu transaction pending — lưu giá đã giảm vào amount, coupon vào raw_response
    const paymentMeta = {
      couponCode: coupon_code?.trim() || null,
      coinsUsed,
      coinValueVnd: COIN_VALUE_VND,
      coinDiscountAmount,
      originalAmount: Number(pkg.price),
      couponDiscountAmount: discountAmount,
    };

    const transaction = await Transaction.create({
      user_id: userId,
      amount: finalAmount,
      payment_method,
      package_id: pkg.id,
      package_duration: pkg.duration_days,
      package_name: pkg.name,
      transaction_code: orderId,
      coupon_code: coupon_code?.trim() || null,
      raw_response: paymentMeta,
    });

    // Nếu payment_method là bank_transfer → trả về thông tin QR
    if (payment_method === 'bank_transfer') {
      const bankConfig = getBankConfig();
      if (!bankConfig) {
        console.error('[Payment] Missing BANK_CODE, BANK_ACCOUNT_NUMBER, or BANK_ACCOUNT_NAME');
        return res.status(500).json({
          success: false,
          message: 'Thanh toĂ¡n chuyá»ƒn khoáº£n chÆ°a Ä‘Æ°á»£c cáº¥u hĂ¬nh.',
        });
      }

      return res.json({
        success: true,
        payment_method: 'bank_transfer',
        orderId,
        bank: {
          bankCode: bankConfig.bankCode,
          accountNumber: bankConfig.accountNumber,
          accountName: bankConfig.accountName,
          amount: finalAmount,
          content: orderId,
          qrUrl: `https://img.vietqr.io/image/${bankConfig.bankCode}-${bankConfig.accountNumber}-compact2.png?amount=${finalAmount}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(bankConfig.accountName)}`,
        },
        appliedCoupon: appliedCoupon ? {
          code: appliedCoupon.code,
          discount_amount: discountAmount,
          original_amount: pkg.price,
          final_amount: finalAmount,
        } : null,
        appliedCoins: coinsUsed > 0 ? {
          coins_used: coinsUsed,
          coin_value_vnd: COIN_VALUE_VND,
          discount_amount: coinDiscountAmount,
        } : null,
      });
    }

    let result;
    if (payment_method === 'vnpay') {
      result = createVNPayUrl(userId, pkg.duration_days, finalAmount, clientIp);
    } else {
      try {
        result = await createMoMoPayment(userId, pkg.duration_days, finalAmount, tier, pkg.name);
      } catch (momoErr) {
        console.error('MoMo API error:', momoErr.message);
        await Transaction.updateStatus(transaction.id, 'failed');
        return res.status(502).json({
          success: false,
          message: 'KhĂ´ng káº¿t ná»‘i Ä‘Æ°á»£c cá»•ng thanh toĂ¡n. Vui lĂ²ng thá»­ láº¡i sau.',
        });
      }
    }

    // Cập nhật transaction_code thực
    await Transaction.updateField(transaction.id, 'transaction_code', result.orderId);

    res.json({
      success: true,
      payUrl: result.payUrl,
      orderId: result.orderId,
      appliedCoupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discount_amount: discountAmount,
        original_amount: pkg.price,
        final_amount: finalAmount,
      } : null,
      appliedCoins: coinsUsed > 0 ? {
        coins_used: coinsUsed,
        coin_value_vnd: COIN_VALUE_VND,
        discount_amount: coinDiscountAmount,
      } : null,
    });
  } catch (err) {
    console.error('Payment create error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tạo thanh toán.' });
  }
});

/**
 * @route POST /api/payments/momo-webhook
 * @desc IPN webhook từ MoMo
 * @access Public (xác thực qua signature)
 */
router.post('/momo-webhook', async (req, res) => {
  try {
    const { partnerCode, orderId, requestId, amount, orderInfo,
            orderType, transId, resultCode, message, payType,
            responseTime, extraData, signature } = req.body;

    // ── Verify signature (thêm transId và resultCode) ───────────────────────
    const rawSig = [
      `accessKey=${MOMO.accessKey}`,
      `amount=${amount || ''}`,
      `extraData=${extraData || ''}`,
      `message=${message || ''}`,
      `orderId=${orderId || ''}`,
      `orderInfo=${orderInfo || ''}`,
      `orderType=${orderType || ''}`,
      `partnerCode=${partnerCode || ''}`,
      `payType=${payType || ''}`,
      `requestId=${requestId || ''}`,
      `responseTime=${responseTime || ''}`,
      `resultCode=${resultCode ?? ''}`,
      `transId=${transId ?? ''}`,
    ].join('&');

    const expectedSig = crypto.createHmac('sha256', MOMO.secretKey).update(rawSig).digest('hex');

    if (signature !== expectedSig) {
      console.warn('MoMo webhook signature mismatch:', orderId);
      return res.status(200).json({ success: false, message: 'Invalid signature' });
    }

    const transaction = await Transaction.findByTransactionCode(orderId);
    if (!transaction) {
      console.warn('MoMo webhook: transaction not found', orderId);
      return res.status(200).json({ success: false });
    }

    if (resultCode === 0) {
      if (transaction.status !== 'completed') {
        const extra = {};
        try { Object.assign(extra, JSON.parse(Buffer.from(extraData || '', 'base64').toString('ascii'))); } catch (e) {}

        const durationDays = extra.durationDays || transaction.package_duration;
        const tier = extra.tier || 'vip';

        // ── Increment coupon usage CHỈ khi thành công ──────────────────────
        await incrementCouponUsage(transaction);
        await applyCoinSpend(transaction);

        // Update user VIP with tier
        await User.updateVipStatus(transaction.user_id, durationDays, tier);
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'momo',
          trans_id: transId ? String(transId) : null,
          raw_response: req.body,
          paid_at: new Date(),
          vip_expires_at: vipExpires,
        });

        // ── Gửi email xác nhận thanh toán + kích hoạt VIP ───────────────
        const paymentUser = await User.findById(transaction.user_id);
        if (paymentUser) {
          Promise.all([
            emailService.sendPaymentConfirmation({
              email: paymentUser.email,
              name: paymentUser.full_name || paymentUser.username,
              packageName: transaction.package_name,
              amount: transaction.amount,
              durationDays: transaction.package_duration,
              transactionCode: orderId,
              method: 'momo',
            }),
            emailService.sendVipActivatedEmail({
              email: paymentUser.email,
              name: paymentUser.full_name || paymentUser.username,
              packageName: transaction.package_name,
              durationDays: transaction.package_duration,
              expiresAt: vipExpires,
            }),
          ]).catch(err => console.error('Payment email error:', err.message));
        }

        console.log(`[MoMo Webhook] SUCCESS: orderId=${orderId}, user=${transaction.user_id}`);
      }
    } else {
      if (transaction.status === 'pending') {
        await rollbackCouponUsage(transaction);
        await Transaction.updateStatus(transaction.id, 'failed');
        await Transaction.updateField(transaction.id, 'raw_response', req.body);
        console.log(`[MoMo Webhook] FAILED: orderId=${orderId}, resultCode=${resultCode}`);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('MoMo webhook error:', err);
    res.status(200).json({ success: false });
  }
});

/**
 * @route POST /api/payments/vnpay-webhook
 * @desc IPN webhook từ VNPay
 * @access Public
 */
router.post('/vnpay-webhook', async (req, res) => {
  try {
    const {
      vnp_TxnRef, vnp_Amount, vnp_BankCode, vnp_PayDate,
      vnp_TransactionNo, vnp_ResponseCode, vnp_SecureHash, ...rest
    } = req.body;

    // Verify secure hash
    const sortedKeys = Object.keys(rest).sort();
    const signData = sortedKeys
      .filter(k => k.startsWith('vnp_') && rest[k] !== '' && rest[k] !== null)
      .map(k => `${k}=${rest[k]}`)
      .join('&');

    const expectedSig = crypto
      .createHmac('sha512', VNPAY.hashSecret)
      .update(signData)
      .digest('hex');

    if (vnp_SecureHash !== expectedSig) {
      console.warn('VNPay webhook signature mismatch:', vnp_TxnRef);
      return res.status(200).json({ success: false });
    }

    const transaction = await Transaction.findByTransactionCode(vnp_TxnRef);
    if (!transaction) {
      return res.status(200).json({ success: false });
    }

    if (vnp_ResponseCode === '00') {
      if (transaction.status !== 'completed') {
        // Increment coupon usage CHỉ khi thành công
        await incrementCouponUsage(transaction);
        await applyCoinSpend(transaction);

        const tier = transaction.package_id
          ? (await require('../config/database').query(`SELECT COALESCE(tier,'vip') as tier FROM vip_packages WHERE id = $1`, [transaction.package_id])).rows[0]?.tier || 'vip'
          : (transaction.package_name?.toLowerCase().includes('pre') ? 'premium' : 'vip');
        await User.updateVipStatus(transaction.user_id, transaction.package_duration, tier);
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'vnpay',
          trans_id: vnp_TransactionNo ? String(vnp_TransactionNo) : null,
          raw_response: req.body,
          paid_at: new Date(),
          vip_expires_at: vipExpires,
        });

        // ── Gửi email xác nhận thanh toán + kích hoạt VIP ───────────────
        const vnpUser = await User.findById(transaction.user_id);
        if (vnpUser) {
          Promise.all([
            emailService.sendPaymentConfirmation({
              email: vnpUser.email,
              name: vnpUser.full_name || vnpUser.username,
              packageName: transaction.package_name,
              amount: transaction.amount,
              durationDays: transaction.package_duration,
              transactionCode: vnp_TxnRef,
              method: 'vnpay',
            }),
            emailService.sendVipActivatedEmail({
              email: vnpUser.email,
              name: vnpUser.full_name || vnpUser.username,
              packageName: transaction.package_name,
              durationDays: transaction.package_duration,
              expiresAt: vipExpires,
            }),
          ]).catch(err => console.error('VNPay email error:', err.message));
        }

        console.log(`[VNPay Webhook] SUCCESS: orderId=${vnp_TxnRef}`);
      }
    } else {
      if (transaction.status === 'pending') {
        await rollbackCouponUsage(transaction);
        await Transaction.updateStatus(transaction.id, 'failed');
        console.log(`[VNPay Webhook] FAILED: orderId=${vnp_TxnRef}, code=${vnp_ResponseCode}`);
      }
    }

    const vnpUrl = new URL(VNPAY.returnUrl);
    vnpUrl.searchParams.set('orderId', vnp_TxnRef);
    vnpUrl.searchParams.set('resultCode', vnp_ResponseCode === '00' ? '0' : String(vnp_ResponseCode));
    return res.redirect(302, vnpUrl.toString());
  } catch (err) {
    console.error('VNPay webhook error:', err);
    res.status(200).json({ success: false });
  }
});

/**
 * @route GET /api/payments/history
 * @desc Lịch sử giao dịch
 * @access Private
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const history = await Transaction.findByUserId(req.user.id);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Payment history error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lấy lịch sử giao dịch.' });
  }
});

/**
 * @route POST /api/payments/verify-return
 * @desc Verify return từ MoMo/VNPay (sau khi redirect về)
 * @access Private
 */
router.post('/verify-return', authenticate, async (req, res) => {
  try {
    const { orderId, resultCode } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Thiếu orderId.' });
    }

    const transaction = await Transaction.findByTransactionCode(orderId);

    if (!transaction) {
      return res.json({ success: false, status: 'not_found' });
    }

    if (transaction.user_id !== req.user.id) {
      return res.json({ success: false, status: 'unauthorized' });
    }

    if (transaction.status === 'completed') {
      return res.json({
        success: true,
        status: 'completed',
        data: {
          package_name: transaction.package_name,
          package_duration: transaction.package_duration,
          amount: transaction.amount,
          paid_at: transaction.paid_at,
          vip_expires_at: transaction.vip_expires_at,
        }
      });
    }

    // [BẢO MẬT] Bỏ việc tin tưởng resultCode từ frontend để tự động hoàn thành thanh toán.
    // Việc cập nhật trạng thái thanh toán CHỈ ĐƯỢC PHÉP thông qua Webhook (IPN) từ MoMo/VNPay.
    // Frontend sẽ poll API này để chờ trạng thái chuyển từ pending sang completed.
    
    return res.json({ success: true, status: transaction.status });
  } catch (err) {
    console.error('Verify return error:', err);
    res.status(500).json({ success: false });
  }
});

/**
 * @route POST /api/payments/sepay-webhook
 * @desc Nhận webhook từ SePay khi có giao dịch chuyển khoản vào
 * @access Public (xác thực qua apikey header)
 */
router.post('/sepay-webhook', async (req, res) => {
  try {
    const authResult = verifySePayApiKey(
      req.headers.authorization,
      req.headers['x-api-key'] || req.headers['x-sepay-api-key']
    );
    if (!authResult.ok) {
      console.warn(`[SePay] Webhook rejected: ${authResult.message}`);
      return res.status(authResult.status).json({ success: false, message: authResult.message });
    }

    const {
      transferAmount,
      content,
      description,
      transferType,
      accountNumber,
      code,
      id,
      referenceCode,
    } = req.body;

    console.log('[SePay] Webhook received:', {
      id,
      referenceCode,
      accountNumber,
      transferType,
      transferAmount,
      code,
      descriptionLength: String(description || '').length,
      contentLength: String(content || '').length,
    });

    const normalizedTransferType = String(transferType || '').toLowerCase();
    if (normalizedTransferType && !['in', 'credit'].includes(normalizedTransferType)) {
      return res.json({ success: true, message: 'Ignored - not incoming transfer' });
    }

    const bankConfig = getBankConfig();
    if (!bankConfig) {
      console.error('[SePay] Missing BANK_CODE, BANK_ACCOUNT_NUMBER, or BANK_ACCOUNT_NAME');
      return res.status(503).json({ success: false, message: 'Bank transfer is not configured' });
    }

    const expectedAccount = normalizeBankAccount(bankConfig.accountNumber);
    const receivedAccount = normalizeBankAccount(accountNumber);
    if (receivedAccount && receivedAccount !== expectedAccount) {
      console.warn('[SePay] Webhook: accountNumber mismatch');
      return res.json({ success: true, message: 'Ignored - account mismatch' });
    }
    if (!receivedAccount) {
      console.warn('[SePay] Webhook: accountNumber missing, continuing with API key + order code + amount verification');
    }

    const receivedAmount = parseInt(transferAmount, 10);
    if (isNaN(receivedAmount) || receivedAmount <= 0) {
      console.warn('[SePay] Invalid transferAmount:', transferAmount);
      return res.json({ success: true, message: 'Invalid amount' });
    }

    const searchText = buildSePaySearchText(req.body);
    const normalizedSearchText = normalizePaymentCode(searchText);
    const extractedOrderCode = extractBankTransferOrderCode(searchText);
    if (!normalizedSearchText || normalizedSearchText.length < 5) {
      console.warn('[SePay] Webhook: Empty or too short payment content');
      return res.json({ success: true, message: 'Invalid content' });
    }

    if (id || referenceCode) {
      const duplicateRes = await db.query(
        `SELECT id FROM transactions
         WHERE payment_channel = 'bank_transfer'
           AND status = 'completed'
           AND (
             ($1::text IS NOT NULL AND raw_response->>'id' = $1::text)
             OR ($2::text IS NOT NULL AND raw_response->>'referenceCode' = $2::text)
           )
         LIMIT 1`,
        [id ? String(id) : null, referenceCode ? String(referenceCode) : null]
      );
      if (duplicateRes.rows[0]) {
        return res.json({ success: true, message: 'Duplicate webhook ignored' });
      }
    }

    let transaction = null;
    if (extractedOrderCode) {
      const txRes = await db.query(
        `SELECT * FROM transactions
         WHERE UPPER(transaction_code) = $1
           AND status = 'pending'
           AND payment_method = 'bank_transfer'
         LIMIT 1`,
        [extractedOrderCode]
      );
      transaction = txRes.rows[0] || null;
    }

    if (!transaction) {
      const likeRes = await db.query(
        `SELECT * FROM transactions
         WHERE $1 ILIKE '%' || transaction_code || '%'
           AND status = 'pending'
           AND payment_method = 'bank_transfer'
          ORDER BY created_at DESC
          LIMIT 1`,
        [searchText]
      );
      transaction = likeRes.rows[0];
    }

    if (!transaction) {
      console.warn('[SePay] Webhook: No matching transaction', {
        extractedOrderCode,
        searchText: searchText.slice(0, 200),
      });
      return res.json({ success: true, message: 'No matching transaction' });
    }

    // Kiểm tra số tiền: thiếu tiền thì reject; chuyển thừa vẫn kích hoạt theo đơn pending.
    const expectedAmount = Number(transaction.amount);
    if (receivedAmount < expectedAmount) {
      console.warn(`[SePay] Amount mismatch: expected ${expectedAmount}, got ${receivedAmount} for tx ${transaction.id}`);
      return res.json({ success: true, message: 'Amount mismatch' });
    }
    if (receivedAmount > expectedAmount) {
      console.warn(`[SePay] Overpaid: expected ${expectedAmount}, got ${receivedAmount} for tx ${transaction.id}`);
    }

    const claimedTransaction = await Transaction.claimPending(transaction.id);
    if (!claimedTransaction) {
      return res.json({ success: true, message: 'Already processing or completed' });
    }
    transaction = claimedTransaction;

    try {
      await completeClaimedBankTransfer(transaction, req.body);
    } catch (processErr) {
      await Transaction.updateStatus(transaction.id, 'pending');
      throw processErr;
    }

    return res.json({ success: true });

  } catch (err) {
    console.error('[SePay] Webhook error:', err);
    return res.status(200).json({ success: false, message: 'Internal error' });
  }
});

/**
 * @route GET /api/payments/check-status
 * @desc Kiểm tra trạng thái giao dịch (dùng cho polling từ frontend)
 * @access Private
 */
router.get('/check-status', authenticate, async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });

    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ success: false });

    let transaction = await Transaction.findByTransactionCode(orderId);
    if (!transaction) return res.json({ success: false, status: 'not_found' });
    if (transaction.user_id !== req.user.id) return res.json({ success: false, status: 'unauthorized' });

    if (transaction.status === 'pending' && transaction.payment_method === 'bank_transfer') {
      transaction = await reconcilePendingBankTransfer(transaction);
    }

    if (transaction.status === 'completed') {
      const freshUser = await User.findById(req.user.id);
      return res.json({
        success: true,
        status: 'completed',
        data: {
          package_name: transaction.package_name,
          vip_expires_at: freshUser?.vip_expires_at || null,
          subscription_tier: freshUser?.subscription_tier || 'basic',
        },
      });
    }

    return res.json({ success: true, status: transaction.status });
  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: increment coupon usage CHỈ khi chưa có record
// ─────────────────────────────────────────────────────────────────────────────
async function incrementCouponUsage(transaction) {
  const existingUsage = await require('../config/database').query(
    `SELECT id FROM coupon_usages WHERE transaction_id = $1 LIMIT 1`,
    [transaction.id]
  );
  if (existingUsage.rows[0]) return; // Đã có, bỏ qua

  const couponCode = getStoredCouponCode(transaction);
  if (!couponCode) return;

  const couponRes = await require('../config/database').query(
    `SELECT id, discount_value, discount_type FROM coupons WHERE UPPER(code) = UPPER($1)`,
    [couponCode]
  );
  if (!couponRes.rows[0]) return;

  const c = couponRes.rows[0];
  const discountAmt = c.discount_type === 'percentage'
    ? Math.floor(transaction.amount * c.discount_value / 100)
    : Math.min(Number(c.discount_value), transaction.amount);
  const originalAmt = transaction.amount + discountAmt;

  await require('../config/database').query(
    `UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`,
    [c.id]
  );
  await require('../config/database').query(
    `INSERT INTO coupon_usages (coupon_id, user_id, transaction_id, discount_amount, final_amount, original_amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [c.id, transaction.user_id, transaction.id, discountAmt, transaction.amount, originalAmt]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: rollback coupon usage khi payment thất bại
// ─────────────────────────────────────────────────────────────────────────────
async function rollbackCouponUsage(transaction) {
  await require('../config/database').query(
    `UPDATE coupons c SET used_count = GREATEST(0, used_count - 1)
     FROM coupon_usages cu WHERE cu.coupon_id = c.id AND cu.transaction_id = $1`,
    [transaction.id]
  );
  await require('../config/database').query(
    `DELETE FROM coupon_usages WHERE transaction_id = $1`,
    [transaction.id]
  );
}

module.exports = router;
