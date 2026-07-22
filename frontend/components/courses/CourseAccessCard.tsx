'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import coursesApi from '@/lib/api/courses';
import type { CourseDetailDto } from '@/lib/types/courses';

export function CourseAccessCard({ course }: { course: CourseDetailDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handleAction = async () => {
    if (course.access.canLearn) {
      const lessonId = course.progress?.lastLessonId ?? course.curriculum[0]?.lessons[0]?.id;
      return router.push(lessonId ? `/hoc/${course.slug}/bai-hoc/${lessonId}` : '/hoc');
    }
    if (!course.access.canEnroll) return router.push('/vip');
    try {
      setBusy(true); setError('');
      const enrollment = await coursesApi.enroll(course.id);
      const lessonId = enrollment.progress?.lastLessonId ?? course.curriculum[0]?.lessons[0]?.id;
      router.push(lessonId ? `/hoc/${course.slug}/bai-hoc/${lessonId}` : '/hoc');
    } catch {
      setError('Chưa thể đăng ký khóa học. Vui lòng thử lại.'); setBusy(false);
    }
  };
  return <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl lg:sticky lg:top-6"><div className="aspect-video rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-700" /><p className="mt-5 text-sm font-bold text-slate-500">Quyền truy cập</p><p className="text-3xl font-black uppercase text-indigo-700">{course.accessType}</p><button type="button" onClick={handleAction} disabled={busy} className="mt-5 w-full rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? 'Đang xử lý...' : course.access.ctaLabel}</button>{error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}<ul className="mt-5 space-y-2 text-sm text-slate-600"><li>{course.totalSections} chương</li><li>{course.totalLessons} bài học</li><li>Trình độ: {course.level}</li><li>{course.certificateEnabled ? 'Có chứng nhận hoàn thành' : 'Không có chứng nhận'}</li></ul></aside>;
}
