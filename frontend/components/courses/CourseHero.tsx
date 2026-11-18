import { FiBookOpen, FiClock, FiUsers } from 'react-icons/fi';
import type { CourseDetailDto, CscaSubjectCode } from '@/lib/types/courses';
import { publicCourseProfileLabel } from '@/lib/coursePresentation';

const subjectLabels: Record<CscaSubjectCode, string> = {
  MATH: 'Toán CSCA', PHYSICS: 'Vật lý CSCA', CHEMISTRY: 'Hóa học CSCA', CHINESE_SCI: 'Trung văn Tự nhiên', CHINESE_SOC: 'Trung văn Xã hội',
};
const levelLabels = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' };

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours} giờ ` : ''}${minutes} phút`;
}

export function CourseHero({ course }: { course: CourseDetailDto }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0b1427] sm:p-8">
      <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300">CSCA · {subjectLabels[course.subjectCode]}</span>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{levelLabels[course.level]}</span>
            {course.profiles?.slice(0, 2).map((profile) => (
              <span key={profile.externalOfferingId || profile.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                {publicCourseProfileLabel(profile.badgeLabel, profile.mode)}
              </span>
            ))}
            {course.isNew ? <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950">MỚI</span> : null}
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 dark:text-white sm:text-5xl">{course.title}</h1>
          {course.shortDescription ? <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">{course.shortDescription}</p> : null}
          {course.instructor?.displayName ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100">
              <span>Giảng viên: <strong>{course.instructor.displayName}</strong></span>
              {course.instructor.headline ? <span className="text-slate-500 dark:text-slate-300">· {course.instructor.headline}</span> : null}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-5 text-sm font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300"><span className="text-amber-600 dark:text-amber-300">★ {course.ratingAvg.toFixed(1)} <span className="text-slate-400">({course.ratingCount} đánh giá)</span></span><span className="inline-flex items-center gap-2"><FiUsers className="text-sky-600 dark:text-sky-300" /> {course.enrolledCount.toLocaleString('vi-VN')} học viên</span><span className="inline-flex items-center gap-2"><FiBookOpen className="text-sky-600 dark:text-sky-300" /> {course.totalLessons} bài học</span><span className="inline-flex items-center gap-2"><FiClock className="text-sky-600 dark:text-sky-300" /> {durationLabel(course.totalDurationSeconds)}</span></div>
      </div>
    </section>
  );
}
