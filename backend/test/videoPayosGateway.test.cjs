const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createVideoPayosGateway}=require('../src/services/videoPayosGateway');
const env={PAYOS_CLIENT_ID:'test-client',PAYOS_API_KEY:'test-key',PAYOS_CHECKSUM_KEY:'test-checksum',FRONTEND_URL:'https://example.invalid'};

test('gateway fails closed without server credentials',()=>{
  assert.throws(()=>createVideoPayosGateway({}).assertConfigured(),{code:'PAYOS_NOT_CONFIGURED'});
});

test('create uses snapshot, original order code and explicit expiry',async()=>{
  let captured;
  const gateway=createVideoPayosGateway(env,()=>({paymentRequests:{create:async input=>{captured=input;return input;}}}));
  await gateway.create({id:42,amount:12345,transaction_code:'VIDEO_test',expires_at:'2026-10-13T01:05:00Z',snapshot:{name:'Video Math'}});
  assert.equal(captured.orderCode,42);assert.equal(captured.amount,12345);
  assert.equal(captured.expiredAt,Date.parse('2026-10-13T01:05:00Z')/1000);
  assert.equal(new URL(captured.returnUrl).pathname,'/thanh-toan-khoa-hoc');
  assert.equal(new URL(captured.cancelUrl).searchParams.get('orderId'),'VIDEO_test');
  assert.equal(new URL(captured.cancelUrl).searchParams.get('cancel'),'true');
});

test('SDK GET without QR or checkout URL restores hosted link from valid ID',async()=>{
  const id='0123456789abcdef0123456789abcdef';
  const gateway=createVideoPayosGateway(env,()=>({paymentRequests:{get:async()=>({id,orderCode:42,amount:12345,amountPaid:0,status:'PENDING'})}}));
  const result=await gateway.get(42);
  assert.equal(result.checkoutUrl,`https://pay.payos.vn/web/${id}`);assert.equal(result.qrCode,undefined);
});

test('unexpected provider ID cannot become a hosted checkout URL',async()=>{
  const gateway=createVideoPayosGateway(env,()=>({paymentRequests:{get:async()=>({id:'../../malicious?url=bad',orderCode:42})}}));
  assert.equal((await gateway.get(42)).checkoutUrl,null);
});
