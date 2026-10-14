jest.mock('../../config/database',()=>({query:jest.fn(),pool:{connect:jest.fn()}}));
jest.mock('../../models/Transaction',()=>({findById:jest.fn(),findByTransactionCode:jest.fn(),claimPending:jest.fn(),findByUserId:jest.fn(),updateComplete:jest.fn(),updateStatus:jest.fn()}));
jest.mock('../../models/User',()=>({grantVipEntitlement:jest.fn(),findById:jest.fn()}));
jest.mock('../emailService',()=>({sendPaymentConfirmation:jest.fn(),sendVipActivatedEmail:jest.fn()}));
jest.mock('../coinService',()=>({debit:jest.fn()}));
jest.mock('../videoPaymentRuntime',()=>({acceptPayment:jest.fn(),status:jest.fn()}));
jest.mock('@payos/node',()=>({PayOS:jest.fn()}));
jest.mock('../../middleware/authMiddleware',()=>({authenticate:(req,res,next)=>{req.user={id:7};next();}}));

const express=require('express');
const request=require('supertest');
const crypto=require('crypto');
const {PayOS}=require('@payos/node');
const Transaction=require('../../models/Transaction');
const User=require('../../models/User');
const runtime=require('../videoPaymentRuntime');
const db=require('../../config/database');
const verify=jest.fn();
let app;
const video={id:41,user_id:7,amount:100000,status:'pending',payment_method:'bank_transfer',transaction_code:'VIDEO_TEST',
  raw_response:{commerceType:'video',paymentProvider:'payos',payosOrderCode:41}};

beforeAll(()=>{
  process.env.PAYOS_CLIENT_ID='test';process.env.PAYOS_API_KEY='test';process.env.PAYOS_CHECKSUM_KEY='test';
  process.env.MOMO_SECRET_KEY='dispatch-test-secret';process.env.MOMO_ACCESS_KEY='dispatch-test-access';
  process.env.VNPAY_HASH_SECRET='dispatch-test-vnpay';
  app=express();app.use(express.json());app.use('/payments',require('../../routes/payments'));
});
beforeEach(()=>{
  jest.clearAllMocks();PayOS.mockImplementation(()=>({webhooks:{verify}}));
  Transaction.findById.mockResolvedValue({...video});Transaction.findByTransactionCode.mockResolvedValue({...video});
  verify.mockResolvedValue({orderCode:41,amount:100000,currency:'VND',code:'00'});
  runtime.acceptPayment.mockResolvedValue({status:'completed',type:'video'});
  runtime.status.mockResolvedValue({status:'completed',type:'video'});
});
test('valid payOS webhook dispatches video before legacy claim or VIP grant',async()=>{
  const res=await request(app).post('/payments/payos-webhook').send({code:'00',success:true});
  expect(res.status).toBe(200);expect(runtime.acceptPayment).toHaveBeenCalledWith(41,{provider:'payos',orderCode:41,amount:100000,currency:'VND',reference:'order:41'});
  expect(Transaction.claimPending).not.toHaveBeenCalled();expect(User.grantVipEntitlement).not.toHaveBeenCalled();
});
test('invalid signature or non-success event cannot reach fulfillment',async()=>{
  verify.mockRejectedValueOnce(new Error('Bad signature'));
  expect((await request(app).post('/payments/payos-webhook').send({code:'00',success:true})).status).toBe(401);
  await request(app).post('/payments/payos-webhook').send({code:'01',success:false});
  expect(runtime.acceptPayment).not.toHaveBeenCalled();
});
test('fulfillment crash returns non-2xx for provider retry',async()=>{
  runtime.acceptPayment.mockRejectedValueOnce(new Error('Database unavailable'));
  expect((await request(app).post('/payments/payos-webhook').send({code:'00',success:true})).status).toBe(500);
  expect(User.grantVipEntitlement).not.toHaveBeenCalled();
});
test('legacy payOS order still uses the existing claim path',async()=>{
  Transaction.findById.mockResolvedValue({...video,raw_response:{paymentProvider:'payos',payosOrderCode:41}});
  Transaction.claimPending.mockResolvedValue(null);
  expect((await request(app).post('/payments/payos-webhook').send({code:'00',success:true})).status).toBe(200);
  expect(Transaction.claimPending).toHaveBeenCalledWith(41);expect(runtime.acceptPayment).not.toHaveBeenCalled();
});

