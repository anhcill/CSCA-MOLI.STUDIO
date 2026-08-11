'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import { LessonWorkEditor } from '@/components/courses/LessonWorkEditor';
import coursesApi from '@/lib/api/courses';
import type { CourseAdminDto } from '@/lib/types/courses';

export default function TeachingCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const id = Number(courseId);
  const [course, setCourse] = useState<CourseAdminDto | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Mã khóa học không hợp lệ.'); setLoading(false); return; }
    try {
      setLoading(true); setError('');
      const next = await coursesApi.getTeachingCourse(id);
      setCourse(next);
      const lessonIds = next.curriculum.flatMap((section) => section.lessons.map((lesson) => lesson.id));
      setSelectedLessonId((current) => current && lessonIds.includes(current) ? current : lessonIds[0] || null);
    } catch { setError('Không thể mở khóa học này hoặc bạn chưa được phân công.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => course?.curriculum.flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title }))).find((lesson) => lesson.id === selectedLessonId) || null, [course, selectedLessonId]);

  return (
    <AdminLayout title="Giao & chấm bài" description={course?.title || 'Khóa học được phân công'}>
      <Link href="/admin/teaching" className="mb-5 inline-flex font-bold text-indigo-700 dark:text-indigo-300">← Danh sách khóa được phân công</Link>
      {loading ? <div className="h-80 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" /> : error || !course ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-300">{error || 'Không có dữ liệu.'}</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-5">
            <div className="border-b border-slate-200 p-4 dark:border-slate-700"><h2 className="font-black">Chọn bài học</h2><p className="mt-1 text-xs text-slate-500">Chỉ dùng để chọn nơi giao bài, không chỉnh sửa nội dung bài học.</p></div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {course.curriculum.map((section) => (
                <div key={section.id} className="mb-3">
                  <p className="px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400">{section.title}</p>
                  {section.lessons.map((lesson) => (
                    <button key={lesson.id} type="button" onClick={() => setSelectedLessonId(lesson.id)} className={`mb-1 w-full rounded-xl px-3 py-3 text-left text-sm font-bold transition ${selectedLessonId === lesson.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{lesson.title}</button>
                  ))}
                </div>
              ))}
            </div>
          </aside>
          <main>
            {selected ? <><div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-black uppercase text-indigo-600">{selected.sectionTitle}</p><h1 className="mt-1 text-xl font-black">{selected.title}</h1></div><LessonWorkEditor key={selected.id} courseId={id} lessonId={selected.id} teacherMode /></> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Khóa học chưa có bài học để giao bài.</div>}
          </main>
        </div>
      )}
    </AdminLayout>
  );
}
