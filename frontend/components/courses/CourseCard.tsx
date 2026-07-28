import Link from 'next/link';
import {
  FiArrowRight,
  FiBookOpen,
  FiClock,
  FiPlay,
  FiUsers,
} from 'react-icons/fi';
import type { CourseCatalogItemDto, CscaSubjectCode } from '@/lib/types/courses';

const levelLabels = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' };
const subjectMeta: Record<CscaSubjectCode, { label: string; cover: string }> = {
  MATH: { label: 'Toán CSCA', cover: '/images/banner/campus-01.jpg' },
  PHYSICS: { label: 'Vật lý CSCA', cover: '/images/banner/campus-07.jpg' },
  CHEMISTRY: { label: 'Hóa học CSCA', cover: '/images/banner/campus-04.jpg' },
  CHINESE_SCI: { label: 'Trung văn Tự nhiên', cover: '/images/banner/campus-09.jpg' },
  CHINESE_SOC: { label: 'Trung văn Xã hội', cover: '/images/banner/campus-12.jpg' },
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

function learningHref(course: CourseCatalogItemDto) {
  const lessonId = course.progress?.lastLessonId;
  return lessonId ? `/hoc/${course.slug}/bai-hoc/${lessonId}` : `/khoa-hoc/${course.slug}`;
}

function StatusBadges({ course }: { course: CourseCatalogItemDto }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`rounded-full px-3 py-1 text-[11px] font-black text-white shadow ${course.progress ? 'bg-[#ad2335]' : 'bg-[#173654]'}`}>
        {accessLabel(course)}
      </span>
      {course.isNew ? <span className="rounded-full bg-[#3e8c77] px-3 py-1 text-[11px] font-black text-white shadow">MỚI</span> : null}
      {course.isHot ? <span className="rounded-full bg-[#c38224] px-3 py-1 text-[11px] font-black text-white shadow">HOT</span> : null}
    </div>
  );
}

function CourseMetrics({ course, bordered = false }: { course: CourseCatalogItemDto; bordered?: boolean }) {
  return (
    <div className={`grid grid-cols-3 text-xs text-[#615850] dark:text-slate-300 ${bordered ? 'rounded-xl border border-[#e0d4c9] bg-[#fffdf9] py-3 dark:border-[#334158] dark:bg-[#0a1628]' : 'border-t border-[#e8ddd4] pt-4 dark:border-[#334158]'}`}>
      <span className="flex items-center justify-center gap-1.5 px-2 text-center font-bold"><FiBookOpen className="text-[#2b8b8d]" /> {course.totalLessons} bài</span>
      <span className="flex items-center justify-center gap-1.5 border-x border-[#e5d9ce] px-2 text-center font-bold dark:border-[#334158]"><FiClock className="text-[#2b8b8d]" /> {durationLabel(course.totalDurationSeconds)}</span>
      <span className="flex items-center justify-center gap-1.5 px-2 text-center font-bold"><FiUsers className="text-[#2b8b8d]" /> {course.enrolledCount.toLocaleString('vi-VN')}</span>
    </div>
  );
}

