'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  FiArrowRight, FiBook, FiTarget, FiTrendingUp, FiUsers,
  FiFileText, FiZap, FiAward, FiCheckCircle, FiStar,
  FiClock, FiCalendar, FiBell, FiCpu, FiBarChart2,
  FiShield, FiPlay,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

// ──────────────────── DATA ────────────────────
const SUBJECTS = [
  { id: 'toan',             name: 'Toán',           name_cn: '数学',    href: '/toan',             emoji: '📐', gradient: 'from-blue-500 to-indigo-600',   shadow: 'hover:shadow-blue-200',   light: 'bg-blue-50 border-blue-200 text-blue-700',       desc: 'Đại số · Giải tích · Hình học' },
  { id: 'vat-ly',           name: 'Vật Lý',         name_cn: '物理',    href: '/vat-ly',           emoji: '⚡', gradient: 'from-yellow-400 to-orange-500', shadow: 'hover:shadow-orange-200', light: 'bg-yellow-50 border-yellow-200 text-yellow-700', desc: 'Cơ học · Điện từ · Quang học' },
  { id: 'hoa',              name: 'Hóa Học',        name_cn: '化学',    href: '/hoa',             emoji: '🧪', gradient: 'from-emerald-500 to-teal-600',  shadow: 'hover:shadow-emerald-200',light: 'bg-emerald-50 border-emerald-200 text-emerald-700', desc: 'Hóa vô cơ · Hóa hữu cơ' },
  { id: 'tieng-trung-xh',   name: 'Tiếng Trung XH',  name_cn: '中文(文)', href: '/tiengtrung-xahoi',emoji: '📖', gradient: 'from-red-500 to-rose-600',      shadow: 'hover:shadow-red-200',    light: 'bg-red-50 border-red-200 text-red-700',          desc: 'Khối xã hội · Nhân văn' },
  { id: 'tieng-trung-tn',   name: 'Tiếng Trung TN',  name_cn: '中文(理)', href: '/tiengtrung-tunhien',emoji: '🔬', gradient: 'from-violet-500 to-purple-600', shadow: 'hover:shadow-violet-200', light: 'bg-violet-50 border-violet-200 text-violet-700', desc: 'Khối tự nhiên · Kỹ thuật' },
  { id: 'forum',            name: 'Diễn Đàn',        name_cn: '论坛',    href: '/forum',           emoji: '💬', gradient: 'from-pink-500 to-fuchsia-600',  shadow: 'hover:shadow-pink-200',   light: 'bg-pink-50 border-pink-200 text-pink-700',       desc: 'Trao đổi · Q&A cộng đồng' },
];

const HOT_EXAMS = [
  { title: 'Đề Toán Tổng Hợp 2025',      subject: 'Toán',        emoji: '📐', attempts: 1240, difficulty: 'Khó',        diffColor: 'bg-red-100 text-red-600',       href: '/de-mo-phong', gradient: 'from-blue-500 to-indigo-600' },
  { title: 'Tiếng Trung XH - Nhân văn',  subject: 'Tiếng Trung', emoji: '📖', attempts: 890,  difficulty: 'Trung bình', diffColor: 'bg-yellow-100 text-yellow-700', href: '/de-mo-phong', gradient: 'from-red-500 to-rose-600' },
  { title: 'Vật Lý Điện Từ Nâng Cao',    subject: 'Vật Lý',      emoji: '⚡', attempts: 670,  difficulty: 'Khó',        diffColor: 'bg-red-100 text-red-600',       href: '/de-mo-phong', gradient: 'from-yellow-400 to-orange-500' },
];

const AI_STEPS = [
  { icon: FiBarChart2,  title: 'Phân tích điểm yếu', desc: 'AI đọc lịch sử làm bài, xác định chủ đề bạn hay sai nhất' },
  { icon: FiCpu,        title: 'Tạo lộ trình riêng', desc: 'Gemini AI lên kế hoạch ôn thi cá nhân hóa theo thời gian còn lại' },
  { icon: FiTrendingUp, title: 'Theo dõi tiến bộ',   desc: 'Biểu đồ tiến độ thực tế, nhắc nhở học đúng giờ mỗi ngày' },
];

