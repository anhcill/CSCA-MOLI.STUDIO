'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { videoShop,type Page,type ShopProduct,type ProductType,type Promotion } from '@/lib/api/videoShop';
import { ShopShell,Message,Pager,money,subjects,buttonClass,panelClass,errorText,secondaryClass } from './shared';
export default function VideoCatalog({ embedded = false, productType = 'video' }: { embedded?: boolean; productType?: ProductType }) {
  const params=useSearchParams(),courseId=Number(params.get('courseId'));
  const [type,setType]=useState<ProductType>(productType),[page,setPage]=useState(1),[data,setData]=useState<Page<ShopProduct>|null>(null);
  const [promotion,setPromotion]=useState<Promotion|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setData(null);setError('');setPromotion(null);
    Promise.all([videoShop.catalog(type,page),videoShop.promotion(type)]).then(([d,p])=>{if(live){setData(d);setPromotion(p);}}).catch(e=>live&&setError(errorText(e)));
    return()=>{live=false;};
  },[type,page,retry]);
  const content = <><h2 className="mb-6 text-2xl font-black text-slate-900">{type === 'video' ? 'Gói khóa học video' : 'Gói luyện tập kết hợp video'}</h2><p className="-mt-4 mb-7 max-w-2xl text-slate-600 dark:text-slate-300">Học video theo gói, hoặc kết hợp cùng quyền luyện tập VIP. Nội dung và thời hạn từng phần luôn được hiển thị trước khi thanh toán.</p>
    {!embedded && <div className="mb-6 flex flex-wrap gap-3" role="group" aria-label="Loại gói">{(['video','combo'] as const).map(t=><button key={t} aria-pressed={type===t} className={type===t?buttonClass:secondaryClass} onClick={()=>{setType(t);setPage(1);}}>{t==='video'?'Gói video':'Combo gói + video'}</button>)}<Link href="/vip" className={secondaryClass}>Gói luyện tập hiện tại ↗</Link></div>}
    {promotion&&<div className="mb-6 rounded-2xl bg-[#102b34] p-6 text-white"><p className="text-lg font-black">{promotion.title}</p><p className="mt-2 text-sm text-slate-200">{promotion.content}</p>{promotion.coupon_code&&<p className="mt-3">Mã ưu đãi: <strong>{promotion.coupon_code}</strong></p>}</div>}
    {error?<Message error>{error} <button className="underline" onClick={()=>setRetry(r=>r+1)}>Thử lại</button></Message>:!data?<Message>Đang tải gói học…</Message>:!data.items.length?<Message>Chưa có gói mở bán. Bạn có thể tiếp tục khám phá thư viện khóa học.</Message>:<>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.items.map(p=><article key={p.id} className={`${panelClass} flex flex-col`}>
        <p className="text-xs font-black uppercase tracking-widest text-teal-700 dark:text-teal-300">{type==='video'?'HỌC QUA VIDEO':'VIDEO + LUYỆN TẬP'}</p><h2 className="mt-3 text-xl font-black">{p.name}</h2>
        {courseId>0&&p.courses.some(c=>Number(c.id)===courseId)&&<p className="mt-2 text-sm font-bold text-teal-700">Có khóa bạn đang xem</p>}
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{p.description}</p>
        <p className="mt-5 text-3xl font-black">{p.video?.requiresSubjectChoice&&Object.keys(p.subjectPrices).length?'Từ ':''}{money(p.video?.requiresSubjectChoice?Math.min(...p.video.allowedSubjects.map(s=>p.subjectPrices[s]??p.priceVnd??0)):p.priceVnd)}</p>
        {p.originalPriceVnd!=null&&p.originalPriceVnd>(p.priceVnd??0)&&<del className="text-sm text-slate-500">{money(p.originalPriceVnd)}</del>}
        <dl className="my-5 space-y-2 text-sm"><div><dt className="font-bold">Quyền video</dt><dd>{p.video?.durationMode==='lifetime'?'Không giới hạn':`${p.video?.durationDays} ngày`} · {p.video?.requiresSubjectChoice?'Chọn 1 môn':p.video?.allowedSubjects.map(s=>subjects[s]).join(', ')}</dd></div>{p.vip&&<div><dt className="font-bold">{p.vip.name}</dt><dd>{'vipDurationDays' in p?String(p.vipDurationDays):''} ngày quyền gói</dd></div>}</dl>
        <ul className="mb-5 space-y-2 text-sm">{p.courses.map(c=><li key={c.id}><Link href={`/khoa-hoc/${c.slug}`} className="underline decoration-slate-300 underline-offset-4">{c.title}</Link></li>)}{p.features.map(f=><li key={f}>✓ {f}</li>)}</ul>
        <Link href={`/thanh-toan-khoa-hoc?type=${type}&productId=${p.id}`} className={`${p.canPurchase?buttonClass:secondaryClass} mt-auto`}>{p.canPurchase?'Chọn gói này':'Xem chi tiết gói'}</Link>
      </article>)}</div><Pager page={page} hasMore={data.hasMore} onPage={setPage}/></>}
  </>;
  return embedded ? <section className="text-slate-900">{content}</section> : <ShopShell title="Chọn gói cho hành trình của bạn">{content}</ShopShell>;
}
