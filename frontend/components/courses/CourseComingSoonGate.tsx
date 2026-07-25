'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiCalendar, FiHeart, FiLock, FiPlayCircle, FiStar } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';

export function CourseComingSoonGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#fff8fc] dark:bg-slate-950" />;
  }

  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-fuchsia-50 to-indigo-100 px-4 py-12 text-slate-900 dark:from-slate-950 dark:via-fuchsia-950/30 dark:to-indigo-950">
      <div className="absolute left-[8%] top-[12%] text-4xl text-pink-300/70 motion-safe:animate-bounce">✦</div>
      <div className="absolute right-[10%] top-[18%] text-3xl text-violet-300/70 motion-safe:animate-pulse">♡</div>
      <div className="absolute bottom-[14%] left-[14%] text-3xl text-indigo-300/70 motion-safe:animate-pulse">✿</div>
      <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-pink-300/25 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl" />

      <section className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/85 p-7 text-center shadow-[0_30px_100px_rgba(124,58,237,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 sm:p-12">
        <Link href="/" className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800">
          <FiArrowLeft /> Trang chủ
        </Link>

        <div className="mx-auto mt-10 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-pink-400 via-fuchsia-500 to-violet-600 text-4xl text-white shadow-xl shadow-fuchsia-300/40 dark:shadow-fuchsia-950/60">
          <FiPlayCircle />
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-600 dark:border-pink-900 dark:bg-pink-950/50 dark:text-pink-300">
          <FiLock /> Đang chuẩn bị thật xinh
        </div>

        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl">
          Khóa học sắp mở rồi nè!
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
          MOLY đang chăm chút từng video, bài học và lộ trình để bạn học CSCA thật dễ hiểu, thật vui và không còn “hoang mang” nữa.
        </p>

        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-4 rounded-3xl border border-violet-100 bg-gradient-to-r from-pink-50 to-violet-50 p-5 dark:border-violet-900/60 dark:from-pink-950/40 dark:to-violet-950/40">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-300">
            <FiCalendar />
          </span>
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest text-violet-500">Hẹn bạn</p>
            <p className="mt-1 text-2xl font-black text-violet-900 dark:text-violet-100">Tháng 8 này nha ♡</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm dark:bg-slate-800"><FiStar className="text-amber-400" /> Video dễ hiểu</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm dark:bg-slate-800"><FiHeart className="text-pink-500" /> Lộ trình có tâm</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm dark:bg-slate-800"><FiPlayCircle className="text-violet-500" /> Học mọi lúc</span>
        </div>

        <p className="mt-9 text-sm font-semibold text-slate-400 dark:text-slate-500">
          Cảm ơn bạn đã chờ MOLY thêm một chút nhé ✨
        </p>
      </section>
    </main>
  );
}