function ProgressBar({ course }: { course: CourseCatalogItemDto }) {
  if (!course.progress) return null;
  const progress = Math.min(100, Math.max(0, course.progress.completionPct));
  return (
    <div className="mt-4">
      <div className="mb-2 flex justify-between text-xs font-bold text-[#736960] dark:text-slate-400">
        <span>Tiến độ của bạn</span>
        <span className="text-[#247d7e] dark:text-[#69c6bd]">{Math.round(progress)}% đã hoàn thành</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e8e0d9] dark:bg-[#26344a]" role="progressbar" aria-label={`Tiến độ ${course.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#236c73] to-[#5ea39a]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function CourseCard({ course, variant = 'compact' }: { course: CourseCatalogItemDto; variant?: 'wide' | 'featured' | 'compact' }) {
  const subject = subjectMeta[course.subjectCode];
  const cover = course.thumbnailUrl || subject.cover;
  const detailHref = `/khoa-hoc/${course.slug}`;
  const continueHref = learningHref(course);

  if (variant === 'wide') {
    return (
      <article className="overflow-hidden rounded-2xl border border-[#d8c8b9] bg-[#fffaf5] shadow-[0_18px_42px_-30px_rgba(48,33,23,.65)] transition-colors dark:border-[#2d3a50] dark:bg-[#0b172b] dark:shadow-[0_22px_50px_-28px_rgba(0,0,0,.9)]">
        <div className="grid lg:grid-cols-[42%_1fr]">
          <Link href={continueHref} className="group relative min-h-64 overflow-hidden bg-[#0a1830] lg:min-h-[330px]">
            <img src={cover} alt={`Ảnh bìa ${course.title}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#061229]/90 via-transparent to-[#061229]/5" />
            <div className="absolute left-5 top-5"><StatusBadges course={course} /></div>
            <span className="absolute bottom-5 left-5 inline-flex items-center gap-3 rounded-full border border-white/35 bg-[#071228]/70 py-2 pl-2 pr-5 font-black text-white backdrop-blur">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#9f1e31] shadow-lg"><FiPlay className="ml-0.5" fill="currentColor" /></span>
              {course.progress ? 'Tiếp tục học' : 'Xem giới thiệu'}
            </span>
          </Link>

          <div className="grid lg:grid-cols-[1fr_210px]">
            <div className="p-6 sm:p-8">
              <span className="text-xs font-black uppercase tracking-[.12em] text-[#247d7e]">▰ {subject.label}</span>
              <h3 className="mt-3 font-sans text-2xl font-black leading-tight text-[#16233b] dark:text-[#f4e8d6] sm:text-3xl">{course.title}</h3>
              <p className="mt-2 text-sm font-bold text-[#c77715]">★ {course.ratingAvg.toFixed(1)} <span className="font-medium text-[#7e746d] dark:text-slate-400">({course.ratingCount} đánh giá)</span></p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#665d56] dark:text-slate-300">{course.shortDescription || 'Lộ trình học có hệ thống, giải thích dễ hiểu và bám sát mục tiêu kỳ thi CSCA.'}</p>
              <div className="mt-5"><CourseMetrics course={course} bordered /></div>
              <ProgressBar course={course} />
            </div>

            <div className="flex flex-col justify-center gap-3 border-t border-[#e4d8ce] p-6 dark:border-[#2d3a50] lg:border-l lg:border-t-0">
              <p className="text-center font-sans text-4xl font-black text-[#b9aa9d] dark:text-[#5b687c]">勤学</p>
              <Link href={continueHref} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#af1f33] px-4 py-3 text-sm font-black text-white shadow transition hover:bg-[#92172a]">
                {course.progress ? 'Tiếp tục học' : 'Bắt đầu học'} <FiArrowRight />
              </Link>
              <Link href={detailHref} className="inline-flex items-center justify-center rounded-lg border border-[#d8c9bd] bg-[#fffdf9] px-4 py-3 text-sm font-black text-[#28334a] transition hover:border-[#aa7652] dark:border-[#3a475c] dark:bg-[#101e33] dark:text-slate-200">
                Xem chi tiết
              </Link>
              <p className="text-center text-xs text-[#8a7e74] dark:text-slate-500">{levelLabels[course.level]} · Cập nhật liên tục</p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const featured = variant === 'featured';
  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-[#fffaf5] shadow-[0_16px_38px_-30px_rgba(48,33,23,.65)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_46px_-28px_rgba(48,33,23,.6)] dark:border-[#2d3a50] dark:bg-[#0b172b] dark:shadow-[0_18px_42px_-28px_rgba(0,0,0,.85)] ${featured ? 'border-[#152b48] bg-[#0c1d37] text-white md:col-span-2 xl:col-span-2' : 'border-[#ded0c3]'}`}>
      <Link href={detailHref} className={`relative overflow-hidden ${featured ? 'aspect-[16/8]' : 'aspect-[16/9]'}`}>
        <img src={cover} alt={`Ảnh bìa ${course.title}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <div className={`absolute inset-0 ${featured ? 'bg-gradient-to-t from-[#07152d]/80 via-transparent to-transparent' : 'bg-gradient-to-t from-black/35 to-transparent'}`} />
        <div className="absolute left-4 top-4"><StatusBadges course={course} /></div>
        <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white text-[#a51f32] shadow-lg"><FiPlay className="ml-0.5" fill="currentColor" /></span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <span className={`text-[11px] font-black uppercase tracking-[.1em] ${featured ? 'text-emerald-300' : 'text-[#257d7e]'}`}>{subject.label}</span>
        <h3 className={`mt-2 line-clamp-2 font-sans text-xl font-black leading-snug ${featured ? 'text-white' : 'text-[#17243d] dark:text-[#f4e8d6]'}`}>{course.title}</h3>
        <p className={`mt-2 text-sm font-bold ${featured ? 'text-amber-300' : 'text-[#c77715]'}`}>★ {course.ratingAvg.toFixed(1)} <span className={`font-medium ${featured ? 'text-slate-400' : 'text-[#8b8077] dark:text-slate-400'}`}>({course.ratingCount})</span></p>
        <p className={`mt-3 line-clamp-2 min-h-10 text-sm leading-5 ${featured ? 'text-slate-300' : 'text-[#6f665f] dark:text-slate-300'}`}>{course.shortDescription}</p>
        <div className={`mt-5 ${featured ? '[&_span]:text-slate-300 [&>div]:border-white/15' : ''}`}><CourseMetrics course={course} /></div>
        <ProgressBar course={course} />
        <Link href={course.progress ? continueHref : detailHref} className={`mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition ${featured ? 'bg-[#ad1f33] text-white hover:bg-[#941629]' : 'border border-[#d8c9bd] text-[#243149] hover:border-[#a97752] dark:border-[#3a475c] dark:text-slate-200'}`}>
          {course.progress ? 'Tiếp tục học' : 'Xem chi tiết'} <FiArrowRight />
        </Link>
      </div>
    </article>
  );
}
