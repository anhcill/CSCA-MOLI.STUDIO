const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authenticate } = require('../middleware/authMiddleware');

// ── Package config ────────────────────────────────────────────────────────────
const PACKAGES = {
  30:  { name: 'Gói Xem',         amount: 99000  },
  180: { name: 'Gói Kiểm tra',    amount: 249000 },
  365: { name: 'Gói Làm bài',     amount: 699000 },
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

  const extraData = Buffer.from(JSON.stringify({ userId, durationDays })).toString('base64');

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
 * @desc Tạo thanh toán MoMo hoặc VNPay
 * @access Private
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const { duration_days, payment_method = 'momo' } = req.body;
    const userId = req.user.id;

    if (!duration_days || !PACKAGES[duration_days]) {
      return res.status(400).json({ success: false, message: 'Gói VIP không hợp lệ.' });
    }

    const pkg = PACKAGES[duration_days];

    // Lưu transaction pending trước
    const orderId = `CSCA_${payment_method.toUpperCase()}_${userId}_${Date.now()}`;
    const transaction = await Transaction.create({
      user_id: userId,
      amount: pkg.amount,
      payment_method,
      package_duration: duration_days,
      package_name: pkg.name,
      transaction_code: orderId,
    });

    let result;

    if (payment_method === 'vnpay') {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      result = createVNPayUrl(userId, duration_days, pkg.amount, clientIp);
    } else {
      try {
        result = await createMoMoPayment(userId, duration_days, pkg.amount);
      } catch (momoErr) {
        console.error('MoMo API error:', momoErr.message);
        // Fallback: trả mock URL nếu MoMo không available
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

        // Update user VIP (DB computes new expiry)
        await User.updateVipStatus(transaction.user_id, durationDays);

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
        // Update user VIP
        await User.updateVipStatus(transaction.user_id, transaction.package_duration);
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
      // Thử xử lý lại (đề phòng webhook chưa kịp gọi)
      await User.updateVipStatus(transaction.user_id, transaction.package_duration);
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

module.exports = router;
