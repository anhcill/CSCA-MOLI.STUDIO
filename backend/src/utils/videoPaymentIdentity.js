function paymentMeta(transaction) {
  const raw = transaction?.raw_response;
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
}

function isVideoPayment(transaction) {
  return ['video', 'combo'].includes(paymentMeta(transaction).commerceType);
}

module.exports = { paymentMeta, isVideoPayment };
