const express = require('express');
const { sendData, sendCourseError } = require('../utils/courseResponses');

function createVideoPaymentRoutes({ service, authenticate, authorizePermission }) {
  const router = express.Router();
  router.use(authenticate);
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  const handle = (work,status=200) => async (req,res) => {
    try { return sendData(res,await work(req),{status}); }
    catch(error) { return sendCourseError(res,error); }
  };
  if (authorizePermission) {
    router.use('/admin',authorizePermission('users.manage'));
    router.get('/admin/coupons/:id/scopes',handle(req=>service.couponScopes(req.params.id)));
    router.put('/admin/coupons/:id/scopes',handle(req=>service.setCouponScopes(req.params.id,req.body.scopes,req.user.id)));
    router.patch('/admin/products/:type/:id/config',handle(req=>service.configureProduct(req.params.type,req.params.id,req.body,req.user.id)));
  }
  router.post('/quote',handle(req=>service.quote(req.user.id,req.body)));
  router.post('/orders',handle(req=>service.createOrder(req.user.id,req.body),201));
  router.get('/orders',handle(req=>service.history(req.user.id,req.query)));
  router.get('/orders/:orderId',handle(req=>service.status(req.user.id,req.params.orderId)));
  router.get('/orders/:orderId/qr',handle(async req=>{
    const order=await service.status(req.user.id,req.params.orderId,{reconcile:false});
    return {dataUrl:order.payment?.qrCode?await require('qrcode').toDataURL(order.payment.qrCode,{width:300,margin:2}):null};
  }));
  router.post('/orders/:orderId/cancel',handle(req=>service.cancel(req.user.id,req.params.orderId)));
  return router;
}

module.exports={createVideoPaymentRoutes};
