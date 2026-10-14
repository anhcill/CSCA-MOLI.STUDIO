'use client';
import { useEffect,useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { shopWrite,type ProductType } from '@/lib/api/videoShop';
import { LookupPicker } from './AdminProductEditor';
import { Message,subjects,inputClass,buttonClass,secondaryClass,panelClass,errorText } from './shared';
export default function AdminGrantForm({onSaved,onClose}:{onSaved:()=>void;onClose:()=>void}) {
  const [type,setType]=useState<ProductType>('video'),[users,setUsers]=useState<number[]>([]),[products,setProducts]=useState<number[]>([]),[subject,setSubject]=useState('');
  const [videoEnd,setVideoEnd]=useState(''),[vipEnd,setVipEnd]=useState(''),[lifetime,setLifetime]=useState(false),[reason,setReason]=useState('');
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [pending,setPending]=useState<Record<string,unknown>|null>(null);
  const actor=useAuthStore(s=>s.user?.id),storageKey=`video-manual-grant:${actor}`;
  useEffect(()=>{if(!actor)return;try{const saved=sessionStorage.getItem(storageKey);if(saved)setPending(JSON.parse(saved));}catch{setError('Không đọc được yêu cầu cũ. Kiểm tra danh sách quyền trước khi cấp thêm.');}},[actor,storageKey]);
  async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
    const input=pending||{type,userId:users[0],productId:products[0],selectedSubjectCode:subject||null,
      videoExpiresAt:lifetime?null:new Date(videoEnd).toISOString(),vipExpiresAt:type==='combo'?new Date(vipEnd).toISOString():null,reason,requestKey:crypto.randomUUID()};
    sessionStorage.setItem(storageKey,JSON.stringify(input));setPending(input);await shopWrite('post','/manage/grants',input);sessionStorage.removeItem(storageKey);setPending(null);onSaved();
  }catch(err){const status=(err as {response?:{status:number}}).response?.status;if(status&&status<500&&status!==409){sessionStorage.removeItem(storageKey);setPending(null);}setError(errorText(err));}finally{setBusy(false);}}
  return <form className={`${panelClass} space-y-5`} onSubmit={submit}><h2 className="text-xl font-black">Cấp quyền thủ công</h2><Message>Không ghi nhận doanh thu. Combo cấp cả quyền video và VIP; thời hạn từng phần được chọn bên dưới.</Message>{error&&<Message error>{error}</Message>}
    {pending&&<Message>Yêu cầu chưa xác nhận xong. Dùng nút thử lại để tránh cấp hai lần.</Message>}
    <fieldset disabled={busy||!!pending} className="space-y-4"><label className="block text-sm font-bold">Loại gói<select className={`${inputClass} mt-2`} value={type} onChange={e=>{setType(e.target.value as ProductType);setProducts([]);setConfirmed(false);}}><option value="video">Video</option><option value="combo">Combo</option></select></label>
      <div className="grid gap-4 lg:grid-cols-2"><LookupPicker kind="users" label="Học viên" selected={users} onChange={ids=>{setUsers(ids);setConfirmed(false);}}/><LookupPicker kind={type} label="Gói được cấp" selected={products} onChange={ids=>{setProducts(ids);setConfirmed(false);}}/></div>
      <label className="block text-sm font-bold">Môn (chỉ chọn nếu gói yêu cầu)<select className={`${inputClass} mt-2`} value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Theo toàn bộ môn trong gói</option>{Object.entries(subjects).filter(([s])=>s!=='*').map(([s,n])=><option key={s} value={s}>{n}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lifetime} onChange={e=>setLifetime(e.target.checked)}/>Video không giới hạn thời hạn</label>
      <div className="grid gap-4 sm:grid-cols-2">{!lifetime&&<label className="text-sm font-bold">Hết hạn video<input required type="datetime-local" value={videoEnd} onChange={e=>setVideoEnd(e.target.value)} className={`${inputClass} mt-2`}/></label>}{type==='combo'&&<label className="text-sm font-bold">Hết hạn quyền VIP<input required type="datetime-local" value={vipEnd} onChange={e=>setVipEnd(e.target.value)} className={`${inputClass} mt-2`}/></label>}</div>
      <label className="block text-sm font-bold">Lý do cấp<textarea required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className={`${inputClass} mt-2`}/></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Tôi đã kiểm tra học viên, gói và thời hạn của từng phần.</label>
    </fieldset>
    <button className={buttonClass} disabled={busy||(!pending&&(!confirmed||!users.length||!products.length))}>{busy?'Đang cấp…':pending?'Thử lại yêu cầu':'Xác nhận cấp quyền'}</button> <button type="button" disabled={busy} className={secondaryClass} onClick={onClose}>Đóng</button>
  </form>;
}
