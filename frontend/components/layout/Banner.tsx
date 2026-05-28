'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowRight, FiAward, FiBook, FiChevronLeft, FiChevronRight, FiStar, FiTarget, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { useLanguage } from '@/context/LanguageContext';

const SLIDE_COPY = [
  {
    id: 1,
    title: {
      vi: 'Du học Trung Quốc',
      en: 'Study in China',
      zh: '留学中国',
    },
    subtitle: {
      vi: 'Học bổng toàn phần tại các trường đại học hàng đầu thế giới',
      en: 'Full scholarships at leading universities around the world',
      zh: '世界一流大学全额奖学金机会',
    },
    badge: {
      vi: '95% đạt học bổng',
      en: '95% scholarship success',
      zh: '95%获得奖学金',
    },
    cta: {
      vi: 'Bắt đầu ôn thi',
      en: 'Start preparing',
      zh: '开始备考',
    },
    ctaHref: '/mon/toan',
    icon: FiTarget,
    bgImage: '/images/du-hoc-trung-quoc-1200x799.jpg',
    accentColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 2,
    title: {
      vi: 'Trường top 100 Châu Á',
      en: 'Top 100 Asian universities',
      zh: '亚洲百强大学',
    },
    subtitle: {
      vi: 'Hàng trăm cơ hội học bổng từ các trường danh tiếng đang chờ bạn',
      en: 'Hundreds of scholarship opportunities from prestigious universities are waiting for you',
      zh: '众多名校奖学金机会正在等待你',
    },
    badge: {
      vi: 'Tương lai rộng mở',
      en: 'A broader future',
      zh: '更广阔的未来',
    },
    cta: {
      vi: 'Xem tài liệu',
      en: 'View materials',
      zh: '查看资料',
    },
    ctaHref: '/tailieu',
    icon: FiAward,
    bgImage: '/images/university-6699377_1920.jpg',
    accentColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 3,
    title: {
      vi: 'Chinh phục CSCA 2026',
      en: 'Conquer CSCA 2026',
      zh: '攻克 CSCA 2026',
    },
    subtitle: {
      vi: 'Cùng hơn 10,000 học viên luyện thi mỗi ngày với hệ thống thông minh',
      en: 'Practice every day with 10,000+ students on an intelligent learning system',
      zh: '与超过10,000名学员一起使用智能系统每日备考',
    },
    badge: {
      vi: '10,000+ học viên',
      en: '10,000+ students',
      zh: '10,000+学员',
    },
    cta: {
      vi: 'Làm đề thử ngay',
      en: 'Try an exam now',
      zh: '立即试做',
    },
    ctaHref: '/de-mo-phong',
    icon: FiTrendingUp,
    bgImage: '/images/pexels-markus-winkler-1430818-30855414.jpg',
    accentColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 4,
    title: {
      vi: 'Đại học Nhân Dân Trung Quốc',
      en: 'Renmin University of China',
      zh: '中国人民大学',
    },
    subtitle: {
      vi: 'Môi trường học tập hiện đại, chất lượng quốc tế thuộc nhóm Top 1% thế giới',
      en: 'A modern learning environment with international quality in the global Top 1%',
      zh: '现代化学习环境，国际化教育质量位居全球前1%',
    },
    badge: {
      vi: 'Top 1% thế giới',
      en: 'Global Top 1%',
      zh: '全球前1%',
    },
    cta: {
      vi: 'Lộ trình học của tôi',
      en: 'My study roadmap',
      zh: '我的学习路径',
    },
    ctaHref: '/lo-trinh',
    icon: FiAward,
    bgImage: '/images/h-nhan-dan.jpg',
    accentColor: 'from-rose-500 to-pink-600',
  },
];

const BANNER_IMAGES = [
  { src: '/images/banner/campus-01.jpg', objectPosition: 'center 48%', accentColor: 'from-amber-500 to-red-600' },
  { src: '/images/banner/campus-02.jpg', objectPosition: '65% center', accentColor: 'from-sky-500 to-cyan-600' },
  { src: '/images/banner/campus-03.jpg', objectPosition: 'center center', accentColor: 'from-emerald-500 to-lime-600' },
  { src: '/images/banner/campus-04.jpg', objectPosition: 'center 45%', accentColor: 'from-pink-400 to-rose-600' },
  { src: '/images/banner/campus-05.jpg', objectPosition: 'center 45%', accentColor: 'from-cyan-500 to-teal-600' },
  { src: '/images/banner/campus-06.jpg', objectPosition: 'center center', accentColor: 'from-rose-400 to-orange-500' },
  { src: '/images/banner/campus-07.jpg', objectPosition: 'center center', accentColor: 'from-green-500 to-emerald-600' },
  { src: '/images/banner/campus-08.jpg', objectPosition: 'center 54%', accentColor: 'from-yellow-400 to-emerald-600' },
  { src: '/images/banner/campus-09.jpg', objectPosition: 'center 47%', accentColor: 'from-violet-500 to-rose-500' },
  { src: '/images/banner/campus-10.jpg', objectPosition: 'center center', accentColor: 'from-blue-400 to-slate-600' },
  { src: '/images/banner/campus-11.jpg', objectPosition: 'center center', accentColor: 'from-amber-400 to-green-600' },
  { src: '/images/banner/campus-12.jpg', objectPosition: 'center center', accentColor: 'from-orange-400 to-emerald-600' },
  { src: '/images/banner/campus-13.jpg', objectPosition: 'center center', accentColor: 'from-lime-500 to-stone-600' },
  { src: '/images/banner/campus-14.jpg', objectPosition: 'center center', accentColor: 'from-yellow-400 to-red-600' },
];

