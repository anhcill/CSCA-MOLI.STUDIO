'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FiArrowRight,
  FiAward,
  FiBarChart2,
  FiBell,
  FiBook,
  FiCalendar,
  FiCheckCircle,
  FiCpu,
  FiFileText,
  FiShield,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useLanguage } from '@/context/LanguageContext';
import { CourseTutorShowcase } from '@/components/courses/CourseTutorShowcase';
import ChinaCampusShowcase from './ChinaCampusShowcase';

type StatsData = { users: number; exams: number; materials: number; passRate: number };
type Countdown = { days: number; hours: number; minutes: number; seconds: number };

const STATS_DEFAULT: StatsData = { users: 10000, exams: 500, materials: 200, passRate: 95 };
const EXAM_DATE_FALLBACK = new Date(process.env.NEXT_PUBLIC_EXAM_DATE || '2026-06-10T08:00:00');

const SUBJECTS = [
  {
    id: 'math',
    labelKey: 'subject.math',
    nameCn: '数学',
    href: '/toan/de-mo-phong',
    gradient: 'from-blue-500 to-indigo-600',
    desc: { vi: 'Đại số · Giải tích · Hình học', en: 'Algebra · Calculus · Geometry', zh: '代数 · 微积分 · 几何' },
  },
  {
    id: 'physics',
    labelKey: 'subject.physics',
    nameCn: '物理',
    href: '/vat-ly',
    gradient: 'from-yellow-400 to-orange-500',
    desc: { vi: 'Cơ học · Điện từ · Quang học', en: 'Mechanics · Electromagnetism · Optics', zh: '力学 · 电磁学 · 光学' },
  },
  {
    id: 'chemistry',
    labelKey: 'subject.chemistry',
    nameCn: '化学',
    href: '/hoa',
    gradient: 'from-emerald-500 to-teal-600',
    desc: { vi: 'Hóa vô cơ · Hóa hữu cơ', en: 'Inorganic · Organic chemistry', zh: '无机化学 · 有机化学' },
  },
  {
    id: 'chinese-soc',
    labelKey: 'subject.chineseSoc',
    nameCn: '中文(文)',
    href: '/tiengtrung-xahoi',
    gradient: 'from-red-500 to-rose-600',
    desc: { vi: 'Khối xã hội · Nhân văn', en: 'Social science · Humanities', zh: '文科 · 人文' },
  },
  {
    id: 'chinese-sci',
    labelKey: 'subject.chineseSci',
    nameCn: '中文(理)',
    href: '/tiengtrung-tunhien',
    gradient: 'from-violet-500 to-purple-600',
    desc: { vi: 'Khối tự nhiên · Kỹ thuật', en: 'Science · Engineering', zh: '理科 · 工科' },
  },
  {
    id: 'forum',
    labelKey: 'subject.forum',
    nameCn: '论坛',
    href: '/forum',
    gradient: 'from-pink-500 to-fuchsia-600',
    desc: { vi: 'Trao đổi · Hỏi đáp cộng đồng', en: 'Discussion · Community Q&A', zh: '交流 · 社区问答' },
  },
];

const HOT_EXAMS = [
  {
    title: { vi: 'Đề Toán Tổng Hợp 2025', en: 'General Math Exam 2025', zh: '2025数学综合试卷' },
    subjectKey: 'subject.math',
    attempts: 1240,
    difficulty: { vi: 'Khó', en: 'Hard', zh: '难' },
    diffColor: 'bg-red-100 text-red-600',
    href: '/de-mo-phong',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    title: { vi: 'Tiếng Trung XH - Nhân văn', en: 'Chinese Social - Humanities', zh: '中文文科 - 人文' },
    subjectKey: 'subject.chineseSoc',
    attempts: 890,
    difficulty: { vi: 'Trung bình', en: 'Medium', zh: '中等' },
    diffColor: 'bg-yellow-100 text-yellow-700',
    href: '/de-mo-phong',
    gradient: 'from-red-500 to-rose-600',
  },
  {
    title: { vi: 'Vật Lý Điện Từ Nâng Cao', en: 'Advanced Electromagnetism', zh: '高级电磁学' },
    subjectKey: 'subject.physics',
    attempts: 670,
    difficulty: { vi: 'Khó', en: 'Hard', zh: '难' },
    diffColor: 'bg-red-100 text-red-600',
    href: '/de-mo-phong',
    gradient: 'from-yellow-400 to-orange-500',
  },
];

