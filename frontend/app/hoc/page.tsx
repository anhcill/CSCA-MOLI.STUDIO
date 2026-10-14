import Link from 'next/link';
import { FiArrowLeft, FiCloud, FiPlayCircle, FiTrendingUp } from 'react-icons/fi';
import { MyLearningClient } from '@/components/learning/MyLearningClient';

export default function MyLearningPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,.16),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(34,211,238,.12),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl">
        <Link href="/khoa-hoc" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
          <FiArrowLeft /> Khám phá khóa học
        </Link>

        <section className="relative mt-6 overflow-hidden rounded-[2.25rem] bg-slate-950 px-7 py-9 text-white shadow-2xl shadow-indigo-950/20 sm:px-10 lg:px-12">
          <div className="absolute -right-24 -top-36 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.18em] text-cyan-200">
                <FiTrendingUp /> Không gian học tập
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Khóa học của tôi</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Tiếp tục đúng bài đang học, theo dõi tiến độ thực tế và chuyển thiết bị mà không mất vị trí đang xem.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[25rem]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <FiCloud className="h-5 w-5 text-cyan-300" />
                <p className="mt-2 font-black">Đồng bộ tự động</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">Tiến độ lưu trên tài khoản, không phụ thuộc thiết bị.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <FiPlayCircle className="h-5 w-5 text-violet-300" />
                <p className="mt-2 font-black">Học tiếp tức thì</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">Quay lại đúng bài và thời điểm xem gần nhất.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <MyLearningClient />
        </section>
      </div>
    </main>
  );
}