const STATS_FALLBACK = [
  { icon: FiUsers,    key: 'users' as const,     label: 'Học viên',   color: 'text-violet-600', bg: 'from-violet-500 to-purple-600',  format: (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k+` : `${n}+` },
  { icon: FiFileText, key: 'exams' as const,     label: 'Đề thi',     color: 'text-blue-600',   bg: 'from-blue-500 to-indigo-600',    format: (n: number) => `${n}+` },
  { icon: FiBook,     key: 'materials' as const, label: 'Tài liệu',   color: 'text-emerald-600', bg: 'from-emerald-500 to-teal-600',  format: (n: number) => `${n}+` },
  { icon: FiAward,    key: 'passRate' as const,  label: 'Tỷ lệ đậu',  color: 'text-orange-600', bg: 'from-orange-400 to-amber-500',   format: (n: number) => `${n}%` },
];

type StatsData = { users: number; exams: number; materials: number; passRate: number };
const STATS_DEFAULT: StatsData = { users: 10000, exams: 500, materials: 200, passRate: 95 };

const FEATURES = [
  { icon: FiZap,        title: 'Đề thi chuẩn CSCA',    desc: 'Đề thi mô phỏng sát với kỳ thi thật, cập nhật liên tục.',                      color: 'bg-yellow-100 text-yellow-600',  ring: 'ring-yellow-200' },
  { icon: FiTarget,     title: 'AI lộ trình cá nhân',  desc: 'Gemini AI phân tích điểm yếu và đề xuất lộ trình tối ưu.',                      color: 'bg-purple-100 text-purple-600',  ring: 'ring-purple-200' },
  { icon: FiTrendingUp, title: 'Theo dõi tiến độ',     desc: 'Dashboard trực quan: tốc độ tiến bộ, lịch sử và điểm theo chủ đề.',             color: 'bg-blue-100 text-blue-600',      ring: 'ring-blue-200' },
  { icon: FiBook,       title: 'Từ vựng thông minh',   desc: 'Hệ thống flashcard tiếng Trung với spaced repetition tự động.',                  color: 'bg-emerald-100 text-emerald-600', ring: 'ring-emerald-200' },
  { icon: FiShield,     title: 'Cấu trúc đề chi tiết', desc: 'Phân tích cấu trúc đề thi CSCA từng năm, biết trước sẽ gặp gì.',                color: 'bg-rose-100 text-rose-600',      ring: 'ring-rose-200' },
  { icon: FiUsers,      title: 'Cộng đồng học viên',   desc: 'Diễn đàn Q&A sôi nổi, chia sẻ kinh nghiệm cùng 10k+ bạn học.',                 color: 'bg-indigo-100 text-indigo-600',  ring: 'ring-indigo-200' },
];

const TESTIMONIALS = [
  { name: 'Minh Anh',   score: '9.5/10',             text: '"Hệ thống đề thi rất sát đề thật. Mình đã đậu học bổng toàn phần nhờ luyện thi ở đây suốt 3 tháng."',               subject: 'Toán',        avatar: 'M', emoji: '📐' },
  { name: 'Thu Trang',  score: 'Học bổng toàn phần', text: '"AI phân tích điểm yếu cực kỳ chính xác, giúp mình tập trung đúng chỗ cần cải thiện thay vì học dàn trải."',  subject: 'Tiếng Trung', avatar: 'T', emoji: '📖' },
  { name: 'Quang Hưng', score: 'Top 5%',              text: '"Tài liệu được biên soạn chi tiết, có cả tiếng Trung lẫn tiếng Việt. Học rất nhanh và không bỡ ngỡ."',         subject: 'Vật Lý',     avatar: 'Q', emoji: '⚡' },
];

// ──────────────────── COUNTDOWN ────────────────────
const EXAM_DATE_FALLBACK_STR = process.env.NEXT_PUBLIC_EXAM_DATE || '2026-06-10T08:00:00';
const EXAM_DATE_FALLBACK = new Date(EXAM_DATE_FALLBACK_STR);

type Countdown = { days: number; hours: number; minutes: number; seconds: number };

function useCountdown(target: Date | null) {
  const calc = (): Countdown => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState<Countdown | null>(null);
  useEffect(() => {
    if (!target) return;
    setTime(calc());
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.getTime()]);
  return time;
}

function CountdownUnit({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-400/20 rounded-2xl blur-md" />
        <div
          className="relative w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl md:text-5xl font-black text-white shadow-lg"
          suppressHydrationWarning
        >
          {value === null ? '--' : String(value).padStart(2, '0')}
        </div>
      </div>
      <span className="text-white/70 text-xs font-medium mt-2 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ──────────────────── COMPONENT ────────────────────
export default function HomeContent() {
  // Admin-configurable exam date fetched from API
  const [examDate, setExamDate] = useState<Date | null>(null);
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/settings/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const dateStr = json?.data?.exam_date;
        setExamDate(dateStr ? new Date(dateStr) : EXAM_DATE_FALLBACK);
      })
      .catch(() => setExamDate(EXAM_DATE_FALLBACK));
  }, []);

  const countdown = useCountdown(examDate);

  // Fetch real stats from API, fallback to defaults if error
  const [stats, setStats] = useState<StatsData>(STATS_DEFAULT);
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiUrl}/stats/overview`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.success && json.data) setStats(json.data); })
      .catch(() => { /* giữ fallback */ });
  }, []);

  return (
    <>
      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <section className="w-full bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          {STATS_FALLBACK.map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.bg} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="font-black text-gray-900 text-lg sm:text-xl leading-tight">
                  {s.format(stats[s.key])}
                </p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUBJECTS GRID ─────────────────────────────────────── */}
      <section className="w-full bg-gray-50/60 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-widest mb-3">6 Môn Thi</span>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Chọn Môn Học Của Bạn</h2>
            <p className="text-gray-500 mt-3 text-lg">Nội dung chuẩn đề thi CSCA, cập nhật liên tục</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {SUBJECTS.map(s => (
              <Link key={s.id} href={s.href}
                className={`group relative bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-transparent hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 overflow-hidden ${s.shadow}`}
              >
                {/* Gradient top bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                {/* Glow bg on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity`} />

                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{s.emoji}</span>
                  <span className="text-xs font-bold text-gray-300 group-hover:text-gray-400 transition-colors">{s.name_cn}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{s.name}</h3>
                <p className="text-sm text-gray-400 mb-4">{s.desc}</p>
                <div className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
                  Học ngay <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOT EXAMS ─────────────────────────────────────────── */}
      <section className="w-full bg-white py-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="inline-block px-4 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-full uppercase tracking-widest mb-3">🔥 Nổi Bật</span>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">Đề Thi Hot Tuần Này</h2>
              <p className="text-gray-500 mt-2">Được nhiều học viên luyện tập nhất</p>
            </div>
            <Link href="/de-mo-phong" className="hidden md:inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
              Xem tất cả <FiArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOT_EXAMS.map(e => (
              <Link key={e.title} href={e.href}
                className="group bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden relative"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${e.gradient}`} />
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{e.emoji}</span>
                  <span className="text-xs text-gray-400 font-medium">{e.subject}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-3 leading-snug group-hover:text-indigo-700 transition-colors">{e.title}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <FiUsers size={12} /> <span>{e.attempts.toLocaleString()} lượt làm</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.diffColor}`}>{e.difficulty}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-800">
                  <FiPlay size={14} /> Làm ngay
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── COUNTDOWN TIMER ───────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-20 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-72 h-72 bg-purple-500 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-6">
            <FiCalendar className="text-indigo-400" size={16} />
            <span className="text-indigo-300 text-sm font-semibold">Kỳ thi CSCA 2026</span>
          </div>
          <h2 className="text-4xl font-black text-white mb-3">Thời gian còn lại đến ngày thi</h2>
          <p className="text-white/60 mb-10 text-lg">Đừng để thời gian trôi qua — bắt đầu ôn tập ngay hôm nay</p>

          <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-8 mb-10">
            <CountdownUnit value={countdown?.days ?? null} label="Ngày" />
            <span className="text-white/40 text-2xl sm:text-4xl font-light mb-6">:</span>
            <CountdownUnit value={countdown?.hours ?? null} label="Giờ" />
            <span className="text-white/40 text-2xl sm:text-4xl font-light mb-6">:</span>
            <CountdownUnit value={countdown?.minutes ?? null} label="Phút" />
            <span className="text-white/40 text-2xl sm:text-4xl font-light mb-6">:</span>
            <CountdownUnit value={countdown?.seconds ?? null} label="Giây" />
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/de-mo-phong"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-2xl hover:scale-105 active:scale-95"
            >
              <FiZap size={18} /> Làm đề thử ngay
            </Link>
            <Link href="/lo-trinh"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all"
            >
              <FiBell size={18} /> Lên lịch ôn thi
            </Link>
          </div>
        </div>
      </section>

      {/* ── AI HIGHLIGHT ──────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 to-transparent" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold rounded-full uppercase tracking-widest mb-6">
                <FiCpu size={13} /> Powered by Gemini AI
              </span>
              <h2 className="text-4xl font-black text-white mb-4 leading-tight">
                Lộ Trình Học Tập<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Cá Nhân Hóa</span>
              </h2>
              <p className="text-white/60 mb-10 text-lg leading-relaxed">
                Không còn học dàn trải. AI phân tích hành vi làm bài của bạn và đưa ra kế hoạch chính xác nhất.
              </p>
              <div className="space-y-6">
                {AI_STEPS.map((step, i) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-400">
                      <step.icon size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-white mb-0.5">{i + 1}. {step.title}</p>
                      <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/lo-trinh"
                className="mt-10 inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-lg shadow-indigo-900/40"
              >
                Thử AI Lộ Trình <FiArrowRight size={16} />
              </Link>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-7 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/30 flex items-center justify-center text-indigo-300">
                  <FiCpu size={18} />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Phân tích của AI</p>
                  <p className="text-white/40 text-xs">Dựa trên 30 ngày làm bài gần nhất</p>
                </div>
              </div>
              <div className="space-y-4 mb-6">
                {[
                  { label: 'Đại số tuyến tính',     pct: 82, color: 'bg-emerald-400' },
                  { label: 'Hàm số & đạo hàm',      pct: 65, color: 'bg-yellow-400'  },
                  { label: 'Hình học không gian',    pct: 41, color: 'bg-red-400'     },
                  { label: 'Phương trình vi phân',   pct: 55, color: 'bg-orange-400'  },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/70">{row.label}</span>
                      <span className="text-white/50">{row.pct}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl p-4">
                <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">💡 Gợi ý hôm nay</p>
                <p className="text-white/70 text-sm leading-relaxed">Tập trung ôn <span className="text-white font-semibold">Hình học không gian</span> — tỷ lệ xuất hiện trong đề thi là 22%. Làm 3 bài luyện tập ngay!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section className="w-full bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase tracking-widest mb-3">Tại sao CSCA?</span>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Học Thông Minh, Đậu Chắc</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className={`group p-8 rounded-2xl border-2 border-gray-100 hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-200 hover:ring-4 ${f.ring}`}>
                <div className={`w-14 h-14 rounded-2xl ${f.color} flex items-center justify-center mb-6`}>
                  <f.icon size={26} />
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">{f.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-gray-50 to-white py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-widest mb-3">3 Bước Đơn Giản</span>
            <h2 className="text-4xl font-black text-gray-900">Bắt Đầu Ngay Hôm Nay</h2>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-11 left-[16%] right-[16%] h-px bg-gradient-to-r from-indigo-200 via-blue-200 to-emerald-200" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
              {[
                { step: '01', title: 'Chọn môn học',       desc: 'Toán, Vật Lý, Hóa hay Tiếng Trung — chọn theo khối thi của bạn',                                          color: 'bg-indigo-600', href: '/mon/toan' },
                { step: '02', title: 'Ôn lý thuyết',       desc: 'Đọc tài liệu PDF biên soạn bởi đội ngũ chuyên gia có kinh nghiệm thi CSCA',                               color: 'bg-blue-600',   href: '/tailieu' },
                { step: '03', title: 'Luyện đề thực chiến', desc: 'Làm đề, xem kết quả chi tiết và phân tích từng câu ngay sau khi nộp bài',                                color: 'bg-emerald-600', href: '/de-mo-phong' },
              ].map((s) => (
                <Link key={s.step} href={s.href} className="group text-center hover:-translate-y-1 transition-transform duration-200">
                  <div className={`w-24 h-24 mx-auto ${s.color} rounded-2xl flex items-center justify-center mb-5 font-black text-3xl text-white shadow-lg group-hover:shadow-xl transition-shadow`}>
                    {s.step}
                  </div>
                  <h3 className="font-bold text-gray-900 text-xl mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section className="w-full bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full uppercase tracking-widest mb-3">Học Viên Nói Gì</span>
            <h2 className="text-4xl font-black text-gray-900">Câu Chuyện Thành Công</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="relative bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden">
                <span className="absolute -bottom-2 -right-2 text-8xl opacity-5 select-none pointer-events-none">{t.emoji}</span>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => <FiStar key={i} size={15} className="text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 italic relative">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.subject} · <span className="text-emerald-600 font-semibold">{t.score}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIP ADVERTISEMENT ───────────────────────────────────── */}
      <section className="w-full bg-slate-50 py-24 border-t border-gray-100 relative overflow-hidden">
        {/* Luminous background blob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-amber-200 to-orange-400 rounded-full blur-[120px] opacity-20 pointer-events-none" />
        
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-100 to-orange-100 border border-orange-200 text-orange-700 text-xs font-bold rounded-full uppercase tracking-widest mb-6 shadow-sm">
            👑 Premium Access
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
            Nâng cấp <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">CSCA PRO</span> ngay hôm nay
          </h2>
          <p className="max-w-2xl mx-auto text-gray-600 mb-10 text-lg leading-relaxed">
            Mở khoá toàn bộ đề thi, lời giải chi tiết và chữa bài tự luận bằng AI. Đừng bỏ lỡ cơ hội bứt phá điểm số với kho tàng tài liệu độc quyền dành riêng cho thành viên VIP.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              { icon: FiStar, text: 'Truy cập đầy đủ kho đề thi' },
              { icon: FiZap, text: 'Chữa bài tự luận AI' },
              { icon: FiTrendingUp, text: 'Gia tăng 300% tỷ lệ đậu' },
              { icon: FiUsers, text: 'Hỗ trợ ưu tiên 24/7' }
            ].map((f, i) => (
               <div key={i} className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl shadow-sm border border-orange-100 text-gray-700 font-bold text-sm hover:-translate-y-1 transition-transform">
                 <f.icon className="text-orange-500" size={18} /> {f.text}
               </div>
            ))}
          </div>

          <Link href="/vip"
             className="inline-flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-8 md:px-10 py-4 sm:py-5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 active:scale-95 text-base sm:text-lg md:text-xl"
          >
             <FaCrown className="text-yellow-200 animate-pulse" size={20} /> <span className="hidden xs:inline">Trở Thành</span> Viên PRO
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="text-6xl mb-6">🚀</div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Sẵn sàng chinh phục CSCA?</h2>
          <p className="text-indigo-200 mb-10 text-xl">Tham gia cùng hơn 10,000 học viên đang ôn thi mỗi ngày</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register"
              className="flex items-center justify-center gap-2 px-10 py-4 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-all shadow-2xl hover:scale-105 active:scale-95 text-lg"
            >
              Đăng ký miễn phí <FiArrowRight size={20} />
            </Link>
            <Link href="/de-mo-phong"
              className="flex items-center justify-center gap-2 px-10 py-4 bg-white/10 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/20 transition-all text-lg"
            >
              Thử làm đề ngay
            </Link>
          </div>
          <p className="text-indigo-300 text-sm mt-6 flex items-center justify-center gap-2">
            <FiCheckCircle size={15} /> Miễn phí hoàn toàn · Không cần thẻ tín dụng
          </p>
        </div>
      </section>
    </>
  );
}