test('legacy successful payment still spends coins, grants the same VIP and completes',async()=>{
  const legacy={...video,package_id:2,package_name:'VIP Math',package_duration:90,
    raw_response:{paymentProvider:'payos',payosOrderCode:41,coinsUsed:10}};
  Transaction.findById.mockResolvedValue(legacy);Transaction.claimPending.mockResolvedValue({...legacy,status:'processing'});
  db.query.mockImplementation(async sql=>{
    if(sql.includes('FROM vip_packages'))return {rows:[{id:2,tier:'vip',allowed_subjects:['MATH'],requires_subject_choice:false}]};
    if(sql.includes('FROM users'))return {rows:[{id:7,email:'test@example.invalid',username:'Test',subscription_tier:'vip',vip_expires_at:'2027-01-01'}]};
    return {rows:[]};
  });
  const res=await request(app).post('/payments/payos-webhook').send({code:'00',success:true});
  expect(res.status).toBe(200);
  expect(require('../coinService').debit).toHaveBeenCalledWith(7,10,'vip_discount',expect.objectContaining({idempotencyKey:'payment:41:coins'}));
  expect(User.grantVipEntitlement).toHaveBeenCalledWith(7,90,'vip',expect.objectContaining({packageId:2,allowedSubjects:['MATH'],transactionId:41}));
  expect(Transaction.updateComplete).toHaveBeenCalledWith(41,expect.objectContaining({status:'completed',payment_channel:'payos'}));
  expect(runtime.acceptPayment).not.toHaveBeenCalled();
});
test('verify-return and polling use owned new orders; frontend resultCode is not proof',async()=>{
  await request(app).post('/payments/verify-return').send({orderId:'VIDEO_TEST',resultCode:0});
  await request(app).get('/payments/check-status?orderId=VIDEO_TEST');
  expect(runtime.status).toHaveBeenCalledTimes(2);expect(runtime.acceptPayment).not.toHaveBeenCalled();
  Transaction.findByTransactionCode.mockResolvedValue({...video,user_id:999});
  const denied=await request(app).post('/payments/verify-return').send({orderId:'VIDEO_TEST',resultCode:0});
  expect(denied.body.status).toBe('unauthorized');expect(runtime.status).toHaveBeenCalledTimes(2);
});
test('even signed MoMo/VNPay events cannot enter legacy VIP fulfillment for video orders',async()=>{
  const body={orderId:'VIDEO_TEST',amount:100000,resultCode:0,transId:1};
  const signed=`accessKey=dispatch-test-access&amount=100000&extraData=&message=&orderId=VIDEO_TEST&orderInfo=&orderType=&partnerCode=&payType=&requestId=&responseTime=&resultCode=0&transId=1`;
  body.signature=crypto.createHmac('sha256','dispatch-test-secret').update(signed).digest('hex');
  expect((await request(app).post('/payments/momo-webhook').send(body)).status).toBe(409);
  const vnp={vnp_TxnRef:'VIDEO_TEST',vnp_Amount:10000000,vnp_ResponseCode:'00',vnp_SecureHash:crypto.createHmac('sha512','dispatch-test-vnpay').update('').digest('hex')};
  expect((await request(app).post('/payments/vnpay-webhook').send(vnp)).status).toBe(409);
  expect(User.grantVipEntitlement).not.toHaveBeenCalled();expect(runtime.acceptPayment).not.toHaveBeenCalled();
});
test('legacy VIP grant and revoke risk actions reject a video transaction',async()=>{
  jest.resetModules();
  // The controller uses the same database module's pool; test only the guard.
  const freshDb=require('../../config/database');
  const client={query:jest.fn(async sql=>sql.startsWith('SELECT user_id')?{rows:[{...video,package_id:null}]}:{rows:[]}),release:jest.fn()};
  freshDb.pool.connect.mockResolvedValue(client);
  const actions=require('../../controllers/paymentRiskActionsController');
  for(const method of ['manualGrantVip','revokeVip']){
    const res={status:jest.fn().mockReturnThis(),json:jest.fn()};
    await actions[method]({params:{id:41},body:{reason:'Review'},user:{id:7}},res);
    expect(res.status).toHaveBeenCalledWith(409);
  }
  expect(client.query.mock.calls.some(([sql])=>sql.includes('UPDATE users'))).toBe(false);
});
