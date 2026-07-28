'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiMonitor,
  FiPlay,
  FiRefreshCw,
} from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type { MyLearningItemDto } from '@/lib/types/courses';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} giờ ${remainder} phút` : `${hours} giờ`;
}

function formatPosition(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function MyLearningClient() {
  const [items, setItems] = useState<MyLearningItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let requestRunning = false;
    const load = async (initial = false) => {
      if (requestRunning) return;
      requestRunning = true;
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError('');
      try {
        const data = await learningApi.getMyLearning();
        if (active) setItems(data);
      } catch {
        if (active) setError('Không thể tải khóa học của bạn. Hãy đăng nhập lại nếu phiên đã hết hạn.');
      } finally {
        requestRunning = false;
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [requestVersion]);

  if (loading) {
    return (
      <div aria-label="Đang tải khóa học" className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-[2rem] bg-slate-200/80 dark:bg-slate-800" />)}
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-7 text-red-700 shadow-sm dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
        <p className="font-semibold">{error}</p>
        <button type="button" className="mt-4 inline-flex items-center gap-2 font-black underline" onClick={() => setRequestVersion((value) => value + 1)}>
          <FiRefreshCw /> Thử lại
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><FiBookOpen className="h-8 w-8" /></span>
        <h2 className="mt-5 text-xl font-black">Chưa có khóa học</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Chọn một lộ trình CSCA để bắt đầu học và đồng bộ tiến độ trên mọi thiết bị.</p>
        <Link href="/khoa-hoc" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700">
          Khám phá khóa học <FiArrowRight />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {items.length} khóa học đang tham gia
        </p>
        <span className={`inline-flex items-center gap-2 text-xs font-bold text-emerald-700 transition-opacity dark:text-emerald-300 ${refreshing ? 'opacity-100' : 'opacity-0'}`}>
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Đang đồng bộ
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {items.map(({ course, enrollment }) => {
          const progress = Math.min(100, Math.max(0, enrollment.progress.completionPct));
          const roundedProgress = Math.round(progress);
          const lessonId = enrollment.progress.lastLessonId;
          const started = Boolean(lessonId) || progress > 0;
          const target = lessonId
            ? `/hoc/${course.slug}/bai-hoc/${lessonId}`
            : `/khoa-hoc/${course.slug}`;
          const coverStyle = course.thumbnailUrl
            ? { backgroundImage: `linear-gradient(90deg, rgba(15,23,42,.9), rgba(30,41,59,.45)), url("${course.thumbnailUrl}")` }
            : undefined;

          return (
            <article key={enrollment.id} className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_16px_50px_-28px_rgba(15,23,42,.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_-28px_rgba(79,70,229,.45)] dark:border-slate-800 dark:bg-slate-900">
              <div
                className="relative min-h-40 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-700 bg-cover bg-center p-6 text-white"
                style={coverStyle}
              >
                <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-cyan-400/20 blur-2xl" />
                <div className="relative flex items-start justify-between gap-5">
                  <div>
                    <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-wider backdrop-blur">
                      {course.subjectCode}
                    </span>
                    <h2 className="mt-4 max-w-xl text-2xl font-black leading-tight">{course.title}</h2>
                  </div>
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full p-1 shadow-lg" style={{ background: `conic-gradient(#67e8f9 ${progress * 3.6}deg, rgba(255,255,255,.18) 0)` }}>
                    <div className="grid h-full w-full place-items-center rounded-full bg-slate-950/90 text-lg font-black">{roundedProgress}%</div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2"><FiBookOpen /> {enrollment.progress.completedLessons}/{enrollment.progress.totalLessons} bài hoàn thành</span>
                  <span className="inline-flex items-center gap-2"><FiClock /> {formatDuration(course.totalDurationSeconds)}</span>
                  <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><FiMonitor /> Đồng bộ đa thiết bị</span>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      {progress >= 100 ? 'Đã hoàn thành' : started ? 'Đang học' : 'Chưa bắt đầu'}
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-300">{roundedProgress}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={`Tiến độ ${course.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={roundedProgress}>
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">{started ? 'Học gần nhất' : 'Sẵn sàng bắt đầu'}</p>
                    <p className="mt-1 truncate font-bold text-slate-800 dark:text-slate-100">
                      {enrollment.progress.lastLessonTitle || 'Bắt đầu bài học đầu tiên'}
                    </p>
                    {enrollment.progress.lastPositionSeconds > 0 ? <p className="mt-1 text-xs text-slate-500">Tiếp tục tại {formatPosition(enrollment.progress.lastPositionSeconds)}</p> : null}
                  </div>
                  <Link href={target} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">
                    {progress >= 100 ? <><FiCheckCircle /> Xem lại</> : started ? <><FiPlay /> Tiếp tục học</> : <>Bắt đầu học <FiArrowRight /></>}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
