const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const db = require('../src/config/database');
const course = require('../src/services/courseService');
const learning = require('../src/services/learningService');
const playback = require('../src/services/videoPlaybackSessionService');
const admin = require('../src/repositories/adminCourseRepository');
const { createBunnyMediaService, providerState } = require('../src/services/bunnyMediaService');
const migration = name => fs.readFileSync(path.join(__dirname,'../../database/migrations',name),'utf8');
let pg, service, asset, creates = 0, remoteStatus = 4, failCreate = false;
const user = { id: 1, role: 'user' }, actor = { id: 2 };
const guid = '11111111-1111-4111-8111-111111111111';
before(async () => {
  pg = new PGlite();
  db.query = (sql,params) => pg.query(sql,params);
  db.pool.connect = async () => ({ query: db.query, release() {} });
  process.env.CSCA_VIDEO_COMMERCE_ENABLED='true'; process.env.CSCA_BUNNY_STREAM_ENABLED='true';
  process.env.BUNNY_STREAM_LIBRARY_ID='123'; process.env.BUNNY_STREAM_TOKEN_KEY='test-only';
  await pg.exec(`CREATE TABLE users(id SERIAL PRIMARY KEY);
    CREATE TABLE materials(id SERIAL PRIMARY KEY);
    CREATE TABLE transactions(id SERIAL PRIMARY KEY);
    CREATE TABLE vip_packages(id SERIAL PRIMARY KEY,name TEXT,sort_order INT DEFAULT 0,is_active BOOLEAN DEFAULT true,allowed_subjects TEXT[],tier TEXT);
    CREATE TABLE user_vip_entitlements(id SERIAL PRIMARY KEY,user_id INT,package_id INT,allowed_subjects TEXT[],
      is_active BOOLEAN,starts_at TIMESTAMPTZ,expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
    INSERT INTO users VALUES(1),(2),(3); INSERT INTO vip_packages(id,name) VALUES(1,'legacy');`);
  for (const name of ['052_csca_courses_core.sql','053_csca_course_progress.sql','054_csca_video_assets.sql',
    '055_csca_course_package_access.sql','067_video_commerce_foundation.sql','070_bunny_learning.sql']) await pg.exec(migration(name));
  await pg.exec(`INSERT INTO courses(id,external_key,slug,title,subject_code,access_type,status)
    VALUES(1,'one','one','One','MATH','private','published'),(2,'two','two','Two','PHYSICS','private','published'),
    (3,'three','three','Three','MATH','package','published');
    INSERT INTO course_sections(id,course_id,title,is_published) VALUES(1,1,'One',true),(2,2,'Two',true);
    INSERT INTO course_lessons(id,external_key,course_id,section_id,slug,title,is_published,estimated_duration_seconds)
    VALUES(1,'one',1,1,'one','One',true,100),(2,'two',2,2,'two','Two',true,100);
    INSERT INTO video_packages(id,name) VALUES(1,'Video');
    INSERT INTO user_video_entitlements(id,user_id,video_package_id,grant_key,source,status,allowed_subjects,starts_at,duration_mode)
    VALUES(1,1,1,'manual:1','manual','active',ARRAY['MATH'],NOW()-INTERVAL '1 day','lifetime');
    INSERT INTO video_entitlement_courses VALUES(1,1),(1,2);
    INSERT INTO course_package_access(course_id,package_id) VALUES(3,1);
    INSERT INTO user_vip_entitlements(user_id,package_id,allowed_subjects,is_active,starts_at)
    VALUES(1,1,ARRAY['MATH'],true,NOW()-INTERVAL '1 day');
    INSERT INTO course_enrollments(user_id,course_id,source) VALUES(1,3,'package');`);
  service = createBunnyMediaService({ database: db, config: { libraryId:'123' },
    authorize: async (a,id) => { if (a.id !== 2 || Number(id)!==1) throw Object.assign(new Error('denied'),{status:403}); },
    adapter: { createTusAuthorization: () => ({ endpoint:'https://video.bunnycdn.com/tusupload',headers:{},expiresAt:'2099-01-01' }),
      createVideo: async () => { creates++; if (failCreate) throw Error('timeout'); return {guid}; },
      getVideo: async () => ({ guid,videoLibraryId:123,status:remoteStatus,length:123.25,thumbnailFileName:'thumbnail.jpg' }) } });
});
after(async()=>{ await pg?.close(); await db.pool.end(); });
test('migration reruns and legacy R2 readiness constraint remains',async()=>{
  await pg.exec(migration('070_bunny_learning.sql'));
  await assert.rejects(pg.query("INSERT INTO video_assets(external_key,course_id,status) VALUES('bad',1,'ready')"));
});
test('purchase snapshot grants matching subject, auto enrolls, legacy package list survives',async()=>{
  const items=await learning.listMyEnrollments(user);
  assert.deepEqual(items.map(x=>x.course.id).sort(),[1,3]);
  await course.requireLearningAccess(1,user);
  await assert.rejects(course.requireLearningAccess(2,user),{code:'ENROLLMENT_REQUIRED'});
  await assert.rejects(course.requireLearningAccess(1,{id:3}),{code:'ENROLLMENT_REQUIRED'});
});
test('revoked enrollment is never restored by purchase',async()=>{
  await pg.query("UPDATE course_enrollments SET status='revoked' WHERE user_id=1 AND course_id=1");
  await assert.rejects(course.requireLearningAccess(1,user),{code:'ENROLLMENT_REQUIRED'});
  await pg.query("UPDATE course_enrollments SET status='active' WHERE user_id=1 AND course_id=1");
});
test('renewal restores expired enrollment without dropping progress',async()=>{
  await learning.updateLessonProgress(1,{positionSeconds:17,watchedDeltaSeconds:5},user);
  await pg.query("UPDATE course_enrollments SET status='expired',starts_at=NOW()-INTERVAL '3 days',expires_at=NOW()-INTERVAL '1 day' WHERE user_id=1 AND course_id=1");
  await course.requireLearningAccess(1,user);
  const row=(await pg.query('SELECT last_position_seconds FROM lesson_progress WHERE user_id=1 AND lesson_id=1')).rows[0];
  assert.equal(row.last_position_seconds,17);
});
test('future and expired rights are denied independently of enrollment',async()=>{
  await pg.query("UPDATE user_video_entitlements SET starts_at=NOW()+INTERVAL '1 day' WHERE id=1");
  await assert.rejects(course.requireLearningAccess(1,user),{code:'ENTITLEMENT_EXPIRED'});
  await pg.query("UPDATE user_video_entitlements SET starts_at=NOW()-INTERVAL '3 days',duration_mode='days',expires_at=NOW()-INTERVAL '1 day' WHERE id=1");
  await assert.rejects(course.requireLearningAccess(1,user),{code:'ENTITLEMENT_EXPIRED'});
  await pg.query("UPDATE user_video_entitlements SET duration_mode='lifetime',expires_at=NULL WHERE id=1");
});
test('expiry/revoke denies lesson and playback; second valid source retains access',async()=>{
  await pg.query("UPDATE user_video_entitlements SET status='revoked',revoked_at=NOW() WHERE id=1");
  await assert.rejects(learning.updateLessonProgress(1,{positionSeconds:20},user),{code:'ENTITLEMENT_EXPIRED'});
  await assert.rejects(playback.createLessonPlaybackSession(1,user),{code:'ENTITLEMENT_EXPIRED'});
  await pg.exec(`INSERT INTO user_video_entitlements(id,user_id,video_package_id,grant_key,source,status,allowed_subjects,starts_at,duration_mode)
    VALUES(2,1,1,'manual:2','manual','active',ARRAY['MATH'],NOW()-INTERVAL '1 day','lifetime');
    INSERT INTO video_entitlement_courses SELECT id,1 FROM user_video_entitlements WHERE grant_key='manual:2';`);
  await course.requireLearningAccess(1,user);
});
test('upload repeated requests reuse provider asset; other admin cannot access it',async()=>{
  asset=await service.create({courseId:1,lessonId:1},actor);
  assert.equal((await service.create({courseId:1,lessonId:1},actor)).videoAssetId,asset.videoAssetId);
  assert.equal(creates,1);
  await assert.rejects(service.status(asset.videoAssetId,user),{status:403});
  await assert.rejects(service.create({courseId:1,lessonId:2},actor),{code:'BUNNY_LESSON_INVALID'});
});
test('provider sync controls readiness/duration and publishing supports Bunny',async()=>{
  remoteStatus=3;
  assert.equal((await service.sync(asset.videoAssetId,actor)).status,'processing');
  await assert.rejects(playback.createLessonPlaybackSession(1,user),{code:'VIDEO_NOT_READY'});
  remoteStatus=4;
  assert.equal((await service.sync(asset.videoAssetId,actor)).status,'ready');
  assert.equal((await pg.query('SELECT estimated_duration_seconds FROM course_lessons WHERE id=1')).rows[0].estimated_duration_seconds,124);
  assert.equal((await admin.getPublishReadiness(1)).invalid_video_lessons,0);
});
test('stale admin duration cannot overwrite provider duration',async()=>{
  const row=await admin.updateLesson(1,1,{estimatedDurationSeconds:0,title:'Updated'},db);
  assert.equal(row.estimated_duration_seconds,124);
});
test('signed Bunny playback returns scoped URL and stored resume; other lesson stays blocked',async()=>{
  await learning.updateLessonProgress(1,{positionSeconds:30,watchedDeltaSeconds:1},user);
  const result=await playback.createLessonPlaybackSession(1,user);
  assert.equal(result.deliveryType,'bunny'); assert.equal(result.resumePositionSeconds,30);
  assert.equal(result.viewerCode,'CSCA-1');
  assert.match(result.embedUrl,/\/embed\/123\/11111111/); assert.match(result.embedUrl,/token=/);
  await assert.rejects(playback.createLessonPlaybackSession(2,user),{code:'ENROLLMENT_REQUIRED'});
});
test('seeking does not complete video; bounded watched time does',async()=>{
  let progress=await learning.updateLessonProgress(1,{positionSeconds:124,watchedDeltaSeconds:0},user);
  assert.notEqual(progress.status,'completed');
  await assert.rejects(learning.completeLesson(1,user),{code:'VIDEO_COMPLETION_THRESHOLD_NOT_MET'});
  await learning.updateLessonProgress(1,{positionSeconds:60,watchedDeltaSeconds:60},user);
  progress=await learning.updateLessonProgress(1,{positionSeconds:120,watchedDeltaSeconds:50},user);
  assert.equal(progress.status,'completed');
});
test('failed/unknown provider statuses never produce ready',async()=>{
  assert.equal(providerState({status:4,length:0}).status,'processing');
  assert.equal(providerState({status:99,length:100}).status,'processing');
  remoteStatus=5; assert.equal((await service.sync(asset.videoAssetId,actor)).status,'failed');
  await assert.rejects(playback.createLessonPlaybackSession(1,user),{code:'VIDEO_NOT_READY'});
});
test('ambiguous creation is retained and never automatically duplicated',async()=>{
  await pg.query('UPDATE course_lessons SET video_asset_id=NULL WHERE id=1'); failCreate=true;
  await assert.rejects(service.create({courseId:1,lessonId:1},actor),{code:'BUNNY_CREATE_UNCERTAIN'});
  const count=creates;
  await assert.rejects(service.create({courseId:1,lessonId:1},actor),{code:'BUNNY_CREATE_UNCERTAIN'});
  assert.equal(creates,count);
  const pending=(await pg.query('SELECT va.status FROM video_assets va JOIN course_lessons l ON l.video_asset_id=va.id WHERE l.id=1')).rows[0];
  assert.equal(pending.status,'pending');
});
test('feature disabled never queries the commerce schema',async()=>{
  process.env.CSCA_VIDEO_COMMERCE_ENABLED='false';
  const access=require('../src/services/videoLearningAccess');
  const original=db.query; db.query=()=>{throw Error('must not query');};
  try { assert.equal(await access.find(1,1),null); await access.syncEnrollments(1); }
  finally { db.query=original; process.env.CSCA_VIDEO_COMMERCE_ENABLED='true'; }
});

