'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiAward, FiBookOpen, FiCheckCircle, FiClock, FiPlayCircle, FiShield } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseDetailDto } from '@/lib/types/courses';

const accessLabels = { free: 'Miễn phí', vip: 'Gói VIP', premium: 'Gói Premium', contact: 'Liên hệ tư vấn', private: 'Khóa học riêng' };
const levelLabels = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' };

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours} giờ ` : ''}${minutes} phút`;
}

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

  return (
    <aside className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)] lg:sticky lg:top-6">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-6 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Quyền truy cập</p><p className="mt-2 text-3xl font-black">{accessLabels[course.accessType]}</p>{course.priceVnd ? <p className="mt-1 text-lg font-bold text-indigo-100">{course.priceVnd.toLocaleString('vi-VN')}đ</p> : <p className="mt-1 text-sm font-semibold text-indigo-100">Bắt đầu học ngay hôm nay</p>}</div>
      <div className="p-6">
        <button type="button" onClick={handleAction} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-indigo-700"><FiPlayCircle className="text-xl" /> {busy ? 'Đang xử lý...' : course.access.ctaLabel}</button>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
        <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300"><li className="flex items-center gap-3"><FiBookOpen className="text-lg text-indigo-600 dark:text-indigo-400" /><span><strong className="text-slate-900 dark:text-white">{course.totalSections} chương</strong> · {course.totalLessons} bài học</span></li><li className="flex items-center gap-3"><FiClock className="text-lg text-indigo-600 dark:text-indigo-400" /><span>Thời lượng <strong className="text-slate-900 dark:text-white">{durationLabel(course.totalDurationSeconds)}</strong></span></li><li className="flex items-center gap-3"><FiShield className="text-lg text-indigo-600 dark:text-indigo-400" /><span>Trình độ <strong className="text-slate-900 dark:text-white">{levelLabels[course.level]}</strong></span></li><li className="flex items-center gap-3"><FiAward className="text-lg text-indigo-600 dark:text-indigo-400" /><span>{course.certificateEnabled ? 'Có chứng nhận hoàn thành' : 'Theo dõi tiến độ học tập'}</span></li></ul>
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><p className="flex items-center gap-2 font-black"><FiCheckCircle /> Học linh hoạt</p><p className="mt-1 leading-5 text-emerald-700 dark:text-emerald-300">Tiến độ được lưu tự động trên mọi thiết bị.</p></div>
      </div>
    </aside>
  );
}
