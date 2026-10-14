'use client';

import Link from 'next/link';

export default function UpgradeNavigation({ section }: { section: string }) {
  const sections = [
    { id: 'practice', label: 'Gói luyện tập', description: 'Các gói nâng cấp hiện có' },
    { id: 'video', label: 'Gói video', description: 'Học các khóa video theo gói' },
    { id: 'combo', label: 'Gói + video', description: 'Kết hợp luyện tập và khóa video' },
  ];
  return <nav aria-label="Chọn loại gói nâng cấp" className="mb-10">
    <div className="grid gap-3 sm:grid-cols-3">
      {sections.map(item => <Link key={item.id} href={`/vip?section=${item.id}`} aria-current={section === item.id ? 'page' : undefined}
        className={`rounded-2xl border p-4 transition ${section === item.id ? 'border-teal-700 bg-teal-700 text-white shadow-md' : 'border-slate-200 bg-white text-slate-900 hover:border-teal-600'}`}>
        <span className="block text-base font-black">{item.label}</span>
        <span className={`mt-1 block text-sm ${section === item.id ? 'text-teal-50' : 'text-slate-500'}`}>{item.description}</span>
      </Link>)}
    </div>
    <div className="mt-4 text-right"><Link href="/tai-khoan/goi-video" className="text-sm font-bold text-teal-800 underline underline-offset-4">Gói video đã mua & lịch sử thanh toán</Link></div>
  </nav>;
}