const AI_STEPS = [
  {
    icon: FiBarChart2,
    title: { vi: 'Phân tích điểm yếu', en: 'Analyze weak points', zh: '分析薄弱点' },
    desc: {
      vi: 'AI đọc lịch sử làm bài, xác định chủ đề bạn hay sai nhất.',
      en: 'AI reads your exam history and identifies your most common weak topics.',
      zh: 'AI读取做题记录，找出你最容易出错的主题。',
    },
  },
  {
    icon: FiCpu,
    title: { vi: 'Tạo lộ trình riêng', en: 'Build a personal roadmap', zh: '生成专属路径' },
    desc: {
      vi: 'Kế hoạch ôn thi được cá nhân hóa theo thời gian còn lại và mục tiêu điểm.',
      en: 'Your plan is personalized by remaining time and target score.',
      zh: '根据剩余时间和目标分数制定个性化复习计划。',
    },
  },
  {
    icon: FiTrendingUp,
    title: { vi: 'Theo dõi tiến bộ', en: 'Track progress', zh: '跟踪进度' },
    desc: {
      vi: 'Biểu đồ tiến độ, lịch sử làm bài và nhắc học đúng thời điểm.',
      en: 'Progress charts, exam history and timely study reminders.',
      zh: '进度图表、做题历史和适时学习提醒。',
    },
  },
];

const FEATURES = [
  {
    icon: FiZap,
    title: { vi: 'Đề thi chuẩn CSCA', en: 'CSCA-aligned exams', zh: '贴近CSCA的试卷' },
    desc: { vi: 'Đề mô phỏng sát kỳ thi thật, phân tách rõ đề thường và đề VIP.', en: 'Realistic mock exams with clear Basic and VIP grouping.', zh: '高仿真模拟试卷，清楚区分普通题和VIP题。' },
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    icon: FiTarget,
    title: { vi: 'Lộ trình cá nhân', en: 'Personal roadmap', zh: '个人学习路径' },
    desc: { vi: 'AI đề xuất thứ tự ôn tập dựa trên điểm yếu thật của bạn.', en: 'AI recommends study order based on your real weak spots.', zh: 'AI根据真实薄弱点推荐复习顺序。' },
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: FiTrendingUp,
    title: { vi: 'Theo dõi tiến độ', en: 'Progress tracking', zh: '进度跟踪' },
    desc: { vi: 'Xem điểm, độ chính xác, lịch sử và xu hướng theo từng môn.', en: 'View scores, accuracy, history and trends by subject.', zh: '按科目查看分数、正确率、历史和趋势。' },
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: FiBook,
    title: { vi: 'Từ vựng thông minh', en: 'Smart vocabulary', zh: '智能词汇' },
    desc: { vi: 'Từ vựng có tiếng Trung, tiếng Anh và tiếng Việt rõ ràng.', en: 'Vocabulary includes Chinese, English and Vietnamese clearly.', zh: '词汇清晰包含中文、英文和越南文。' },
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: FiShield,
    title: { vi: 'Cấu trúc đề chi tiết', en: 'Detailed exam structure', zh: '详细考试结构' },
    desc: { vi: 'Nắm rõ phần thi, thời lượng và dạng câu trước khi vào luyện.', en: 'Understand sections, timing and question types before practicing.', zh: '练习前了解考试部分、时间和题型。' },
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: FiUsers,
    title: { vi: 'Cộng đồng học viên', en: 'Student community', zh: '学员社区' },
    desc: { vi: 'Diễn đàn, hỏi đáp và hỗ trợ cho thành viên VIP/Pre.', en: 'Forum, Q&A and support for VIP/Pre members.', zh: '为VIP/Pre会员提供论坛、问答和支持。' },
    color: 'bg-indigo-100 text-indigo-600',
  },
];

