'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useSearchParams,useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { videoShop,shopGet,type ShopProduct,type Page,type VideoRight } from '@/lib/api/videoShop';
import { videoPaymentsApi } from '@/lib/api/videoPayments';
import type { VideoCreateOrderInput,VideoPaymentOrder,VideoPaymentQuote,VideoPaymentSelection } from '@/lib/types/videoPayments';
import type { CscaSubjectCode } from '@/lib/types/courses';
import { ShopShell,Message,money,endDate,subjects,statusLabel,inputClass,buttonClass,secondaryClass,panelClass,errorText } from './shared';

export default function VideoCheckout() {
  const params=useSearchParams(),router=useRouter(),userId=useAuthStore(s=>s.user?.id),logged=useAuthStore(s=>s.isAuthenticated);
  const type=params.get('type')==='combo'?'combo':'video',id=Number(params.get('productId')),orderId=params.get('orderId');
  const [mounted,setMounted]=useState(false),[product,setProduct]=useState<ShopProduct|null>(null),[subject,setSubject]=useState('');
  const [coupon,setCoupon]=useState(''),[useCoins,setUseCoins]=useState(false),[quote,setQuote]=useState<VideoPaymentQuote|null>(null);
  const [order,setOrder]=useState<VideoPaymentOrder|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState<string|null>(null);
  const [pending,setPending]=useState<VideoCreateOrderInput|null>(null),[retry,setRetry]=useState(0),[cancelConfirm,setCancelConfirm]=useState(false);
  const [owned,setOwned]=useState<VideoRight[]>([]);
  const flight=useRef(false),key=`video-checkout:${userId}:${type}:${id}`;
  useEffect(()=>setMounted(true),[]);
  useEffect(()=>{let live=true;setOwned([]);if(userId&&product)shopGet<Page<VideoRight>>('/me/rights',{limit:100}).then(data=>{
    if(live)setOwned(data.items.filter(r=>r.status==='active'&&(!r.expiresAt||new Date(r.expiresAt)>new Date())&&r.courseIds.some(id=>product.courses.some(c=>Number(c.id)===id))));
  }).catch(()=>{});return()=>{live=false;};},[userId,product]);
  useEffect(()=>{let live=true;setError('');setProduct(null);setQuote(null);setOrder(null);setPending(null);
    if(!orderId&&Number.isSafeInteger(id)&&id>0)videoShop.product(type,id).then(p=>live&&setProduct(p)).catch(e=>live&&setError(errorText(e)));
    else if(!orderId)setError('Chọn một gói từ danh sách trước khi thanh toán.');
    if(userId&&!orderId){try{const saved=sessionStorage.getItem(key);if(saved)setPending(JSON.parse(saved));}catch{setError('Không đọc được yêu cầu trước. Kiểm tra lịch sử đơn trước khi tạo mới.');}}
    return()=>{live=false;};
  },[type,id,orderId,key,userId,retry]);
  const refresh=useCallback(async()=>{
    if(!orderId||!logged)return;
    try{setOrder(await videoPaymentsApi.status(orderId));setError('');}catch(e){setError(errorText(e));}
  },[orderId,logged]);
  const terminal=!!order&&['completed','cancelled','expired','failed'].includes(order.status);
  useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(stopped||!orderId)return;try{const next=await videoPaymentsApi.status(orderId);if(!stopped){setOrder(next);setError('');}}catch(e){if(!stopped)setError(errorText(e));}if(!stopped&&!terminal)timer=setTimeout(poll,8000);};
    if(orderId&&logged)void poll();return()=>{stopped=true;clearTimeout(timer);};
  },[orderId,logged,terminal]);
  useEffect(()=>{let live=true;setQr(null);if(order?.payment?.qrCode)shopGet<{dataUrl:string|null}>(`/payments/orders/${encodeURIComponent(order.orderId)}/qr`).then(r=>live&&setQr(r.dataUrl)).catch(()=>{});return()=>{live=false;};},[order?.orderId,order?.payment?.qrCode]);
  const selection=():VideoPaymentSelection=>({type,productId:id,...(subject?{selectedSubjectCode:subject as CscaSubjectCode}:{}),couponCode:coupon.trim()||null,useCoins});
  async function getQuote(){if(flight.current)return;flight.current=true;setBusy(true);setError('');setQuote(null);
    try{setQuote(await videoPaymentsApi.quote(selection()));}catch(e){setError(errorText(e));}finally{flight.current=false;setBusy(false);}}
  async function pay(){if(flight.current||(!quote&&!pending))return;flight.current=true;setBusy(true);setError('');
    try{
      const input=pending||{...selection(),quoteHash:quote!.quoteHash,idempotencyKey:crypto.randomUUID()};
      // Persist before POST so reload/timeout can only retry this financial intent.
      sessionStorage.setItem(key,JSON.stringify(input));setPending(input);
      const result=await videoPaymentsApi.createOrder(input);sessionStorage.removeItem(key);setPending(null);setOrder(result);
      router.replace(`/thanh-toan-khoa-hoc?orderId=${encodeURIComponent(result.orderId)}`);
    }catch(e){
      const status=(e as {response?:{status:number}}).response?.status;
      const code=(e as {response?:{data?:{code:string}}}).response?.data?.code;
      if(status&&[409,422,503].includes(status)&&!['PAYMENT_RECONCILIATION_REQUIRED','IDEMPOTENCY_CONFLICT'].includes(code||'')){
        sessionStorage.removeItem(key);setPending(null);setQuote(null);
      }
      setError(errorText(e));
    }finally{flight.current=false;setBusy(false);}
  }
  async function cancel(){if(!order||flight.current)return;flight.current=true;setBusy(true);setError('');try{setOrder(await videoPaymentsApi.cancel(order.orderId));setCancelConfirm(false);}catch(e){setError(errorText(e));}finally{flight.current=false;setBusy(false);}}
  const change=(fn:()=>void)=>{fn();setQuote(null);setError('');};
  const paymentUrl=order?.payment?.checkoutUrl;
  const safeUrl=paymentUrl&&/^https:\/\/pay\.payos\.vn\//.test(paymentUrl)?paymentUrl:null;
  return <ShopShell title={order?'Thông tin thanh toán':'Xác nhận gói học'}>
    {error&&<div className="mb-5"><Message error>{error}</Message></div>}
    {!mounted?<Message>Đang tải…</Message>:!logged?<Message>Bạn cần đăng nhập để nhận đúng quyền học. <Link className="font-bold underline" href={`/login?redirect=${encodeURIComponent('/thanh-toan-khoa-hoc?'+params.toString())}`}>Đăng nhập</Link></Message>:orderId?<>
      {!order?<Message>Đang xác minh đơn với cổng thanh toán… <button className="underline" onClick={refresh}>Thử lại</button></Message>:<div className="grid items-start gap-6 md:grid-cols-2">
        <section className={panelClass}><p className="text-xs font-bold uppercase text-teal-700">{order.type==='combo'?'Combo':'Gói video'}</p><h2 className="mt-2 text-2xl font-black">{order.snapshot.name}</h2><p className="mt-4 break-all text-xs text-slate-500">Mã đơn: {order.orderId}</p><p className="mt-3 text-3xl font-black">{money(order.amount)}</p><p className="my-5 rounded-xl bg-teal-50 p-3 font-bold text-teal-900">{statusLabel[order.status]||order.status}</p>
          <p className="text-sm">Môn video: {order.snapshot.video.subjects.map(s=>subjects[s]).join(', ')}</p><p className="mt-2 text-sm">Thời hạn video: {order.snapshot.video.durationMode==='lifetime'?'Không giới hạn':`${order.snapshot.video.durationDays} ngày`}</p>
          {order.snapshot.vip&&<p className="mt-2 text-sm">Quyền gói: {order.snapshot.vip.name} · {order.snapshot.vip.durationDays} ngày</p>}
          {order.rights&&<div className="mt-5 space-y-2 text-sm"><p>Hạn video: {endDate(order.rights.videoExpiresAt)}</p>{order.rights.vipEntitlementId&&<p>Hạn quyền gói: {endDate(order.rights.vipExpiresAt)}</p>}<Link href="/hoc" className={buttonClass}>Đến khóa học của tôi</Link></div>}
          <Link href="/tai-khoan/goi-video" className="mt-5 block text-sm font-bold underline">Xem lịch sử và quyền đã nhận</Link>
        </section>
        <section className={`${panelClass} space-y-4`}>
          {order.status==='completed'?<Message>Đã hoàn tất cấp quyền. Bạn có thể xem lại các quyền đã nhận trong tài khoản.</Message>:order.status==='awaiting_fulfillment'||order.status==='payment_review'?<Message>Đơn đã ghi nhận tiền và đang cần xử lý. Không thanh toán lại. Giữ mã đơn để liên hệ hỗ trợ; hệ thống sẽ tiếp tục đối soát.</Message>:['cancelled','expired','failed'].includes(order.status)?<Message>Đơn đã đóng. Nếu bạn đã chuyển tiền, hãy dùng nút kiểm tra lại hoặc liên hệ hỗ trợ với mã đơn này.</Message>:<>
            <h2 className="text-xl font-black">Thanh toán qua payOS</h2><p className="text-sm text-slate-600 dark:text-slate-300">Hạn tạo thanh toán: {endDate(order.expiresAt)}. Chuyển đúng số tiền và nội dung trên cổng.</p>
            {qr&&<img src={qr} width={300} height={300} alt="Mã QR thanh toán của đơn hàng" className="mx-auto h-auto max-w-full rounded-xl"/>}
            {safeUrl?<a href={safeUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass} w-full`}>Mở cổng thanh toán ↗</a>:<Message>Đang khôi phục thông tin thanh toán. Hãy kiểm tra lại trạng thái đơn.</Message>}
            {!cancelConfirm?<button className={secondaryClass} onClick={()=>setCancelConfirm(true)}>Hủy đơn này</button>:<div className="space-y-3"><p className="text-sm">Chỉ hủy khi bạn chưa chuyển tiền. Xác nhận hủy đơn?</p><button disabled={busy} onClick={cancel} className={secondaryClass}>Xác nhận hủy</button> <button className="text-sm underline" onClick={()=>setCancelConfirm(false)}>Giữ đơn</button></div>}
          </>}
          {order.reconciliationPending&&<Message>Chưa kết nối được cổng để xác minh. Đơn vẫn được giữ.</Message>}
          <button className={secondaryClass} onClick={refresh}>Kiểm tra lại trạng thái</button>
        </section>
      </div>}
    </>:!product?<Message>Đang tải gói… <button className="underline" onClick={()=>setRetry(r=>r+1)}>Thử lại</button></Message>:<div className="grid items-start gap-6 md:grid-cols-[1fr_1fr]">
      <section className={panelClass}><p className="text-xs font-bold uppercase text-teal-700">{type==='combo'?'Combo gói + video':'Gói video'}</p><h2 className="mt-2 text-2xl font-black">{product.name}</h2><p className="my-4 text-sm leading-6">{product.description}</p>
        <p className="font-bold">Video: {product.video?.name}</p><p className="mt-1 text-sm">{product.video?.durationMode==='lifetime'?'Không giới hạn':`${product.video?.durationDays??'Chưa cấu hình'} ngày`}</p>
        {product.vip&&<p className="mt-4 text-sm">Kèm {product.vip.name} · {'vipDurationDays' in product?String(product.vipDurationDays):''} ngày</p>}
        <ul className="mt-5 space-y-2 text-sm">{product.courses.map(c=><li key={c.id}>✓ {c.title} · {subjects[c.subject_code]}</li>)}</ul>
        {owned.length>0&&<div className="mt-4"><Message>Bạn đã có quyền học một số khóa trong gói này. <Link className="underline" href="/tai-khoan/goi-video">Xem quyền và thời hạn đang sở hữu</Link> trước khi mua thêm.</Message></div>}
        <p className="mt-5 text-sm text-slate-500">Quyền bắt đầu khi cấp thành công. {product.renewalMode==='extend'?'Gói được cấu hình cộng thời gian cho quyền phù hợp.':product.renewalMode==='new_period'?'Mua lại tạo một kỳ quyền mới.':'Nếu đang sở hữu quyền trùng, cần hỗ trợ xác nhận chính sách gia hạn.'}</p>
      </section>
      <section className={`${panelClass} space-y-5`}>
        {pending?<Message>Đang có yêu cầu thanh toán chưa xác nhận. Thử lại để mở đúng đơn đã tạo; kiểm tra lịch sử trước khi mua thêm.</Message>:<fieldset disabled={busy} className="space-y-4">
          {product.video?.requiresSubjectChoice&&<label className="block text-sm font-bold">Môn muốn học<select className={`${inputClass} mt-2`} value={subject} onChange={e=>change(()=>setSubject(e.target.value))}><option value="">Chọn môn</option>{product.video.allowedSubjects.map(s=><option key={s} value={s}>{subjects[s]}</option>)}</select></label>}
          <label className="block text-sm font-bold">Mã giảm giá<input className={`${inputClass} mt-2`} value={coupon} maxLength={50} onChange={e=>change(()=>setCoupon(e.target.value))} placeholder="Nhập mã nếu có"/></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={useCoins} onChange={e=>change(()=>setUseCoins(e.target.checked))}/>Dùng xu hiện có (tối đa 20% sau voucher, 100 đ/xu)</label>
        </fieldset>}
        {!product.canPurchase&&!pending&&<Message>Gói chưa mở thanh toán. Bạn có thể xem thông tin và quay lại sau.</Message>}
        {!pending&&<button disabled={busy||!product.canPurchase} onClick={getQuote} className={`${secondaryClass} w-full`}>{busy?'Đang kiểm tra…':'Kiểm tra giá & ưu đãi'}</button>}
        {quote&&!pending&&<dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800"><div className="flex justify-between"><dt>Giá gói</dt><dd>{money(quote.originalAmount)}</dd></div><div className="flex justify-between"><dt>Voucher</dt><dd>− {money(quote.couponDiscountAmount)}</dd></div><div className="flex justify-between"><dt>{quote.coinsUsed} xu</dt><dd>− {money(quote.coinDiscountAmount)}</dd></div><div className="flex justify-between border-t pt-3 text-lg font-black"><dt>Thanh toán</dt><dd>{money(quote.amount)}</dd></div></dl>}
        {(quote||pending)&&<button disabled={busy||(!pending&&!quote?.salesEnabled)} onClick={pay} className={`${buttonClass} w-full`}>{busy?'Đang xử lý…':pending?'Thử lại yêu cầu thanh toán':quote?.amount===0?'Xác nhận nhận gói':'Xác nhận & tạo thanh toán'}</button>}
        <Link href="/tai-khoan/goi-video" className="block text-sm underline">Mở lịch sử đơn hàng</Link>
      </section>
    </div>}
  </ShopShell>;
}
