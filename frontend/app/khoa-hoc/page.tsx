import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiBookOpen,
  FiClock,
  FiLayers,
  FiMonitor,
  FiPlayCircle,
  FiTrendingUp,
} from 'react-icons/fi';
import { CourseCatalogClient } from '@/components/courses/CourseCatalogClient';
import { CourseTutorShowcase } from '@/components/courses/CourseTutorShowcase';
import ThemeToggle from '@/components/layout/ThemeToggle';

export const metadata: Metadata = {
  title: 'Khóa học CSCA',
  description: 'Thư viện khóa học video luyện thi CSCA theo từng môn và lộ trình.',
};

const HERO_IMAGE =
  'https://res.cloudinary.com/dvrgrmais/image/upload/v1785245197/csca/course-library/hero-learning-web.webp';

const benefits = [
  { icon: FiLayers, label: 'Học theo lộ trình' },
  { icon: FiTrendingUp, label: 'Theo dõi tiến độ' },
  { icon: FiMonitor, label: 'Xem trên mọi thiết bị' },
];

const stats = [
  { icon: FiBookOpen, value: '5', label: 'nhóm môn CSCA' },
  { icon: FiPlayCircle, value: '4K', label: 'trải nghiệm sắc nét' },
  { icon: FiClock, value: '24/7', label: 'học theo nhịp riêng' },
];

export default function CoursesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f3ed] pb-20 text-[#15213a] transition-colors duration-300 dark:bg-[#050d1d] dark:text-[#f5ead9]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_8%_8%,rgba(169,113,65,.10),transparent_22%),radial-gradient(circle_at_92%_22%,rgba(24,93,97,.08),transparent_24%)]" />
      <div className="pointer-events-none absolute left-0 top-20 h-72 w-72 rounded-full border border-[#b58a61]/10 dark:border-[#d8b58c]/10" />
      <div className="pointer-events-none absolute right-[-7rem] top-10 h-[28rem] w-[28rem] rounded-full border border-[#b58a61]/10 dark:border-[#d8b58c]/10" />

      <div className="relative mx-auto max-w-[1460px] px-4 pt-5 sm:px-6 lg:px-8">
        <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#b89170] bg-[#fffaf4]/90 px-5 py-2.5 text-sm font-black text-[#4f3629] shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-[#8c6b4f] dark:bg-[#0b172b]/90 dark:text-[#f1d5b2] dark:hover:bg-[#12213a]"
          >
            <FiArrowLeft aria-hidden="true" /> Về trang chủ
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#d8c6b5] bg-[#fffaf4]/90 dark:border-[#33425b] dark:bg-[#0b172b] [&_button]:rounded-full [&_button]:text-[#66574b] dark:[&_button]:text-[#f0d1a9]">
              <ThemeToggle />
            </span>
            <Link
              href="/hoc"
              className="inline-flex items-center gap-2 rounded-full border border-[#b89170]/70 bg-[#071228] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#e5c49f] dark:bg-[#13233c]"
            >
              <FiBookOpen aria-hidden="true" /> Khóa học của tôi
            </Link>
          </div>
        </nav>

        <section
          className="relative isolate min-h-[350px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#071228] text-white shadow-[0_30px_70px_-32px_rgba(23,26,42,.75)] sm:min-h-[385px]"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(4,14,36,.98) 0%, rgba(5,18,44,.91) 36%, rgba(11,19,48,.28) 72%, rgba(7,14,36,.18) 100%), url("${HERO_IMAGE}")`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,9,24,.72),transparent_48%)]" />
          <div className="absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

          <div className="relative flex min-h-[350px] max-w-[830px] flex-col justify-between px-6 py-6 sm:min-h-[385px] sm:px-10 sm:py-7 lg:px-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-emerald-200 backdrop-blur">
                <FiBookOpen /> CSCA Learning
              </span>
              <h1 className="mt-4 max-w-3xl font-sans text-3xl font-black leading-[1.05] tracking-tight text-[#fff4df] sm:text-4xl lg:text-5xl">
                Học đúng trọng tâm,
                <span className="block text-white">tiến bộ theo từng bài.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base lg:text-[17px]">
                Lộ trình video dành riêng cho Toán, Vật lý, Hóa học và Tiếng Trung CSCA — từ nền tảng đến luyện đề, giúp bạn vững kiến thức và tự tin chinh phục mục tiêu du học Trung Quốc.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {benefits.map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-2 rounded-full border border-[#d8b58c]/45 bg-[#071228]/45 px-3.5 py-2 text-xs font-bold text-[#f9e7cc] backdrop-blur sm:text-sm">
                    <Icon className="text-emerald-300" /> {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/15 pt-4">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="hidden h-7 w-7 shrink-0 text-emerald-300 sm:block" />
                  <div>
                    <p className="font-sans text-xl font-black text-[#ffe8c4] sm:text-2xl">{value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-300 sm:text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CourseTutorShowcase courseTitle="các khóa học online của MOLY" />

        <div className="mt-8">
          <CourseCatalogClient />
        </div>

        <section className="mt-8 grid overflow-hidden rounded-2xl border border-[#ddcfc0] bg-[#fffaf4]/90 shadow-sm backdrop-blur transition-colors dark:border-[#27364e] dark:bg-[#0b172b]/95 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Lộ trình cá nhân hóa', 'Học đúng hướng, tiết kiệm thời gian'],
            ['Theo dõi đa thiết bị', 'Tiếp tục đúng bài và vị trí đang xem'],
            ['Hỗ trợ trong quá trình học', 'Giải đáp và cập nhật nội dung liên tục'],
            ['Bám sát cấu trúc CSCA', 'Kiến thức được tổ chức theo từng mục tiêu'],
          ].map(([title, text], index) => (
            <div key={title} className={`px-6 py-5 ${index ? 'border-t border-[#eadfd4] dark:border-[#27364e] sm:border-l sm:border-t-0' : ''}`}>
              <p className="font-sans text-lg font-black text-[#1a2943] dark:text-[#f4dfc2]">{title}</p>
              <p className="mt-1 text-sm leading-6 text-[#71675f] dark:text-slate-400">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