const STEPS = [
  {
    step: '01',
    href: '/toan/de-mo-phong',
    title: { vi: 'Chọn môn học', en: 'Choose a subject', zh: '选择科目' },
    desc: { vi: 'Toán, Vật Lý, Hóa Học hoặc Tiếng Trung theo khối thi của bạn.', en: 'Math, Physics, Chemistry or Chinese based on your track.', zh: '按你的考试方向选择数学、物理、化学或中文。' },
  },
  {
    step: '02',
    href: '/tailieu',
    title: { vi: 'Ôn lý thuyết', en: 'Review theory', zh: '复习理论' },
    desc: { vi: 'Đọc tài liệu, học từ vựng và nắm cấu trúc đề trước khi làm bài.', en: 'Read materials, learn vocabulary and understand the exam format.', zh: '阅读资料、学习词汇并掌握考试结构。' },
  },
  {
    step: '03',
    href: '/de-mo-phong',
    title: { vi: 'Luyện đề thực chiến', en: 'Practice real exams', zh: '实战刷题' },
    desc: { vi: 'Làm đề, xem kết quả chi tiết và học lại từng câu sai.', en: 'Take exams, review detailed results and revisit every mistake.', zh: '做试卷、查看详细结果并复盘错题。' },
  },
];

const TESTIMONIALS = [
  {
    name: 'Minh Anh',
    score: '9.5/10',
    text: {
      vi: 'Hệ thống đề thi rất sát đề thật. Mình đậu học bổng toàn phần sau 3 tháng luyện đều.',
      en: 'The mock exams were close to the real test. I won a full scholarship after 3 months of steady practice.',
      zh: '模拟试题非常贴近真实考试。我坚持练习3个月后拿到了全额奖学金。',
    },
    subjectKey: 'subject.math',
    avatar: 'M',
  },
  {
    name: 'Thu Trang',
    score: { vi: 'Học bổng toàn phần', en: 'Full scholarship', zh: '全额奖学金' },
    text: {
      vi: 'AI phân tích đúng điểm yếu nên mình không còn học dàn trải, tập trung được vào phần cần cải thiện.',
      en: 'AI found my weak points accurately, so I stopped studying randomly and focused on what mattered.',
      zh: 'AI准确找出我的薄弱点，让我不再盲目学习，而是集中提升关键部分。',
    },
    subjectKey: 'subject.chineseSoc',
    avatar: 'T',
  },
  {
    name: 'Quang Hưng',
    score: 'Top 5%',
    text: {
      vi: 'Tài liệu có tiếng Việt rõ ràng, kèm thuật ngữ tiếng Trung nên học nhanh và dễ nhớ hơn.',
      en: 'The materials are clear in Vietnamese with Chinese terms, making them faster to learn and remember.',
      zh: '资料有清楚的越南文说明和中文术语，学习和记忆都更快。',
    },
    subjectKey: 'subject.physics',
    avatar: 'Q',
  },
];

function useCountdown(target: Date | null) {
  const calc = (): Countdown => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState<Countdown | null>(null);

  useEffect(() => {
    if (!target) return;
    setTime(calc());
    const timer = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(timer);
  }, [target?.getTime()]);

  return time;
}

function CountdownUnit({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-indigo-400/20 blur-md" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-3xl font-black text-white shadow-lg backdrop-blur-sm sm:h-20 sm:w-20 sm:text-4xl md:h-24 md:w-24 md:text-5xl" suppressHydrationWarning>
          {value === null ? '--' : String(value).padStart(2, '0')}
        </div>
      </div>
      <span className="mt-2 text-xs font-medium uppercase tracking-wider text-white/70">{label}</span>
    </div>
  );
}

