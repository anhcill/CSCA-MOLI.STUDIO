'use client';
import { useState } from 'react';
import { shopWrite,type VideoCoupon,type ProductType } from '@/lib/api/videoShop';
import { videoPaymentsApi } from '@/lib/api/videoPayments';
import { LookupPicker } from './AdminProductEditor';
import { Message,inputClass,buttonClass,secondaryClass,panelClass,errorText } from './shared';
const localDate=(v:string|null)=>v?new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
export default function AdminCouponEditor({coupon,onSaved,onClose}:{coupon:VideoCoupon|null;onSaved:()=>void;onClose:()=>void}) {
  const [code,setCode]=useState(coupon?.code||''),[description,setDescription]=useState(coupon?.description||''),[kind,setKind]=useState(coupon?.discount_type||'percentage'),[discount,setDiscount]=useState(coupon?.discount_value?.toString()||'');
  const [minimum,setMinimum]=useState(coupon?.min_order_amount||0),[limit,setLimit]=useState(coupon?.max_uses?.toString()||''),[userLimit,setUserLimit]=useState(coupon?.user_limit||1);
  const [from,setFrom]=useState(localDate(coupon?.valid_from||null)),[until,setUntil]=useState(localDate(coupon?.valid_until||null)),[active,setActive]=useState(coupon?.is_active??true);
  const [scopes,setScopes]=useState(coupon?.scopes||[]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const shared=coupon&&!coupon.videoOnly;
  function toggle(type:ProductType){setScopes(scopes.some(s=>s.type===type)?scopes.filter(s=>s.type!==type):[...scopes,{type,productIds:[]}]);}
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
    if(shared)await videoPaymentsApi.setCouponScopes(coupon.id,scopes);
    else await shopWrite(coupon?'patch':'post',`/manage/coupons${coupon?'/'+coupon.id:''}`,{code,description,discount_type:kind,discount_value:Number(discount),min_order_amount:minimum,
      max_uses:limit?Number(limit):null,user_limit:userLimit,valid_from:from?new Date(from).toISOString():null,valid_until:until?new Date(until).toISOString():null,is_active:active,scopes});onSaved();
  }catch(err){setError(errorText(err));}finally{setBusy(false);}}
  return <form onSubmit={submit} className={`${panelClass} space-y-5`}><h2 className="text-xl font-black">{coupon?'Sửa':'Tạo'} voucher {shared?'dùng chung':'video/combo'}</h2><Message>{shared?'Chỉ chỉnh phạm vi video/combo ở đây. Giá trị giảm và phạm vi gói cũ tiếp tục quản lý tại trang Mã giảm giá.':'Mã mới chỉ dành cho video/combo; không áp dụng cho checkout gói hiện tại.'}</Message>{error&&<Message error>{error}</Message>}
    <fieldset disabled={busy||!!shared} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Mã<input required maxLength={50} pattern="[A-Za-z0-9_-]{2,50}" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className={`${inputClass} mt-2`}/></label><label className="text-sm font-bold">Mô tả<input value={description} onChange={e=>setDescription(e.target.value)} className={`${inputClass} mt-2`}/></label>
      <label className="text-sm font-bold">Kiểu giảm<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)} className={`${inputClass} mt-2`}><option value="percentage">Phần trăm</option><option value="fixed">Số tiền VND</option></select></label><label className="text-sm font-bold">Mức giảm<input required type="number" min={1} max={kind==='percentage'?100:2147483647} value={discount} onChange={e=>setDiscount(e.target.value)} className={`${inputClass} mt-2`}/></label>
      <label className="text-sm font-bold">Đơn tối thiểu (VND)<input type="number" min={0} value={minimum} onChange={e=>setMinimum(Number(e.target.value))} className={`${inputClass} mt-2`}/></label><label className="text-sm font-bold">Tổng lượt (trống: không giới hạn)<input type="number" min={1} value={limit} onChange={e=>setLimit(e.target.value)} className={`${inputClass} mt-2`}/></label><label className="text-sm font-bold">Lượt mỗi tài khoản<input required type="number" min={1} value={userLimit} onChange={e=>setUserLimit(Number(e.target.value))} className={`${inputClass} mt-2`}/></label>
      <label className="text-sm font-bold">Bắt đầu<input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className={`${inputClass} mt-2`}/></label><label className="text-sm font-bold">Kết thúc<input type="datetime-local" value={until} onChange={e=>setUntil(e.target.value)} className={`${inputClass} mt-2`}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Cho phép sử dụng</label>
    </fieldset>
    <fieldset disabled={busy} className="space-y-4"><legend className="mb-3 text-sm font-bold">Phạm vi áp dụng</legend>{(['video','combo'] as const).map(t=><div key={t}><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={scopes.some(s=>s.type===t)} onChange={()=>toggle(t)}/>{t==='video'?'Gói video':'Combo'}</label>{scopes.some(s=>s.type===t)&&<div className="mt-3"><p className="mb-2 text-xs text-slate-500">Không chọn gói cụ thể = toàn bộ gói thuộc loại này.</p><LookupPicker kind={t} label={`Giới hạn gói ${t}`} multiple selected={scopes.find(s=>s.type===t)!.productIds} onChange={ids=>setScopes(scopes.map(s=>s.type===t?{...s,productIds:ids}:s))}/></div>}</div>)}</fieldset>
    <button disabled={busy} className={buttonClass}>{busy?'Đang lưu…':'Lưu voucher'}</button> <button type="button" disabled={busy} onClick={onClose} className={secondaryClass}>Đóng</button>
  </form>;
}
