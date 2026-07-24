'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import learningApi from '@/lib/api/learning';
import type { MyLearningItemDto } from '@/lib/types/courses';

export function MyLearningClient() {
  const [items, setItems] = useState<MyLearningItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    learningApi.getMyLearning()
      .then((data) => active && setItems(data))
      .catch(() => active && setError('Không thể tải khóa học của bạn. Hãy đăng nhập lại nếu phiên đã hết hạn.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [requestVersion]);

  if (loading) return <div aria-label="Đang tải khóa học" className="grid gap-6 md:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}<button type="button" className="ml-4 font-bold underline" onClick={() => setRequestVersion((value) => value + 1)}>Thử lại</button></div>;
  if (!items.length) return <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700 dark:bg-slate-900/40"><p className="text-slate-500 dark:text-slate-400">Bạn chưa đăng ký khóa học CSCA nào.</p><Link href="/khoa-hoc" className="mt-4 inline-block font-bold text-indigo-700 dark:text-indigo-300">Khám phá khóa học →</Link></div>;

  return <div className="grid gap-6 md:grid-cols-2">{items.map(({ course, enrollment }) => { const lessonId = enrollment.progress.lastLessonId; return <article key={enrollment.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{course.subjectCode}</p><h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{course.title}</h2><div className="mt-5 h-2 rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={`Tiến độ ${course.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(enrollment.progress.completionPct)}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, enrollment.progress.completionPct)}%` }} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-500 dark:text-slate-400">{Math.round(enrollment.progress.completionPct)}% hoàn thành</span><Link href={lessonId ? `/hoc/${course.slug}/bai-hoc/${lessonId}` : `/khoa-hoc/${course.slug}`} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-500">{lessonId ? 'Tiếp tục học' : 'Xem khóa học'}</Link></div></article>; })}</div>;
}
