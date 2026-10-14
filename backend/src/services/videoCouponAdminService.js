const {CourseApiError}=require('../utils/courseResponses');
const {positiveId,productType}=require('../utils/videoCommerceContract');
const {pageQuery,paged}=require('./videoAdminService');
const fail=(code,message)=>{throw new CourseApiError(422,code,message);};
function createVideoCouponAdminService({db,admin}) {
  const number=(v,min=0)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>2147483647)fail('INVALID_COUPON','Invalid number.');return v;};
  const date=v=>{if(v==null||v==='')return null;if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))fail('INVALID_DATE','Invalid date.');return new Date(v).toISOString();};
  async function list(query={}) {
    const p=pageQuery(query);
    const rows=(await db.query(`SELECT c.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('type',s.product_type,'productIds',s.product_ids))
      FROM video_coupon_scopes s WHERE s.coupon_id=c.id),'[]'::jsonb) AS scopes
      FROM coupons c WHERE 'video_only'=ANY(c.applicable_tiers) OR EXISTS(SELECT 1 FROM video_coupon_scopes s WHERE s.coupon_id=c.id)
      ORDER BY c.id DESC LIMIT $1 OFFSET $2`,[p.limit+1,p.offset])).rows;
    return paged(rows.map(c=>({...c,videoOnly:c.applicable_tiers?.includes('video_only')})),p);
  }
  async function save(idValue,input,actor) {
    const id=idValue==null?null:positiveId(idValue);
    if(typeof input.code!=='string'||!/^[A-Za-z0-9_-]{2,50}$/.test(input.code))fail('INVALID_COUPON','Code must have 2-50 letters, numbers, underscores or hyphens.');
    if(!['percentage','fixed'].includes(input.discount_type))fail('INVALID_COUPON','Invalid discount type.');
    const discount=number(input.discount_value,1);if(input.discount_type==='percentage'&&discount>100)fail('INVALID_COUPON','Discount cannot exceed 100 percent.');
    const from=date(input.valid_from),until=date(input.valid_until);
    if(from&&until&&until<=from)fail('INVALID_DATE','End must follow start.');
    if(!Array.isArray(input.scopes)||input.scopes.length>2)fail('INVALID_COUPON_SCOPE','Select product scopes.');
    const scopes=input.scopes.map(s=>({type:productType(s.type),productIds:Array.isArray(s.productIds)?[...new Set(s.productIds.map(x=>positiveId(x)))]:fail('INVALID_COUPON_SCOPE','Invalid packages.')}));
    if(new Set(scopes.map(s=>s.type)).size!==scopes.length)fail('INVALID_COUPON_SCOPE','Duplicate product type.');
    return admin.tx(async client=>{
      const previous=id?(await client.query('SELECT * FROM coupons WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
      if(id&&!previous?.applicable_tiers?.includes('video_only'))fail('LEGACY_COUPON_READ_ONLY','Edit shared vouchers in the existing voucher page; only scopes are editable here.');
      for(const s of scopes) {
        const found=await client.query(`SELECT id FROM ${s.type==='video'?'video_packages':'combo_packages'} WHERE id=ANY($1::bigint[])`,[s.productIds]);
        if(found.rows.length!==s.productIds.length)fail('INVALID_COUPON_SCOPE','Package not found.');
      }
      const values=[input.code.toUpperCase(),String(input.description||'').slice(0,1000),input.discount_type,discount,
        number(input.min_order_amount??0),input.max_uses==null?null:number(input.max_uses,1),number(input.user_limit??1,1),from,until,input.is_active!==false];
      let savedId=id;
      try {
        if(id)await client.query(`UPDATE coupons SET code=$1,description=$2,discount_type=$3,discount_value=$4,min_order_amount=$5,
          max_uses=$6,user_limit=$7,valid_from=$8,valid_until=$9,is_active=$10 WHERE id=$11`,[...values,id]);
        else savedId=(await client.query(`INSERT INTO coupons(code,description,discount_type,discount_value,min_order_amount,max_uses,user_limit,
          valid_from,valid_until,is_active,applicable_tiers,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,ARRAY['video_only'],$11) RETURNING id`,[...values,actor])).rows[0].id;
      } catch(error){if(error.code==='23505')fail('COUPON_EXISTS','Voucher code already exists.');throw error;}
      await client.query('DELETE FROM video_coupon_scopes WHERE coupon_id=$1',[savedId]);
      for(const s of scopes)await client.query('INSERT INTO video_coupon_scopes(coupon_id,product_type,product_ids) VALUES ($1,$2,$3)',[savedId,s.type,s.productIds]);
      await admin.audit(client,actor,'coupon_saved','coupon',savedId,{code:values[0],scopes});
      return {id:savedId};
    });
  }
  async function usage(id,query={}) {
    const p=pageQuery(query);
    return paged((await db.query(`SELECT cu.*,u.email,t.transaction_code FROM coupon_usages cu JOIN users u ON u.id=cu.user_id
      LEFT JOIN transactions t ON t.id=cu.transaction_id WHERE cu.coupon_id=$1 ORDER BY cu.id DESC LIMIT $2 OFFSET $3`,[positiveId(id),p.limit+1,p.offset])).rows,p);
  }
  async function promotion(typeValue,adminView=false) {
    const type=productType(typeValue);
    return (await db.query(`SELECT p.*,c.code AS coupon_code FROM video_promotions p LEFT JOIN coupons c ON c.id=p.coupon_id
      WHERE p.product_type=$1 ${adminView?'':`AND p.is_active=TRUE AND (p.starts_at IS NULL OR p.starts_at<=NOW()) AND (p.ends_at IS NULL OR p.ends_at>NOW())
      AND (p.coupon_id IS NULL OR (c.is_active=TRUE AND (c.valid_from IS NULL OR c.valid_from<=NOW()) AND (c.valid_until IS NULL OR c.valid_until>NOW())
      AND (c.max_uses IS NULL OR c.used_count<c.max_uses) AND EXISTS(SELECT 1 FROM video_coupon_scopes s WHERE s.coupon_id=c.id AND s.product_type=$1)))`}`,[type])).rows[0]||null;
  }
  async function savePromotion(typeValue,input,actor) {
    const type=productType(typeValue),from=date(input.starts_at),until=date(input.ends_at);
    if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.content!=='string'||input.content.length>2000)fail('INVALID_PROMOTION','Enter title and content.');
    if(from&&until&&until<=from)fail('INVALID_DATE','End must follow start.');
    const couponId=input.coupon_id==null?null:positiveId(input.coupon_id);
    return admin.tx(async client=>{
      if(couponId && !(await client.query('SELECT coupon_id FROM video_coupon_scopes WHERE coupon_id=$1 AND product_type=$2',[couponId,type])).rows.length)fail('COUPON_SCOPE_MISMATCH','Voucher is not enabled for this type.');
      await client.query(`INSERT INTO video_promotions(product_type,title,content,coupon_id,is_active,starts_at,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(product_type) DO UPDATE SET title=$2,content=$3,coupon_id=$4,is_active=$5,starts_at=$6,ends_at=$7,updated_at=NOW()`,
      [type,input.title.trim(),input.content,couponId,input.is_active===true,from,until]);
      await admin.audit(client,actor,'promotion_saved',type,0,{title:input.title});return {saved:true};
    });
  }
  return {list,save,usage,promotion,savePromotion};
}
module.exports={createVideoCouponAdminService};
