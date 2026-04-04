'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiChevronLeft, FiChevronRight, FiTarget, FiTrendingUp, FiAward, FiArrowRight, FiUsers, FiBook, FiStar } from 'react-icons/fi';

const slides = [
  {
    id: 1,
    title: 'Du học Trung Quốc',
    subtitle: 'Học bổng toàn phần tại các trường đại học hàng đầu thế giới',
    badge: '95% đạt học bổng',
    cta: 'Bắt đầu ôn thi',
    ctaHref: '/mon/toan',
    icon: FiTarget,
    bgImage: '/images/du-hoc-trung-quoc-1200x799.jpg',
    accentColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 2,
    title: 'Trường top 100 Châu Á',
    subtitle: 'Hàng trăm cơ hội học bổng từ các trường danh tiếng đang chờ bạn',
    badge: 'Tương lai rộng mở',
    cta: 'Xem tài liệu',
    ctaHref: '/tailieu',
    icon: FiAward,
    bgImage: '/images/university-6699377_1920.jpg',
    accentColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 3,
    title: 'Chinh phục CSCA 2026',
    subtitle: 'Cùng hơn 10,000 học viên luyện thi mỗi ngày với hệ thống thông minh',
    badge: '10,000+ học viên',
    cta: 'Làm đề thử ngay',
    ctaHref: '/de-mo-phong',
    icon: FiTrendingUp,
    bgImage: '/images/pexels-markus-winkler-1430818-30855414.jpg',
    accentColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 4,
    title: 'Đại học Nhân Dân Trung Quốc',
    subtitle: 'Môi trường học tập hiện đại, chất lượng quốc tế Top 1% thế giới',
    badge: 'Top 1% thế giới',
    cta: 'Lộ trình học của tôi',
    ctaHref: '/lo-trinh',
    icon: FiAward,
    bgImage: '/images/h-nhan-dan.jpg',
    accentColor: 'from-rose-500 to-pink-600',
  },
];

// Quick panel stats (static — no API needed for banner)
const QUICK_STATS = [
  { icon: FiUsers, value: '10k+', label: 'Học viên' },
  { icon: FiBook,  value: '500+', label: 'Đề thi' },
  { icon: FiStar,  value: '95%',  label: 'Tỷ lệ đậu' },
];

export default function Banner() {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const go = (dir: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent((prev) => (prev + dir + slides.length) % slides.length);
    startTimer();
  };

  const goTo = (i: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent(i);
    startTimer();
  };

  return (
    <div
      className="relative w-full h-[92vh] min-h-[520px] overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Slides ── */}
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-all duration-700 ease-in-out ${
            i === current ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
        >
          <Image
            src={slide.bgImage}
            alt={slide.title}
            fill
            priority={i === 0}
            quality={90}
            sizes="100vw"
            className="object-cover"
          />
          {/* Multi-layer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Subtle horizontal light streak */}
          <div className={`absolute inset-0 bg-gradient-to-br ${slide.accentColor} opacity-[0.08]`} />
        </div>
      ))}

      {/* ── Center Content ── */}
      <div className="relative z-10 h-full flex items-center">
        <div className="w-full max-w-7xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

            {/* Left: Main text */}
            <div
              className={`lg:col-span-7 max-w-2xl transition-all duration-700 delay-100 ${
                'translate-y-0 opacity-100'
              }`}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full px-5 py-2 mb-6">
                {(() => { const Ic = slides[current].icon; return <Ic className="text-white" size={15} />; })()}
                <span className="text-white font-semibold text-sm">{slides[current].badge}</span>
              </div>

              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
                {slides[current].title}
              </h1>

              {/* Subtitle */}
              <p className="text-xl text-white/80 mb-8 leading-relaxed font-light">
                {slides[current].subtitle}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4">
                <Link
                  href={slides[current].ctaHref}
                  className="flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-bold text-base rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:scale-105 active:scale-95"
                >
                  {slides[current].cta} <FiArrowRight size={18} />
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold text-base rounded-xl border border-white/40 hover:bg-white/20 transition-all"
                >
                  Đăng ký miễn phí
                </Link>
              </div>
            </div>

            {/* Right: Glassmorphism info card */}
            <div className="lg:col-span-5 hidden lg:flex justify-end">
              <div className="bg-white/10 backdrop-blur-xl border border-white/25 rounded-3xl p-7 w-80 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-xl">🎓</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">CSCA Platform</p>
                    <p className="text-white/60 text-xs">Luyện thi học bổng Trung Quốc</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {QUICK_STATS.map(s => (
                    <div key={s.label} className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
                      <s.icon className="text-white/70 mx-auto mb-1" size={16} />
                      <p className="text-white font-black text-lg leading-tight">{s.value}</p>
                      <p className="text-white/55 text-[10px] leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Subject pills */}
                <div className="mb-6">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">4 Môn thi</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { emoji: '📐', name: 'Toán',    href: '/mon/toan' },
                      { emoji: '⚡', name: 'Vật Lý',   href: '/mon/vatly' },
                      { emoji: '🧪', name: 'Hóa Học',  href: '/mon/hoa' },
                      { emoji: '🈶', name: '汉语',      href: '/tiengtrung-xahoi' },
                    ].map(s => (
                      <Link
                        key={s.name}
                        href={s.href}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full text-white text-xs font-medium transition-colors"
                      >
                        <span>{s.emoji}</span> {s.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Progress bar – visual only */}
                <div className="space-y-2">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Tỷ lệ học viên đậu</p>
                  <div className="w-full bg-white/15 rounded-full h-2">
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 w-[95%] transition-all" />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/50">
                    <span>0%</span>
                    <span className="text-emerald-400 font-bold">95% đạt học bổng</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav arrows ── */}
      <button
        onClick={() => go(-1)}
        className={`absolute left-5 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/15 backdrop-blur-md border border-white/30 hover:bg-white/30 rounded-full flex items-center justify-center transition-all z-20 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <FiChevronLeft className="text-white" size={24} />
      </button>
      <button
        onClick={() => go(1)}
        className={`absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/15 backdrop-blur-md border border-white/30 hover:bg-white/30 rounded-full flex items-center justify-center transition-all z-20 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <FiChevronRight className="text-white" size={24} />
      </button>

      {/* ── Bottom: Dots + counter ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`transition-all duration-300 rounded-full ${
              i === current ? 'w-8 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/45 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
      <div className="absolute bottom-8 right-8 text-white/50 text-sm font-mono z-20">
        {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
      </div>

      {/* ── Bottom wave shape ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-16 block">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </div>
    </div>
  );
}
