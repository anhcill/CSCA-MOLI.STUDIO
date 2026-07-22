'use client';

import { useEffect, useState } from 'react';
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

  if (loading) return <div aria-label="Đang tải khóa học" className="h-[70vh] animate-pulse rounded-3xl bg-slate-200" />;
  if (error || !course) return <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-red-700"><p>{error || 'Không có dữ liệu khóa học.'}</p><button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="mt-4 font-bold underline">Thử lại</button></div>;

  return <><CourseHero course={course} /><div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"><main className="space-y-12"><section><h2 className="text-3xl font-black">Bạn sẽ học được gì?</h2>{course.outcomes.length ? <ul className="mt-5 grid gap-3 sm:grid-cols-2">{course.outcomes.map((outcome) => <li key={outcome} className="rounded-xl bg-emerald-50 p-4 text-emerald-900">✓ {outcome}</li>)}</ul> : <p className="mt-4 text-slate-500">Nội dung đang được cập nhật.</p>}</section><section><h2 className="mb-5 text-3xl font-black">Nội dung khóa học</h2><CurriculumAccordion sections={course.curriculum} /></section></main><CourseAccessCard course={course} /></div></>;
}