test('day 5 rehearsal: commerce migrations, checkout, learning and source revocation share one database',async()=>{
  await pg.exec(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT 'test@example.invalid', ADD COLUMN full_name TEXT DEFAULT 'Test',
    ADD COLUMN username TEXT DEFAULT 'test', ADD COLUMN coins INTEGER DEFAULT 1000, ADD COLUMN is_vip BOOLEAN DEFAULT FALSE,
    ADD COLUMN subscription_tier TEXT DEFAULT 'basic', ADD COLUMN vip_expires_at TIMESTAMPTZ,
    ADD COLUMN vip_package_id INTEGER, ADD COLUMN vip_allowed_subjects TEXT[] DEFAULT '{}', ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE vip_packages ADD COLUMN price INTEGER DEFAULT 90000, ADD COLUMN duration_days INTEGER DEFAULT 90,
      ADD COLUMN requires_subject_choice BOOLEAN DEFAULT FALSE;
    UPDATE vip_packages SET tier='vip',allowed_subjects=ARRAY['MATH'] WHERE id=1;
    ALTER TABLE user_vip_entitlements ADD COLUMN transaction_id INTEGER,ADD COLUMN tier TEXT,ADD COLUMN source TEXT;
    ALTER TABLE user_vip_entitlements ALTER COLUMN is_active SET DEFAULT TRUE;
    ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id),ADD COLUMN amount BIGINT NOT NULL DEFAULT 1 CHECK(amount>0),
      ADD COLUMN payment_method TEXT,ADD COLUMN package_id INTEGER,ADD COLUMN package_duration INTEGER NOT NULL DEFAULT 90,
      ADD COLUMN package_name VARCHAR(100),ADD COLUMN transaction_code TEXT UNIQUE,ADD COLUMN status TEXT,ADD COLUMN payment_channel TEXT,
      ADD COLUMN trans_id TEXT,ADD COLUMN raw_response JSONB,ADD COLUMN paid_at TIMESTAMPTZ,ADD COLUMN vip_expires_at TIMESTAMPTZ,
      ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(),ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    CREATE TABLE coupons(id SERIAL PRIMARY KEY,code TEXT UNIQUE,description TEXT,created_by INTEGER,is_active BOOLEAN DEFAULT TRUE,
      discount_type TEXT,discount_value INTEGER,min_order_amount INTEGER DEFAULT 0,max_discount_amount INTEGER,max_uses INTEGER,
      user_limit INTEGER DEFAULT 1,used_count INTEGER DEFAULT 0,valid_from TIMESTAMPTZ,valid_until TIMESTAMPTZ,
      applicable_packages INTEGER[],applicable_tiers TEXT[] DEFAULT ARRAY['all']);
    CREATE TABLE coupon_usages(id SERIAL PRIMARY KEY,coupon_id INTEGER,user_id INTEGER,transaction_id INTEGER,
      discount_amount INTEGER,final_amount INTEGER,original_amount INTEGER);
    CREATE TABLE coin_ledger(id BIGSERIAL PRIMARY KEY,user_id INTEGER,amount INTEGER,balance_after INTEGER,source TEXT,
      description TEXT,metadata JSONB,idempotency_key TEXT UNIQUE);
    INSERT INTO users(id) VALUES(4),(5);
    SELECT setval('video_packages_id_seq',100); SELECT setval('user_video_entitlements_id_seq',100);`);
  for(const name of ['068_video_commerce_payments.sql','069_video_commerce_admin.sql','070_bunny_learning.sql'])await pg.exec(migration(name));
  const {createVideoPaymentService}=require('../src/services/videoPaymentService');
  const {createVideoAdminService}=require('../src/services/videoAdminService');
  const {createVideoCommerceRepository}=require('../src/repositories/videoCommerceRepository');
  const User=require('../src/models/User');
  let gatewayCalls=0;
  const payments=createVideoPaymentService({db,salesEnabled:()=>true,
    gateway:{assertConfigured(){},async create(row){gatewayCalls++;return {orderCode:Number(row.id),amount:Number(row.amount),status:'PENDING'};}},
    recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),sendEmail:async()=>({sent:true})});
  const management=createVideoAdminService({db,repository:createVideoCommerceRepository(db),payments,
    recalculateVip:(id,client)=>User.recalculateVipSummary(id,client),salesEnabled:()=>true});
  const video=await management.saveProduct('video',null,{name:'Rehearsal video',status:'active',priceVnd:100000,
    durationMode:'days',durationDays:90,allowedSubjects:['MATH'],courseIds:[1],renewalMode:'new_period'},2);
  const combo=await management.saveProduct('combo',null,{name:'Rehearsal combo',status:'active',priceVnd:150000,
    vipPackageId:1,videoPackageId:video.id,vipDurationDays:90,renewalMode:'new_period'},2);
  const {createVideoCouponAdminService}=require('../src/services/videoCouponAdminService');
  const coupons=createVideoCouponAdminService({db,admin:management});
  await coupons.save(null,{code:'REHEARSAL',description:'Test only',discount_type:'percentage',discount_value:100,
    min_order_amount:0,max_uses:2,user_limit:1,is_active:true,scopes:[{type:'video',productIds:[video.id]}]},2);
  const freeChoice={type:'video',productId:video.id,couponCode:'REHEARSAL'};
  const quote=await payments.quote(4,freeChoice);
  const free=await payments.createOrder(4,{...freeChoice,quoteHash:quote.quoteHash,idempotencyKey:'day5_free_order'});
  assert.equal(free.status,'completed');assert.equal(free.amount,0);assert.equal(gatewayCalls,0);
  assert.equal((await pg.query('SELECT is_vip FROM users WHERE id=4')).rows[0].is_vip,false);
  await course.requireLearningAccess(1,{id:4});
  // Reattach the earlier ready asset after the ambiguous-upload recovery scenario.
  await pg.query('UPDATE course_lessons SET video_asset_id=$1 WHERE id=1',[asset.videoAssetId]);
  remoteStatus=4;await service.sync(asset.videoAssetId,actor);
  assert.equal((await playback.createLessonPlaybackSession(1,{id:4})).deliveryType,'bunny');
  const choice={type:'combo',productId:combo.id,useCoins:true};
  const comboQuote=await payments.quote(5,choice);
  const paid=await payments.createOrder(5,{...choice,quoteHash:comboQuote.quoteHash,idempotencyKey:'day5_combo_order'});
  const transaction=(await pg.query('SELECT * FROM transactions WHERE transaction_code=$1',[paid.orderId])).rows[0];
  const evidence={provider:'payos',orderCode:transaction.id,amount:Number(transaction.amount),reference:'day5-provider-reference'};
  await payments.acceptPayment(transaction.id,evidence);await payments.acceptPayment(transaction.id,evidence);
  assert.equal((await pg.query('SELECT COUNT(*)::int n FROM user_video_entitlements WHERE user_id=5')).rows[0].n,1);
  assert.equal((await pg.query('SELECT COUNT(*)::int n FROM coin_ledger WHERE user_id=5')).rows[0].n,1);
  assert.equal((await pg.query('SELECT is_vip FROM users WHERE id=5')).rows[0].is_vip,true);
  assert.equal((await playback.createLessonPlaybackSession(1,{id:5})).deliveryType,'bunny');
  await learning.updateLessonProgress(1,{positionSeconds:32,watchedDeltaSeconds:10},{id:5});
  const manual=await management.grant({type:'video',productId:video.id,userId:5,videoExpiresAt:null,
    reason:'Independent teaching grant',requestKey:'day5_manual_grant'},2);
  const paidRight=(await pg.query("SELECT id FROM user_video_entitlements WHERE user_id=5 AND source='payment'")).rows[0];
  await management.revoke(paidRight.id,{reason:'Rehearsal source revoke'},2);
  assert.equal((await pg.query('SELECT is_vip FROM users WHERE id=5')).rows[0].is_vip,false);
  await course.requireLearningAccess(1,{id:5});
  await management.revoke(manual.id,{reason:'End rehearsal'},2);
  await assert.rejects(playback.createLessonPlaybackSession(1,{id:5}),{code:'ENTITLEMENT_EXPIRED'});
  assert.equal((await pg.query('SELECT last_position_seconds FROM lesson_progress WHERE user_id=5')).rows[0].last_position_seconds,32);
  const stats=await management.stats();
  assert.equal(Number(stats.find(row=>row.type==='combo').revenue),Number(transaction.amount));
  assert.equal((await pg.query("SELECT used_count FROM coupons WHERE code='REHEARSAL'")).rows[0].used_count,1);
});
