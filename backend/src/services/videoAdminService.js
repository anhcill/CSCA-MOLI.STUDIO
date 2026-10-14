const crypto = require('crypto');
const { CourseApiError } = require('../utils/courseResponses');
const { positiveId, productType, normalizeDraft, mapProduct, configurationIssues } = require('../utils/videoCommerceContract');
const { resolveSelectedSubjects, normalizeTier } = require('../utils/vipEntitlements');
const { preserveLegacyVip, recalculateVideoVip } = require('./videoVipSummary');

const fail = (code, message, status=422) => { throw new CourseApiError(status,code,message); };
const table = type => productType(type)==='video'?'video_packages':'combo_packages';
const integer = (value,min=0) => typeof value==='number' && Number.isSafeInteger(value) && value>=min && value<=2147483647;
const reason = value => {
  if(typeof value!=='string' || value.trim().length<3 || value.length>1000) fail('REASON_REQUIRED','Enter a reason (3-1000 characters).');
  return value.trim();
};
function pageQuery(query={}) {
  const page=positiveId(query.page??1),limit=Math.min(100,positiveId(query.limit??20));
  if(!Number.isSafeInteger((page-1)*limit))fail('INVALID_PAGE','Invalid page.');
  return {page,limit,offset:(page-1)*limit};
}
const paged=(rows,p)=>({items:rows.slice(0,p.limit),page:p.page,limit:p.limit,hasMore:rows.length>p.limit});

