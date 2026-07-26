'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAward,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiPlayCircle,
  FiShield,
} from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseDetailDto } from '@/lib/types/courses';

const levelLabels = {
  basic: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

type CourseWithPackages = CourseDetailDto & {
  packages?: Array<{ id: number; name: string }>;
  packageSummaries?: Array<{ id?: number; name?: string } | string>;
  packageNames?: string[];
};

function packageNames(course: CourseDetailDto): string[] {
  const source = course as CourseWithPackages;
  const names = [
    ...(source.packages ?? []).map((item) => item.name),
    ...(source.packageSummaries ?? []).map((item) => typeof item === 'string' ? item : item.name),
    ...(source.packageNames ?? []),
  ];
  return [...new Set(names.filter((name): name is string => Boolean(name?.trim())).map((name) => name.trim()))];
}

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours) return `${Math.max(1, minutes)} phút`;
  return `${hours} giờ${minutes ? ` ${minutes} phút` : ''}`;
}

function accessHeading(course: CourseDetailDto, names: string[]) {
  if (course.access.canLearn) return 'Bạn đã có quyền học';
  if (course.accessType === 'free') return 'Khóa học miễn phí';
  if (course.accessType === 'contact') return 'Liên hệ để đăng ký';
  if (course.accessType === 'private') return 'Khóa học riêng';
  return names.length ? 'Mở khóa theo gói' : 'Cần gói học phù hợp';
}

function actionLabel(course: CourseDetailDto) {
  if (course.access.canLearn) return course.progress ? 'Tiếp tục học' : 'Bắt đầu học';
  if (course.access.canEnroll) return course.accessType === 'free' ? 'Đăng ký miễn phí' : 'Đăng ký học';
  if (course.access.reasonCode === 'AUTH_REQUIRED') return 'Đăng nhập để học';
  if (course.accessType === 'contact' || course.accessType === 'private') return 'Liên hệ tư vấn';
  return 'Xem gói mở khóa';
}

export function CourseAccessCard({ course }: { course: CourseDetailDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const names = packageNames(course);

  const openFirstLesson = (lastLessonId?: number | null) => {
    const lessonId = lastLessonId ?? course.curriculum[0]?.lessons[0]?.id;
    if (!lessonId) {
      setError('Khóa học chưa có bài học được xuất bản. Vui lòng quay lại sau.');
      setBusy(false);
      return;
    }
    router.push(`/hoc/${course.slug}/bai-hoc/${lessonId}`);
  };

  const handleAction = async () => {
    if (course.access.canLearn) return openFirstLesson(course.progress?.lastLessonId);

    if (!course.access.canEnroll) {
      if (course.access.reasonCode === 'AUTH_REQUIRED') {
        const redirect = `/khoa-hoc/${course.slug}`;
        return router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      }
      if (course.accessType === 'contact' || course.accessType === 'private') {
        return router.push('/lien-he');
      }
      return router.push(`/vip?course=${encodeURIComponent(course.slug)}`);
    }

    try {
      setBusy(true);
      setError('');
      const enrollment = await coursesApi.enroll(course.id);
      openFirstLesson(enrollment.progress?.lastLessonId);
    } catch {
      setError('Chưa thể đăng ký khóa học. Vui lòng đăng nhập hoặc thử lại sau.');
      setBusy(false);
    }
  };

  return (
    <aside className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)] lg:sticky lg:top-6">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Quyền truy cập khóa học</p>
        <p className="mt-2 text-2xl font-black">{accessHeading(course, names)}</p>
        {course.access.canLearn ? (
          <p className="mt-2 text-sm font-semibold text-indigo-100">Quyền học của bạn đang hoạt động.</p>
        ) : names.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {names.map((name) => (
              <span key={name} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {name}
              </span>
            ))}
          </div>
        ) : course.accessType !== 'free' ? (
          <p className="mt-2 text-sm font-semibold text-indigo-100">Chọn gói có khóa học này trong trang thanh toán.</p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-indigo-100">Bắt đầu học ngay hôm nay.</p>
        )}
      </div>

      <div className="p-6">
        <button
          type="button"
          onClick={handleAction}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-indigo-700"
        >
          {course.access.canLearn || course.access.canEnroll ? <FiPlayCircle className="text-xl" /> : <FiPackage className="text-xl" />}
          {busy ? 'Đang xử lý...' : actionLabel(course)}
        </button>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-3"><FiBookOpen className="text-lg text-indigo-600 dark:text-indigo-400" /><span><strong className="text-slate-900 dark:text-white">{course.totalSections} chương</strong> · {course.totalLessons} bài học</span></li>
          <li className="flex items-center gap-3"><FiClock className="text-lg text-indigo-600 dark:text-indigo-400" /><span>Thời lượng <strong className="text-slate-900 dark:text-white">{durationLabel(course.totalDurationSeconds)}</strong></span></li>
          <li className="flex items-center gap-3"><FiShield className="text-lg text-indigo-600 dark:text-indigo-400" /><span>Trình độ <strong className="text-slate-900 dark:text-white">{levelLabels[course.level]}</strong></span></li>
          <li className="flex items-center gap-3"><FiAward className="text-lg text-indigo-600 dark:text-indigo-400" /><span>{course.certificateEnabled ? 'Có chứng nhận hoàn thành' : 'Theo dõi tiến độ học tập'}</span></li>
        </ul>

        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="flex items-center gap-2 font-black"><FiCheckCircle /> Học linh hoạt</p>
          <p className="mt-1 leading-5 text-emerald-700 dark:text-emerald-300">Tiến độ được lưu tự động trên mọi thiết bị.</p>
        </div>
      </div>
    </aside>
  );
}