export default function HomeContent() {
  const { t, pick } = useLanguage();
  const [examDate, setExamDate] = useState<Date | null>(null);
  const [stats, setStats] = useState<StatsData>(STATS_DEFAULT);
  const countdown = useCountdown(examDate);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/settings/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const dateStr = json?.data?.exam_date;
        setExamDate(dateStr ? new Date(dateStr) : EXAM_DATE_FALLBACK);
      })
      .catch(() => setExamDate(EXAM_DATE_FALLBACK));
  }, []);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/stats/overview`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success && json.data) setStats(json.data); })
      .catch(() => {});
  }, []);

  const statCards = [
    { icon: FiUsers, value: stats.users >= 1000 ? `${(stats.users / 1000).toFixed(0)}k+` : `${stats.users}+`, label: t('home.stats.students'), color: 'from-violet-500 to-purple-600' },
    { icon: FiFileText, value: `${stats.exams}+`, label: t('home.stats.exams'), color: 'from-blue-500 to-indigo-600' },
    { icon: FiBook, value: `${stats.materials}+`, label: t('home.stats.materials'), color: 'from-emerald-500 to-teal-600' },
    { icon: FiAward, value: `${stats.passRate}%`, label: t('home.stats.passRate'), color: 'from-orange-400 to-amber-500' },
  ];

  return (
    <>
      <section className="w-full border-b border-gray-100 bg-white shadow-sm dark:bg-gray-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-6 py-5 sm:gap-6 md:grid-cols-4">
          {statCards.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-sm`}>
                <item.icon size={20} />
              </div>
              <div>
                <p className="text-lg font-black leading-tight text-gray-900 dark:text-white sm:text-xl">{item.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full bg-white px-4 pb-14 pt-4 dark:bg-gray-900 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <CourseTutorShowcase courseTitle="hành trình luyện thi CSCA cùng MOLY" />
        </div>
      </section>

      <ChinaCampusShowcase />

      <section className="w-full bg-gray-50/60 py-20 dark:bg-gray-800">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">{t('home.subjects.badge')}</span>
            <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{t('home.subjects.title')}</h2>
            <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">{t('home.subjects.desc')}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
            {SUBJECTS.map((subject) => (
              <Link
                key={subject.id}
                href={subject.href}
                className="national-day-subject-card group relative overflow-hidden rounded-2xl border-2 border-gray-100 bg-white p-6 transition-all duration-200 hover:-translate-y-1.5 hover:border-transparent hover:shadow-xl dark:border-gray-700 dark:bg-gray-900"
              >
                <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${subject.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className={`absolute inset-0 bg-gradient-to-br ${subject.gradient} opacity-0 transition-opacity group-hover:opacity-[0.04]`} />
                <div className="mb-4 flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <FiBook size={22} />
                  </span>
                  <span className="text-xs font-bold text-gray-300 transition-colors group-hover:text-gray-400 dark:text-gray-600">{subject.nameCn}</span>
                </div>
                <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">{t(subject.labelKey)}</h3>
                <p className="mb-4 text-sm text-gray-400 dark:text-gray-500">{pick(subject.desc)}</p>
                <div className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 dark:text-indigo-400">
                  {t('home.subjects.studyNow')} <FiArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full border-t border-gray-100 bg-white py-20 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <span className="mb-3 inline-block rounded-full bg-red-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-600 dark:bg-red-900 dark:text-red-300">{t('home.hot.badge')}</span>
              <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{t('home.hot.title')}</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">{t('home.hot.desc')}</p>
            </div>
            <Link href="/de-mo-phong" className="hidden items-center gap-2 font-semibold text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 md:inline-flex">
              {t('home.hot.all')} <FiArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOT_EXAMS.map((exam) => (
              <Link key={pick(exam.title)} href={exam.href} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${exam.gradient}`} />
                <div className="mb-4 flex items-center gap-3">
                  <FiFileText className="text-gray-400" size={24} />
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{t(exam.subjectKey)}</span>
                </div>
                <h3 className="mb-3 text-base font-bold leading-snug text-gray-900 transition-colors group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{pick(exam.title)}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <FiUsers size={12} />
                    <span>{exam.attempts.toLocaleString()} {t('home.hot.attempts')}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${exam.diffColor}`}>{pick(exam.difficulty)}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-800 dark:text-indigo-400">
                  <FiZap size={14} /> {t('home.hot.start')}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-20">
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2">
            <FiCalendar className="text-indigo-400" size={16} />
            <span className="text-sm font-semibold text-indigo-300">{t('home.countdown.label')}</span>
          </div>
          <h2 className="mb-3 text-4xl font-black text-white">{t('home.countdown.title')}</h2>
          <p className="mb-10 text-lg text-white/60">{t('home.countdown.desc')}</p>
          <div className="mb-10 flex items-center justify-center gap-2 sm:gap-4 md:gap-8">
            <CountdownUnit value={countdown?.days ?? null} label={t('home.countdown.days')} />
            <span className="mb-6 text-2xl font-light text-white/40 sm:text-4xl">:</span>
            <CountdownUnit value={countdown?.hours ?? null} label={t('home.countdown.hours')} />
            <span className="mb-6 text-2xl font-light text-white/40 sm:text-4xl">:</span>
            <CountdownUnit value={countdown?.minutes ?? null} label={t('home.countdown.minutes')} />
            <span className="mb-6 text-2xl font-light text-white/40 sm:text-4xl">:</span>
            <CountdownUnit value={countdown?.seconds ?? null} label={t('home.countdown.seconds')} />
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/de-mo-phong" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-gray-900 shadow-2xl transition-all hover:scale-105 hover:bg-gray-50 active:scale-95">
              <FiZap size={18} /> {t('home.countdown.start')}
            </Link>
            <Link href="/lo-trinh" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-8 py-4 font-semibold text-white transition-all hover:bg-white/20">
              <FiBell size={18} /> {t('home.countdown.plan')}
            </Link>
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 py-20">
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2">
          <div>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-300">
              <FiCpu size={13} /> {t('home.ai.badge')}
            </span>
            <h2 className="mb-4 text-4xl font-black leading-tight text-white">
              {t('home.ai.title')}<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{t('home.ai.titleAccent')}</span>
            </h2>
            <p className="mb-10 text-lg leading-relaxed text-white/60">{t('home.ai.desc')}</p>
            <div className="space-y-6">
              {AI_STEPS.map((step, index) => (
                <div key={pick(step.title)} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/20 text-indigo-400">
                    <step.icon size={18} />
                  </div>
                  <div>
                    <p className="mb-0.5 font-bold text-white">{index + 1}. {pick(step.title)}</p>
                    <p className="text-sm leading-relaxed text-white/50">{pick(step.desc)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/lo-trinh" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-indigo-900/40 transition-all hover:scale-105 hover:bg-indigo-500">
              {t('home.ai.try')} <FiArrowRight size={16} />
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/30 text-indigo-300">
                <FiCpu size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{pick({ vi: 'Phân tích của AI', en: 'AI analysis', zh: 'AI分析' })}</p>
                <p className="text-xs text-white/40">{pick({ vi: 'Dựa trên 30 ngày làm bài gần nhất', en: 'Based on the last 30 days of exams', zh: '基于最近30天的做题记录' })}</p>
              </div>
            </div>
            <div className="mb-6 space-y-4">
              {[
                { label: { vi: 'Đại số tuyến tính', en: 'Linear algebra', zh: '线性代数' }, pct: 82, color: 'bg-emerald-400' },
                { label: { vi: 'Hàm số và đạo hàm', en: 'Functions and derivatives', zh: '函数与导数' }, pct: 65, color: 'bg-yellow-400' },
                { label: { vi: 'Hình học không gian', en: 'Solid geometry', zh: '立体几何' }, pct: 41, color: 'bg-red-400' },
                { label: { vi: 'Phương trình vi phân', en: 'Differential equations', zh: '微分方程' }, pct: 55, color: 'bg-orange-400' },
              ].map((row) => (
                <div key={pick(row.label)}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-white/70">{pick(row.label)}</span>
                    <span className="text-white/50">{row.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-300">{pick({ vi: 'Gợi ý hôm nay', en: 'Today suggestion', zh: '今日建议' })}</p>
              <p className="text-sm leading-relaxed text-white/70">
                {pick({
                  vi: 'Tập trung ôn Hình học không gian. Chủ đề này xuất hiện nhiều trong đề và điểm hiện tại còn thấp.',
                  en: 'Focus on solid geometry. This topic appears often and your current score is still low.',
                  zh: '重点复习立体几何。该主题出现频率高，目前得分仍偏低。',
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-white py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block rounded-full bg-purple-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-purple-700 dark:bg-purple-900 dark:text-purple-300">{t('home.features.badge')}</span>
            <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{t('home.features.title')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={pick(feature.title)} className="group rounded-2xl border-2 border-gray-100 p-8 transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-xl dark:border-gray-700">
                <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${feature.color}`}>
                  <feature.icon size={26} />
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{pick(feature.title)}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{pick(feature.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full border-y border-gray-100 bg-gray-50 py-20 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">{t('home.steps.badge')}</span>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white">{t('home.steps.title')}</h2>
          </div>
          <div className="relative">
            <div className="absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-indigo-200 via-blue-200 to-emerald-200 dark:from-indigo-800 dark:via-blue-800 dark:to-emerald-800 md:block" />
            <div className="relative z-10 grid grid-cols-1 gap-10 md:grid-cols-3">
              {STEPS.map((step) => (
                <Link key={step.step} href={step.href} className="group text-center transition-transform duration-200 hover:-translate-y-1">
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-indigo-600 text-3xl font-black text-white shadow-lg transition-shadow group-hover:shadow-xl">
                    {step.step}
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{pick(step.title)}</h3>
                  <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{pick(step.desc)}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-white py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block rounded-full bg-yellow-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">{t('home.testimonials.badge')}</span>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white">{t('home.testimonials.title')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div key={item.name} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <FiStar key={index} size={15} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="relative mb-6 italic leading-relaxed text-gray-600 dark:text-gray-300">"{pick(item.text)}"</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-base font-bold text-white">
                    {item.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-gray-400">{t(item.subjectKey)} · <span className="font-semibold text-emerald-600">{typeof item.score === 'string' ? item.score : pick(item.score)}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden border-t border-gray-100 bg-slate-50 py-24 dark:border-gray-800 dark:bg-slate-900">
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-700 shadow-sm">
            <FaCrown /> {t('home.vip.badge')}
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight text-gray-900 dark:text-white md:text-5xl">{t('home.vip.title')}</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">{t('home.vip.desc')}</p>
          <div className="mb-12 flex flex-wrap justify-center gap-4">
            {[
              { icon: FiStar, text: { vi: 'Truy cập đầy đủ kho đề thi', en: 'Full exam bank access', zh: '完整题库权限' } },
              { icon: FiZap, text: { vi: 'Chữa bài tự luận AI', en: 'AI essay grading', zh: 'AI作文批改' } },
              { icon: FiTrendingUp, text: { vi: 'Theo dõi tiến bộ chi tiết', en: 'Detailed progress tracking', zh: '详细进度跟踪' } },
              { icon: FiUsers, text: { vi: 'Pre có hỏi giảng viên', en: 'Pre includes instructor Q&A', zh: 'Pre包含教师问答' } },
            ].map((feature) => (
              <div key={pick(feature.text)} className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition-transform hover:-translate-y-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <feature.icon className="text-orange-500 dark:text-orange-400" size={18} />
                {pick(feature.text)}
              </div>
            ))}
          </div>
          <Link href="/vip" className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 px-8 py-5 text-lg font-black text-white shadow-xl shadow-orange-500/30 transition-all hover:-translate-y-1 hover:shadow-orange-500/50 active:scale-95">
            <FaCrown className="text-yellow-200" size={20} />
            {t('home.vip.join')}
          </Link>
        </div>
      </section>

      {/* SEO Introduction Section */}
      <section className="w-full bg-gray-50/50 py-16 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-4xl px-6 text-left">
          <h2 className="mb-6 text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
            {pick({
              vi: 'MOLI.STUDIO - Nền tảng ôn thi tiếng Trung và luyện thi CSCA online hàng đầu',
              en: 'CSCA Prep & Chinese Government Scholarship (CSC) Learning Platform',
              zh: 'CSCA 备考与中国政府奖学金 (CSC) 学习平台'
            })}
          </h2>
          
          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-gray-650 dark:text-gray-350">
            <p>
              {pick({
                vi: 'Chào mừng bạn đến với MOLI.STUDIO, nền tảng ôn thi tiếng Trung và hỗ trợ luyện thi CSCA online hàng đầu dành cho học viên Việt Nam. Hệ thống cung cấp kho dữ liệu đề thi CSCA phong phú, bao gồm các bài mock test CSCA chuẩn cấu trúc và chức năng thi thử HSK online cập nhật liên tục. Nền tảng của chúng tôi được thiết kế chuyên biệt để giúp bạn chinh phục kỳ thi đánh giá năng lực CSCA (Chinese Scholarship Council Assessment), mở rộng cơ hội giành các suất học bổng CSC toàn phần danh giá để đi du học Trung Quốc.',
                en: 'Welcome to MOLI.STUDIO, the premier online learning platform specialized in helping students conquer the CSCA (Chinese Scholarship Council Assessment) exam and secure prestigious scholarships to study in China. The CSCA exam is a mandatory assessment that determines eligibility for full government scholarships at top Chinese universities.',
                zh: '欢迎来到 MOLI.STUDIO，这是专为帮助学生攻克 CSCA 考试并获得中国政府奖学金而设计的在线学习平台。CSCA 考试是评估学生学术水平和汉语能力的重要指标。'
              })}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {pick({
                    vi: 'Cấu trúc bài thi & Nội dung ôn luyện',
                    en: 'Exam Structure & Practice Content',
                    zh: '考试结构与练习内容'
                  })}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {pick({
                    vi: 'Hệ thống cung cấp đầy đủ tài liệu lý thuyết và hàng trăm đề thi CSCA chuẩn format cùng các đề mock test CSCA tự luận/trắc nghiệm đầy đủ. Người học có thể tham gia thi thử HSK online để đánh giá trình độ và nhận tài liệu luyện HSK miễn phí. Mỗi câu hỏi trong đề thi CSCA đều đi kèm đáp án chi tiết và dịch nghĩa song ngữ tiếng Trung - tiếng Việt chuẩn xác để bạn tích lũy từ vựng nhanh chóng.',
                    en: 'Our system offers comprehensive theoretical documents and hundreds of mock exams modeled after the three main sections of CSCA: Mathematics (in Chinese/English), General Knowledge (Chinese history, culture, and geography), and Chinese language proficiency.',
                    zh: '我们的系统提供全面的理论文档和数百套模拟考试，涵盖数学（中文/英文）、综合知识（中国历史、文化和地理）以及汉语水平（HSK）三大核心部分。'
                  })}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                  {pick({
                    vi: 'Công nghệ AI phân tích bài thi & Lộ trình học',
                    en: 'AI Weak Point Analysis & Learning Paths',
                    zh: 'AI 弱点分析与学习路径'
                  })}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {pick({
                    vi: 'MOLI.STUDIO tiên phong ứng dụng công nghệ AI phân tích bài thi thông minh. Sau mỗi lượt làm đề, hệ thống AI phân tích bài thi sẽ chỉ ra những lỗ hổng kiến thức, phân loại các dạng câu hỏi bạn thường sai để đề xuất lộ trình ôn tập hàng ngày. Bạn cũng có thể luyện HSK miễn phí trên hệ thống với các bộ đề thi thử được chấm điểm và sửa lỗi trực tiếp bằng AI giúp nâng cao điểm số của mình.',
                    en: 'Using integrated Gemini AI technology, MOLI.STUDIO tracks your practice history, evaluates accuracy by topic, and identifies knowledge gaps. The AI suggests a personalized daily roadmap to optimize your study time and boost your target scores.',
                    zh: '借助集成的 Gemini AI 技术，MOLI.STUDIO 自动跟踪做题历史，评估各主题正确率，并发现知识薄弱点，从而生成每日个性化复习路径。'
                  })}
                </p>
              </div>
            </div>

            <p className="mt-4">
              {pick({
                vi: 'Hãy bắt đầu hành trình chinh phục học bổng hôm nay. Đăng ký tài khoản để luyện HSK miễn phí, làm đề thi CSCA mô phỏng và trải nghiệm tính năng AI phân tích bài thi ngay hôm nay tại nền tảng ôn thi tiếng Trung thông minh nhất Việt Nam.',
                en: 'Start your journey to study in China today with MOLI.STUDIO. Sign up for a free account to practice mock exams and experience the smartest prep tools.',
                zh: '立即加入 MOLI.STUDIO，开启您的中国留学之旅。注册免费账号，体验最智能的备考工具。'
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="relative w-full overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 py-24">
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <FiAward className="mx-auto mb-6 text-white" size={56} />
          <h2 className="mb-4 text-4xl font-black tracking-tight text-white md:text-5xl">{t('home.final.title')}</h2>
          <p className="mb-10 text-xl text-indigo-200">{t('home.final.desc')}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className="flex items-center justify-center gap-2 rounded-xl bg-white px-10 py-4 text-lg font-black text-indigo-700 shadow-2xl transition-all hover:scale-105 hover:bg-indigo-50 active:scale-95">
              {t('home.hero.signup')} <FiArrowRight size={20} />
            </Link>
            <Link href="/de-mo-phong" className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-white/20">
              {t('home.final.tryExam')}
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-indigo-300">
            <FiCheckCircle size={15} /> {t('home.final.freeNote')}
          </p>
        </div>
      </section>
    </>
  );
}
