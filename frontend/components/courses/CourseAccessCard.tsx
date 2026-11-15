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
import { MOLY_ZALO_URL } from '@/lib/constants/moly';
import { CourseOwnershipBadge } from '@/components/courses/CourseOwnershipBadge';
import { CourseSsoLaunchButton } from '@/components/courses/CourseSsoLaunchButton';

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
  const unpricedBlocked = course.checkoutReady === false && !course.owned;
  if (unpricedBlocked) return 'Đang cập nhật học phí';
  if (course.accessType === 'free') return 'Khóa học miễn phí';
  if (course.accessType === 'contact') return 'Liên hệ để đăng ký';
  if (course.accessType === 'private') return 'Khóa học riêng';
  return names.length ? 'Mở khóa theo gói' : 'Cần gói học phù hợp';
}

function actionLabel(course: CourseDetailDto) {
  if (course.access.canLearn) return course.progress ? 'Tiếp tục học' : 'Bắt đầu học';
  const blockCode = course.access.blockCode ?? course.blockCode ?? null;
  if ((course.checkoutReady === false && !course.owned) || blockCode === 'PRICE_NOT_CONFIGURED') {
    return 'Chưa mở bán';
  }
  if (course.access.canEnroll) return course.accessType === 'free' ? 'Đăng ký miễn phí' : 'Đăng ký học';
  const ownershipStatus = course.access.ownershipStatus ?? course.ownershipStatus;
  if (ownershipStatus === 'expired') return 'Mua lại khóa học';
  if (ownershipStatus === 'verification_required') return 'Cần xác minh tài khoản';
  if (ownershipStatus === 'not_owned' && course.accessType !== 'free' && course.accessType !== 'contact' && course.accessType !== 'private') {
    return 'Mua khóa học';
  }
  if (course.access.reasonCode === 'AUTH_REQUIRED') return 'Đăng nhập để học';
  if (course.accessType === 'contact' || course.accessType === 'private') return 'Liên hệ tư vấn';
  return 'Xem gói mở khóa';
}

