const db = require('../config/database');
const User = require('../models/User');
const emailService = require('./emailService');
const { createVideoPaymentService } = require('./videoPaymentService');
const { createVideoPayosGateway } = require('./videoPayosGateway');
const { parseFeatureFlag } = require('../utils/courseFeatureConfig');

module.exports = createVideoPaymentService({
  db,
  gateway: createVideoPayosGateway(),
  recalculateVip: (userId, client) => User.recalculateVipSummary(userId, client),
  sendEmail: data => emailService.sendVideoPurchaseEmail(data),
  salesEnabled: () => parseFeatureFlag(process.env.CSCA_VIDEO_COMMERCE_SALES_ENABLED, 'CSCA_VIDEO_COMMERCE_SALES_ENABLED'),
});
