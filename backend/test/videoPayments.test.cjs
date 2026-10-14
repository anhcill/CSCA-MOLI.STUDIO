const { test,before,after }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const request=require('supertest');
const { PGlite }=require('@electric-sql/pglite');
const { createVideoPaymentService }=require('../src/services/videoPaymentService');
const { createVideoPaymentRoutes }=require('../src/routes/videoPaymentRoutes');
const { lockCoupon,consumeCoupon }=require('../src/services/paymentCouponReservation');
const { isVideoPayment }=require('../src/utils/videoPaymentIdentity');
const User=require('../src/models/User');
const {createVideoCommerceRepository}=require('../src/repositories/videoCommerceRepository');
const {createVideoAdminService}=require('../src/services/videoAdminService');
const {createVideoCouponAdminService}=require('../src/services/videoCouponAdminService');
const {createVideoShopRoutes}=require('../src/routes/videoShopRoutes');

let db,service,app,enabled=true,emailFailure=false,failVip=false,clock=new Date(Date.now()+1000),serial=0;
let admin,couponAdmin;
const sent=[],payments=new Map();
const gateway={
  assertConfigured(){},
  async get(id){ if(!payments.has(Number(id))) throw new Error('Not found'); return payments.get(Number(id)); },
  async create(row){const payment={orderCode:Number(row.id),amount:Number(row.amount),status:'PENDING',qrCode:'test-qr',checkoutUrl:'https://pay.payos.vn/test'};payments.set(Number(row.id),payment);return payment;},
  async cancel(id){const payment=await this.get(id);if(payment.status!=='PAID')payment.status='CANCELLED';return payment;},
};
const migration=name=>fs.readFileSync(path.join(__dirname,'../../database/migrations',name),'utf8');
before(async()=>{
  db=new PGlite();
  await db.exec(`
    CREATE TABLE users(id SERIAL PRIMARY KEY,email TEXT,full_name TEXT,username TEXT,coins INTEGER DEFAULT 0,is_vip BOOLEAN DEFAULT FALSE,
      subscription_tier TEXT DEFAULT 'basic',vip_expires_at TIMESTAMPTZ,vip_package_id INTEGER,vip_allowed_subjects TEXT[] DEFAULT '{}',updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE vip_packages(id SERIAL PRIMARY KEY,name TEXT,tier TEXT DEFAULT 'vip',price INTEGER,duration_days INTEGER,allowed_subjects TEXT[],requires_subject_choice BOOLEAN DEFAULT FALSE,is_active BOOLEAN DEFAULT TRUE);
    CREATE TABLE courses(id BIGSERIAL PRIMARY KEY,subject_code TEXT,status TEXT);
    CREATE TABLE transactions(id SERIAL PRIMARY KEY,user_id INTEGER REFERENCES users(id),amount BIGINT NOT NULL CHECK(amount>0),payment_method TEXT,
      package_id INTEGER REFERENCES vip_packages(id),package_duration INTEGER NOT NULL,package_name VARCHAR(100),transaction_code TEXT UNIQUE,status TEXT,
      payment_channel TEXT,trans_id TEXT,raw_response JSONB,paid_at TIMESTAMPTZ,vip_expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE coupons(id SERIAL PRIMARY KEY,code TEXT UNIQUE,is_active BOOLEAN DEFAULT TRUE,discount_type TEXT,discount_value INTEGER,
      min_order_amount INTEGER DEFAULT 0,max_discount_amount INTEGER,max_uses INTEGER,user_limit INTEGER DEFAULT 1,used_count INTEGER DEFAULT 0,
      valid_from TIMESTAMPTZ,valid_until TIMESTAMPTZ,applicable_packages INTEGER[],applicable_tiers TEXT[] DEFAULT ARRAY['all']);
    CREATE TABLE coupon_usages(id SERIAL PRIMARY KEY,coupon_id INTEGER REFERENCES coupons(id),user_id INTEGER REFERENCES users(id),transaction_id INTEGER REFERENCES transactions(id),discount_amount INTEGER,final_amount INTEGER,original_amount INTEGER);
    CREATE TABLE coin_ledger(id BIGSERIAL PRIMARY KEY,user_id INTEGER,amount INTEGER,balance_after INTEGER,source TEXT,description TEXT,metadata JSONB,idempotency_key TEXT UNIQUE);
    CREATE TABLE user_vip_entitlements(id SERIAL PRIMARY KEY,user_id INTEGER,package_id INTEGER,transaction_id INTEGER,tier TEXT,allowed_subjects TEXT[],
      starts_at TIMESTAMPTZ,expires_at TIMESTAMPTZ,source TEXT,is_active BOOLEAN DEFAULT TRUE,created_at TIMESTAMPTZ DEFAULT NOW());
    INSERT INTO vip_packages(id,name,price,duration_days,allowed_subjects) VALUES (1,'Legacy Math',90000,90,ARRAY['MATH']);
    INSERT INTO courses(id,subject_code,status) VALUES (1,'MATH','published'),(2,'PHYSICS','published'),(3,'MATH','draft');
  `);
  await db.exec(migration('067_video_commerce_foundation.sql'));
  await db.exec(migration('068_video_commerce_payments.sql'));
  await db.exec(`ALTER TABLE courses ADD COLUMN title TEXT DEFAULT 'Course',ADD COLUMN slug TEXT DEFAULT 'course';
    ALTER TABLE coupons ADD COLUMN description TEXT,ADD COLUMN created_by INTEGER REFERENCES users(id);`);
  await db.exec(migration('069_video_commerce_admin.sql'));
  service=createVideoPaymentService({db,gateway,now:()=>clock,salesEnabled:()=>enabled,
    recalculateVip:async(id,client)=>{if(failVip)throw new Error('Simulated VIP failure');return User.recalculateVipSummary(id,client);},
    sendEmail:async value=>{if(emailFailure)throw new Error('Email failed');sent.push(value);return {sent:true};},
  });
  admin=createVideoAdminService({db,repository:createVideoCommerceRepository(db),payments:service,
    recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),salesEnabled:()=>enabled});
  couponAdmin=createVideoCouponAdminService({db,admin});
  app=express();app.use(express.json());
  app.use('/payments',createVideoPaymentRoutes({service,authenticate:(req,res,next)=>{
    if(!req.headers['x-test-user'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user'])};next();
  },authorizePermission:permission=>(req,res,next)=>{
    assert.equal(permission,'users.manage');
    if(req.headers['x-test-admin']!=='true')return res.sendStatus(403);next();
  }}));
  app.use('/commerce',createVideoShopRoutes({service:admin,coupons:couponAdmin,
    authenticate:(req,res,next)=>{if(!req.headers['x-test-user'])return res.sendStatus(401);req.user={id:Number(req.headers['x-test-user'])};next();},
    authorizePermission:permission=>(req,res,next)=>{assert.equal(permission,'users.manage');if(req.headers['x-test-admin']!=='true')return res.sendStatus(403);next();}}));
});
after(async()=>{if(db)await db.close();});
async function user(coins=1000){return (await db.query("INSERT INTO users(email,full_name,username,coins) VALUES ('test@example.invalid','Test','test',$1) RETURNING id",[coins])).rows[0].id;}
async function product({type='video',price=100000,mode='unconfigured',choice=false}={}){
  const video=(await db.query(`INSERT INTO video_packages(name,status,price_vnd,duration_mode,duration_days,allowed_subjects,requires_subject_choice,renewal_mode)
    VALUES ('Video Math','active',$1,'days',90,$2,$3,$4) RETURNING id`,[price,choice?['MATH','PHYSICS']:['MATH'],choice,mode])).rows[0];
  await db.query('INSERT INTO video_package_courses(video_package_id,course_id) VALUES ($1,1)',[video.id]);
  if(choice)await db.query('INSERT INTO video_package_courses(video_package_id,course_id) VALUES ($1,2)',[video.id]);
  if(type==='video')return {type,productId:Number(video.id)};
  const combo=(await db.query(`INSERT INTO combo_packages(name,status,price_vnd,vip_package_id,video_package_id,vip_duration_days,renewal_mode)
    VALUES ('Combo Math','active',$1,1,$2,90,$3) RETURNING id`,[price,video.id,mode])).rows[0];
  return {type,productId:Number(combo.id)};
}
async function coupon({discount=10,type='percentage',uses=null,limit=1,scope=true}={}){
  const row=(await db.query(`INSERT INTO coupons(code,discount_type,discount_value,max_uses,user_limit)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`,[`TEST${++serial}`,type,discount,uses,limit])).rows[0];
  if(scope)await db.query("INSERT INTO video_coupon_scopes(coupon_id,product_type) VALUES ($1,'video'),($1,'combo')",[row.id]);return row;
}
async function order(uid,choice,overrides={}){
  const quote=await service.quote(uid,choice);
  return service.createOrder(uid,{...choice,quoteHash:quote.quoteHash,idempotencyKey:`request_${++serial}`,...overrides});
}
async function row(code){return (await db.query('SELECT * FROM transactions WHERE transaction_code=$1',[code])).rows[0];}
async function pay(created,extra={}){const transaction=await row(created.orderId);return service.acceptPayment(transaction.id,{provider:'payos',orderCode:transaction.id,amount:Number(transaction.amount),reference:`ref:${transaction.id}`,...extra});}
async function count(table,uid){return Number((await db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=$1`,[uid])).rows[0].n);}

test('payment migration reruns, preserves legacy catalog and permits zero-amount orders',async()=>{
  await db.exec(migration('068_video_commerce_payments.sql'));
  const vip=(await db.query('SELECT price,duration_days FROM vip_packages WHERE id=1')).rows[0];
  assert.deepEqual(vip,{price:90000,duration_days:90});
  const uid=await user();
  await assert.rejects(db.query("INSERT INTO transactions(user_id,amount,package_duration) VALUES ($1,-1,0)",[uid]),{code:'23514'});
});
test('quote computes voucher then capped coins on server and ignores client price',async()=>{
  const uid=await user(),p=await product(),c=await coupon();
  const quote=await service.quote(uid,{...p,couponCode:c.code,useCoins:true,amount:1,priceVnd:1});
  assert.equal(quote.originalAmount,100000);assert.equal(quote.couponDiscountAmount,10000);
  assert.equal(quote.coinsUsed,180);assert.equal(quote.amount,72000);
  assert.equal(await count('transactions',uid),0);
});
test('voucher remains legacy-only unless explicitly scoped for video/combo',async()=>{
  const uid=await user(),p=await product(),c=await coupon({scope:false});
  await assert.rejects(service.quote(uid,{...p,couponCode:c.code}),{code:'COUPON_SCOPE_MISMATCH'});
});
test('voucher checks expiry, minimum, selected product and per-user limits',async()=>{
  const uid=await user(),p=await product(),c=await coupon();
  await db.query("UPDATE coupons SET valid_until=NOW()-INTERVAL '1 day' WHERE id=$1",[c.id]);
  await assert.rejects(service.quote(uid,{...p,couponCode:c.code}),{code:'COUPON_INVALID'});
  await db.query('UPDATE coupons SET valid_until=NULL,min_order_amount=200000 WHERE id=$1',[c.id]);
  await assert.rejects(service.quote(uid,{...p,couponCode:c.code}),{code:'COUPON_MINIMUM'});
  await db.query('UPDATE coupons SET min_order_amount=0 WHERE id=$1',[c.id]);
  await db.query("UPDATE video_coupon_scopes SET product_ids=ARRAY[99999]::bigint[] WHERE coupon_id=$1",[c.id]);
  await assert.rejects(service.quote(uid,{...p,couponCode:c.code}),{code:'COUPON_SCOPE_MISMATCH'});
});
test('subject choice determines price and grants only the selected course',async()=>{
  const uid=await user(),p=await product({choice:true});
  await db.query(`UPDATE video_packages SET subject_prices='{"PHYSICS":50000}'::jsonb WHERE id=$1`,[p.productId]);
  await assert.rejects(service.quote(uid,p),{code:'SUBJECT_REQUIRED'});
  const quote=await service.quote(uid,{...p,selectedSubjectCode:'PHYSICS'});
  assert.equal(quote.originalAmount,50000);assert.deepEqual(quote.video.courseIds,[2]);
  assert.deepEqual(quote.video.subjects,['PHYSICS']);
});
test('draft, unready courses, unsupported methods and invalid configuration fail closed',async()=>{
  const uid=await user(),p=await product();
  await assert.rejects(service.quote(uid,{...p,paymentMethod:'momo'}),{code:'PAYMENT_METHOD_UNSUPPORTED'});
  await db.query("UPDATE video_packages SET status='draft',price_vnd=NULL WHERE id=$1",[p.productId]);
  await assert.rejects(service.quote(uid,p),{code:'PRODUCT_NOT_AVAILABLE'});
  const active=await product();
  await db.query('INSERT INTO video_package_courses(video_package_id,course_id) VALUES ($1,3)',[active.productId]);
  await assert.rejects(service.quote(uid,active),{code:'COURSES_NOT_READY'});
});
test('price changed after quote requires review instead of creating different amount',async()=>{
  const uid=await user(),p=await product(),q=await service.quote(uid,p);
  await db.query('UPDATE video_packages SET price_vnd=price_vnd+10000 WHERE id=$1',[p.productId]);
  await assert.rejects(service.createOrder(uid,{...p,quoteHash:q.quoteHash,idempotencyKey:'changed_price'}),{code:'QUOTE_CHANGED'});
  assert.equal(await count('transactions',uid),0);
});
test('video-only payment atomically grants video without modifying VIP',async()=>{
  const uid=await user(),p=await product(),before=(await db.query('SELECT * FROM users WHERE id=$1',[uid])).rows[0];
  const created=await order(uid,p),paid=await pay(created);
  assert.equal(paid.status,'completed');assert.ok(paid.rights.videoEntitlementId);assert.equal(paid.rights.vipEntitlementId,null);
  assert.equal(await count('user_video_entitlements',uid),1);assert.equal(await count('user_vip_entitlements',uid),0);
  assert.deepEqual((await db.query('SELECT * FROM users WHERE id=$1',[uid])).rows[0],before);
});
test('combo grants both components from immutable snapshot after catalog edits',async()=>{
  const uid=await user(),p=await product({type:'combo'}),created=await order(uid,p);
  const replacement=await product();
  await db.query('UPDATE combo_packages SET price_vnd=1,video_package_id=$2 WHERE id=$1',[p.productId,replacement.productId]);
  const paid=await pay(created);assert.equal(paid.status,'completed');
  assert.equal(paid.snapshot.originalAmount,100000);assert.ok(paid.rights.vipEntitlementId);
  assert.equal(await count('user_video_entitlements',uid),1);assert.equal(await count('user_vip_entitlements',uid),1);
  const profile=(await db.query('SELECT is_vip,vip_allowed_subjects FROM users WHERE id=$1',[uid])).rows[0];
  assert.equal(profile.is_vip,true);assert.deepEqual(profile.vip_allowed_subjects,['MATH']);
});
test('mid-combo DB failure rolls back rights, coupon and coins; retry completes once',async()=>{
  const uid=await user(),p=await product({type:'combo'}),c=await coupon();
  const created=await order(uid,{...p,couponCode:c.code,useCoins:true});
  failVip=true;await assert.rejects(pay(created),/Simulated VIP failure/);failVip=false;
  assert.equal(await count('user_video_entitlements',uid),0);assert.equal(await count('user_vip_entitlements',uid),0);
  assert.equal(await count('coupon_usages',uid),0);assert.equal(await count('coin_ledger',uid),0);
  const failed=await service.status(uid,created.orderId,{reconcile:false});assert.equal(failed.status,'completed');
  assert.equal(await count('user_video_entitlements',uid),1);assert.equal(await count('coupon_usages',uid),1);
  assert.equal(await count('coin_ledger',uid),1);
});
test('concurrent webhook retries do not duplicate rights, coupons, coins or email',async()=>{
  const uid=await user(),p=await product(),c=await coupon(),created=await order(uid,{...p,couponCode:c.code,useCoins:true});
  await Promise.all([pay(created),pay(created),pay(created)]);
  assert.equal(await count('user_video_entitlements',uid),1);assert.equal(await count('coupon_usages',uid),1);assert.equal(await count('coin_ledger',uid),1);
  assert.equal(sent.filter(value=>value.order.orderId===created.orderId).length,1);
});
test('concurrent creates with same key return the same order; changed request conflicts',async()=>{
  const uid=await user(),p=await product(),q=await service.quote(uid,p),input={...p,quoteHash:q.quoteHash,idempotencyKey:'same_request_key'};
  const [a,b]=await Promise.all([service.createOrder(uid,input),service.createOrder(uid,input)]);
  assert.equal(a.orderId,b.orderId);assert.equal(await count('transactions',uid),1);
  await assert.rejects(service.createOrder(uid,{...input,coinsToUse:1}),{code:'IDEMPOTENCY_CONFLICT'});
});
test('wrong provider, amount, currency and identity never record payment or grant rights',async()=>{
  const uid=await user(),created=await order(uid,await product());
  for(const extra of [{provider:'momo'},{amount:1},{amount:200000},{currency:'USD'},{orderCode:999999}])await assert.rejects(pay(created,extra),{code:'PAYMENT_MISMATCH'});
  assert.equal(await count('user_video_entitlements',uid),0);
  assert.equal((await service.status(uid,created.orderId,{reconcile:false})).status,'pending');
});
test('100 percent voucher completes without creating provider link',async()=>{
  const uid=await user(),p=await product(),c=await coupon({discount:100}),before=payments.size;
  const created=await order(uid,{...p,couponCode:c.code});assert.equal(created.status,'completed');assert.equal(created.amount,0);
  assert.equal(payments.size,before);assert.equal(await count('coupon_usages',uid),1);
});
test('new sales switch blocks new orders but existing callbacks and same-key retries work',async()=>{
  const uid=await user(),p=await product(),q=await service.quote(uid,p),input={...p,quoteHash:q.quoteHash,idempotencyKey:'sales_switch_key'};
  const created=await service.createOrder(uid,input);enabled=false;
  assert.equal((await service.createOrder(uid,input)).orderId,created.orderId);
  await assert.rejects(service.createOrder(uid,{...input,idempotencyKey:'another_switch_key'}),{code:'VIDEO_SALES_DISABLED'});
  assert.equal((await pay(created)).status,'completed');enabled=true;
});
test('last coupon use is reserved across users and legacy pending orders',async()=>{
  const a=await user(),b=await user(),p=await product(),c=await coupon({uses:1});
  const input={...p,couponCode:c.code},qa=await service.quote(a,input),qb=await service.quote(b,input);
  const outcomes=await Promise.allSettled([
    service.createOrder(a,{...input,quoteHash:qa.quoteHash,idempotencyKey:'last_use_user_a'}),
    service.createOrder(b,{...input,quoteHash:qb.quoteHash,idempotencyKey:'last_use_user_b'}),
  ]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'COUPON_LIMIT_REACHED');
  await assert.rejects(db.transaction(client=>lockCoupon(client,{code:c.code,userId:b})),{code:'COUPON_LIMIT_REACHED'});
});
test('legacy pending voucher counts toward video per-user and total limits',async()=>{
  const uid=await user(),p=await product(),c=await coupon({uses:1});
  await db.query(`INSERT INTO transactions(user_id,amount,package_duration,status,raw_response) VALUES ($1,10000,90,'pending',$2::jsonb)`,[uid,JSON.stringify({couponCode:c.code})]);
  await assert.rejects(service.quote(uid,{...p,couponCode:c.code}),{code:'COUPON_LIMIT_REACHED'});
});
test('shared coupon consumption is idempotent for a reserved legacy order',async()=>{
  const uid=await user(),c=await coupon();
  const legacy=(await db.query(`INSERT INTO transactions(user_id,amount,package_duration,status,raw_response)
    VALUES ($1,90000,90,'pending',$2::jsonb) RETURNING *`,[uid,JSON.stringify({couponCode:c.code,couponDiscountAmount:10000,originalAmount:100000})])).rows[0];
  await db.transaction(client=>consumeCoupon(client,legacy));await db.transaction(client=>consumeCoupon(client,legacy));
  assert.equal(await count('coupon_usages',uid),1);assert.equal((await db.query('SELECT used_count FROM coupons WHERE id=$1',[c.id])).rows[0].used_count,1);
});
test('legacy coin reservations reduce available coins for new orders',async()=>{
  const uid=await user(200),p=await product();
  await db.query(`INSERT INTO transactions(user_id,amount,package_duration,status,raw_response) VALUES ($1,10000,90,'pending','{"coinsUsed":150}')`,[uid]);
  const quote=await service.quote(uid,{...p,useCoins:true});assert.equal(quote.coinsUsed,50);
});
test('cancellation releases reservations only after provider confirmation',async()=>{
  const uid=await user(200),p=await product(),c=await coupon({uses:1}),created=await order(uid,{...p,useCoins:true,couponCode:c.code});
  assert.equal((await service.quote(uid,{...p,useCoins:true})).coinsUsed,20);
  assert.equal((await service.cancel(uid,created.orderId)).status,'cancelled');
  assert.equal((await service.quote(uid,{...p,useCoins:true,couponCode:c.code})).coinsUsed,180);
});
test('late paid event after cancellation still grants snapshot when resources are available',async()=>{
  const uid=await user(),created=await order(uid,await product());await service.cancel(uid,created.orderId);
  assert.equal((await pay(created)).status,'completed');
});
test('late paid event with insufficient coins is recorded for review; retry can recover',async()=>{
  const uid=await user(200),created=await order(uid,{...await product(),useCoins:true});await service.cancel(uid,created.orderId);
  await db.query('UPDATE users SET coins=0 WHERE id=$1',[uid]);
  const result=await pay(created);assert.equal(result.status,'awaiting_fulfillment');assert.equal(result.fulfillmentError,'INSUFFICIENT_COINS');
  assert.equal(await count('user_video_entitlements',uid),0);
  await db.query('UPDATE users SET coins=200 WHERE id=$1',[uid]);
  assert.equal((await service.quote(uid,{...await product(),useCoins:true})).coinsUsed,0);
  assert.equal((await service.status(uid,created.orderId,{reconcile:false})).status,'completed');
});
test('provider creation timeout resumes same order without losing reservation',async()=>{
  const original=gateway.create,uid=await user(),p=await product(),q=await service.quote(uid,p);
  gateway.create=async row=>{await original.call(gateway,row);throw new Error('Timeout after accepted');};
  const created=await service.createOrder(uid,{...p,quoteHash:q.quoteHash,idempotencyKey:'timeout_recovery_key'});gateway.create=original;
  assert.equal(created.status,'pending');assert.equal(await count('transactions',uid),1);
});
test('provider outage does not mark uncertain order failed or release coins',async()=>{
  const originalCreate=gateway.create,originalGet=gateway.get,uid=await user(),p=await product(),q=await service.quote(uid,{...p,useCoins:true});
  gateway.create=async()=>{throw new Error('Network error');};gateway.get=async()=>{throw new Error('Network error');};
  const input={...p,useCoins:true,quoteHash:q.quoteHash,idempotencyKey:'uncertain_provider_key'};
  await assert.rejects(service.createOrder(uid,input),{code:'PAYMENT_RECONCILIATION_REQUIRED'});
  assert.equal(await count('transactions',uid),1);assert.equal((await service.quote(uid,{...p,useCoins:true})).coinsUsed,200);
  gateway.create=originalCreate;gateway.get=originalGet;
  assert.equal((await service.createOrder(uid,input)).status,'pending');
});
test('provider status reconciliation grants verified paid order; return query alone cannot',async()=>{
  const uid=await user(),created=await order(uid,await product()),transaction=await row(created.orderId);
  assert.equal((await service.status(uid,created.orderId)).status,'pending');
  Object.assign(payments.get(transaction.id),{status:'PAID',amountPaid:Number(transaction.amount)});
  assert.equal((await service.status(uid,created.orderId)).status,'completed');
});
test('email failures remain retryable without rolling back or granting twice',async()=>{
  const uid=await user(),created=await order(uid,await product());emailFailure=true;
  assert.equal((await pay(created)).status,'completed');emailFailure=false;
  await service.status(uid,created.orderId,{reconcile:false});
  assert.equal(sent.filter(value=>value.order.orderId===created.orderId).length,1);assert.equal(await count('user_video_entitlements',uid),1);
});
test('unconfigured renewal policy blocks overlapping purchases; explicit extension adds days',async()=>{
  const uid=await user(),p=await product(),created=await order(uid,p),paid=await pay(created);
  await assert.rejects(service.quote(uid,p),{code:'RENEWAL_POLICY_REQUIRED'});
  await db.query("UPDATE video_packages SET renewal_mode='extend' WHERE id=$1",[p.productId]);
  const renewed=await pay(await order(uid,p));
  assert.equal(new Date(renewed.rights.videoExpiresAt)-new Date(paid.rights.videoExpiresAt),90*86400000);
});
test('combo does not shorten a permanent legacy premium membership',async()=>{
  const uid=await user(),p=await product({type:'combo',mode:'new_period'});
  await db.query("UPDATE users SET is_vip=TRUE,subscription_tier='premium',vip_expires_at=NULL,vip_allowed_subjects=ARRAY['*'] WHERE id=$1",[uid]);
  const paid=await pay(await order(uid,p));assert.equal(paid.status,'completed');
  const profile=(await db.query('SELECT subscription_tier,vip_expires_at,vip_allowed_subjects FROM users WHERE id=$1',[uid])).rows[0];
  assert.equal(profile.subscription_tier,'premium');assert.equal(profile.vip_expires_at,null);assert.deepEqual(profile.vip_allowed_subjects,['*']);
});
test('API ownership, authentication, history and cancellation never reveal other orders',async()=>{
  const uid=await user(),other=await user(),created=await order(uid,await product());
  assert.equal((await request(app).get('/payments/orders')).status,401);
  assert.equal((await request(app).get(`/payments/orders/${created.orderId}`).set('x-test-user',String(other))).status,404);
  assert.equal((await request(app).post(`/payments/orders/${created.orderId}/cancel`).set('x-test-user',String(other))).status,404);
  const history=await request(app).get('/payments/orders').set('x-test-user',String(uid));
  assert.equal(history.status,200);assert.equal(history.body.data.items[0].orderId,created.orderId);
  assert.equal(history.headers['cache-control'],'no-store');
});
test('product identity distinguishes new orders without assuming package_id or VIP name',()=>{
  assert.equal(isVideoPayment({package_id:null,package_name:'Premium'}),false);
  assert.equal(isVideoPayment({raw_response:{commerceType:'video'}}),true);
  assert.equal(isVideoPayment({raw_response:'{"commerceType":"combo"}'}),true);
});

test('renamed or disabled voucher preserves a pending order snapshot; voucher cannot be deleted',async()=>{
  const uid=await user(),p=await product(),c=await coupon(),created=await order(uid,{...p,couponCode:c.code});
  await db.query('UPDATE coupons SET code=$2,is_active=FALSE,discount_value=1 WHERE id=$1',[c.id,`RENAMED${c.id}`]);
  await assert.rejects(db.query('DELETE FROM coupons WHERE id=$1',[c.id]),{code:'23001'});
  const result=await pay(created);assert.equal(result.status,'completed');assert.equal(result.snapshot.couponDiscountAmount,10000);
});
test('partial payment cannot release reservation via cancellation or grant rights',async()=>{
  const uid=await user(),created=await order(uid,await product()),transaction=await row(created.orderId);
  Object.assign(payments.get(transaction.id),{status:'UNDERPAID',amountPaid:1000});
  assert.equal((await service.status(uid,created.orderId)).status,'payment_review');
  await assert.rejects(service.cancel(uid,created.orderId),{code:'PARTIAL_PAYMENT_REVIEW'});
  assert.equal(await count('user_video_entitlements',uid),0);
});
test('admin can scope a voucher and configure renewal without changing legacy package',async()=>{
  const uid=await user(),p=await product(),c=await coupon({scope:false});
  await service.setCouponScopes(c.id,[{type:'video',productIds:[p.productId]}],uid);
  assert.deepEqual(await service.couponScopes(c.id),[{type:'video',productIds:[p.productId]}]);
  assert.equal((await service.quote(uid,{...p,couponCode:c.code})).couponDiscountAmount,10000);
  const config=await service.configureProduct('video',p.productId,{renewalMode:'extend',subjectPrices:{MATH:80000}},uid);
  assert.equal(config.renewalMode,'extend');
  await assert.rejects(service.configureProduct('video',p.productId,{subjectPrices:{PHYSICS:100}},uid),{code:'INVALID_SUBJECT_PRICES'});
  assert.equal((await db.query('SELECT price FROM vip_packages WHERE id=1')).rows[0].price,90000);
});
test('maintenance retries a completed order email without new rights',async()=>{
  const uid=await user(),created=await order(uid,await product());emailFailure=true;await pay(created);emailFailure=false;
  await service.maintenance(100);assert.equal(sent.filter(value=>value.order.orderId===created.orderId).length,1);
  assert.equal(await count('user_video_entitlements',uid),1);
});

test('HTTP quote and order flow requires a server quote and returns the stored snapshot',async()=>{
  const uid=await user(),p=await product();
  const quote=await request(app).post('/payments/quote').set('x-test-user',String(uid)).send(p);
  assert.equal(quote.status,200);
  const created=await request(app).post('/payments/orders').set('x-test-user',String(uid))
    .send({...p,quoteHash:quote.body.data.quoteHash,idempotencyKey:'http_checkout_request'});
  assert.equal(created.status,201);assert.equal(created.body.data.amount,100000);
  const invalid=await request(app).post('/payments/orders').set('x-test-user',String(uid)).send({...p,idempotencyKey:'missing_quote_request'});
  assert.equal(invalid.status,422);
});

test('admin HTTP endpoints require permission before reads or writes',async()=>{
  const uid=await user(),p=await product(),c=await coupon({scope:false});
  for(const method of ['get','put']){
    const denied=await request(app)[method](`/payments/admin/coupons/${c.id}/scopes`).set('x-test-user',String(uid)).send({scopes:[]});
    assert.equal(denied.status,403);
  }
  const denied=await request(app).patch(`/payments/admin/products/video/${p.productId}/config`).set('x-test-user',String(uid)).send({renewalMode:'extend'});
  assert.equal(denied.status,403);
  const allowed=await request(app).put(`/payments/admin/coupons/${c.id}/scopes`).set('x-test-user',String(uid)).set('x-test-admin','true')
    .send({scopes:[{type:'video',productIds:[p.productId]}]});
  assert.equal(allowed.status,200);assert.deepEqual(allowed.body.data,[{type:'video',productIds:[p.productId]}]);
});

test('a consumed legacy coupon is not counted again as a pending reservation',async()=>{
  const uid=await user(),other=await user(),c=await coupon({uses:2});
  const legacy=(await db.query(`INSERT INTO transactions(user_id,amount,package_duration,status,raw_response)
    VALUES ($1,90000,90,'pending',$2::jsonb) RETURNING *`,[uid,JSON.stringify({couponId:c.id,couponCode:c.code,couponDiscountAmount:10000,originalAmount:100000})])).rows[0];
  await db.transaction(client=>consumeCoupon(client,legacy));
  assert.equal((await service.quote(other,{...await product(),couponCode:c.code})).couponDiscountAmount,10000);
});

test('stale provider cancellation cannot release recorded partial-payment reservations',async()=>{
  const uid=await user(200),p=await product(),created=await order(uid,{...p,useCoins:true}),transaction=await row(created.orderId);
  Object.assign(payments.get(transaction.id),{status:'UNDERPAID',amountPaid:1000});
  await service.status(uid,created.orderId);
  Object.assign(payments.get(transaction.id),{status:'CANCELLED',amountPaid:0});
  assert.equal((await service.status(uid,created.orderId)).status,'payment_review');
  assert.equal((await service.quote(uid,{...p,useCoins:true})).coinsUsed,0);
});

test('maintenance rotates checked orders so an unresolved older order cannot starve the next',async()=>{
  const uid=await user(),a=await order(uid,await product()),b=await order(uid,await product());
  await db.query('UPDATE video_commerce_orders SET last_checked_at=NOW()');
  await db.query('UPDATE video_commerce_orders SET last_checked_at=NULL WHERE transaction_id=ANY($1::int[])',[[ (await row(a.orderId)).id,(await row(b.orderId)).id ]]);
  assert.equal((await service.maintenance(1))[0].orderId,a.orderId);
  assert.equal((await service.maintenance(1))[0].orderId,b.orderId);
});

test('extension of lifetime rights is rejected at quote before collecting payment',async()=>{
  const uid=await user(),p=await product({mode:'extend'}),created=await order(uid,p);
  await pay(created);
  await db.query("UPDATE user_video_entitlements SET expires_at=NULL,duration_mode='lifetime' WHERE user_id=$1",[uid]);
  await assert.rejects(service.quote(uid,p),{code:'LIFETIME_ALREADY_OWNED'});
  assert.equal(await count('transactions',uid),1);
});

test('admin migration is repeatable and backfills payment source linkage',async()=>{
  const uid=await user(),created=await order(uid,await product({type:'combo'})),paid=await pay(created);
  await db.exec(migration('069_video_commerce_admin.sql'));await db.exec(migration('069_video_commerce_admin.sql'));
  const right=(await db.query('SELECT vip_entitlement_id,snapshot FROM user_video_entitlements WHERE id=$1',[paid.rights.videoEntitlementId])).rows[0];
  assert.equal(right.vip_entitlement_id,paid.rights.vipEntitlementId);assert.equal(right.snapshot.name,paid.snapshot.name);
});

test('admin saves unpriced drafts, rejects invalid publishing, then publishes complete products',async()=>{
  const actor=await user();
  const draft=await admin.saveProduct('video',null,{name:'Admin draft'},actor);
  assert.equal(draft.priceVnd,null);assert.equal(draft.status,'draft');assert.equal(draft.canPurchase,false);
  await assert.rejects(admin.saveProduct('video',draft.id,{status:'active'},actor),{code:'PRODUCT_NOT_CONFIGURED'});
  const active=await admin.saveProduct('video',draft.id,{status:'active',priceVnd:150000,durationMode:'days',durationDays:60,allowedSubjects:['MATH'],courseIds:[1]},actor);
  assert.equal(active.canPurchase,true);assert.equal(active.courses[0].title,'Course');
  assert.equal((await admin.product('video',draft.id)).status,'active');
});

test('admin publish rejects unpublished or missing subject courses atomically',async()=>{
  const actor=await user(),draft=await admin.saveProduct('video',null,{name:'Unready',priceVnd:10,durationMode:'days',durationDays:30,allowedSubjects:['MATH'],courseIds:[3]},actor);
  await assert.rejects(admin.saveProduct('video',draft.id,{status:'active'},actor),{code:'COURSES_NOT_READY'});
  assert.equal((await db.query('SELECT status FROM video_packages WHERE id=$1',[draft.id])).rows[0].status,'draft');
  await assert.rejects(admin.saveProduct('video',draft.id,{courseIds:[2]},actor),{code:'COURSE_SUBJECT_MISMATCH'});
});

test('admin edits live catalog without changing purchased course snapshot',async()=>{
  const actor=await user(),uid=await user(),p=await product(),paid=await pay(await order(uid,p));
  await admin.saveProduct('video',p.productId,{name:'Revised Math',status:'archived',courseIds:[]},actor);
  const right=(await admin.rights({},uid)).items[0];assert.deepEqual(right.courseIds,[1]);assert.equal(right.name,paid.snapshot.name);
  await assert.rejects(admin.product('video',p.productId),{code:'PRODUCT_NOT_AVAILABLE'});
});

function manualInput(uid,p,extra={}){return {userId:uid,...p,videoExpiresAt:new Date(Date.now()+86400000*30).toISOString(),vipExpiresAt:p.type==='combo'?new Date(Date.now()+86400000*45).toISOString():null,reason:'Customer support grant',requestKey:`manual_test_${++serial}`,...extra};}

test('manual video grant is replay safe and creates no VIP, coins or revenue',async()=>{
  const actor=await user(),uid=await user(),p=await product(),input=manualInput(uid,p);
  const a=await admin.grant(input,actor),b=await admin.grant(input,actor);
  assert.equal(a.id,b.id);assert.equal(await count('user_video_entitlements',uid),1);assert.equal(await count('user_vip_entitlements',uid),0);
  assert.equal(await count('transactions',uid),0);assert.equal(await count('coin_ledger',uid),0);
  await assert.rejects(admin.grant({...input,reason:'Changed purpose'},actor),{code:'IDEMPOTENCY_CONFLICT'});
});

test('manual grant requires explicit expiry or lifetime, reason, valid user and selected subject',async()=>{
  const actor=await user(),uid=await user(),p=await product({choice:true}),input=manualInput(uid,p);
  await assert.rejects(admin.grant(input,actor),{code:'SUBJECT_REQUIRED'});
  await assert.rejects(admin.grant({...input,selectedSubjectCode:'MATH',videoExpiresAt:undefined},actor),{code:'INVALID_EXPIRY'});
  await assert.rejects(admin.grant({...input,reason:''},actor),{code:'REASON_REQUIRED'});
  const result=await admin.grant({...input,selectedSubjectCode:'PHYSICS',videoExpiresAt:null},actor);
  const right=(await admin.rights({},uid)).items[0];assert.equal(right.id,result.id);assert.equal(right.expiresAt,null);assert.deepEqual(right.courseIds,[2]);
});

test('manual combo revoke affects only its two source entitlements; repeat is safe',async()=>{
  const actor=await user(),uid=await user(),p=await product({type:'combo'});
  const independent=await pay(await order(uid,await product({type:'combo',mode:'new_period'})));
  const manual=await admin.grant(manualInput(uid,p),actor);
  assert.equal(await count('user_vip_entitlements',uid),2);
  await admin.revoke(manual.id,{reason:'Incorrect assignment'},actor);await admin.revoke(manual.id,{reason:'Retry request'},actor);
  const rows=(await db.query('SELECT id,is_active FROM user_vip_entitlements WHERE user_id=$1',[uid])).rows;
  assert.equal(rows.filter(r=>r.is_active).length,1);assert.equal(rows.find(r=>r.is_active).id,independent.rights.vipEntitlementId);
  assert.equal((await db.query('SELECT is_vip FROM users WHERE id=$1',[uid])).rows[0].is_vip,true);
});

test('revoking paid combo retains profile-only permanent legacy rights',async()=>{
  const actor=await user(),uid=await user();
  await db.query("UPDATE users SET is_vip=TRUE,subscription_tier='premium',vip_expires_at=NULL,vip_allowed_subjects=ARRAY['*'] WHERE id=$1",[uid]);
  const paid=await pay(await order(uid,await product({type:'combo',mode:'new_period'})));
  await admin.revoke(paid.rights.videoEntitlementId,{reason:'Revoke this purchase only'},actor);
  const profile=(await db.query('SELECT is_vip,subscription_tier,vip_expires_at FROM users WHERE id=$1',[uid])).rows[0];
  assert.deepEqual(profile,{is_vip:true,subscription_tier:'premium',vip_expires_at:null});
});

test('manual combo failure rolls back its VIP and video writes',async()=>{
  const actor=await user(),uid=await user(),bad=createVideoAdminService({db,repository:createVideoCommerceRepository(db),payments:service,recalculateVip:async()=>{throw new Error('Summary failed');}});
  await assert.rejects(bad.grant(manualInput(uid,await product({type:'combo'})),actor),/Summary failed/);
  assert.equal(await count('user_vip_entitlements',uid),0);assert.equal(await count('user_video_entitlements',uid),0);
});

test('video-only voucher is excluded by legacy tier and honored by scoped new quote',async()=>{
  const actor=await user(),uid=await user(),p=await product();
  const code=`VIDEOONLY${++serial}`;
  const c=await couponAdmin.save(null,{code,discount_type:'percentage',discount_value:25,scopes:[{type:'video',productIds:[p.productId]}]},actor);
  const saved=(await db.query('SELECT * FROM coupons WHERE id=$1',[c.id])).rows[0];
  assert.deepEqual(saved.applicable_tiers,['video_only']);assert.equal(saved.applicable_tiers.includes('vip'),false);assert.equal(saved.applicable_tiers.includes('premium'),false);
  assert.equal((await service.quote(uid,{...p,couponCode:code})).couponDiscountAmount,25000);
  await assert.rejects(service.quote(uid,{...await product({type:'combo'}),couponCode:code}),{code:'COUPON_SCOPE_MISMATCH'});
  await assert.rejects(couponAdmin.save((await coupon()).id,{code:'RENAMEOLD',discount_type:'fixed',discount_value:10,scopes:[]},actor),{code:'LEGACY_COUPON_READ_ONLY'});
});

test('voucher edits and promotions validate scope, dates and invalid values',async()=>{
  const actor=await user();
  await assert.rejects(couponAdmin.save(null,{code:'BAD',discount_type:'percentage',discount_value:101,scopes:[]},actor),{code:'INVALID_COUPON'});
  const c=await coupon({scope:false});
  await assert.rejects(couponAdmin.savePromotion('video',{title:'Offer',content:'Details',coupon_id:c.id,is_active:true},actor),{code:'COUPON_SCOPE_MISMATCH'});
  const good=await coupon();await couponAdmin.savePromotion('video',{title:'Offer',content:'Details',coupon_id:good.id,is_active:true},actor);
  assert.equal((await couponAdmin.promotion('video')).coupon_code,good.code);
  await db.query('UPDATE coupons SET is_active=FALSE WHERE id=$1',[good.id]);assert.equal(await couponAdmin.promotion('video'),null);
});

test('shop HTTP routes protect admin mutations and keep learner rights private',async()=>{
  const uid=await user(),other=await user(),p=await product();await admin.grant(manualInput(uid,p),other);
  assert.equal((await request(app).get('/commerce/manage/stats')).status,401);
  assert.equal((await request(app).post('/commerce/manage/grants').set('x-test-user',String(uid)).send(manualInput(uid,p))).status,403);
  assert.equal((await request(app).get('/commerce/manage/events').set('x-test-user',String(uid))).status,403);
  const own=await request(app).get('/commerce/me/rights?userId='+uid).set('x-test-user',String(other));
  assert.equal(own.status,200);assert.equal(own.body.data.items.length,0);
  assert.equal((await request(app).get('/commerce/shop/catalog/video')).status,200);
  const stats=await request(app).get('/commerce/manage/stats').set('x-test-user',String(other)).set('x-test-admin','true');
  assert.equal(stats.status,200);
});

test('manual notification failure keeps granted rights and retries without duplicate grant',async()=>{
  const actor=await user(),uid=await user(),input=manualInput(uid,await product());let broken=true;const notifications=[];
  const notifying=createVideoAdminService({db,repository:createVideoCommerceRepository(db),payments:service,
    recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),sendRightsEmail:async data=>{if(broken)throw new Error('Mail offline');notifications.push(data);return {sent:true};}});
  const result=await notifying.grant(input,actor);assert.equal(await count('user_video_entitlements',uid),1);
  assert.equal((await db.query('SELECT sent_at FROM video_rights_outbox WHERE event_key=$1',[`grant:${result.id}`])).rows[0].sent_at,null);
  broken=false;await notifying.grant(input,actor);await notifying.grant(input,actor);
  assert.equal(notifications.length,1);assert.equal(notifications[0].action,'granted');
  await notifying.revoke(result.id,{reason:'Revoke for test'},actor);await notifying.revoke(result.id,{reason:'Retry revoke'},actor);
  assert.equal(notifications.length,2);assert.equal(notifications[1].action,'revoked');assert.equal(await count('user_video_entitlements',uid),1);
});

test('payment QR is generated locally and only available to the order owner',async()=>{
  const uid=await user(),other=await user(),created=await order(uid,await product());
  const own=await request(app).get(`/payments/orders/${created.orderId}/qr`).set('x-test-user',String(uid));
  assert.equal(own.status,200);assert.match(own.body.data.dataUrl,/^data:image\/png;base64,/);
  assert.equal((await request(app).get(`/payments/orders/${created.orderId}/qr`).set('x-test-user',String(other))).status,404);
});
