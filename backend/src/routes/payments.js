const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const QRCode = require('qrcode');
const { PayOS } = require('@payos/node');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { authenticate } = require('../middleware/authMiddleware');
const db = require('../config/database');
const coinService = require('../services/coinService');
const {
  canAccessSubject,
  hasAllSubjects,
  resolveSelectedSubjects,
} = require('../utils/vipEntitlements');

const COIN_VALUE_VND = 100;
const MAX_COIN_DISCOUNT_RATIO = 0.2;
function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  if (tier === 'premium' || tier === 'pre') return 'premium';
  if (tier === 'vip') return 'vip';
  return 'basic';
}

function isActiveVipLike(user) {
  if (!user) return false;
  const userTier = normalizeTier(user.subscription_tier);
  const hasTier = user.is_vip === true || userTier === 'vip' || userTier === 'premium';
  const notExpired = !user.vip_expires_at || new Date(user.vip_expires_at) > new Date();
  return hasTier && notExpired;
}

function getActiveTier(user) {
  if (!isActiveVipLike(user)) return 'basic';
  const userTier = normalizeTier(user.subscription_tier);
  if (userTier !== 'basic') return userTier;
  return user?.is_vip ? 'vip' : 'basic';
}

function isPackageEntitlementCovered(user, targetTier, selectedSubjects) {
  const activeTier = getActiveTier(user);
  if (activeTier === 'basic') return false;
  if (activeTier === 'premium') return true;
  if (normalizeTier(targetTier) === 'premium') return false;

  const subjects = Array.isArray(selectedSubjects) ? selectedSubjects : [];
  if (hasAllSubjects(subjects)) return false;
  return subjects.length > 0 && subjects.every(subject => canAccessSubject(user, subject));
}

