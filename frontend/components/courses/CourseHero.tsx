import { FiBookOpen, FiClock, FiPlay, FiUsers } from 'react-icons/fi';
import type { CourseDetailDto, CscaSubjectCode } from '@/lib/types/courses';

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
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 py-8 text-white shadow-[0_30px_80px_rgba(49,46,129,0.2)] sm:py-10 lg:py-12">
      <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:px-8">
        <div>
          <div className="flex flex-wrap gap-2"><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200">CSCA · {subjectLabels[course.subjectCode]}</span><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-black">{levelLabels[course.level]}</span>{course.isNew ? <span className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-emerald-950">MỚI</span> : null}</div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">{course.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{course.shortDescription}</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-200"><span className="text-amber-300">★ {course.ratingAvg.toFixed(1)} <span className="text-slate-400">({course.ratingCount} đánh giá)</span></span><span className="inline-flex items-center gap-2"><FiUsers className="text-cyan-300" /> {course.enrolledCount.toLocaleString('vi-VN')} học viên</span><span className="inline-flex items-center gap-2"><FiBookOpen className="text-cyan-300" /> {course.totalLessons} bài học</span><span className="inline-flex items-center gap-2"><FiClock className="text-cyan-300" /> {durationLabel(course.totalDurationSeconds)}</span></div>
        </div>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur-sm">
          <div className="relative aspect-video overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-cyan-500 to-indigo-700">{course.thumbnailUrl ? <img src={course.thumbnailUrl} alt={`Ảnh bìa ${course.title}`} className="h-full w-full object-cover" /> : null}<div className="absolute inset-0 bg-slate-950/25" /><span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-2xl text-indigo-700 shadow-xl"><FiPlay className="ml-1" fill="currentColor" /></span><p className="absolute inset-x-4 bottom-4 text-center text-sm font-black text-white drop-shadow">Nội dung học trực quan, theo từng bước</p></div>
        </div>
      </div>
    </section>
  );
}
