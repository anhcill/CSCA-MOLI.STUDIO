import Link from 'next/link';
import { MyLearningClient } from '@/components/learning/MyLearningClient';

export default function MyLearningPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-6xl"><Link href="/khoa-hoc" className="mb-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">← Khám phá khóa học</Link><h1 className="text-4xl font-black text-slate-950">Khóa học của tôi</h1><p className="mb-8 mt-3 text-slate-600">Tiếp tục lộ trình học CSCA từ vị trí gần nhất.</p><MyLearningClient /></div></main>;
}
