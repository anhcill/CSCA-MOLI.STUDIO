'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { videoShop,type Page,type VideoRight } from '@/lib/api/videoShop';
import { videoPaymentsApi } from '@/lib/api/videoPayments';
import type { VideoOrderHistory } from '@/lib/types/videoPayments';
import { ShopShell,Message,Pager,money,endDate,statusLabel,subjects,panelClass,secondaryClass,errorText } from './shared';
export default function MyVideoPackages(){
  const user=useAuthStore(s=>s.user),[tab,setTab]=useState<'rights'|'orders'>('rights'),[page,setPage]=useState(1),[retry,setRetry]=useState(0);
  const [rights,setRights]=useState<Page<VideoRight>|null>(null),[orders,setOrders]=useState<VideoOrderHistory|null>(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;setError('');setRights(null);setOrders(null);if(user){(tab==='rights'?videoShop.rights(page).then(d=>live&&setRights(d)):videoPaymentsApi.history({page}).then(d=>live&&setOrders(d))).catch(e=>live&&setError(errorText(e)));}return()=>{live=false;};},[user,tab,page,retry]);
  const data=tab==='rights'?rights:orders;
  return <ShopShell title="Gói video của tôi"><div className="mb-6 flex gap-3">{(['rights','orders'] as const).map(t=><button aria-pressed={tab===t} key={t} className={secondaryClass} onClick={()=>{setTab(t);setPage(1);}}>{t==='rights'?'Quyền học':'Lịch sử thanh toán'}</button>)}</div>
    {!user?<Message><Link className="underline" href="/login?redirect=/tai-khoan/goi-video">Đăng nhập để xem gói học</Link></Message>:error?<Message error>{error} <button className="underline" onClick={()=>setRetry(r=>r+1)}>Thử lại</button></Message>:!data?<Message>Đang tải…</Message>:<>
      {!data.items.length&&<Message>Chưa có {tab==='rights'?'quyền video':'đơn hàng'} trong tài khoản. <Link className="underline" href="/goi-video">Khám phá gói học</Link></Message>}
      <div className="grid gap-4 md:grid-cols-2">{tab==='rights'?rights?.items.map(r=><article key={r.id} className={panelClass}><p className="text-xs font-bold text-teal-700">{r.type==='combo'?'COMBO':'VIDEO'} · {r.source==='manual'?'Được cấp':'Đã mua'}</p><h2 className="mt-2 text-xl font-black">{r.name}</h2><p className="mt-3 text-sm">{r.subjects.map(s=>subjects[s]).join(', ')}</p><p className="mt-3 font-bold">{r.status==='revoked'?'Đã thu hồi':r.expiresAt&&new Date(r.expiresAt)<=new Date()?'Đã hết hạn':'Còn hiệu lực'}</p><p className="mt-2 text-sm">Hạn video: {endDate(r.expiresAt)}</p>{r.type==='combo'&&<p className="mt-2 text-sm">Quyền gói: {r.vipActive?'Đang hoạt động':'Không hoạt động'} · {endDate(r.vipExpiresAt)}</p>}<Link className={`${secondaryClass} mt-4`} href="/hoc">Khóa học của tôi</Link></article>):orders?.items.map(o=><article key={o.orderId} className={panelClass}><p className="text-xs font-bold text-teal-700">{o.type==='combo'?'COMBO':'VIDEO'}</p><h2 className="mt-2 text-xl font-black">{o.snapshot.name}</h2><p className="mt-3">{money(o.amount)} · {statusLabel[o.status]}</p><p className="mt-3 break-all text-xs text-slate-500">{o.orderId}</p><Link className={`${secondaryClass} mt-4`} href={`/thanh-toan-khoa-hoc?orderId=${encodeURIComponent(o.orderId)}`}>Xem đơn hàng</Link></article>)}</div>
      <Pager page={page} hasMore={data.hasMore} onPage={setPage}/>
    </>}
  </ShopShell>;
}
