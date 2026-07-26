import Link from 'next/link';
import { FiArrowUpRight, FiBookOpen, FiClock, FiPlay, FiUsers } from 'react-icons/fi';
import type { CourseCatalogItemDto, CscaSubjectCode } from '@/lib/types/courses';

const levelLabels = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' };
const subjectMeta: Record<CscaSubjectCode, { label: string; gradient: string; accent: string }> = {
  MATH: { label: 'Toán CSCA', gradient: 'from-blue-600 via-indigo-600 to-violet-700', accent: 'text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300' },
  PHYSICS: { label: 'Vật lý CSCA', gradient: 'from-cyan-600 via-sky-600 to-blue-700', accent: 'text-cyan-700 bg-cyan-50 dark:bg-cyan-950/50 dark:text-cyan-300' },
  CHEMISTRY: { label: 'Hóa học CSCA', gradient: 'from-emerald-600 via-teal-600 to-cyan-700', accent: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CHINESE_SCI: { label: 'Trung văn Tự nhiên', gradient: 'from-rose-500 via-pink-600 to-violet-700', accent: 'text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300' },
  CHINESE_SOC: { label: 'Trung văn Xã hội', gradient: 'from-amber-500 via-orange-600 to-rose-600', accent: 'text-orange-700 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-300' },
};

type CatalogItemWithPackages = CourseCatalogItemDto & {
  packages?: Array<{ id: number; name: string }>;
  packageNames?: string[];
};

function accessLabel(course: CourseCatalogItemDto) {
  if (course.progress) return 'Đang học';
  if (course.accessType === 'free') return 'Miễn phí';
  if (course.accessType === 'contact') return 'Liên hệ';
  if (course.accessType === 'private') return 'Khóa học riêng';
  const source = course as CatalogItemWithPackages;
  const names = [...(source.packages ?? []).map((item) => item.name), ...(source.packageNames ?? [])]
    .filter((name) => name?.trim());
  return names.length === 1 ? names[0] : 'Mở khóa theo gói';
}

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}g ${minutes ? `${minutes}p` : ''}`.trim() : `${Math.max(1, minutes)} phút`;
}

export function CourseCard({ course }: { course: CourseCatalogItemDto }) {
  const subject = subjectMeta[course.subjectCode];
  const progress = Math.min(100, Math.max(0, course.progress?.completionPct ?? 0));

  return (
    <Link href={`/khoa-hoc/${course.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-[0_24px_55px_rgba(79,70,229,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_12px_35px_rgba(0,0,0,0.2)] dark:hover:border-indigo-700 dark:hover:shadow-[0_24px_55px_rgba(49,46,129,0.22)]">
      <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${subject.gradient}`}>
        {course.thumbnailUrl ? <img src={course.thumbnailUrl} alt={`Ảnh bìa ${course.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/5 to-transparent" />
        <div className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-between gap-2">
          <span className="max-w-[75%] truncate rounded-full border border-white/50 bg-white/95 px-3 py-1.5 text-[11px] font-black text-indigo-700 shadow-sm">{accessLabel(course)}</span>
          <div className="flex gap-1.5">{course.isNew ? <span className="rounded-full bg-emerald-400 px-2.5 py-1.5 text-[10px] font-black text-emerald-950 shadow-sm">MỚI</span> : null}{course.isHot ? <span className="rounded-full bg-orange-400 px-2.5 py-1.5 text-[10px] font-black text-orange-950 shadow-sm">HOT</span> : null}</div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <span className="rounded-lg bg-slate-950/35 px-2.5 py-1 text-xs font-bold backdrop-blur-md">{levelLabels[course.level]}</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-indigo-700 shadow-lg transition group-hover:scale-110"><FiPlay className="ml-0.5" fill="currentColor" /></span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${subject.accent}`}>{subject.label}</span>
          <span className="text-sm font-black text-amber-500">★ {course.ratingAvg.toFixed(1)} <span className="font-semibold text-slate-400 dark:text-slate-500">({course.ratingCount})</span></span>
        </div>
        <h2 className="mt-4 line-clamp-2 text-xl font-black leading-snug text-slate-950 transition group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{course.title}</h2>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{course.shortDescription}</p>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs font-bold text-slate-500 dark:bg-slate-950/80 dark:text-slate-400">
          <span className="flex items-center justify-center gap-1"><FiBookOpen className="text-indigo-500" /> {course.totalLessons} bài</span>
          <span className="flex items-center justify-center gap-1"><FiClock className="text-indigo-500" /> {durationLabel(course.totalDurationSeconds)}</span>
          <span className="flex items-center justify-center gap-1"><FiUsers className="text-indigo-500" /> {course.enrolledCount.toLocaleString('vi-VN')}</span>
        </div>

        {course.progress ? <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400"><span>Tiến độ của bạn</span><span className="text-indigo-700 dark:text-indigo-300">{Math.round(progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600" style={{ width: `${progress}%` }} /></div></div> : null}

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5 text-sm dark:border-slate-800">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white">M</span><span className="font-bold text-slate-600 dark:text-slate-300">{course.instructor?.displayName || 'MOLI.STUDIO'}</span></div>
          <span className="flex items-center gap-1 font-black text-indigo-700 dark:text-indigo-300">Xem khóa học <FiArrowUpRight /></span>
        </div>
      </div>
    </Link>
  );
}