function createVideoAdminService({db,repository,payments,recalculateVip,sendRightsEmail,salesEnabled=()=>false}) {
  const tx=repository.transaction;
  const audit=(client,actor,action,type,id,details)=>client.query(`INSERT INTO video_admin_events(actor_id,action,entity_type,entity_id,details)
    VALUES ($1,$2,$3,$4,$5::jsonb)`,[positiveId(actor),action,type,id,JSON.stringify(details)]);
  async function deliverRightsEmail(eventKey) {
    if(!sendRightsEmail)return;
    const claimed=(await db.query(`UPDATE video_rights_outbox SET attempts=attempts+1,last_attempt_at=NOW(),locked_until=NOW()+INTERVAL '2 minutes'
      WHERE event_key=$1 AND sent_at IS NULL AND (locked_until IS NULL OR locked_until<NOW()) RETURNING *`,[eventKey])).rows[0];
    if(!claimed)return;
    try {
      const user=(await db.query('SELECT email,full_name FROM users WHERE id=$1',[claimed.user_id])).rows[0];
      const result=await sendRightsEmail({email:user.email,name:user.full_name,...claimed.payload});
      if(result?.sent===false)throw new Error('Email not sent');
      await db.query('UPDATE video_rights_outbox SET sent_at=NOW(),locked_until=NULL WHERE event_key=$1',[eventKey]);
    }catch(_){await db.query('UPDATE video_rights_outbox SET locked_until=NULL WHERE event_key=$1',[eventKey]);}
  }
  async function retryRightsEmails() {
    const rows=(await db.query('SELECT event_key FROM video_rights_outbox WHERE sent_at IS NULL ORDER BY last_attempt_at NULLS FIRST,event_key LIMIT 25')).rows;
    for(const row of rows)await deliverRightsEmail(row.event_key);
    return {checked:rows.length};
  }

  async function enrich(row,type,client=db) {
    const value={...mapProduct(row,type),renewalMode:row.renewal_mode,subjectPrices:row.subject_prices||{}};
    const video=type==='video'?row:await repository.find('video',row.video_package_id,client);
    value.video=video?mapProduct(video,'video'):null;
    value.courses=video?(await client.query('SELECT id,title,slug,subject_code FROM courses WHERE id=ANY($1::bigint[]) ORDER BY id',[video.course_ids||[]])).rows:[];
    value.vip=type==='combo'?(await client.query('SELECT id,name FROM vip_packages WHERE id=$1',[row.vip_package_id])).rows[0]||null:null;
    value.configurationIssues=configurationIssues(value);
    value.canPurchase=false;
    if(row.status==='active') {
      try {
        const choices=video?.requires_subject_choice?video.allowed_subjects:[null];
        for(const subject of choices||[])await payments.productSnapshot(client,{type,productId:Number(row.id),selectedSubjectCode:subject});
        value.canPurchase=salesEnabled();
      } catch(error) {if(!(error instanceof CourseApiError))throw error;value.configurationIssues.push(error.code);}
    }
    return value;
  }
  async function catalog(typeValue,query={},admin=false) {
    const type=productType(typeValue),p=pageQuery(query);
    const rows=await repository.list(type,{status:admin?null:'active',limit:p.limit+1,offset:p.offset});
    const items=[];for(const row of rows)items.push(await enrich(row,type));
    return {...paged(items,p),checkoutAvailable:salesEnabled()};
  }
  async function product(typeValue,idValue) {
    const type=productType(typeValue),row=await repository.find(type,positiveId(idValue));
    if(!row || row.status!=='active')fail('PRODUCT_NOT_AVAILABLE','Package not available.',404);
    return enrich(row,type);
  }
  async function saveProduct(typeValue,idValue,input,actor) {
    const type=productType(typeValue),id=idValue==null?null:positiveId(idValue);
    if(!input || typeof input!=='object' || Array.isArray(input))fail('INVALID_PRODUCT','Expected product fields.');
    return tx(async client=>{
      const previous=id?await repository.find(type,id,client,{lock:true}):null;
      if(id && !previous)fail('PRODUCT_NOT_FOUND','Package not found.',404);
      const status=input.status??previous?.status??'draft';
      if(!['draft','active','archived'].includes(status))fail('INVALID_STATUS','Invalid status.');
      const data=normalizeDraft(type,{...(previous?mapProduct(previous,type):{}),...input,status:'draft'});
      const renewal=input.renewalMode??previous?.renewal_mode??'unconfigured';
      if(!['unconfigured','new_period','extend'].includes(renewal))fail('INVALID_RENEWAL_POLICY','Invalid renewal policy.');
      const video=type==='video'?data:data.videoPackageId?mapProduct(await repository.find('video',data.videoPackageId,client)||{},'video'):null;
      if(type==='video') {
        const courses=await repository.findCourses(data.courseIds,client);
        if(courses.length!==data.courseIds.length || courses.some(c=>!data.allowedSubjects.includes(c.subject_code)))fail('COURSE_SUBJECT_MISMATCH','Select courses matching the package subjects.');
      } else {
        if(data.videoPackageId && !video?.id)fail('VIDEO_PACKAGE_NOT_FOUND','Video package not found.');
        if(data.vipPackageId && !await repository.findVipPackage(data.vipPackageId,client))fail('VIP_PACKAGE_NOT_FOUND','VIP package not found.');
      }
      const prices=input.subjectPrices??previous?.subject_prices??{};
      if(!prices || typeof prices!=='object' || Array.isArray(prices) || Object.entries(prices).some(([s,v])=>!video?.allowedSubjects?.includes(s)||!integer(v)))fail('INVALID_SUBJECT_PRICES','Invalid subject prices.');
      const saved=await repository.writeDraft(type,{...data,status:'draft'},actor,client,id);
      await client.query(`UPDATE ${table(type)} SET renewal_mode=$2,subject_prices=$3::jsonb WHERE id=$1`,[saved.id,renewal,JSON.stringify(prices)]);
      if(status==='active') {
        if(configurationIssues({...data,type}).length)fail('PRODUCT_NOT_CONFIGURED','Configure price, duration and package contents before publishing.');
        await client.query(`UPDATE ${table(type)} SET status='active' WHERE id=$1`,[saved.id]);
        for(const subject of video?.requiresSubjectChoice?video.allowedSubjects:[null])await payments.productSnapshot(client,{type,productId:Number(saved.id),selectedSubjectCode:subject});
      } else await client.query(`UPDATE ${table(type)} SET status=$2 WHERE id=$1`,[saved.id,status]);
      const result=await enrich(await repository.find(type,saved.id,client),type,client);
      await audit(client,actor,'product_saved',type,saved.id,{before:previous?mapProduct(previous,type):null,after:result});
      return result;
    });
  }
  async function lookup(kind,query={}) {
    const p=pageQuery(query),search=String(query.search||'').slice(0,100);
    const sql={courses:'SELECT id,title AS name,subject_code,status FROM courses WHERE title ILIKE $1 ORDER BY id',
      vip:'SELECT id,name,is_active,allowed_subjects FROM vip_packages WHERE name ILIKE $1 ORDER BY id',
      users:'SELECT id,email,full_name AS name FROM users WHERE email ILIKE $1 OR full_name ILIKE $1 ORDER BY id',
      coupons:'SELECT id,code AS name FROM coupons WHERE code ILIKE $1 ORDER BY id'}[kind];
    if(!sql)fail('INVALID_LOOKUP','Unsupported lookup.');
    return paged((await db.query(`${sql} LIMIT $2 OFFSET $3`,[`%${search}%`,p.limit+1,p.offset])).rows,p);
  }
  const rightsSql=`SELECT e.*,vp.name AS video_name,cp.name AS combo_name,u.email,u.full_name,
    ve.expires_at AS vip_expires_at,ve.is_active AS vip_active,
    COALESCE(e.snapshot,o.snapshot) AS purchase_snapshot,
    ARRAY(SELECT ec.course_id FROM video_entitlement_courses ec WHERE ec.entitlement_id=e.id) AS course_ids
    FROM user_video_entitlements e JOIN video_packages vp ON vp.id=e.video_package_id
    LEFT JOIN combo_packages cp ON cp.id=e.combo_package_id JOIN users u ON u.id=e.user_id
    LEFT JOIN video_commerce_orders o ON o.transaction_id=e.transaction_id
    LEFT JOIN user_vip_entitlements ve ON ve.id=COALESCE(e.vip_entitlement_id,(o.result->>'vipEntitlementId')::int)`;
  async function rights(query={},userId=null) {
    const p=pageQuery(query),uid=userId?positiveId(userId):query.userId?positiveId(query.userId):null;
    const rows=(await db.query(`${rightsSql} WHERE ($1::int IS NULL OR e.user_id=$1)
      ORDER BY e.id DESC LIMIT $2 OFFSET $3`,[uid,p.limit+1,p.offset])).rows;
    return paged(rows.map(r=>({id:Number(r.id),userId:r.user_id,email:userId?undefined:r.email,userName:userId?undefined:r.full_name,
      type:r.combo_package_id?'combo':'video',name:r.purchase_snapshot?.name||r.combo_name||r.video_name,source:r.source,
      status:r.status,startsAt:r.starts_at,expiresAt:r.expires_at,subjects:r.allowed_subjects,courseIds:r.course_ids.map(Number),
      vipExpiresAt:r.vip_expires_at,vipActive:r.vip_active,reason:r.reason,transactionId:r.transaction_id})),p);
  }
  async function recalc(client,userId) {
    await recalculateVideoVip(client,userId,recalculateVip);
  }
  function expiry(value,required) {
    if(value===null && !required)return null;
    const date=typeof value==='string'?new Date(value):null;
    if(!date || !Number.isFinite(date.getTime()) || date<=new Date())fail('INVALID_EXPIRY','Choose a future expiry date; use explicit lifetime only for video.');
    return date.toISOString();
  }
  async function grant(input,actor) {
    const type=productType(input.type),id=positiveId(input.productId),uid=positiveId(input.userId),why=reason(input.reason);
    if(typeof input.requestKey!=='string'||!/^[\w-]{8,120}$/.test(input.requestKey))fail('REQUEST_KEY_REQUIRED','A stable request key is required.');
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify([actor,type,id,uid,input.selectedSubjectCode||null,input.videoExpiresAt,input.vipExpiresAt||null,why])).digest('hex');
    const result=await tx(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`video-grant:${input.requestKey}`]);
      const previous=(await client.query('SELECT * FROM video_admin_requests WHERE request_key=$1',[input.requestKey])).rows[0];
      if(previous){if(previous.request_hash!==fingerprint)fail('IDEMPOTENCY_CONFLICT','Key belongs to another grant.',409);return {id:Number(previous.entitlement_id)};}
      const user=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[uid])).rows[0];
      if(!user)fail('USER_NOT_FOUND','User not found.',404);
      const product=await repository.find(type,id,client);
      if(!product || product.status==='archived')fail('PRODUCT_NOT_AVAILABLE','Package not available.');
      const video=type==='video'?product:await repository.find('video',product.video_package_id,client);
      if(!video || video.status==='archived')fail('PRODUCT_NOT_CONFIGURED','Video package missing.');
      const subjects=video.requires_subject_choice?[input.selectedSubjectCode]:video.allowed_subjects;
      if(!subjects?.length || subjects.some(s=>!video.allowed_subjects.includes(s)) || (!video.requires_subject_choice && input.selectedSubjectCode))fail('SUBJECT_REQUIRED','Select a valid subject.');
      const courses=(await repository.findCourses(video.course_ids,client)).filter(c=>subjects.includes(c.subject_code));
      if(subjects.some(s=>!courses.some(c=>c.subject_code===s)) || courses.some(c=>c.status!=='published'))fail('COURSES_NOT_READY','Select published courses for every included subject.');
      const videoEnd=expiry(input.videoExpiresAt,false);
      let vipId=null,vipSnapshot=null;
      if(type==='combo') {
        const vip=(await client.query('SELECT * FROM vip_packages WHERE id=$1',[product.vip_package_id])).rows[0];
        if(!vip?.is_active || !['vip','premium'].includes(normalizeTier(vip.tier)))fail('COMBO_NOT_CONFIGURED','VIP component not available.');
        let vipSubjects;try{vipSubjects=resolveSelectedSubjects(vip,input.selectedSubjectCode);}catch(_){fail('SUBJECT_REQUIRED','Choose a compatible subject.');}
        if(!vipSubjects.includes('*') && subjects.some(s=>!vipSubjects.includes(s)))fail('COMBO_SUBJECT_MISMATCH','Combo subjects do not match.');
        const vipEnd=expiry(input.vipExpiresAt,true);
        await preserveLegacyVip(client,user);
        vipId=(await client.query(`INSERT INTO user_vip_entitlements(user_id,package_id,tier,allowed_subjects,starts_at,expires_at,source)
          VALUES ($1,$2,$3,$4,NOW(),$5,'manual') RETURNING id`,[uid,vip.id,normalizeTier(vip.tier),vipSubjects,vipEnd])).rows[0].id;
        vipSnapshot={packageId:vip.id,name:vip.name,subjects:vipSubjects};
        await recalc(client,uid);
      }
      const snapshot={name:product.name,type,video:{packageId:Number(video.id),name:video.name,subjects,courseIds:courses.map(c=>Number(c.id))},vip:vipSnapshot};
      const granted=(await client.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,combo_package_id,grant_key,source,
        allowed_subjects,starts_at,expires_at,duration_mode,granted_by,reason,vip_entitlement_id,snapshot)
        VALUES ($1,$2,$3,$4,'manual',$5,NOW(),$6,$7,$8,$9,$10,$11::jsonb) RETURNING id`,
      [uid,video.id,type==='combo'?id:null,`manual:${input.requestKey}`,subjects,videoEnd,videoEnd?'days':'lifetime',actor,why,vipId,JSON.stringify(snapshot)])).rows[0];
      await client.query('INSERT INTO video_entitlement_courses(entitlement_id,course_id) SELECT $1,UNNEST($2::bigint[])',[granted.id,snapshot.video.courseIds]);
      await client.query('INSERT INTO video_admin_requests(request_key,request_hash,entitlement_id) VALUES ($1,$2,$3)',[input.requestKey,fingerprint,granted.id]);
      await audit(client,actor,'manual_grant','entitlement',granted.id,{userId:uid,reason:why,snapshot});
      await client.query('INSERT INTO video_rights_outbox(event_key,user_id,payload) VALUES ($1,$2,$3::jsonb)',
        [`grant:${granted.id}`,uid,JSON.stringify({action:'granted',packageName:product.name,videoExpiresAt:videoEnd,vipExpiresAt:type==='combo'?input.vipExpiresAt:null,combo:type==='combo'})]);
      return {id:Number(granted.id)};
    });
    await deliverRightsEmail(`grant:${result.id}`).catch(()=>{});
    return result;
  }
  async function revoke(idValue,input,actor) {
    const id=positiveId(idValue),why=reason(input.reason);
    const result=await tx(async client=>{
      const known=(await client.query('SELECT user_id FROM user_video_entitlements WHERE id=$1',[id])).rows[0];
      if(!known)fail('RIGHT_NOT_FOUND','Entitlement not found.',404);
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[known.user_id]);
      const row=(await client.query('SELECT * FROM user_video_entitlements WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(row.status==='revoked')return {id,status:'revoked'};
      const order=row.transaction_id?(await client.query('SELECT result FROM video_commerce_orders WHERE transaction_id=$1',[row.transaction_id])).rows[0]:null;
      const vipId=row.vip_entitlement_id||order?.result?.vipEntitlementId;
      if(row.combo_package_id && !vipId)fail('COMBO_LINK_REQUIRED','Combo source must be reconciled before revocation.',409);
      if(vipId) {
        await client.query('UPDATE user_vip_entitlements SET is_active=FALSE WHERE id=$1 AND user_id=$2',[vipId,row.user_id]);
        await recalc(client,row.user_id);
      }
      await client.query("UPDATE user_video_entitlements SET status='revoked',revoked_at=NOW(),revoked_by=$2 WHERE id=$1",[id,actor]);
      await audit(client,actor,'revoked','entitlement',id,{userId:row.user_id,reason:why,vipEntitlementId:vipId||null});
      const product=await repository.find(row.combo_package_id?'combo':'video',row.combo_package_id||row.video_package_id,client);
      await client.query('INSERT INTO video_rights_outbox(event_key,user_id,payload) VALUES ($1,$2,$3::jsonb)',
        [`revoke:${id}`,row.user_id,JSON.stringify({action:'revoked',packageName:row.snapshot?.name||product.name,combo:!!row.combo_package_id})]);
      return {id,status:'revoked'};
    });
    await deliverRightsEmail(`revoke:${id}`).catch(()=>{});
    return result;
  }
  async function orders(query={}) {
    const p=pageQuery(query),type=query.type?productType(query.type):null;
    const rows=(await db.query(`SELECT t.transaction_code AS "orderId",t.amount,o.product_type AS type,u.email,
      o.snapshot->>'name' AS name,CASE WHEN o.fulfilled_at IS NOT NULL THEN 'completed' WHEN o.paid_at IS NOT NULL THEN 'awaiting_fulfillment'
      WHEN o.received_amount>0 THEN 'payment_review' ELSE t.status END AS status,o.fulfillment_error AS error,o.created_at AS "createdAt"
      FROM video_commerce_orders o JOIN transactions t ON t.id=o.transaction_id JOIN users u ON u.id=o.user_id
      WHERE ($1::text IS NULL OR o.product_type=$1) ORDER BY o.transaction_id DESC LIMIT $2 OFFSET $3`,[type,p.limit+1,p.offset])).rows;
    return paged(rows,p);
  }
  async function sync(code,actor) {
    const row=(await db.query('SELECT user_id FROM transactions WHERE transaction_code=$1 AND raw_response->>\'commerceType\' IN (\'video\',\'combo\')',[code])).rows[0];
    if(!row)fail('ORDER_NOT_FOUND','Order not found.',404);
    const result=await payments.status(row.user_id,code);
    await audit(db,actor,'payment_synced','order',0,{orderId:code,status:result.status});
    return result;
  }
  async function stats() {
    return (await db.query(`SELECT o.product_type AS type,COUNT(*)::int AS orders,
      COUNT(*) FILTER(WHERE o.fulfilled_at IS NOT NULL)::int AS completed,
      COALESCE(SUM(t.amount) FILTER(WHERE o.fulfilled_at IS NOT NULL),0) AS revenue,
      COUNT(*) FILTER(WHERE o.paid_at IS NOT NULL AND o.fulfilled_at IS NULL)::int AS review
      FROM video_commerce_orders o JOIN transactions t ON t.id=o.transaction_id GROUP BY o.product_type`)).rows;
  }
  async function events(query={}) {const p=pageQuery(query);return paged((await db.query(`SELECT e.*,u.email AS actor FROM video_admin_events e JOIN users u ON u.id=e.actor_id ORDER BY e.id DESC LIMIT $1 OFFSET $2`,[p.limit+1,p.offset])).rows,p);}
  return {catalog,product,saveProduct,lookup,rights,grant,revoke,orders,sync,stats,events,audit,tx,retryRightsEmails};
}
module.exports={createVideoAdminService,pageQuery,paged};
