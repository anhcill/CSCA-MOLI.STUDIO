import type { Metadata } from 'next';
import Link from 'next/link';
import { FiArrowLeft, FiBookOpen, FiPlayCircle, FiTrendingUp } from 'react-icons/fi';
import { CourseCatalogClient } from '@/components/courses/CourseCatalogClient';

export const metadata: Metadata = {
  title: 'Khóa học CSCA',
  description: 'Khóa học video luyện thi CSCA theo từng môn.',
};

export default function CoursesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f7fb] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md">
            <FiArrowLeft aria-hidden="true" /> Về trang chủ
          </Link>
          <Link href="/hoc" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md">
            <FiBookOpen aria-hidden="true" /> Khóa học của tôi
          </Link>
        </nav>

        <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-10 text-white shadow-[0_30px_80px_rgba(49,46,129,0.22)] sm:px-10 sm:py-14 lg:px-14">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute right-8 top-8 hidden h-44 w-44 rotate-12 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-sm lg:block" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              <FiPlayCircle aria-hidden="true" /> CSCA Learning
            </span>
            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Học đúng trọng tâm,<br className="hidden sm:block" /> tiến bộ theo từng bài.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Lộ trình video dành riêng cho Toán, Vật lý, Hóa học và Tiếng Trung CSCA — từ nền tảng đến luyện đề.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
              <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">✓ Học theo lộ trình</span>
              <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">✓ Theo dõi tiến độ</span>
              <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">✓ Xem trên mọi thiết bị</span>
            </div>
          </div>
          <div className="relative mt-9 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/10 pt-6 text-center sm:text-left">
            <div><p className="text-2xl font-black text-white">5</p><p className="mt-1 text-xs font-semibold text-slate-400">nhóm môn CSCA</p></div>
            <div><p className="text-2xl font-black text-white">4K</p><p className="mt-1 text-xs font-semibold text-slate-400">trải nghiệm sắc nét</p></div>
            <div><p className="flex items-center justify-center gap-1 text-2xl font-black text-white sm:justify-start"><FiTrendingUp /> 24/7</p><p className="mt-1 text-xs font-semibold text-slate-400">học theo nhịp riêng</p></div>
          </div>
        </section>

        <div className="mt-12">
          <CourseCatalogClient />
        </div>
      </div>
    </main>
  );
}