function getSubjectPriceMapValue(map, subjectCode) {
  if (!map || !subjectCode) return null;
  const value = map[subjectCode] ?? map[String(subjectCode).toUpperCase()];
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getEffectivePackagePrice(pkg, selectedSubjects) {
  const selected = Array.isArray(selectedSubjects) && selectedSubjects.length === 1 ? selectedSubjects[0] : null;
  return getSubjectPriceMapValue(pkg?.subject_prices, selected) || Number(pkg?.price || 0);
}

function getEffectiveOriginalPrice(pkg, selectedSubjects) {
  const selected = Array.isArray(selectedSubjects) && selectedSubjects.length === 1 ? selectedSubjects[0] : null;
  return getSubjectPriceMapValue(pkg?.subject_original_prices, selected) || Number(pkg?.original_price || 0) || null;
}

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

function getPayOSConfig() {
  const clientId = String(process.env.PAYOS_CLIENT_ID || '').trim();
  const apiKey = String(process.env.PAYOS_API_KEY || '').trim();
  const checksumKey = String(process.env.PAYOS_CHECKSUM_KEY || '').trim();
  if (!clientId || !apiKey || !checksumKey) return null;

  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const backendUrl = String(
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    (railwayDomain ? `https://${railwayDomain}` : 'http://localhost:5000')
  ).replace(/\/+$/, '');

  return {
    clientId,
    apiKey,
    checksumKey,
    frontendUrl,
    backendUrl,
    apiBaseUrl: String(process.env.PAYOS_API_BASE_URL || 'https://api-merchant.payos.vn').replace(/\/+$/, ''),
  };
}

function createPayOSClient(config = getPayOSConfig()) {
  if (!config) return null;
  return new PayOS({
    clientId: config.clientId,
    apiKey: config.apiKey,
    checksumKey: config.checksumKey,
    baseURL: config.apiBaseUrl,
    timeout: 15000,
    maxRetries: 2,
    logLevel: 'error',
  });
}

function getPayOSMeta(transaction) {
  const meta = getStoredPaymentMeta(transaction);
  return {
    provider: meta.paymentProvider,
    orderCode: Number.parseInt(meta.payosOrderCode, 10),
    payment: meta.payosPayment || null,
  };
}

function isPayOSPaymentExpired(payment) {
  if (!payment) return false;
  if (String(payment.status || '').toUpperCase() === 'EXPIRED') return true;
  const expiredAt = Number(payment.expiredAt);
  return Number.isFinite(expiredAt) && expiredAt > 0 && expiredAt <= Math.floor(Date.now() / 1000);
}

async function buildPayOSBankResponse(transaction, paymentData) {
  if (!paymentData?.qrCode) return null;
  const qrUrl = await QRCode.toDataURL(paymentData.qrCode, {
    width: 420,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return {
    bankCode: paymentData.bin === '970422' ? 'MB' : (paymentData.bin || 'Ngân hàng'),
    accountNumber: paymentData.accountNumber || '',
    accountName: paymentData.accountName || '',
    amount: Number(paymentData.amount || transaction.amount || 0),
    content: paymentData.description || `CSCA${transaction.id}`,
    qrUrl,
    checkoutUrl: paymentData.checkoutUrl || null,
    expiresAt: paymentData.expiredAt || null,
  };
}

async function createPayOSPaymentRequest(transaction, packageName) {
  const config = getPayOSConfig();
  if (!config) {
    const error = new Error('payOS chưa được cấu hình.');
    error.code = 'PAYOS_NOT_CONFIGURED';
    throw error;
  }

  const orderCode = Number(transaction.id);
  const description = `CSCA${orderCode}`.slice(0, 9);
  const returnUrl = `${config.frontendUrl}/checkout/success?orderId=${encodeURIComponent(transaction.transaction_code)}`;
  const cancelUrl = `${config.frontendUrl}/checkout/success?orderId=${encodeURIComponent(transaction.transaction_code)}&cancel=true`;
  const body = {
    amount: Number(transaction.amount),
    cancelUrl,
    description,
    orderCode,
    returnUrl,
    items: [{
      name: String(packageName || transaction.package_name || 'Gói MOLI.STUDIO').slice(0, 100),
      quantity: 1,
      price: Number(transaction.amount),
    }],
    expiredAt: Math.floor(Date.now() / 1000) + (5 * 60),
  };

  const paymentData = await createPayOSClient(config).paymentRequests.create(body);
  const meta = {
    ...getStoredPaymentMeta(transaction),
    paymentProvider: 'payos',
    payosOrderCode: orderCode,
    payosPayment: paymentData,
  };
  await Transaction.updateField(transaction.id, 'raw_response', JSON.stringify(meta));
  return paymentData;
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

function getStoredDiscountDetails(transaction) {
  const raw = getStoredPaymentMeta(transaction);
  const originalAmount = Number.parseInt(raw?.originalAmount, 10);
  const couponDiscountAmount = Number.parseInt(raw?.couponDiscountAmount, 10);
  const finalAmount = Number.parseInt(raw?.finalAmount ?? transaction?.amount, 10);
  return {
    originalAmount: Number.isFinite(originalAmount) && originalAmount >= 0 ? originalAmount : Number(transaction?.amount || 0),
    couponDiscountAmount: Number.isFinite(couponDiscountAmount) && couponDiscountAmount >= 0 ? couponDiscountAmount : 0,
    finalAmount: Number.isFinite(finalAmount) && finalAmount >= 0 ? finalAmount : Number(transaction?.amount || 0),
  };
}

function normalizeIdempotencyKey(value) {
  return String(value || '').trim().slice(0, 160);
}

function restrictionAllows(values, expected) {
  if (!Array.isArray(values) || values.length === 0) return true;
  const normalized = values.map(value => String(value).toLowerCase());
  if (normalized.includes('all')) return true;
  return normalized.includes(String(expected).toLowerCase());
}

function buildAppliedCouponFromTransaction(transaction) {
  const couponCode = getStoredCouponCode(transaction);
  if (!couponCode) return null;

  const discounts = getStoredDiscountDetails(transaction);
  return {
    code: couponCode,
    discount_amount: discounts.couponDiscountAmount,
    original_amount: discounts.originalAmount,
    final_amount: discounts.finalAmount,
  };
}

function buildAppliedCoinsFromTransaction(transaction) {
  const { coinsUsed, coinDiscountAmount } = getStoredCoinSpend(transaction);
  if (!coinsUsed) return null;

  return {
    coins_used: coinsUsed,
    coin_value_vnd: COIN_VALUE_VND,
    discount_amount: coinDiscountAmount,
  };
}

async function buildExistingPaymentResponse(transaction) {
  if (transaction.status === 'completed') {
    const user = await User.findById(transaction.user_id);
    return {
      success: true,
      status: 'completed',
      payment_method: transaction.payment_method,
      orderId: transaction.transaction_code,
      data: {
        package_name: transaction.package_name,
        package_duration: transaction.package_duration,
        amount: Number(transaction.amount || 0),
        vip_expires_at: user?.vip_expires_at || transaction.vip_expires_at || null,
        subscription_tier: user?.subscription_tier || 'basic',
      },
      appliedCoupon: buildAppliedCouponFromTransaction(transaction),
      appliedCoins: buildAppliedCoinsFromTransaction(transaction),
    };
  }

  if (transaction.payment_method === 'bank_transfer') {
    const payos = getPayOSMeta(transaction);
    if (payos.provider !== 'payos' || !payos.payment) {
      return {
        success: false,
        status: 500,
        message: 'Không tìm thấy thông tin thanh toán payOS. Vui lòng tạo lại đơn.',
      };
    }
    const bank = await buildPayOSBankResponse(transaction, payos.payment);

    return {
      success: true,
      payment_method: 'bank_transfer',
      payment_provider: 'payos',
      orderId: transaction.transaction_code,
      payUrl: payos.payment.checkoutUrl || null,
      bank,
      appliedCoupon: buildAppliedCouponFromTransaction(transaction),
      appliedCoins: buildAppliedCoinsFromTransaction(transaction),
    };
  }

  return {
    success: true,
    status: transaction.status,
    payment_method: transaction.payment_method,
    orderId: transaction.transaction_code,
    appliedCoupon: buildAppliedCouponFromTransaction(transaction),
    appliedCoins: buildAppliedCoinsFromTransaction(transaction),
  };
}

async function getPackageEntitlement(packageId) {
  if (!packageId) return null;
  const result = await db.query(
    `SELECT id, name, COALESCE(tier, 'vip') AS tier, allowed_subjects, requires_subject_choice
     FROM vip_packages
     WHERE id = $1`,
    [packageId]
  );
  return result.rows[0] || null;
}

async function getEntitlementForTransaction(transaction) {
  const meta = getStoredPaymentMeta(transaction);
  const pkg = await getPackageEntitlement(transaction.package_id);
  const fallbackTier = transaction.package_name?.toLowerCase().includes('pre') ? 'premium' : 'vip';

  if (!pkg) {
    return {
      tier: fallbackTier,
      allowedSubjects: ['*'],
      packageId: transaction.package_id || null,
      transactionId: transaction.id,
      source: 'payment',
    };
  }

  let allowedSubjects;
  try {
    allowedSubjects = resolveSelectedSubjects(pkg, meta.selectedSubjectCode);
  } catch (error) {
    if (error.code !== 'SUBJECT_REQUIRED') throw error;
    allowedSubjects = Array.isArray(pkg.allowed_subjects) && pkg.allowed_subjects.length > 0
      ? pkg.allowed_subjects
      : ['*'];
  }

  return {
    tier: normalizeTier(pkg.tier || fallbackTier),
    allowedSubjects,
    packageId: pkg.id,
    transactionId: transaction.id,
    source: 'payment',
  };
}

async function getReservedCoins(userId, client = db) {
  const reservedRes = await client.query(
    `SELECT COALESCE(SUM(
       CASE
         WHEN raw_response ? 'coinsUsed'
          AND (raw_response->>'coinsUsed') ~ '^[0-9]+$'
         THEN (raw_response->>'coinsUsed')::int
         ELSE 0
       END
     ), 0)::int AS reserved
     FROM transactions
     WHERE user_id = $1
       AND status IN ('pending', 'processing')
       AND created_at >= NOW() - INTERVAL '24 hours'`,
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
      `SELECT id, email, username, full_name, vip_expires_at, subscription_tier, vip_package_id, vip_allowed_subjects
       FROM users
       WHERE id = $1`,
      [userId]
    );
    return userRes.rows[0] || null;
  } catch (err) {
    console.error('[Payment] Full payment user lookup failed, using fallback:', err.message);
    const fallbackRes = await db.query(
      `SELECT id, email, username, full_name, vip_expires_at, vip_package_id, vip_allowed_subjects
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
    console.error('[Payment] Fallback transaction completion failed, using status-only update:', err.message);
    await Transaction.updateStatus(transaction.id, 'completed');
  }
}

async function updateVipStatusForPayment(userId, durationDays, tier, entitlementOptions = {}) {
  try {
    return await User.grantVipEntitlement(userId, durationDays, tier, entitlementOptions);
  } catch (err) {
    console.error('[Payment] User.grantVipEntitlement failed, using direct fallback:', err.message);
    const normalizedTier = String(tier || '').toLowerCase() === 'premium' || String(tier || '').toLowerCase() === 'pre'
      ? 'premium'
      : 'vip';
    const days = Number.parseInt(durationDays, 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 0;
    const fallbackSubjects = normalizedTier === 'premium'
      ? ['*']
      : (Array.isArray(entitlementOptions.allowedSubjects) && entitlementOptions.allowedSubjects.length > 0
        ? entitlementOptions.allowedSubjects
        : ['*']);
    const fallbackRes = await db.query(
      `UPDATE users
       SET is_vip = TRUE,
           subscription_tier = $3,
           vip_package_id = COALESCE($4, vip_package_id),
           vip_allowed_subjects = $5,
           vip_expires_at = CASE
             WHEN $2::int > 0 THEN GREATEST(COALESCE(vip_expires_at, NOW()), NOW()) + ($2::int * INTERVAL '1 day')
             ELSE vip_expires_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_vip, vip_expires_at, subscription_tier, vip_package_id, vip_allowed_subjects`,
      [userId, safeDays, normalizedTier, entitlementOptions.packageId || null, fallbackSubjects]
    );
    return fallbackRes.rows[0] || null;
  }
}

async function completeClaimedBankTransfer(transaction, providerPayload = {}) {
  await applyCoinSpend(transaction);
  await incrementCouponUsage(transaction).catch(err => {
    console.error('[Payment] Coupon usage update failed, continuing payment completion:', err.message);
  });

  const entitlement = await getEntitlementForTransaction(transaction);
  await updateVipStatusForPayment(transaction.user_id, transaction.package_duration, entitlement.tier, entitlement);
  const updatedUser = await getPaymentUser(transaction.user_id);
  if (!updatedUser) {
    throw new Error(`Payment user not found: ${transaction.user_id}`);
  }

  const providerTransId = providerPayload.reference || providerPayload.referenceCode || providerPayload.reference_number || providerPayload.id?.toString() || `PAYOS_${Date.now()}`;
  const payload = {
    ...getStoredPaymentMeta(transaction),
    ...(providerPayload || {}),
    bankTransferWebhook: providerPayload,
  };
  try {
    await Transaction.updateComplete(transaction.id, {
      status: 'completed',
      payment_channel: 'payos',
      trans_id: providerTransId,
      raw_response: payload,
      paid_at: new Date(),
      vip_expires_at: updatedUser?.vip_expires_at || null,
    });
  } catch (completeErr) {
    console.error('[Payment] Full transaction completion failed, using fallback:', completeErr.message);
    await markTransactionCompletedFallback(transaction, payload);
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

  console.log(`[Payment] Bank transfer completed: user=${transaction.user_id}, tx=${transaction.transaction_code}, tier=${entitlement.tier}`);
  return { updatedUser, tier: entitlement.tier };
}

async function completeZeroAmountTransaction(transaction, providerPayload = {}) {
  await applyCoinSpend(transaction);
  await incrementCouponUsage(transaction).catch(err => {
    console.error('[Payment] Coupon usage update failed, continuing payment completion:', err.message);
  });

  const entitlement = await getEntitlementForTransaction(transaction);
  await updateVipStatusForPayment(transaction.user_id, transaction.package_duration, entitlement.tier, entitlement);
  const updatedUser = await getPaymentUser(transaction.user_id);
  if (!updatedUser) {
    throw new Error(`Payment user not found: ${transaction.user_id}`);
  }

  const payload = {
    ...getStoredPaymentMeta(transaction),
    ...(providerPayload || {}),
    completedWithoutGateway: true,
    completedReason: 'zero_amount_after_discount',
  };

  await Transaction.updateComplete(transaction.id, {
    status: 'completed',
    payment_channel: 'coupon_free',
    trans_id: `FREE_${transaction.transaction_code}`,
    raw_response: payload,
    paid_at: new Date(),
    vip_expires_at: updatedUser?.vip_expires_at || null,
  });

  Promise.all([
    emailService.sendPaymentConfirmation({
      email: updatedUser.email,
      name: updatedUser.full_name || updatedUser.username,
      packageName: transaction.package_name,
      amount: 0,
      durationDays: transaction.package_duration,
      transactionCode: transaction.transaction_code,
      method: 'coupon_free',
    }),
    emailService.sendVipActivatedEmail({
      email: updatedUser.email,
      name: updatedUser.full_name || updatedUser.username,
      packageName: transaction.package_name,
      durationDays: transaction.package_duration,
      expiresAt: updatedUser?.vip_expires_at || null,
    }),
  ]).catch(err => console.error('Zero amount payment email error:', err.message));

  return { updatedUser, tier: entitlement.tier };
}

async function getPayOSPaymentRequest(transaction) {
  const config = getPayOSConfig();
  const payos = getPayOSMeta(transaction);
  if (!config || payos.provider !== 'payos' || !payos.orderCode) return null;

  return createPayOSClient(config).paymentRequests.get(payos.orderCode, {
    timeout: 10000,
    maxRetries: 1,
  });
}

async function reconcilePendingPayOSPayment(transaction) {
  if (!transaction || transaction.status !== 'pending' || transaction.payment_method !== 'bank_transfer') {
    return transaction;
  }

  try {
    const payment = await getPayOSPaymentRequest(transaction);
    if (!payment || payment.status !== 'PAID') return transaction;
    if (Number(payment.amountPaid || payment.amount || 0) < Number(transaction.amount)) {
      console.warn(`[payOS] Reconcile amount mismatch for transaction ${transaction.id}`);
      return transaction;
    }

    const claimedTransaction = await Transaction.claimPending(transaction.id);
    if (!claimedTransaction) {
      return await Transaction.findByTransactionCode(transaction.transaction_code);
    }

    try {
      const latestPayment = Array.isArray(payment.transactions) && payment.transactions.length
        ? payment.transactions[payment.transactions.length - 1]
        : {};
      await completeClaimedBankTransfer(claimedTransaction, {
        ...latestPayment,
        orderCode: payment.orderCode,
        paymentLinkId: payment.id,
        amount: payment.amountPaid || payment.amount,
        source: 'payos_api_reconcile',
      });
    } catch (processErr) {
      await Transaction.updateStatus(claimedTransaction.id, 'pending');
      throw processErr;
    }
    return await Transaction.findByTransactionCode(transaction.transaction_code);
  } catch (err) {
    console.error('[payOS] API reconcile failed:', err.message);
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

    const { package_id, payment_method = 'momo', coupon_code, idempotency_key, use_coins, coins_to_use, selected_subject_code } = req.body;
    const userId = req.user.id;
    const idemKey = normalizeIdempotencyKey(idempotency_key);

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

    // ── Idempotency: tránh tạo transaction trùng khi bấm thanh toán nhiều lần ──
    if (idemKey) {
      let existingTx = await Transaction.findByIdempotencyKey(userId, idemKey);
      if (
        existingTx?.payment_method === 'bank_transfer' &&
        existingTx.status === 'pending'
      ) {
        const existingPayOS = getPayOSMeta(existingTx);

        if (existingPayOS.provider === 'payos' && isPayOSPaymentExpired(existingPayOS.payment)) {
          // Cho phép tạo orderCode mới sau khi QR payOS cũ hết hạn.
          await Transaction.updateStatus(existingTx.id, 'failed');
          existingTx = null;
        } else if (existingPayOS.provider !== 'payos' || !existingPayOS.payment) {
          // Nâng cấp đơn pending được tạo từ luồng SePay cũ sang payOS.
          try {
            const migratedPayment = await createPayOSPaymentRequest(
              existingTx,
              existingTx.package_name
            );
            existingTx = {
              ...existingTx,
              raw_response: {
                ...getStoredPaymentMeta(existingTx),
                paymentProvider: 'payos',
                payosOrderCode: Number(existingTx.id),
                payosPayment: migratedPayment,
              },
            };
          } catch (migrationError) {
            console.error('[payOS] Legacy payment migration failed:', migrationError.message);
            return res.status(502).json({
              success: false,
              message: 'Không tạo được mã thanh toán payOS. Vui lòng thử lại.',
            });
          }
        }
      }

      if (existingTx) {
        const existingResponse = await buildExistingPaymentResponse(existingTx);
        if (existingResponse.success === false) {
          return res.status(existingResponse.status || 500).json(existingResponse);
        }
        return res.json(existingResponse);
      }
    }

    // Lấy gói từ DB
    const pkgRes = await db.query(
      `SELECT id, name, tier, duration_days, price, original_price, subject_prices, subject_original_prices, is_active, allowed_subjects, requires_subject_choice FROM vip_packages WHERE id = $1 AND is_active = TRUE`,
      [pkgId]
    );

    if (!pkgRes.rows[0]) {
      return res.status(400).json({ success: false, message: 'Gói không tồn tại hoặc đã bị tắt.' });
    }

    const pkg = pkgRes.rows[0];
    const normalizedPackageTier = normalizeTier(pkg.tier || 'vip');
    const tier = normalizedPackageTier === 'basic' ? 'vip' : normalizedPackageTier;
    let selectedSubjects;
    try {
      selectedSubjects = resolveSelectedSubjects(pkg, selected_subject_code);
    } catch (subjectErr) {
      return res.status(400).json({
        success: false,
        code: subjectErr.code || 'INVALID_SUBJECT',
        message: subjectErr.message || 'Mon hoc khong hop le.',
      });
    }

    // Block payment for an active same-tier or lower-tier package.
    const userCheck = await db.query(
      `SELECT is_vip, vip_expires_at, subscription_tier, vip_allowed_subjects, COALESCE(coins, 0) AS coins FROM users WHERE id = $1`,
      [userId]
    );
    const user = userCheck.rows[0];
    const activeTier = getActiveTier(user);
    if (isPackageEntitlementCovered(user, tier, selectedSubjects)) {
      return res.status(409).json({
        success: false,
        code: 'PACKAGE_ALREADY_ACTIVE',
        message: activeTier === 'premium'
          ? 'Bạn đang có gói Pre đang hoạt động, không cần mua thêm gói này.'
          : 'Bạn đang có gói VIP đang hoạt động, không cần mua thêm gói VIP.',
        currentTier: activeTier,
      });
    }

    const effectivePrice = getEffectivePackagePrice(pkg, selectedSubjects);
    const effectiveOriginalPrice = getEffectiveOriginalPrice(pkg, selectedSubjects);

    // Sanitize: đảm bảo giá là số dương
    if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
      return res.status(400).json({ success: false, message: 'Giá gói không hợp lệ.' });
    }

    const orderId = `CSCA${userId}T${Date.now()}`;

    let finalAmount = Number(effectivePrice);
    let discountAmount = 0;
    let appliedCoupon = null;

    // ── Áp dụng coupon nếu có (CHỈ validation, chưa increment) ───────────
    if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim().length > 0) {
      const couponRes = await db.query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = TRUE`,
        [coupon_code.trim()]
      );

      if (!couponRes.rows[0]) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ.' });
      }

      const c = couponRes.rows[0];
      const now = new Date();
      const validFrom = c.valid_from ? new Date(c.valid_from) : null;
      const validUntil = c.valid_until ? new Date(c.valid_until) : null;

      if (validFrom && now < validFrom) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá chưa có hiệu lực.' });
      }
      if (validUntil && now > validUntil) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn.' });
      }
      if (c.max_uses !== null && c.used_count >= c.max_uses) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng.' });
      }
      if (!restrictionAllows(c.applicable_packages, pkg.id)) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho gói này.' });
      }
      if (!restrictionAllows(c.applicable_tiers, tier)) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá không áp dụng cho cấp bậc này.' });
      }
      if (c.min_order_amount && Number(c.min_order_amount) > effectivePrice) {
        return res.status(400).json({
          success: false,
          message: `Giá trị đơn hàng tối thiểu là ${Number(c.min_order_amount).toLocaleString('vi-VN')}đ.`,
        });
      }

      const userUsage = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM coupon_usages
         WHERE coupon_id = $1 AND user_id = $2`,
        [c.id, userId]
      );
      if (Number(userUsage.rows[0]?.count || 0) >= Number(c.user_limit || 1)) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã sử dụng mã giảm giá này đủ số lần cho phép.',
        });
      }

      if (c.discount_type === 'percentage') {
        discountAmount = Math.floor(effectivePrice * c.discount_value / 100);
        if (c.max_discount_amount) {
          discountAmount = Math.min(discountAmount, c.max_discount_amount);
        }
      } else {
        discountAmount = Math.min(Number(c.discount_value), effectivePrice);
      }
      discountAmount = Math.min(Math.max(0, discountAmount), Number(effectivePrice));
      finalAmount = Math.max(0, Math.round(effectivePrice - discountAmount));
      appliedCoupon = c;
    }

    let coinsUsed = 0;
    let coinDiscountAmount = 0;
    let transaction = null;
    const paymentClient = await db.pool.connect();
    try {
      await paymentClient.query('BEGIN');
      const lockedUser = await paymentClient.query(
        `SELECT COALESCE(coins, 0)::int AS coins FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      );
      const lockedCoins = lockedUser.rows[0]?.coins || 0;

      if (use_coins === true || Number.parseInt(coins_to_use, 10) > 0) {
        const requestedCoins = Number.parseInt(coins_to_use, 10);
        const reservedCoins = await getReservedCoins(userId, paymentClient);
        const availableCoins = Math.max(0, Number(lockedCoins || 0) - reservedCoins);
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
        idempotencyKey: idemKey || null,
        couponCode: coupon_code?.trim() || null,
        coinsUsed,
        coinValueVnd: COIN_VALUE_VND,
        coinDiscountAmount,
        originalAmount: Number(effectivePrice),
        originalListAmount: effectiveOriginalPrice,
        couponDiscountAmount: discountAmount,
        finalAmount,
        paymentMethodRequested: payment_method,
        selectedSubjectCode: selectedSubjects.length === 1 && selectedSubjects[0] !== '*' ? selectedSubjects[0] : null,
        grantedSubjects: selectedSubjects,
      };

      transaction = await Transaction.create({
        user_id: userId,
        amount: finalAmount,
        payment_method: finalAmount <= 0 ? 'coupon_free' : payment_method,
        package_id: pkg.id,
        package_duration: pkg.duration_days,
        package_name: pkg.name,
        transaction_code: orderId,
        coupon_code: coupon_code?.trim() || null,
        raw_response: paymentMeta,
      }, paymentClient);

      await paymentClient.query('COMMIT');
    } catch (paymentCreateErr) {
      await paymentClient.query('ROLLBACK').catch(() => {});
      throw paymentCreateErr;
    } finally {
      paymentClient.release();
    }

    // Nếu payment_method là bank_transfer → trả về thông tin QR
    if (finalAmount <= 0) {
      const { updatedUser } = await completeZeroAmountTransaction(transaction, {
        couponCode: appliedCoupon?.code || coupon_code?.trim() || null,
        originalAmount: Number(effectivePrice),
        couponDiscountAmount: discountAmount,
        coinDiscountAmount,
        coinsUsed,
      });

      return res.json({
        success: true,
        status: 'completed',
        payment_method: 'coupon_free',
        orderId,
        message: 'Đơn hàng đã được giảm về 0đ và kích hoạt thành công.',
        data: {
          package_name: pkg.name,
          package_duration: pkg.duration_days,
          amount: 0,
          vip_expires_at: updatedUser?.vip_expires_at || null,
          subscription_tier: updatedUser?.subscription_tier || tier,
          vip_allowed_subjects: updatedUser?.vip_allowed_subjects || selectedSubjects,
          selected_subject_code: selectedSubjects.length === 1 && selectedSubjects[0] !== '*' ? selectedSubjects[0] : null,
        },
        appliedCoupon: appliedCoupon ? {
          code: appliedCoupon.code,
          discount_amount: discountAmount,
          original_amount: effectivePrice,
          final_amount: 0,
        } : null,
        appliedCoins: coinsUsed > 0 ? {
          coins_used: coinsUsed,
          coin_value_vnd: COIN_VALUE_VND,
          discount_amount: coinDiscountAmount,
        } : null,
      });
    }

    if (payment_method === 'bank_transfer') {
      let payosPayment;
      try {
        payosPayment = await createPayOSPaymentRequest(transaction, pkg.name);
      } catch (payosErr) {
        console.error('[payOS] Create payment failed:', payosErr.response?.data?.desc || payosErr.message);
        await Transaction.updateStatus(transaction.id, 'failed').catch(() => {});
        return res.status(payosErr.code === 'PAYOS_NOT_CONFIGURED' ? 503 : 502).json({
          success: false,
          message: payosErr.code === 'PAYOS_NOT_CONFIGURED'
            ? 'Thanh toán payOS chưa được cấu hình.'
            : 'Không tạo được mã thanh toán payOS. Vui lòng thử lại.',
        });
      }
      const bank = await buildPayOSBankResponse(transaction, payosPayment);

      return res.json({
        success: true,
        payment_method: 'bank_transfer',
        payment_provider: 'payos',
        orderId,
        payUrl: payosPayment.checkoutUrl || null,
        bank,
        appliedCoupon: appliedCoupon ? {
          code: appliedCoupon.code,
          discount_amount: discountAmount,
          original_amount: effectivePrice,
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
          message: 'Không kết nối được cổng thanh toán. Vui lòng thử lại sau.',
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
          original_amount: effectivePrice,
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
        const entitlement = await getEntitlementForTransaction(transaction);

        // ── Increment coupon usage CHỈ khi thành công ──────────────────────
        await applyCoinSpend(transaction);
        await incrementCouponUsage(transaction).catch(err => {
          console.error('[Payment] Coupon usage update failed, continuing payment completion:', err.message);
        });

        await updateVipStatusForPayment(transaction.user_id, durationDays, entitlement.tier, entitlement);
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'momo',
          trans_id: transId ? String(transId) : null,
          raw_response: { ...getStoredPaymentMeta(transaction), momoWebhook: req.body },
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
        await applyCoinSpend(transaction);
        await incrementCouponUsage(transaction).catch(err => {
          console.error('[Payment] Coupon usage update failed, continuing payment completion:', err.message);
        });

        const entitlement = await getEntitlementForTransaction(transaction);
        await updateVipStatusForPayment(transaction.user_id, transaction.package_duration, entitlement.tier, entitlement);
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'vnpay',
          trans_id: vnp_TransactionNo ? String(vnp_TransactionNo) : null,
          raw_response: { ...getStoredPaymentMeta(transaction), vnpayWebhook: req.body },
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

    let transaction = await Transaction.findByTransactionCode(orderId);

    if (!transaction) {
      return res.json({ success: false, status: 'not_found' });
    }

    if (transaction.user_id !== req.user.id) {
      return res.json({ success: false, status: 'unauthorized' });
    }

    if (transaction.status === 'pending' && transaction.payment_method === 'bank_transfer') {
      transaction = await reconcilePendingPayOSPayment(transaction);
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
    // Việc cập nhật trạng thái thanh toán chỉ được phép qua webhook hoặc API đối soát nhà cung cấp.
    // Frontend sẽ poll API này để chờ trạng thái chuyển từ pending sang completed.
    
    return res.json({ success: true, status: transaction.status });
  } catch (err) {
    console.error('Verify return error:', err);
    res.status(500).json({ success: false });
  }
});

/**
 * @route POST /api/payments/payos-webhook
 * @desc Nhận webhook thanh toán từ payOS
 * @access Public (xác thực bằng HMAC SHA-256)
 */
router.post('/payos-webhook', async (req, res) => {
  try {
    const config = getPayOSConfig();
    if (!config) {
      console.error('[payOS] Webhook received while payOS is not configured');
      return res.status(503).json({ success: false, message: 'payOS is not configured' });
    }

    let webhookData;
    try {
      webhookData = await createPayOSClient(config).webhooks.verify(req.body);
    } catch (_signatureError) {
      console.warn('[payOS] Webhook signature rejected');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // payOS gửi dữ liệu mẫu khi xác nhận URL webhook. Trả 200 nếu chữ ký hợp lệ.
    if (req.body?.code !== '00' || req.body?.success !== true || webhookData?.code !== '00') {
      return res.json({ success: true, message: 'Webhook verified; non-success event ignored' });
    }

    const orderCode = Number.parseInt(webhookData.orderCode, 10);
    if (!Number.isFinite(orderCode) || orderCode <= 0) {
      return res.json({ success: true, message: 'Webhook test acknowledged' });
    }

    let transaction = await Transaction.findById(orderCode);
    if (!transaction) {
      // Dữ liệu mẫu của payOS thường dùng orderCode không tồn tại.
      return res.json({ success: true, message: 'Unknown/test order acknowledged' });
    }

    const payos = getPayOSMeta(transaction);
    if (
      transaction.payment_method !== 'bank_transfer' ||
      payos.provider !== 'payos' ||
      payos.orderCode !== orderCode
    ) {
      console.warn(`[payOS] Webhook order ${orderCode} does not belong to payOS`);
      return res.json({ success: true, message: 'Order provider mismatch' });
    }

    if (transaction.status === 'completed') {
      return res.json({ success: true, message: 'Duplicate webhook ignored' });
    }

    const receivedAmount = Number(webhookData.amount);
    const expectedAmount = Number(transaction.amount);
    if (!Number.isFinite(receivedAmount) || receivedAmount < expectedAmount) {
      console.warn(`[payOS] Amount mismatch: expected ${expectedAmount}, got ${receivedAmount} for tx ${transaction.id}`);
      return res.json({ success: true, message: 'Amount mismatch' });
    }

    const claimedTransaction = await Transaction.claimPending(transaction.id);
    if (!claimedTransaction) {
      return res.json({ success: true, message: 'Already processing or completed' });
    }
    transaction = claimedTransaction;

    try {
      await completeClaimedBankTransfer(transaction, {
        ...webhookData,
        source: 'payos_webhook',
      });
    } catch (processErr) {
      await Transaction.updateStatus(transaction.id, 'pending');
      throw processErr;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[payOS] Webhook error:', err.message);
    // Trả non-2xx để payOS retry, tránh mất sự kiện khi DB tạm lỗi.
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

router.post('/sepay-webhook', (_req, res) => {
  return res.status(410).json({ success: false, message: 'SePay has been replaced by payOS' });
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
      transaction = await reconcilePendingPayOSPayment(transaction);
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
  const stored = getStoredDiscountDetails(transaction);
  let discountAmt = stored.couponDiscountAmount;
  if (!discountAmt) {
    discountAmt = c.discount_type === 'percentage'
      ? Math.floor(stored.originalAmount * c.discount_value / 100)
      : Math.min(Number(c.discount_value), stored.originalAmount);
  }
  discountAmt = Math.min(Math.max(0, discountAmt), stored.originalAmount);
  const originalAmt = stored.originalAmount;
  const finalAmt = Math.max(0, stored.finalAmount);

  await require('../config/database').query(
    `UPDATE coupons SET used_count = used_count + 1 WHERE id = $1`,
    [c.id]
  );
  await require('../config/database').query(
    `INSERT INTO coupon_usages (coupon_id, user_id, transaction_id, discount_amount, final_amount, original_amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [c.id, transaction.user_id, transaction.id, discountAmt, finalAmt, originalAmt]
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