export function CourseAccessCard({ course }: { course: CourseDetailDto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const names = packageNames(course);
  const ownershipStatus = course.access.ownershipStatus ?? course.ownershipStatus ?? null;
  const ownershipLabel = course.access.ownershipLabel ?? course.ownershipLabel ?? null;
  const canLaunchCourse = Boolean(course.access.canLaunchCourse ?? course.canLaunchCourse);
  const ssoTargetPath = course.access.ssoTargetPath ?? course.ssoTargetPath ?? null;
  const blockCode = course.access.blockCode ?? course.blockCode ?? null;
  const isUnpricedBlocked = !course.access.canLearn && !course.owned
    && (course.checkoutReady === false || blockCode === 'PRICE_NOT_CONFIGURED');
  const isCscaCourse = course.contentOrigin === 'csca_course';
  const firstUnitHref = course.firstUnitHref || course.curriculum[0]?.lessons[0]?.href || null;
  const firstFreePreviewLesson = !course.access.canLearn
    ? course.curriculum.flatMap((s) => s.lessons).find((l) => l.isFreePreview)
    : undefined;

  const openFirstLesson = (lastLessonId?: number | string | null) => {
    if (isCscaCourse && firstUnitHref) {
      router.push(firstUnitHref);
      return;
    }
    const lessonId = lastLessonId ?? course.curriculum[0]?.lessons[0]?.id;
    const lessonHref = course.curriculum.flatMap((s) => s.lessons).find((l) => l.id === lessonId)?.href;
    if (lessonHref) {
      router.push(lessonHref);
      return;
    }
    if (!lessonId) {
      setError('Khóa học chưa có bài học được xuất bản. Vui lòng quay lại sau.');
      setBusy(false);
      return;
    }
    router.push(`/hoc/${course.slug}/bai-hoc/${lessonId}`);
  };

  const handleAction = async () => {
    if (course.access.canLearn) return openFirstLesson(course.progress?.lastLessonId);
    if (isUnpricedBlocked) return;

    if (!course.access.canEnroll) {
      if (course.access.reasonCode === 'AUTH_REQUIRED') {
        const redirect = `/khoa-hoc/${course.slug}`;
        return router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
      }
      if (course.accessType === 'contact' || course.accessType === 'private') {
        window.open(MOLY_ZALO_URL, '_blank', 'noopener,noreferrer');
        return;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Quyền truy cập khóa học</p>
          {ownershipStatus ? (
            <CourseOwnershipBadge status={ownershipStatus} label={ownershipLabel} className="bg-white/95" />
          ) : null}
        </div>
        <p className="mt-2 text-2xl font-black">{accessHeading(course, names)}</p>
        {course.access.canLearn ? (
          <p className="mt-2 text-sm font-semibold text-indigo-100">Quyền học của bạn đang hoạt động.</p>
        ) : isUnpricedBlocked ? (
          <p className="mt-2 text-sm font-semibold text-indigo-100">Khóa học đã được đồng bộ và đang chờ cấu hình gói học phí để mở bán.</p>
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
        {ownershipStatus === 'pending_sync' ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
            <p>Đang đồng bộ quyền học từ CSCA Course. Hệ thống sẽ cập nhật trong giây lát.</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-2 inline-flex items-center gap-1.5 font-black underline"
            >
              Đồng bộ lại quyền
            </button>
          </div>
        ) : null}
        {ownershipStatus === 'verification_required' ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-200">
            <p>Email tài khoản đang trùng trên hai hệ thống và cần xác minh liên kết an toàn trước khi đồng bộ quyền.</p>
          </div>
        ) : null}
        {ownershipStatus === 'grant_blocked' ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <p>Quyền truy cập khóa học hiện đang bị tạm khóa hoặc thu hồi.</p>
          </div>
        ) : null}
        {ownershipStatus === 'expired' ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <p>Quyền truy cập khóa học trước đây của bạn đã hết hạn.</p>
          </div>
        ) : null}

        {isUnpricedBlocked ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
            <p>Khóa học chưa cấu hình học phí trên Moly nên chưa thể thanh toán hoặc tự đăng ký.</p>
          </div>
        ) : null}

        {isCscaCourse && (course.access.canLearn || course.owned) && firstUnitHref ? (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => router.push(firstUnitHref)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              <FiPlayCircle className="text-xl" />
              {course.progress ? 'Tiếp tục học trên Moly' : 'Vào học ngay trên Moly'}
            </button>
            {canLaunchCourse ? (
              <CourseSsoLaunchButton courseId={course.id} targetPath={ssoTargetPath} label="Mở trên CSCA-Course" className="!bg-slate-100 !text-slate-800 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-100" />
            ) : null}
          </div>
        ) : (
          <>
            {canLaunchCourse ? (
              <div className="mb-3">
                <CourseSsoLaunchButton courseId={course.id} targetPath={ssoTargetPath} label="Vào học" />
              </div>
            ) : null}

            {(!canLaunchCourse || course.curriculum.some((section) => section.lessons.length > 0)) ? (
              <button
                type="button"
                onClick={handleAction}
                disabled={busy || ownershipStatus === 'pending_sync' || ownershipStatus === 'grant_blocked' || isUnpricedBlocked}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-indigo-700"
              >
                {course.access.canLearn || course.access.canEnroll ? <FiPlayCircle className="text-xl" /> : <FiPackage className="text-xl" />}
                {busy ? 'Đang xử lý...' : actionLabel(course)}
              </button>
            ) : null}
          </>
        )}
        {firstFreePreviewLesson ? (
          <button
            type="button"
            onClick={() => router.push(firstFreePreviewLesson.href || `/hoc/${course.slug}/bai-hoc/${firstFreePreviewLesson.id}`)}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <FiPlayCircle className="text-lg" /> Xem bài học thử miễn phí
          </button>
        ) : null}
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