const SLIDES = BANNER_IMAGES.map((image, index) => ({
  ...SLIDE_COPY[index % SLIDE_COPY.length],
  id: index + 1,
  bgImage: image.src,
  objectPosition: image.objectPosition,
  accentColor: image.accentColor,
}));

const QUICK_STATS = [
  { icon: FiUsers, value: '10k+', labelKey: 'home.stats.students' },
  { icon: FiBook, value: '500+', labelKey: 'home.stats.exams' },
  { icon: FiStar, value: '95%', labelKey: 'home.stats.passRate' },
];

const SUBJECT_PILLS = [
  { labelKey: 'subject.math', href: '/mon/toan' },
  { labelKey: 'subject.physics', href: '/vat-ly' },
  { labelKey: 'subject.chemistry', href: '/hoa' },
  { labelKey: 'subject.chineseSoc', href: '/tiengtrung-xahoi' },
];

export default function Banner() {
  const { t, pick } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef(0);

  const commitSlide = (index: number) => {
    const next = (index + SLIDES.length) % SLIDES.length;
    if (next === currentRef.current) return;

    setPrevious(currentRef.current);
    currentRef.current = next;
    setCurrent(next);

    if (transitionRef.current) clearTimeout(transitionRef.current);
    transitionRef.current = setTimeout(() => setPrevious(null), 800);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      commitSlide(currentRef.current + 1);
    }, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, []);

  useEffect(() => {
    [current, current + 1, current - 1].forEach((index) => {
      const slideToPreload = SLIDES[(index + SLIDES.length) % SLIDES.length];
      const image = new window.Image();
      image.src = slideToPreload.bgImage;
    });
  }, [current]);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setIsTouch(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const slide = SLIDES[current];
  const Icon = slide.icon;
  const showArrows = isHovered || isTouch;

  const go = (dir: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    commitSlide(currentRef.current + dir);
    startTimer();
  };

  const goTo = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    commitSlide(index);
    startTimer();
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 'calc(100svh - 68px)', minHeight: '480px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {[previous, current].filter((index, position, indexes): index is number => index !== null && indexes.indexOf(index) === position).map((index) => {
        const item = SLIDES[index];
        const isActive = index === current;

        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ease-out ${isActive ? 'z-[1] opacity-100' : 'z-0 opacity-0'}`}
          >
            <Image
              src={item.bgImage}
              alt={pick(item.title)}
              fill
              priority={index === 0}
              quality={90}
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: item.objectPosition }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className={`absolute inset-0 bg-gradient-to-br ${item.accentColor} opacity-[0.08]`} />
          </div>
        );
      })}

      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="max-w-2xl opacity-100 transition-all delay-100 duration-700 lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2 backdrop-blur-md">
                <Icon className="text-white" size={15} />
                <span className="text-sm font-semibold text-white">{pick(slide.badge)}</span>
              </div>

              <h1 className="mb-4 text-2xl font-black leading-tight tracking-tight text-white xs:text-3xl sm:text-4xl md:mb-5 md:text-5xl lg:text-6xl">
                {pick(slide.title)}
              </h1>

              <p className="mb-6 text-base font-light leading-relaxed text-white/80 sm:text-lg md:mb-8 md:text-xl">
                {pick(slide.subtitle)}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={slide.ctaHref}
                  className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-2xl transition-all hover:scale-105 hover:bg-gray-100 active:scale-95 sm:px-8 sm:py-4 sm:text-base"
                >
                  {pick(slide.cta)} <FiArrowRight size={18} />
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:px-8 sm:py-4 sm:text-base"
                >
                  {t('home.hero.signup')}
                </Link>
              </div>
            </div>

            <div className="hidden justify-end md:flex lg:col-span-5">
              <div className="w-80 rounded-3xl border border-white/25 bg-white/10 p-7 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <FiAward className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t('home.hero.platform')}</p>
                    <p className="text-xs text-white/60">{t('home.hero.platformDesc')}</p>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-3">
                  {QUICK_STATS.map((stat) => (
                    <div key={stat.labelKey} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center">
                      <stat.icon className="mx-auto mb-1 text-white/70" size={16} />
                      <p className="text-lg font-black leading-tight text-white">{stat.value}</p>
                      <p className="text-[10px] leading-tight text-white/55">{t(stat.labelKey)}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">{t('home.hero.subjectCount')}</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_PILLS.map((subject) => (
                      <Link
                        key={subject.labelKey}
                        href={subject.href}
                        className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/25"
                      >
                        {t(subject.labelKey)}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{t('home.hero.passRate')}</p>
                  <div className="h-2 w-full rounded-full bg-white/15">
                    <div className="h-2 w-[95%] rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/50">
                    <span>0%</span>
                    <span className="font-bold text-emerald-400">{pick(SLIDES[0].badge)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        className={`absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 backdrop-blur-md transition-all hover:bg-white/30 sm:left-5 sm:h-12 sm:w-12 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
        aria-label="Previous slide"
      >
        <FiChevronLeft className="text-white" size={22} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        className={`absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/15 backdrop-blur-md transition-all hover:bg-white/30 sm:right-5 sm:h-12 sm:w-12 ${showArrows ? 'opacity-100' : 'opacity-0'}`}
        aria-label="Next slide"
      >
        <FiChevronRight className="text-white" size={22} />
      </button>

      <div className="absolute bottom-8 left-1/2 z-20 flex max-w-[calc(100%-7rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 sm:gap-3">
        {SLIDES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => goTo(index)}
            className={`rounded-full transition-all duration-300 ${
              index === current ? 'h-2.5 w-8 bg-white' : 'h-2.5 w-2.5 bg-white/45 hover:bg-white/70'
            }`}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
      <div className="absolute bottom-8 right-8 z-20 hidden font-mono text-sm text-white/50 sm:block">
        {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="block h-16 w-full">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </div>
    </div>
  );
}
