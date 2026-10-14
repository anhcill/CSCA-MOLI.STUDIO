const crypto = require('crypto');
const { CourseApiError } = require('../utils/courseResponses');
const { positiveId, productType } = require('../utils/videoCommerceContract');
const { resolveSelectedSubjects, normalizeTier } = require('../utils/vipEntitlements');
const { lockCoupon, couponDiscount, consumeCoupon } = require('./paymentCouponReservation');
const { preserveLegacyVip, recalculateVideoVip } = require('./videoVipSummary');

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, status = 409) => { throw new CourseApiError(status, code, message); };
const money = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647;

function createVideoPaymentService({ db, gateway, recalculateVip, sendEmail, now = () => new Date(), salesEnabled = () => false }) {
  async function tx(work) {
    if (db.transaction) return db.transaction(work);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function lockUser(client, userId) {
    const result = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!result.rows[0]) fail('USER_NOT_FOUND', 'User not found.', 404);
    return result.rows[0];
  }
  function selection(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_ORDER', 'Expected an order object.', 422);
    if (input.paymentMethod && input.paymentMethod !== 'bank_transfer') fail('PAYMENT_METHOD_UNSUPPORTED', 'Video purchases currently use bank transfer.', 422);
    if (input.useCoins !== undefined && typeof input.useCoins !== 'boolean') fail('INVALID_COINS', 'useCoins must be boolean.', 422);
    if (input.coinsToUse != null && (!Number.isSafeInteger(input.coinsToUse) || input.coinsToUse < 0)) fail('INVALID_COINS', 'Invalid coin amount.', 422);
    if (input.couponCode != null && (typeof input.couponCode !== 'string' || input.couponCode.length > 50)) fail('INVALID_COUPON', 'Invalid voucher code.', 422);
    if (input.selectedSubjectCode != null && typeof input.selectedSubjectCode !== 'string') fail('INVALID_SUBJECT', 'Invalid subject.', 422);
    return { type: productType(input.type), productId: positiveId(input.productId),
      selectedSubjectCode: input.selectedSubjectCode?.trim().toUpperCase() || null,
      couponCode: input.couponCode?.trim().toUpperCase() || null,
      useCoins: input.useCoins === true, coinsToUse: input.coinsToUse ?? null };
  }

  async function productSnapshot(client, choice) {
    const table = choice.type === 'video' ? 'video_packages' : 'combo_packages';
    const product = (await client.query(`SELECT * FROM ${table} WHERE id = $1`, [choice.productId])).rows[0];
    if (!product || product.status !== 'active') fail('PRODUCT_NOT_AVAILABLE', 'Package is not on sale.', 422);
    const video = choice.type === 'video' ? product : (await client.query('SELECT * FROM video_packages WHERE id = $1', [product.video_package_id])).rows[0];
    if (!video || video.status !== 'active' || !['days', 'lifetime'].includes(video.duration_mode)
      || (video.duration_mode === 'days' && (!(video.duration_days > 0)
        || !Number.isFinite(new Date(now().getTime()+video.duration_days*86400000).getTime()))) || !video.allowed_subjects?.length) {
      fail('PRODUCT_NOT_CONFIGURED', 'Video package is not configured.', 422);
    }
    let subjects = [...video.allowed_subjects].sort();
    if (video.requires_subject_choice) {
      if (!subjects.includes(choice.selectedSubjectCode)) fail('SUBJECT_REQUIRED', 'Choose a subject included in this video package.', 422);
      subjects = [choice.selectedSubjectCode];
    } else if (choice.selectedSubjectCode) fail('SUBJECT_NOT_REQUIRED', 'This package does not accept a subject override.', 422);
    const courses = (await client.query(`SELECT c.id, c.subject_code, c.status FROM video_package_courses vc
      JOIN courses c ON c.id = vc.course_id WHERE vc.video_package_id = $1 ORDER BY c.id`, [video.id])).rows;
    const included = courses.filter(course => subjects.includes(course.subject_code));
    if (!included.length || included.some(course => course.status !== 'published')
      || subjects.some(subject => !included.some(course => course.subject_code === subject))) {
      fail('COURSES_NOT_READY', 'All selected subjects must have published courses.', 422);
    }
    const subjectPrice = video.requires_subject_choice ? product.subject_prices?.[subjects[0]] : undefined;
    const price = subjectPrice ?? product.price_vnd;
    if (price == null || !money(price)) fail('PRICE_NOT_CONFIGURED', 'Package price is not configured.', 422);
    const snapshot = { version: 1, type: choice.type, productId: Number(product.id), name: product.name,
      originalAmount: Number(price), renewalMode: product.renewal_mode,
      video: { packageId: Number(video.id), name: video.name, subjects, courseIds: included.map(course => Number(course.id)),
        durationMode: video.duration_mode, durationDays: video.duration_days }, vip: null };
    if (choice.type === 'combo') {
      const vip = (await client.query('SELECT * FROM vip_packages WHERE id = $1', [product.vip_package_id])).rows[0];
      if (!vip?.is_active || !['vip','premium'].includes(normalizeTier(vip.tier)) || !(product.vip_duration_days > 0)
        || !Number.isFinite(new Date(now().getTime()+product.vip_duration_days*86400000).getTime())) fail('COMBO_NOT_CONFIGURED', 'Combo VIP component is not configured.', 422);
      let vipSubjects;
      try { vipSubjects = resolveSelectedSubjects(vip, choice.selectedSubjectCode); }
      catch (_) { fail('COMBO_SUBJECT_MISMATCH', 'Combo requires a compatible subject selection.', 422); }
      if (!vipSubjects.includes('*') && subjects.some(subject => !vipSubjects.includes(subject))) {
        fail('COMBO_SUBJECT_MISMATCH', 'Video subjects must match the combo VIP component.', 422);
      }
      snapshot.vip = { packageId: Number(vip.id), name: vip.name, tier: normalizeTier(vip.tier), subjects: vipSubjects.sort(), durationDays: product.vip_duration_days };
    }
    return snapshot;
  }

  async function checkOverlap(client, userId, snapshot) {
    if (snapshot.renewalMode !== 'unconfigured') return;
    const rights = await client.query(`SELECT e.id FROM user_video_entitlements e
      JOIN video_entitlement_courses ec ON ec.entitlement_id = e.id
      WHERE e.user_id=$1 AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at > $3)
      AND ec.course_id = ANY($2::bigint[]) LIMIT 1`, [userId, snapshot.video.courseIds, now()]);
    if (rights.rows.length) fail('RENEWAL_POLICY_REQUIRED', 'Admin must configure repeat-purchase policy before buying overlapping video rights.');
    if (snapshot.vip) {
      const vip = await client.query(`SELECT id FROM users WHERE id=$1 AND (is_vip=TRUE OR subscription_tier IN ('vip','premium'))
        AND (vip_expires_at IS NULL OR vip_expires_at > $2)`, [userId, now()]);
      if (vip.rows.length) fail('RENEWAL_POLICY_REQUIRED', 'Admin must configure how combo purchases apply to an existing VIP membership.');
    }
  }

  async function availableCoins(client, userId, excludeId = null) {
    const result = await client.query(`SELECT COALESCE(SUM(CASE WHEN (raw_response->>'coinsUsed') ~ '^[0-9]+$'
      THEN (raw_response->>'coinsUsed')::bigint ELSE 0 END),0) AS reserved FROM transactions
      WHERE user_id=$1 AND status IN ('pending','processing') AND ($2::int IS NULL OR id<>$2)
      AND (raw_response->>'commerceType' IN ('video','combo') OR created_at >= NOW() - INTERVAL '24 hours')`, [userId, excludeId]);
    return Number(result.rows[0].reserved);
  }

  async function quoteLocked(client, user, choice) {
    const snapshot = await productSnapshot(client, choice);
    await checkOverlap(client, user.id, snapshot);
    if (snapshot.renewalMode === 'extend') {
      await rightsExpiry(client,user.id,snapshot,'video');
      if (snapshot.vip) await rightsExpiry(client,user.id,snapshot,'vip');
    }
    let discount = 0, coupon = null;
    if (choice.couponCode) {
      coupon = await lockCoupon(client, { code: choice.couponCode, userId: user.id, now: now() });
      const scope = (await client.query('SELECT product_ids FROM video_coupon_scopes WHERE coupon_id=$1 AND product_type=$2', [coupon.id, choice.type])).rows[0];
      if (!scope || (scope.product_ids.length && !scope.product_ids.map(Number).includes(choice.productId))) {
        fail('COUPON_SCOPE_MISMATCH', 'Voucher is not enabled for this video/combo package.', 422);
      }
      discount = couponDiscount(coupon, snapshot.originalAmount);
    }
    const afterCoupon = snapshot.originalAmount - discount;
    let coins = 0;
    if (choice.useCoins || choice.coinsToUse > 0) {
      const usable = Math.max(0, Math.min(Number(user.coins || 0) - await availableCoins(client, user.id), Math.floor(afterCoupon * 0.2 / 100)));
      coins = choice.coinsToUse > 0 ? Math.min(choice.coinsToUse, usable) : usable;
    }
    const totals = { couponCode: coupon?.code || null, couponId: coupon?.id || null,
      couponDiscountAmount: discount, coinsUsed: coins, coinDiscountAmount: coins * 100, amount: afterCoupon - coins * 100 };
    return { ...snapshot, ...totals, quoteHash: hash({ snapshot, totals }) };
  }

  async function quote(userIdValue, input) {
    const userId = positiveId(userIdValue), choice = selection(input);
    return tx(async client => ({ ...await quoteLocked(client, await lockUser(client, userId), choice), salesEnabled: salesEnabled() }));
  }

  const orderSql = `SELECT o.*,t.id,t.transaction_code,t.amount,t.payment_method,t.status,t.raw_response
    FROM video_commerce_orders o JOIN transactions t ON t.id=o.transaction_id`;
  async function orderById(client, id, lock = false) {
    return (await client.query(`${orderSql} WHERE o.transaction_id=$1${lock ? ' FOR UPDATE OF o,t' : ''}`, [id])).rows[0];
  }
  function orderDto(row) {
    return { orderId: row.transaction_code, type: row.product_type, productId: Number(row.product_id),
      status: row.fulfilled_at ? 'completed' : row.paid_at ? 'awaiting_fulfillment' : row.received_amount > 0 ? 'payment_review' : row.status,
      amount: Number(row.amount), snapshot: row.snapshot, expiresAt: row.expires_at,
      payment: row.fulfilled_at || ['cancelled','expired'].includes(row.status) ? null : row.provider_payment,
      rights: row.result || null, fulfillmentError: row.fulfillment_error || null };
  }
  async function createOrder(userIdValue, input) {
    const userId = positiveId(userIdValue), choice = selection(input);
    if (typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,120}$/.test(input.idempotencyKey)) fail('IDEMPOTENCY_KEY_REQUIRED', 'Use an 8-120 character request key.', 422);
    if (typeof input.quoteHash !== 'string' || !/^[0-9a-f]{64}$/.test(input.quoteHash)) fail('QUOTE_REQUIRED', 'Obtain a current quote before creating the order.', 422);
    const requestHash = hash({ choice, quoteHash: input.quoteHash });
    let row = await tx(async client => {
      const user = await lockUser(client, userId);
      const previous = (await client.query(`${orderSql} WHERE o.user_id=$1 AND o.request_key=$2`, [userId, input.idempotencyKey])).rows[0];
      if (previous) {
        if (previous.request_hash !== requestHash) fail('IDEMPOTENCY_CONFLICT', 'This request key belongs to a different order.');
        return previous;
      }
      if (!salesEnabled()) fail('VIDEO_SALES_DISABLED', 'New video/combo orders are disabled.', 503);
      const snapshot = await quoteLocked(client, user, choice);
      if (snapshot.quoteHash !== input.quoteHash) fail('QUOTE_CHANGED', 'Price, rights or available discounts changed; request a new quote.');
      if (snapshot.amount > 0) gateway.assertConfigured();
      const expiresAt = new Date(now().getTime() + 5 * 60 * 1000);
      const meta = { commerceType: choice.type, commerceVersion: 1, paymentProvider: 'payos',
        couponCode: snapshot.couponCode, couponId: snapshot.couponId, couponReservation: true, originalAmount: snapshot.originalAmount,
        couponDiscountAmount: snapshot.couponDiscountAmount, coinsUsed: snapshot.coinsUsed,
        coinDiscountAmount: snapshot.coinDiscountAmount, finalAmount: snapshot.amount };
      const inserted = await client.query(`INSERT INTO transactions(user_id,amount,payment_method,package_id,package_duration,package_name,
        transaction_code,status,raw_response) VALUES ($1,$2,$3,NULL,$4,$5,$6,'pending',$7::jsonb) RETURNING id`,
      [userId, snapshot.amount, snapshot.amount ? 'bank_transfer' : 'coupon_free', snapshot.video.durationDays || 0,
        snapshot.name.slice(0, 100), `VIDEO_${crypto.randomUUID()}`, JSON.stringify(meta)]);
      const id = inserted.rows[0].id;
      await client.query(`UPDATE transactions SET raw_response=raw_response || jsonb_build_object('payosOrderCode',$2::int) WHERE id=$1`, [id, id]);
      await client.query(`INSERT INTO video_commerce_orders(transaction_id,user_id,request_key,request_hash,product_type,product_id,snapshot,expires_at,coupon_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`, [id,userId,input.idempotencyKey,requestHash,choice.type,choice.productId,JSON.stringify(snapshot),expiresAt,snapshot.couponId]);
      return orderById(client, id);
    });
    if (!Number(row.amount) && !row.fulfilled_at) return acceptPayment(row.id, { provider: 'zero', orderCode: row.id, amount: 0, reference: `ZERO_${row.id}` });
    if (!row.provider_payment && !row.paid_at && row.status === 'pending') row = await ensurePayment(row);
    return orderDto(row);
  }

  async function ensurePayment(row) {
    let payment;
    // First query a possibly-created link after a prior timeout. A missing link
    // may be created with the SAME orderCode, never a second financial order.
    try { payment = await gateway.get(row.id); } catch (_) { /* creation reconciles duplicate order codes below */ }
    if (payment?.status === 'PAID') {
      await reconcilePayment(row, payment); return orderById(db, row.id);
    }
    if (payment && Number(payment.orderCode)!==Number(row.id)) fail('PAYMENT_RESPONSE_MISMATCH','Provider returned a different order.',502);
    if (payment && Number(payment.amountPaid)>0) {
      await notePartialPayment(row,payment); return orderById(db,row.id);
    }
    if (payment && ['CANCELLED','EXPIRED'].includes(payment.status)) {
      await closeUnpaid(row, payment.status.toLowerCase()); return orderById(db, row.id);
    }
    if (!payment) {
      if (new Date(row.expires_at) <= now()) fail('PAYMENT_RECONCILIATION_REQUIRED', 'Order creation expired; reconcile the original order before retrying.');
      try { payment = await gateway.create(row); }
      catch (_) {
        try { payment = await gateway.get(row.id); } catch (_) { fail('PAYMENT_RECONCILIATION_REQUIRED', 'Payment creation is uncertain; retry with the same request key.', 502); }
      }
    }
    if (!payment || Number(payment.orderCode) !== Number(row.id) || Number(payment.amount) !== Number(row.amount)) {
      fail('PAYMENT_RESPONSE_MISMATCH', 'Provider returned a different order or amount.', 502);
    }
    if (payment.status === 'PAID') { await reconcilePayment(row, payment); return orderById(db, row.id); }
    if (Number(payment.amountPaid)>0) { await notePartialPayment(row,payment); return orderById(db,row.id); }
    if (['CANCELLED','EXPIRED'].includes(payment.status)) {
      await closeUnpaid(row,payment.status.toLowerCase()); return orderById(db,row.id);
    }
    const safe = { orderCode: Number(payment.orderCode), status: payment.status, amount: Number(payment.amount),
      qrCode: payment.qrCode || null, checkoutUrl: payment.checkoutUrl || null,
      bin: payment.bin || null, accountNumber: payment.accountNumber || null, accountName: payment.accountName || null,
      description: payment.description || null };
    await db.query('UPDATE video_commerce_orders SET provider_payment=$2::jsonb WHERE transaction_id=$1 AND paid_at IS NULL', [row.id,JSON.stringify(safe)]);
    return orderById(db, row.id);
  }

  async function rightsExpiry(client, userId, snapshot, kind) {
    const component = snapshot[kind];
    if (kind === 'video' && component.durationMode === 'lifetime') return null;
    let base = now().getTime();
    if (snapshot.renewalMode === 'extend') {
      const table = kind === 'video' ? 'user_video_entitlements' : 'user_vip_entitlements';
      const packageColumn = kind === 'video' ? 'video_package_id' : 'package_id';
      const active = kind === 'video' ? "status='active'" : 'is_active=TRUE';
      const rows = (await client.query(`SELECT expires_at FROM ${table} WHERE user_id=$1 AND ${packageColumn}=$2
        AND ${active} AND allowed_subjects @> $3::text[] AND (expires_at IS NULL OR expires_at>$4)`,
      [userId,component.packageId,component.subjects,now()])).rows;
      if (rows.some(item => item.expires_at == null)) fail('LIFETIME_ALREADY_OWNED', 'This package already has lifetime access.');
      for (const item of rows) base = Math.max(base, new Date(item.expires_at).getTime());
    }
    return new Date(base + component.durationDays * 86400000).toISOString();
  }

  async function fulfill(id) {
    const known = await orderById(db, id);
    if (!known) fail('ORDER_NOT_FOUND', 'Order not found.', 404);
    try {
      await tx(async client => {
        const user = await lockUser(client, known.user_id);
        const row = await orderById(client, id, true);
        if (row.fulfilled_at) return;
        if (!row.paid_at) fail('PAYMENT_NOT_CONFIRMED', 'Payment must be verified by the provider.');
        const snapshot = row.snapshot;
        await checkOverlap(client, user.id, snapshot);
        await consumeCoupon(client, row, { now: now() });
        const coins = snapshot.coinsUsed;
        if (coins) {
          const reserved = await availableCoins(client, user.id, id);
          if (Number(user.coins || 0) - coins < reserved) fail('INSUFFICIENT_COINS', 'Reserved coins are no longer available; payment needs review.');
          await client.query('UPDATE users SET coins=coins-$2,updated_at=NOW() WHERE id=$1', [user.id,coins]);
          await client.query(`INSERT INTO coin_ledger(user_id,amount,balance_after,source,description,metadata,idempotency_key)
            VALUES ($1,$2,$3,'video_discount','Video/combo discount',$4::jsonb,$5)`,
          [user.id,-coins,Number(user.coins)-coins,JSON.stringify({ transactionId:id }),`payment:${id}:coins`]);
        }
        const videoExpiry = await rightsExpiry(client, user.id, snapshot, 'video');
        const right = (await client.query(`INSERT INTO user_video_entitlements(user_id,video_package_id,combo_package_id,transaction_id,grant_key,
          source,allowed_subjects,starts_at,expires_at,duration_mode)
          VALUES ($1,$2,$3,$4,$5,'payment',$6,$7,$8,$9) RETURNING id`,
        [user.id,snapshot.video.packageId,snapshot.type==='combo'?snapshot.productId:null,id,`payment:${id}:video`,
          snapshot.video.subjects,now(),videoExpiry,snapshot.video.durationMode])).rows[0];
        await client.query('INSERT INTO video_entitlement_courses(entitlement_id,course_id) SELECT $1,UNNEST($2::bigint[])', [right.id,snapshot.video.courseIds]);
        let vipExpiry = null, vipEntitlementId = null;
        if (snapshot.vip) {
          vipExpiry = await rightsExpiry(client, user.id, snapshot, 'vip');
          await preserveLegacyVip(client,user);
          const vip = (await client.query(`INSERT INTO user_vip_entitlements(user_id,package_id,transaction_id,tier,allowed_subjects,starts_at,expires_at,source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'payment') RETURNING id`,
          [user.id,snapshot.vip.packageId,id,snapshot.vip.tier,snapshot.vip.subjects,now(),vipExpiry])).rows[0];
          vipEntitlementId = Number(vip.id);
          await recalculateVideoVip(client,user.id,recalculateVip);
          // Preserve profile-only legacy rights, including a permanent VIP. The
          // new combo must never reduce an existing subscription summary.
          if ((user.is_vip || ['vip','premium'].includes(user.subscription_tier))
            && (user.vip_expires_at == null || new Date(user.vip_expires_at) > now())) {
            const permanent = user.vip_expires_at == null;
            await client.query(`UPDATE users SET vip_expires_at=CASE WHEN $2::boolean THEN NULL ELSE GREATEST(vip_expires_at,$3) END,
              subscription_tier=CASE WHEN $4::text IN ('premium','pre') THEN 'premium' ELSE subscription_tier END,
              vip_allowed_subjects=CASE WHEN '*'=ANY($5::text[]) THEN ARRAY['*']::text[] ELSE
                ARRAY(SELECT DISTINCT UNNEST(vip_allowed_subjects || $5::text[])) END WHERE id=$1`,
            [user.id,permanent,user.vip_expires_at,user.subscription_tier,user.vip_allowed_subjects?.length?user.vip_allowed_subjects:['*']]);
          }
        }
        const result = { videoEntitlementId:Number(right.id),videoExpiresAt:videoExpiry,vipEntitlementId,vipExpiresAt:vipExpiry };
        await client.query('UPDATE video_commerce_orders SET fulfilled_at=$2,fulfillment_error=NULL,result=$3::jsonb WHERE transaction_id=$1', [id,now(),JSON.stringify(result)]);
        await client.query("UPDATE transactions SET status='completed',paid_at=$2,vip_expires_at=$3,payment_channel=$4,updated_at=NOW() WHERE id=$1",
          [id,row.paid_at,vipExpiry,Number(row.amount) ? 'payos' : 'coupon_free']);
        await client.query('INSERT INTO video_payment_outbox(transaction_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
      });
    } catch (error) {
      await db.query('UPDATE video_commerce_orders SET fulfillment_error=$2 WHERE transaction_id=$1 AND fulfilled_at IS NULL',
        [id,error instanceof CourseApiError ? error.code : 'FULFILLMENT_RETRY_REQUIRED']);
      if (!(error instanceof CourseApiError)) throw error;
    }
    return orderDto(await orderById(db, id));
  }

  async function acceptPayment(idValue, event) {
    const id = positiveId(idValue);
    await tx(async client => {
      const known = await orderById(client,id);
      if (!known) fail('ORDER_NOT_FOUND', 'Order not found.',404);
      await lockUser(client,known.user_id);
      const row = await orderById(client,id,true);
      if (Number(event.orderCode)!==id || !money(event.amount) || Number(event.amount)!==Number(row.amount)
        || (event.currency && event.currency!=='VND') || event.provider !== (Number(row.amount) ? 'payos' : 'zero')) {
        fail('PAYMENT_MISMATCH', 'Provider, order, amount or currency does not match.');
      }
      if (typeof event.reference!=='string' || !event.reference.trim() || event.reference.length>200) fail('PAYMENT_REFERENCE_REQUIRED','Provider reference is required.');
      if (!row.paid_at) await client.query(`UPDATE video_commerce_orders SET paid_at=$2,received_amount=$3,provider_reference=$4 WHERE transaction_id=$1`,
        [id,now(),Number(event.amount),`${event.provider}:${event.reference}`]);
      if (!row.fulfilled_at) await client.query("UPDATE transactions SET status='processing',updated_at=NOW() WHERE id=$1",[id]);
    });
    const result = await fulfill(id);
    await deliverEmail(id).catch(() => {});
    return result;
  }

  async function reconcilePayment(row, payment) {
    if (Number(payment.orderCode)!==Number(row.id) || payment.status!=='PAID') fail('PAYMENT_MISMATCH','Unexpected provider payment.');
    return acceptPayment(row.id,{provider:'payos',orderCode:payment.orderCode,amount:Number(payment.amountPaid ?? payment.amount),
      currency:payment.currency || 'VND',reference:`order:${payment.orderCode}`});
  }
  async function notePartialPayment(row,payment) {
    if (Number(payment.orderCode)!==Number(row.id) || !money(payment.amountPaid)) fail('PAYMENT_MISMATCH','Unexpected partial payment.');
    await tx(async client => {
      await lockUser(client,row.user_id);
      const current=await orderById(client,row.id,true);
      if (current.paid_at || current.fulfilled_at) return;
      await client.query(`UPDATE video_commerce_orders SET received_amount=GREATEST(received_amount,$2),fulfillment_error='PARTIAL_PAYMENT_REVIEW'
        WHERE transaction_id=$1`,[row.id,Number(payment.amountPaid)]);
      // A stale cancellation response must not release a received payment's reservations.
      await client.query("UPDATE transactions SET status='processing',updated_at=NOW() WHERE id=$1",[row.id]);
    });
  }
  async function closeUnpaid(row, status) {
    return tx(async client => {
      await lockUser(client,row.user_id);
      const current = await orderById(client,row.id,true);
      if (!current.paid_at && !current.fulfilled_at && !(Number(current.received_amount)>0)) {
        await client.query('UPDATE transactions SET status=$2,updated_at=NOW() WHERE id=$1',[row.id,status]);
      }
    });
  }
  async function ownedOrder(userId, code) {
    if (typeof code !== 'string' || code.length>255) fail('ORDER_NOT_FOUND','Order not found.',404);
    const result = await db.query(`${orderSql} WHERE o.user_id=$1 AND t.transaction_code=$2`,[positiveId(userId),code]);
    if (!result.rows[0]) fail('ORDER_NOT_FOUND','Order not found.',404);
    return result.rows[0];
  }
  async function status(userId, code, { reconcile = true } = {}) {
    let row = await ownedOrder(userId,code);
    if (row.paid_at && !row.fulfilled_at) { await fulfill(row.id); row=await orderById(db,row.id); }
    if (!row.paid_at && Number(row.amount)===0) {
      await acceptPayment(row.id,{provider:'zero',orderCode:row.id,amount:0,reference:`ZERO_${row.id}`}); row=await orderById(db,row.id);
    } else if (reconcile && !row.paid_at) {
      let payment;
      try { payment=await gateway.get(row.id); } catch (_) { return { ...orderDto(row),reconciliationPending:true }; }
      if (Number(payment.orderCode)!==Number(row.id)) fail('PAYMENT_MISMATCH','Unexpected provider order.');
      if (payment.status==='PAID') await reconcilePayment(row,payment);
      else if (Number(payment.amountPaid)>0) await notePartialPayment(row,payment);
      else if (['CANCELLED','EXPIRED'].includes(payment.status)) await closeUnpaid(row,payment.status.toLowerCase());
      else if (new Date(row.expires_at)<=now()) {
        const cancelled=await gateway.cancel(row.id);
        if (Number(cancelled.orderCode)!==Number(row.id)) fail('PAYMENT_MISMATCH','Unexpected cancellation response.');
        if (cancelled.status==='PAID') await reconcilePayment(row,cancelled);
        else if (Number(cancelled.amountPaid)>0) await notePartialPayment(row,cancelled);
        else if (['CANCELLED','EXPIRED'].includes(cancelled.status)) await closeUnpaid(row,'expired');
      }
      row=await orderById(db,row.id);
    }
    await deliverEmail(row.id).catch(() => {});
    return orderDto(row);
  }
  async function cancel(userId,code) {
    const row=await ownedOrder(userId,code);
    if (row.paid_at || row.fulfilled_at) fail('ORDER_ALREADY_PAID','A paid order cannot be cancelled here.');
    if (!Number(row.amount)) fail('ZERO_ORDER_FINALIZING','Zero-amount orders are finalized without a gateway.');
    const current=await gateway.get(row.id);
    if (Number(current.orderCode)!==Number(row.id)) fail('PAYMENT_MISMATCH','Unexpected provider order.');
    if (current.status==='PAID') { await reconcilePayment(row,current); return orderDto(await orderById(db,row.id)); }
    if (Number(current.amountPaid)>0) { await notePartialPayment(row,current); fail('PARTIAL_PAYMENT_REVIEW','Order has received a partial payment and needs review.'); }
    const payment=await gateway.cancel(row.id);
    if (Number(payment.orderCode)!==Number(row.id)) fail('PAYMENT_MISMATCH','Unexpected provider order.');
    if (payment.status==='PAID') await reconcilePayment(row,payment);
    else if (Number(payment.amountPaid)>0) await notePartialPayment(row,payment);
    else if (['CANCELLED','EXPIRED'].includes(payment.status)) await closeUnpaid(row,'cancelled');
    else fail('CANCELLATION_UNCONFIRMED','Provider has not confirmed cancellation.');
    return orderDto(await orderById(db,row.id));
  }
  async function history(userIdValue,{ page=1,limit=20 }={}) {
    const userId=positiveId(userIdValue),safePage=positiveId(page),safeLimit=Math.min(100,positiveId(limit));
    const offset=(safePage-1)*safeLimit;
    if (!Number.isSafeInteger(offset)) fail('INVALID_PAGE','Page is too large.',422);
    const rows=(await db.query(`${orderSql} WHERE o.user_id=$1 ORDER BY o.created_at DESC,o.transaction_id DESC LIMIT $2 OFFSET $3`,[userId,safeLimit+1,offset])).rows;
    return { items:rows.slice(0,safeLimit).map(orderDto),page:safePage,limit:safeLimit,hasMore:rows.length>safeLimit };
  }
  async function deliverEmail(id) {
    if (!sendEmail) return;
    const claim=await db.query(`UPDATE video_payment_outbox SET status='sending',attempts=attempts+1,locked_until=NOW()+INTERVAL '2 minutes'
      WHERE transaction_id=$1 AND (status='pending' OR (status='sending' AND locked_until<NOW())) RETURNING transaction_id`,[id]);
    if (!claim.rows.length) return;
    try {
      const row=await orderById(db,id);
      const user=(await db.query('SELECT email,full_name,username FROM users WHERE id=$1',[row.user_id])).rows[0];
      const sent=await sendEmail({email:user.email,name:user.full_name||user.username,order:orderDto(row)});
      if (sent?.sent===false) throw new Error('Email not sent');
      await db.query("UPDATE video_payment_outbox SET status='sent',sent_at=NOW(),locked_until=NULL,last_error=NULL WHERE transaction_id=$1",[id]);
    } catch (_) {
      await db.query("UPDATE video_payment_outbox SET status='pending',locked_until=NULL,last_error='EMAIL_RETRY_REQUIRED' WHERE transaction_id=$1",[id]);
    }
  }
  async function maintenance(limit=25) {
    const safeLimit=Math.min(100,positiveId(limit));
    const candidates=(await db.query(`SELECT o.transaction_id,o.user_id,t.transaction_code FROM video_commerce_orders o
      JOIN transactions t ON t.id=o.transaction_id LEFT JOIN video_payment_outbox e ON e.transaction_id=o.transaction_id
      WHERE (o.fulfilled_at IS NULL AND (o.paid_at IS NOT NULL OR t.status IN ('pending','processing')))
        OR (e.status<>'sent') ORDER BY o.last_checked_at NULLS FIRST,o.created_at,o.transaction_id LIMIT $1`,[safeLimit])).rows;
    const results=[];
    for (const candidate of candidates) {
      await db.query('UPDATE video_commerce_orders SET last_checked_at=NOW() WHERE transaction_id=$1',[candidate.transaction_id]);
      try { const result=await status(candidate.user_id,candidate.transaction_code);results.push({orderId:result.orderId,status:result.status}); }
      catch(error) { results.push({orderId:candidate.transaction_code,error:error instanceof CourseApiError?error.code:'RETRY_REQUIRED'}); }
    }
    return results;
  }
  async function couponScopes(couponIdValue) {
    const couponId=positiveId(couponIdValue);
    const rows=await db.query('SELECT product_type,product_ids FROM video_coupon_scopes WHERE coupon_id=$1 ORDER BY product_type',[couponId]);
    return rows.rows.map(row=>({type:row.product_type,productIds:row.product_ids.map(Number)}));
  }
  async function setCouponScopes(couponIdValue,input,actorIdValue) {
    const couponId=positiveId(couponIdValue),actorId=positiveId(actorIdValue);
    if (!Array.isArray(input) || input.length>2) fail('INVALID_COUPON_SCOPE','Expected up to two product scopes.',422);
    const scopes=input.map(scope=>{
      if (!scope || !Array.isArray(scope.productIds) || scope.productIds.length>500) fail('INVALID_COUPON_SCOPE','productIds must be an array.',422);
      return {type:productType(scope.type),productIds:[...new Set(scope.productIds.map(id=>positiveId(id)))]};
    });
    if (new Set(scopes.map(scope=>scope.type)).size!==scopes.length) fail('INVALID_COUPON_SCOPE','Product scopes must be unique.',422);
    return tx(async client=>{
      const coupon=await client.query('SELECT id FROM coupons WHERE id=$1 FOR UPDATE',[couponId]);
      if (!coupon.rows.length) fail('COUPON_NOT_FOUND','Voucher not found.',404);
      for (const scope of scopes) {
        const table=scope.type==='video'?'video_packages':'combo_packages';
        const matches=await client.query(`SELECT id FROM ${table} WHERE id=ANY($1::bigint[])`,[scope.productIds]);
        if (matches.rows.length!==scope.productIds.length) fail('INVALID_COUPON_SCOPE','One or more packages do not exist.',422);
      }
      await client.query('DELETE FROM video_coupon_scopes WHERE coupon_id=$1',[couponId]);
      for (const scope of scopes) await client.query('INSERT INTO video_coupon_scopes(coupon_id,product_type,product_ids) VALUES ($1,$2,$3)',[couponId,scope.type,scope.productIds]);
      await client.query("INSERT INTO video_payment_config_audit(actor_id,entity_type,entity_id,changes) VALUES ($1,'coupon',$2,$3::jsonb)",[actorId,couponId,JSON.stringify({scopes})]);
      return scopes;
    });
  }
  async function configureProduct(typeValue,idValue,input,actorIdValue) {
    const type=productType(typeValue),id=positiveId(idValue),actorId=positiveId(actorIdValue);
    if (!input || typeof input!=='object' || Array.isArray(input)) fail('INVALID_PAYMENT_CONFIG','Expected configuration.',422);
    if (input.renewalMode!==undefined && !['unconfigured','new_period','extend'].includes(input.renewalMode)) fail('INVALID_RENEWAL_POLICY','Unsupported renewal policy.',422);
    if (input.subjectPrices!==undefined && (!input.subjectPrices || typeof input.subjectPrices!=='object' || Array.isArray(input.subjectPrices))) fail('INVALID_SUBJECT_PRICES','Expected a subject price map.',422);
    return tx(async client=>{
      const table=type==='video'?'video_packages':'combo_packages';
      const product=(await client.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if (!product) fail('PRODUCT_NOT_FOUND','Package not found.',404);
      const video=type==='video'?product:(await client.query('SELECT allowed_subjects FROM video_packages WHERE id=$1',[product.video_package_id])).rows[0];
      const prices=input.subjectPrices??product.subject_prices;
      if (Object.entries(prices).some(([subject,price])=>!video?.allowed_subjects?.includes(subject) || typeof price!=='number' || !money(price))) {
        fail('INVALID_SUBJECT_PRICES','Each price must be nonnegative VND for a subject in the video package.',422);
      }
      const config={renewalMode:input.renewalMode??product.renewal_mode,subjectPrices:prices};
      await client.query(`UPDATE ${table} SET renewal_mode=$2,subject_prices=$3::jsonb,updated_at=NOW() WHERE id=$1`,[id,config.renewalMode,JSON.stringify(prices)]);
      await client.query('INSERT INTO video_payment_config_audit(actor_id,entity_type,entity_id,changes) VALUES ($1,$2,$3,$4::jsonb)',[actorId,type,id,JSON.stringify(config)]);
      return config;
    });
  }
  return {quote,createOrder,acceptPayment,status,cancel,history,deliverEmail,maintenance,couponScopes,setCouponScopes,configureProduct,productSnapshot};
}

module.exports={createVideoPaymentService};
