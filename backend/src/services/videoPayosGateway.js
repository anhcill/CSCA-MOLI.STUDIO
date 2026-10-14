const { PayOS } = require('@payos/node');
const { CourseApiError } = require('../utils/courseResponses');

function createVideoPayosGateway(env = process.env, clientFactory = config => new PayOS(config)) {
  function client() {
    if (!env.PAYOS_CLIENT_ID || !env.PAYOS_API_KEY || !env.PAYOS_CHECKSUM_KEY) {
      throw new CourseApiError(503, 'PAYOS_NOT_CONFIGURED', 'payOS is not configured.');
    }
    return clientFactory({ clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY,
      checksumKey: env.PAYOS_CHECKSUM_KEY, timeout: 15000, maxRetries: 1, logLevel: 'error' });
  }
  return {
    assertConfigured() { client(); },
    async create(order) {
      const origin = new URL(env.FRONTEND_URL || 'http://localhost:3000').origin;
      const returnUrl = new URL('/thanh-toan-khoa-hoc', origin);
      returnUrl.searchParams.set('orderId', order.transaction_code);
      const cancelUrl = new URL(returnUrl); cancelUrl.searchParams.set('cancel', 'true');
      return client().paymentRequests.create({ orderCode: Number(order.id), amount: Number(order.amount),
        description: `CSCA${order.id}`.slice(0, 25), returnUrl: returnUrl.toString(), cancelUrl: cancelUrl.toString(),
        expiredAt: Math.floor(new Date(order.expires_at).getTime() / 1000),
        items: [{ name: order.snapshot.name.slice(0, 100), quantity: 1, price: Number(order.amount) }] });
    },
    async get(id) {
      const payment = await client().paymentRequests.get(Number(id));
      // GET returns PaymentLink, not CreatePaymentLinkResponse: it has no QR or
      // checkoutUrl. Restore the documented hosted URL from the verified ID.
      return { ...payment, checkoutUrl: /^[a-f0-9]{32}$/i.test(payment.id || '')
        ? `https://pay.payos.vn/web/${payment.id}` : null };
    },
    async cancel(id) { return client().paymentRequests.cancel(Number(id), 'Cancelled by purchaser'); },
  };
}

module.exports = { createVideoPayosGateway };
