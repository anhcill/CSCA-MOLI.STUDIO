'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiRefreshCw, FiTarget } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseDetailDto } from '@/lib/types/courses';
import { CourseAccessCard } from './CourseAccessCard';
import { CourseHero } from './CourseHero';
import { CurriculumAccordion } from './CurriculumAccordion';

export function CourseDetailClient({ slug }: { slug: string }) {
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    coursesApi.getCourse(slug)
      .then((data) => active && setCourse(data))
      .catch(() => active && setError('Không tìm thấy khóa học hoặc khóa học chưa được công bố.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug, requestVersion]);

  if (loading) return <div aria-label="Đang tải khóa học" className="space-y-8"><div className="h-[430px] animate-pulse rounded-[2rem] bg-slate-200" /><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="h-96 animate-pulse rounded-[1.75rem] bg-slate-200" /><div className="h-96 animate-pulse rounded-[1.75rem] bg-slate-200" /></div></div>;
  if (error || !course) return <div role="alert" className="rounded-[2rem] border border-red-200 bg-white p-12 text-center shadow-sm"><p className="text-lg font-black text-red-700">{error || 'Không có dữ liệu khóa học.'}</p><button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-bold text-white"><FiRefreshCw /> Thử lại</button></div>;

  return (
    <>
      <CourseHero course={course} />
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
        <main className="space-y-8">
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700"><FiTarget /></span><div><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Kết quả sau khóa học</p><h2 className="text-2xl font-black text-slate-950 sm:text-3xl">Bạn sẽ học được gì?</h2></div></div>
            {course.outcomes.length ? <ul className="mt-6 grid gap-3 sm:grid-cols-2">{course.outcomes.map((outcome) => <li key={outcome} className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold leading-6 text-emerald-950"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white"><FiCheck /></span>{outcome}</li>)}</ul> : <p className="mt-4 text-slate-500">Nội dung đang được cập nhật.</p>}
          </section>

          {course.descriptionHtml ? <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black text-slate-950">Giới thiệu khóa học</h2><div className="prose prose-slate mt-5 max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: course.descriptionHtml }} /></section> : null}

          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">Lộ trình từng bước</p><h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Nội dung khóa học</h2></div><p className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">{course.totalSections} chương · {course.totalLessons} bài</p></div>
            <div className="mt-6"><CurriculumAccordion sections={course.curriculum} /></div>
          </section>

          {course.requirements.length ? <section className="rounded-[1.75rem] border border-amber-200/80 bg-amber-50 p-6 sm:p-8"><h2 className="text-xl font-black text-amber-950">Bạn cần chuẩn bị gì?</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{course.requirements.map((item) => <li key={item} className="flex gap-2 text-sm font-semibold leading-6 text-amber-900"><FiCheck className="mt-1 shrink-0 text-amber-600" /> {item}</li>)}</ul></section> : null}
        </main>
        <CourseAccessCard course={course} />
      </div>
    </>
  );
}
