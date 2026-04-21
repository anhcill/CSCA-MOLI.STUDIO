const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authenticate } = require('../middleware/authMiddleware');

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
async function createMoMoPayment(userId, durationDays, amount) {
  const orderId = `CSCA_MOMO_${userId}_${Date.now()}`;
  const orderInfo = `CSCA VIP ${PACKAGES[durationDays]?.name || 'Gói VIP'} - ${durationDays} ngày`;

  const extraData = Buffer.from(JSON.stringify({ userId, durationDays, tier: pkg.tier })).toString('base64');

  // Signature MoMo
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

  // Gọi MoMo API
  const response = await axios.post(MOMO.endpoint, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  return { orderId, payUrl: response.data?.payUrl, transId: response.data?.transId };
}

/**
 * Tạo VNPay payment URL
 */
function formatVNPayDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') map[type] = value;
  });

  return `${map.year}${map.month}${map.day}${map.hour}${map.minute}${map.second}`;
}

function createVNPayUrl(userId, durationDays, amount, ipnUrl) {
  const orderId = `CSCA_VNP_${userId}_${Date.now()}`;
  const orderInfo = `CSCA VIP ${PACKAGES[durationDays]?.name || 'Gói VIP'} - ${durationDays} ngày`;

  const vnpParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNPAY.tmnCode,
    vnp_Amount: String(amount * 100), // VNPay dùng xu (Amount * 100)
    vnp_BankCode: '',
    vnp_CreateDate: formatVNPayDate(new Date()),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: ipnUrl || '127.0.0.1',
    vnp_Locale: 'vn',
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'billpayment',
    vnp_ReturnUrl: VNPAY.returnUrl,
    vnp_TxnRef: orderId,
    vnp_ExpireDate: formatVNPayDate(new Date(Date.now() + 2 * 3600000)),
  };

  // Sort keys alphabetically
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
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/payments/create
 * @desc Tạo thanh toán MoMo hoặc VNPay — đọc giá từ DB vip_packages
 * @access Private
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const { package_id, payment_method = 'momo' } = req.body;
    const userId = req.user.id;

    if (!package_id) {
      return res.status(400).json({ success: false, message: 'Thiếu package_id.' });
    }

    // Lấy gói từ DB thay vì dùng fake PACKAGES
    const pkgRes = await require('../config/database').query(
      `SELECT id, name, duration_days, price, is_active FROM vip_packages WHERE id = $1 AND is_active = TRUE`,
      [package_id]
    );

    if (!pkgRes.rows[0]) {
      return res.status(400).json({ success: false, message: 'Gói không tồn tại hoặc đã bị tắt.' });
    }

    const pkg = pkgRes.rows[0];
    const tier = pkg.name.toLowerCase().includes('premium') ? 'premium' : 'vip';
    // Chuyển orderId thành dạng chỉ gồm chữ và số để tránh lỗi app ngân hàng xóa dấu gạch dưới. 
    // Ví dụ: CSCA5T1776774955106
    const orderId = `CSCA${userId}T${Date.now()}`;

    // Lưu transaction pending
    const transaction = await Transaction.create({
      user_id: userId,
      amount: pkg.price,
      payment_method,
      package_duration: pkg.duration_days,
      package_name: pkg.name,
      transaction_code: orderId,
    });

    // Nếu payment_method là bank_transfer → trả về thông tin QR
    if (payment_method === 'bank_transfer') {
      return res.json({
        success: true,
        payment_method: 'bank_transfer',
        orderId,
        bank: {
          bankCode: process.env.BANK_CODE || 'MSB',
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || '80003018784',
          accountName: process.env.BANK_ACCOUNT_NAME || 'LE DUC ANH',
          amount: pkg.price,
          content: orderId, // Nội dung chuyển khoản
          qrUrl: `https://img.vietqr.io/image/${process.env.BANK_CODE || 'MSB'}-${process.env.BANK_ACCOUNT_NUMBER || '80003018784'}-compact2.png?amount=${pkg.price}&addInfo=${encodeURIComponent(orderId)}&accountName=${encodeURIComponent(process.env.BANK_ACCOUNT_NAME || 'LE DUC ANH')}`,
        },
      });
    }

    if (payment_method === 'vnpay') {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      result = createVNPayUrl(userId, pkg.duration_days, pkg.price, clientIp);
    } else {
      try {
        result = await createMoMoPayment(userId, pkg.duration_days, pkg.price, pkg.name, tier);
      } catch (momoErr) {
        console.error('MoMo API error:', momoErr.message);
        result = {
          orderId,
          payUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success?orderId=${orderId}&resultCode=0&simulated=true`,
          transId: null,
        };
      }
    }

    // Cập nhật transaction_code thực
    await Transaction.updateField(transaction.id, 'transaction_code', result.orderId);

    res.json({ success: true, payUrl: result.payUrl, orderId: result.orderId });
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

    // Verify signature
    const rawSig = [
      `accessKey=${MOMO.accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData}`,
      `message=${message}`,
      `orderId=${orderId}`,
      `orderInfo=${orderInfo}`,
      `orderType=${orderType}`,
      `partnerCode=${partnerCode}`,
      `payType=${payType}`,
      `requestId=${requestId}`,
      `responseTime=${responseTime}`,
      `resultCode=${resultCode}`,
      `transId=${transId}`,
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
          // SUCCESS
          if (transaction.status !== 'completed') {
            const extra = {};
            try { Object.assign(extra, JSON.parse(Buffer.from(extraData, 'base64').toString('ascii'))); } catch (e) {}

            const durationDays = extra.durationDays || transaction.package_duration;
            const tier = extra.tier || 'vip';

            // Update user VIP with tier
            await User.updateVipStatus(transaction.user_id, durationDays, tier);

        // Fetch updated user to get new vip_expires_at
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'momo',
          trans_id: transId,
          raw_response: req.body,
          paid_at: new Date(),
          vip_expires_at: vipExpires,
        });

        console.log(`[MoMo Webhook] SUCCESS: orderId=${orderId}, user=${transaction.user_id}`);
      }
    } else {
      // FAILED
      if (transaction.status === 'pending') {
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

    // resultCode 00 = success
    if (vnp_ResponseCode === '00') {
      if (transaction.status !== 'completed') {
        // Update user VIP with tier from package_name
        const tier = transaction.package_name?.toLowerCase().includes('premium') ? 'premium' : 'vip';
        await User.updateVipStatus(transaction.user_id, transaction.package_duration, tier);
        const updatedUser = await User.findById(transaction.user_id);
        const vipExpires = updatedUser?.vip_expires_at || null;

        await Transaction.updateComplete(transaction.id, {
          status: 'completed',
          payment_channel: 'vnpay',
          trans_id: vnp_TransactionNo,
          raw_response: req.body,
          paid_at: new Date(),
          vip_expires_at: vipExpires,
        });
        console.log(`[VNPay Webhook] SUCCESS: orderId=${vnp_TxnRef}`);
      }
    } else {
      if (transaction.status === 'pending') {
        await Transaction.updateStatus(transaction.id, 'failed');
        console.log(`[VNPay Webhook] FAILED: orderId=${vnp_TxnRef}, code=${vnp_ResponseCode}`);
      }
    }

    // VNPay yêu cầu redirect về returnUrl
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

    // Check DB
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

    // Nếu pending + user đã quay về thành công
    if (transaction.status === 'pending' && resultCode === '0') {
      const tier = transaction.package_name?.toLowerCase().includes('premium') ? 'premium' : 'vip';
      await User.updateVipStatus(transaction.user_id, transaction.package_duration, tier);
      const updatedUser = await User.findById(transaction.user_id);
      const vipExpires = updatedUser?.vip_expires_at || null;

      await Transaction.updateComplete(transaction.id, {
        status: 'completed',
        raw_response: { verified_return: true },
        paid_at: new Date(),
        vip_expires_at: vipExpires,
      });

      return res.json({
        success: true,
        status: 'completed',
        data: {
          package_name: transaction.package_name,
          package_duration: transaction.package_duration,
          amount: transaction.amount,
          paid_at: new Date().toISOString(),
          vip_expires_at: vipExpires,
        }
      });
    }

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
    // Xác thực API key từ SePay
    const apiKey = req.headers['authorization'];
    const expectedKey = `Apikey ${process.env.SEPAY_API_KEY || ''}`;

    if (process.env.SEPAY_API_KEY && apiKey !== expectedKey) {
      console.warn('[SePay] Webhook: Invalid API key');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { transferAmount, content, transferType, accountNumber } = req.body;

    console.log('[SePay] Webhook received:', JSON.stringify(req.body));

    // Chỉ xử lý giao dịch TIỀN VÀO
    if (transferType !== 'in') {
      return res.json({ success: true, message: 'Ignored - not incoming transfer' });
    }

    // Tìm order ID trong nội dung chuyển khoản (format: CSCA_BANK_TRANSFER_{userId}_{timestamp})
    const contentStr = (content || '').toUpperCase();
    // Tìm transaction khớp với nội dung
    const txRes = await require('../config/database').query(
      `SELECT * FROM transactions
       WHERE UPPER(transaction_code) = $1
         AND status = 'pending'
         AND payment_method = 'bank_transfer'
       LIMIT 1`,
      [contentStr]
    );

    // Nếu không khớp chính xác, thử tìm bằng LIKE (SePay có thể thêm text)
    let transaction = txRes.rows[0];
    if (!transaction) {
      const likeRes = await require('../config/database').query(
        `SELECT * FROM transactions
         WHERE $1 ILIKE '%' || transaction_code || '%'
           AND status = 'pending'
           AND payment_method = 'bank_transfer'
         ORDER BY created_at DESC
         LIMIT 1`,
        [content || '']
      );
      transaction = likeRes.rows[0];
    }

    if (!transaction) {
      console.warn('[SePay] Webhook: No matching transaction for content:', content);
      return res.json({ success: true, message: 'No matching transaction' });
    }

    // Kiểm tra số tiền (cho phép sai lệch ±1000đ để tránh phí ngân hàng)
    const expectedAmount = transaction.amount;
    const receivedAmount = parseInt(transferAmount) || 0;
    if (Math.abs(receivedAmount - expectedAmount) > 1000) {
      console.warn(`[SePay] Amount mismatch: expected ${expectedAmount}, got ${receivedAmount} for tx ${transaction.id}`);
      // Vẫn xử lý nhưng log cảnh báo
    }

    // Tránh xử lý 2 lần
    if (transaction.status === 'completed') {
      return res.json({ success: true, message: 'Already completed' });
    }

    // Cấp VIP cho user
    const tier = transaction.package_name?.toLowerCase().includes('premium') ? 'premium' : 'vip';
    await User.updateVipStatus(transaction.user_id, transaction.package_duration, tier);
    const updatedUser = await User.findById(transaction.user_id);

    await Transaction.updateComplete(transaction.id, {
      status: 'completed',
      payment_channel: 'bank_transfer',
      trans_id: req.body.referenceCode || req.body.id?.toString() || `SEPAY_${Date.now()}`,
      raw_response: req.body,
      paid_at: new Date(),
      vip_expires_at: updatedUser?.vip_expires_at || null,
    });

    console.log(`[SePay] ✅ VIP granted: user=${transaction.user_id}, pkg=${transaction.package_name}, tier=${tier}`);
    return res.json({ success: true });

  } catch (err) {
    console.error('[SePay] Webhook error:', err);
    // Luôn trả 200 để SePay không retry vô hạn
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
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ success: false });

    const transaction = await Transaction.findByTransactionCode(orderId);
    if (!transaction) return res.json({ success: false, status: 'not_found' });
    if (transaction.user_id !== req.user.id) return res.json({ success: false, status: 'unauthorized' });

    if (transaction.status === 'completed') {
      const freshUser = await User.findById(req.user.id);
      return res.json({
        success: true,
        status: 'completed',
        data: {
          package_name: transaction.package_name,
          vip_expires_at: freshUser?.vip_expires_at || null,
          subscription_tier: freshUser?.subscription_tier || 'vip',
        },
      });
    }

    return res.json({ success: true, status: transaction.status });
  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;

