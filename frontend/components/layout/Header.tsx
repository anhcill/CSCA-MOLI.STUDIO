'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiAward,
  FiBookOpen,
  FiChevronDown,
  FiFileText,
  FiGift,
  FiHelpCircle,
  FiHome,
  FiLogOut,
  FiMap,
  FiMenu,
  FiMessageSquare,
  FiMonitor,
  FiShield,
  FiUser,
  FiX,
  FiGitBranch,
} from 'react-icons/fi';
import { FaCrown, FaFire, FaTrophy, FaGamepad, FaGraduationCap } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';
import MessageBadge from './MessageBadge';
import DailyQuestsBtn from './DailyQuestsBtn';
import ThemeToggle from './ThemeToggle';
import DailyQuestBanner from './DailyQuestBanner';
import { isNationalDayThemeActive, NATIONAL_DAY_THEME_END } from '@/lib/nationalDayTheme';

const COURSE_ITEMS = [
  { id: 'math', labelKey: 'subject.math', href: '/toan/de-mo-phong' },
  { id: 'physics', labelKey: 'subject.physics', href: '/vat-ly' },
  { id: 'chemistry', labelKey: 'subject.chemistry', href: '/hoa' },
  { id: 'chinese-soc', labelKey: 'subject.chineseSoc', href: '/tiengtrung-xahoi' },
  { id: 'chinese-sci', labelKey: 'subject.chineseSci', href: '/tiengtrung-tunhien' },
];

const MAIN_NAV_TOP = [
  { id: 'home', labelKey: 'nav.home', href: '/', icon: FiHome },
  { id: 'exam', labelKey: 'nav.examRoom', href: '/exam-room', icon: FiMonitor },
];

const MAIN_NAV_BOTTOM = [
  { id: 'roadmap', labelKey: 'nav.roadmap', href: '/lo-trinh', icon: FiGitBranch },
  { id: 'games', labelKey: 'nav.games', href: '/games', icon: FaGamepad },
  { id: 'docs', labelKey: 'nav.docs', href: '/tailieu', icon: FiFileText },
  { id: 'forum', labelKey: 'nav.forum', href: '/forum', icon: FiMessageSquare },
  { id: 'qa', labelKey: 'nav.qa', href: '/hoi-dap', icon: FaCrown },
  { id: 'feedback', labelKey: 'nav.feedback', href: '/gop-y', icon: FiHelpCircle },
  { id: 'blog', labelKey: 'nav.blog', href: '/blog', icon: FiBookOpen },
];

export default function Header() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCourseMenu, setShowCourseMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCourseOpen, setMobileCourseOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [nationalDayTheme, setNationalDayTheme] = useState(isNationalDayThemeActive);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 4);
      
      // Auto-hide header when scrolling down past 80px, show when scrolling up
      if (currentScrollY <= 10) {
        setVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY.current) {
        setVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (courseMenuRef.current && !courseMenuRef.current.contains(event.target as Node)) {
        setShowCourseMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!nationalDayTheme) return;
    const remaining = NATIONAL_DAY_THEME_END.getTime() - Date.now();
    if (remaining <= 0) {
      setNationalDayTheme(false);
      return;
    }
    const timer = window.setTimeout(() => setNationalDayTheme(false), remaining);
    return () => window.clearTimeout(timer);
  }, [nationalDayTheme]);

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));
  const courseActive = pathname.includes('/mon/') || pathname.includes('tiengtrung') || pathname === '/vat-ly' || pathname === '/hoa';
  const streak = user?.current_streak ?? 0;

  const navLinkClass = (active: boolean) =>
    nationalDayTheme
      ? `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
          active
            ? 'bg-[#ffd568]/20 text-[#fff0b6] shadow-[inset_0_0_0_1px_rgba(255,215,104,0.42)]'
            : 'text-white/90 hover:bg-white/12 hover:text-[#ffe49a]'
        }`
      :
    `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
      active
        ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400'
        : 'text-gray-600 hover:bg-gray-50 hover:text-violet-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-violet-400'
    }`;

  return (
    <>
    <header className={`sticky top-0 z-[60] overflow-visible border-b py-2.5 backdrop-blur-md transition-all duration-300 ${nationalDayTheme ? 'national-day-header border-[#f5c95e]/55 bg-[linear-gradient(112deg,#9d0715_0%,#d31325_48%,#850512_100%)] shadow-[0_8px_28px_rgba(85,0,10,0.35)]' : 'border-gray-100 bg-white/95 dark:border-gray-800 dark:bg-gray-900/95'} ${scrolled ? 'shadow-lg' : 'shadow-sm'} ${visible ? 'translate-y-0' : '-translate-y-full shadow-none'}`}>
      {nationalDayTheme && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-2 top-[-1.65rem] text-8xl leading-none text-[#ffe074]/[0.16]">★</span>
          <span className="absolute left-[8%] bottom-[-0.8rem] text-5xl leading-none text-[#ffe074]/[0.12]">★</span>
          <span className="absolute left-[15%] top-[-0.5rem] text-3xl leading-none text-[#ffe074]/[0.17]">★</span>
          <span className="absolute left-[25%] top-2 text-4xl leading-none text-[#ffe074]/[0.14]">★</span>
          <span className="absolute left-[34%] bottom-[-1rem] text-6xl leading-none text-[#ffe074]/[0.13]">★</span>
          <span className="absolute left-[43%] top-[-0.65rem] text-5xl leading-none text-[#ffe074]/[0.12]">★</span>
          <span className="absolute left-[54%] bottom-1 text-3xl leading-none text-[#ffe074]/[0.16]">★</span>
          <span className="absolute left-[64%] top-2 text-4xl leading-none text-[#ffe074]/[0.13]">★</span>
          <span className="absolute left-[73%] bottom-[-0.75rem] text-6xl leading-none text-[#ffe074]/[0.12]">★</span>
          <span className="absolute right-[24%] top-[-0.9rem] text-7xl leading-none text-[#ffe074]/[0.14]">★</span>
          <span className="absolute right-[15%] top-3 text-3xl leading-none text-[#ffe074]/[0.16]">★</span>
          <span className="absolute -right-1 bottom-[-1.9rem] text-8xl leading-none text-[#ffe074]/[0.16]">★</span>
          <span className="absolute right-[8%] bottom-1 text-3xl leading-none text-[#ffe074]/[0.12]">★</span>
        </div>
      )}
      <div className="relative z-10 mx-auto w-full max-w-[1600px] overflow-visible px-3 sm:px-4 2xl:px-6">
        {/* Top Row: Logo, Nav, Search, Actions */}
        <div className="flex items-center justify-between gap-4 overflow-visible">
          {/* Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5 sm:gap-3">
            <div className={`relative flex h-9.5 w-9.5 items-center justify-center rounded-2xl shadow-md transition-all duration-300 group-hover:-translate-y-0.5 sm:h-10.5 sm:w-10.5 ${nationalDayTheme ? 'bg-gradient-to-br from-[#ffd768] via-[#f6b72c] to-[#cf7d0d]' : 'bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-500'}`}>
              <span className="text-lg font-black leading-none text-white sm:text-xl">m</span>
            </div>
            <span className={`hidden text-xl font-black tracking-tight sm:inline sm:text-2xl ${nationalDayTheme ? 'text-white drop-shadow-sm' : 'text-gray-900 dark:text-white'}`}>
              Moly
            </span>
          </Link>

          {/* Desktop Navigation & Search (Hidden on Mobile) */}
          <div className="hidden flex-1 items-center justify-between gap-4 xl:flex px-6">
            <nav className="flex items-center gap-1.5">
              <Link href={MAIN_NAV_TOP[0].href} className={navLinkClass(isActive(MAIN_NAV_TOP[0].href))}>
                <FiHome className="text-lg" />
                {t(MAIN_NAV_TOP[0].labelKey)}
              </Link>

              <div className="relative" ref={courseMenuRef}>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setShowCourseMenu((open) => !open); }}
                  className={navLinkClass(courseActive)}
                >
                  <FiBookOpen className="text-lg" />
                  {t('nav.courses')}
                  <FiChevronDown className={`transition-transform duration-200 ${showCourseMenu ? nationalDayTheme ? 'rotate-180 text-[#ffe49a]' : 'rotate-180 text-violet-600' : ''}`} />
                </button>

                {showCourseMenu && (
                  <div className="absolute left-0 top-full z-50 pt-3" onMouseLeave={() => setShowCourseMenu(false)}>
                    <div className="w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
                      <div className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        {t('nav.chooseSubject')}
                      </div>
                      {COURSE_ITEMS.map((course) => (
                        <Link
                          key={course.id}
                          href={course.href}
                          className="flex items-center rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-300 dark:hover:bg-violet-950/30 dark:hover:text-violet-400"
                        >
                          {t(course.labelKey)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link href="/khoa-hoc" className={navLinkClass(isActive('/khoa-hoc'))}>
                <FaGraduationCap className="text-lg" />
                {t('nav.videoCourses')}
              </Link>

              {MAIN_NAV_TOP.slice(1).map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.id} href={item.href} className={navLinkClass(isActive(item.href))}>
                    {Icon && <Icon className="text-lg" />}
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>

            <div className={`w-full max-w-[220px] shrink-0 ${nationalDayTheme ? 'national-day-search' : ''}`}>
              <SearchBar />
            </div>
          </div>

          {/* Right Side Icons & Actions */}
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <Link href="/vip" className={`hidden items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-extrabold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg xl:flex 2xl:px-4 ${nationalDayTheme ? 'border border-[#ffd66d]/55 bg-[#790914]/45 shadow-[#68000a]/20 hover:bg-[#67050e]/60' : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-500 shadow-indigo-500/10 hover:shadow-indigo-500/20'}`}>
              <FaCrown className="text-white" size={12} />
              <span className="hidden 2xl:inline">{t('nav.upgrade')}</span>
            </Link>

            <div className={`hidden lg:block ${nationalDayTheme ? 'national-day-language' : ''}`}>
              <LanguageSwitcher compact />
            </div>

            <div className={`hidden sm:block ${nationalDayTheme ? 'national-day-theme-toggle' : ''}`}>
              <ThemeToggle />
            </div>

            {mounted && isAuthenticated && streak > 0 && (
              <div
                className={`hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-all sm:flex ${
                  streak >= 3
                    ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-rose-50 shadow-sm dark:border-orange-800/50 dark:from-orange-900/30 dark:to-rose-900/30'
                    : 'border-orange-100 bg-orange-50 dark:border-orange-800/30 dark:bg-orange-900/20'
                }`}
                title={`${streak} ${t('common.days')}`}
              >
                <FaFire className={streak >= 3 ? 'animate-pulse text-rose-500' : 'text-orange-500'} size={16} />
                <span className={`text-sm font-black ${streak >= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {streak}
                </span>
              </div>
            )}

            <div className={nationalDayTheme ? 'national-day-message' : ''}><MessageBadge /></div>
            <div className={nationalDayTheme ? 'national-day-notifications' : ''}><NotificationBell /></div>
            <div className={`hidden sm:block ${nationalDayTheme ? 'national-day-quests' : ''}`}>
              <DailyQuestsBtn />
            </div>

            {mounted && isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setShowUserMenu((open) => !open); }}
                  className="flex items-center gap-2 rounded-2xl border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-800 dark:hover:bg-gray-800/50"
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-400 shadow-sm ring-2 ring-white sm:h-9 sm:w-9 dark:ring-gray-900">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <FiUser size={14} className="text-white" />
                    )}
                  </div>
                  <span className="hidden flex-col items-start leading-tight 2xl:flex">
                    <span className="max-w-[100px] truncate text-sm font-bold text-gray-800 dark:text-gray-200">{user.full_name}</span>
                    {isVipActive(user) && (
                      <span className="rounded bg-violet-600 px-1 py-0.5 text-[9px] font-extrabold tracking-wide text-white leading-none mt-0.5">
                        PRO
                      </span>
                    )}
                  </span>
                  <FiChevronDown size={14} className={`hidden text-gray-400 transition-transform duration-200 2xl:block ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="animate-in fade-in slide-in-from-top-2 absolute right-0 top-full z-[200] mt-2 w-64 overflow-hidden rounded-3xl border border-gray-100 bg-white py-3 shadow-2xl duration-150 dark:border-gray-800 dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
                    <div className="mb-2 flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        {user.avatar ? <img src={user.avatar} alt={user.full_name} className="h-full w-full object-cover" /> : <FiUser className="text-gray-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{user.full_name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <Link href="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-300 dark:hover:bg-violet-950/30 dark:hover:text-violet-400">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"><FiUser size={16} /></div>
                      {t('nav.profile')}
                    </Link>
                    {user.role === 'admin' && (
                      <Link href="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"><FiShield size={16} /></div>
                        {t('nav.admin')}
                      </Link>
                    )}
                    {!isVipActive(user) && (
                      <Link href="/vip" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-450"><FaCrown size={16} /></div>
                        {t('nav.upgradeVip')}
                      </Link>
                    )}
                    <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                      <button type="button" onClick={() => { logout(); setShowUserMenu(false); }} className="flex w-full items-center gap-3 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-450"><FiLogOut size={16} /></div>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : mounted ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-colors sm:px-4 sm:py-2 ${nationalDayTheme ? 'text-white hover:bg-white/12' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
                  {t('nav.login')}
                </Link>
                <Link href="/register" className={`rounded-xl px-3 py-1.5 text-sm font-bold shadow-md transition-all hover:shadow-lg sm:px-4 sm:py-2 ${nationalDayTheme ? 'bg-[#fff0b6] text-[#9d0715] hover:bg-white' : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200'}`}>
                  {t('nav.register')}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-[32px] w-[84px] animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 sm:h-[36px] sm:w-[94px]" />
                <div className="h-[32px] w-[74px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 sm:h-[36px] sm:w-[82px]" />
              </div>
            )}

            <button type="button" onClick={() => setMobileOpen((open) => !open)} className={`rounded-xl p-2 transition-colors xl:hidden ${nationalDayTheme ? 'text-white hover:bg-white/12' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`} aria-label="Menu">
              {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>

        {/* Divider line under top row (Hidden on Mobile) */}
        <div className={`my-2.5 hidden border-t xl:block ${nationalDayTheme ? 'border-[#ffdf83]/30' : 'border-gray-100 dark:border-gray-800'}`} />

        {/* Desktop Secondary Navigation Bar (Hidden on Mobile) */}
        <div className="hidden xl:block">
          <nav className="flex items-center gap-1.5 py-0.5 pl-1.5">
            <span className={`mr-3 text-xs font-bold ${nationalDayTheme ? 'text-[#ffe7a8]/80' : 'text-gray-400 dark:text-gray-500'}`}>{t('nav.more')}</span>
            {MAIN_NAV_BOTTOM.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 ${nationalDayTheme
                    ? isActive(item.href) ? 'bg-white/18 text-[#fff0ba]' : 'text-white/80 hover:bg-white/12 hover:text-[#ffe49a]'
                    : isActive(item.href) ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400' : 'text-gray-500 hover:bg-gray-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-violet-400'
                  }`}
                >
                  {Icon && <Icon className="text-sm" />}
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <Link
              href="/bang-xep-hang"
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 ${nationalDayTheme
                ? isActive('/bang-xep-hang') ? 'bg-white/18 text-[#fff0ba]' : 'text-white/80 hover:bg-white/12 hover:text-[#ffe49a]'
                : isActive('/bang-xep-hang') ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400' : 'text-gray-500 hover:bg-gray-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-violet-400'
              }`}
            >
              <FaTrophy className="text-sm" />
              {t('nav.ranking')}
            </Link>
          </nav>
        </div>
      </div>

      <div className={`absolute left-0 top-full w-full origin-top overflow-hidden border-t shadow-2xl transition-all duration-300 dark:border-gray-800 xl:hidden ${mobileOpen ? 'visible max-h-[85vh] overflow-y-auto bg-white opacity-100 dark:bg-gray-900' : 'invisible max-h-0 opacity-0'}`}>
        <div className="space-y-2 p-4">
          <SearchBar />

          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('common.language')}</span>
            <LanguageSwitcher compact />
          </div>

          {mounted && (!user || !isVipActive(user)) && (
            <Link href="/vip" onClick={() => setMobileOpen(false)} className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <FaCrown size={20} className="text-yellow-200" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-wide">{t('nav.mobileUpgradeTitle')}</p>
                  <p className="text-xs text-white/80">{t('nav.mobileUpgradeDesc')}</p>
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-600 shadow-sm">{t('nav.viewNow')}</div>
            </Link>
          )}

          {mounted && isAuthenticated && user && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-400 shadow-sm ring-2 ring-white">
                {user.avatar ? <img src={user.avatar} alt={user.full_name} className="h-full w-full object-cover" /> : <FiUser size={18} className="text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900 dark:text-white">{user.full_name}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
              {isVipActive(user) && <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-500">PRO</span>}
            </div>
          )}

          <nav className="space-y-1">
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl p-4 font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
              {t('nav.home')}
            </Link>
            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setMobileCourseOpen((open) => !open)} className="flex w-full items-center justify-between bg-gray-50/50 p-4 font-bold text-gray-800 hover:bg-gray-50 dark:bg-gray-800/50 dark:text-gray-200 dark:hover:bg-gray-800">
                <div className="flex items-center gap-3"><FiBookOpen /> {t('nav.courses')}</div>
                <FiChevronDown className={`transition-transform duration-300 ${mobileCourseOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className={`bg-white transition-all duration-300 dark:bg-gray-900 ${mobileCourseOpen ? 'visible max-h-[400px] py-2 opacity-100' : 'invisible max-h-0 opacity-0'}`}>
                {COURSE_ITEMS.map((course) => (
                  <Link key={course.id} href={course.href} onClick={() => setMobileOpen(false)} className="block px-10 py-3 text-sm font-semibold text-gray-600 hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-900/20 dark:hover:text-violet-400">
                    {t(course.labelKey)}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/khoa-hoc" onClick={() => setMobileOpen(false)} className="flex w-full items-center justify-between rounded-2xl p-4 font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
              <span className="flex items-center gap-3"><FaGraduationCap /> {t('nav.videoCourses')}</span>
            </Link>

            {[...MAIN_NAV_TOP.slice(1), ...MAIN_NAV_BOTTOM].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.id} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl p-4 font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  {Icon && <Icon className="text-gray-400 dark:text-gray-500" />}
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <Link href="/bang-xep-hang" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl p-4 font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
              <FiAward className="text-gray-400 dark:text-gray-500" />
              {t('nav.ranking')}
            </Link>
          </nav>

          {mounted && isAuthenticated && user && (
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 dark:border-gray-800">
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl p-4 font-bold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                <FiUser className="text-gray-400" />
                {t('nav.profile')}
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-2xl p-4 font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                  <FiShield className="text-emerald-500" />
                  {t('nav.admin')}
                </Link>
              )}
              <div className="flex items-center justify-between rounded-2xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="font-bold text-gray-800 dark:text-gray-200">{t('nav.darkMode')}</span>
                <ThemeToggle />
              </div>
              <button type="button" onClick={() => { logout(); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-2xl p-4 font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <FiLogOut className="text-red-500" />
                {t('nav.logout')}
              </button>
            </div>
          )}

          {(!mounted || !isAuthenticated) && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-2xl border-2 border-gray-100 py-3 text-center font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                {t('nav.login')}
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="rounded-2xl bg-gray-900 py-3 text-center font-bold text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600">
                {t('nav.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .national-day-header .national-day-search > div > div:first-child {
          border-color: rgba(255, 216, 111, 0.58) !important;
          background: rgba(102, 5, 19, 0.58) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(74,0,8,0.14);
        }
        .national-day-header .national-day-search > div > div:first-child:hover,
        .national-day-header .national-day-search > div > div:first-child:focus-within {
          border-color: rgba(255, 230, 146, 0.9) !important;
          background: rgba(119, 7, 22, 0.76) !important;
        }
        .national-day-header .national-day-search input {
          color: #fff5d0 !important;
        }
        .national-day-header .national-day-search input::placeholder {
          color: rgba(255, 235, 179, 0.68) !important;
        }
        .national-day-header .national-day-search > div > div:first-child svg {
          color: #ffe49a !important;
        }
        .national-day-header .national-day-search > div > div:first-child > span:last-child {
          border-color: rgba(255, 224, 137, 0.45) !important;
          background: rgba(73, 3, 12, 0.5) !important;
          color: #ffe8ad !important;
          box-shadow: none !important;
        }
        .national-day-header .national-day-language > button,
        .national-day-header .national-day-theme-toggle > button,
        .national-day-header .national-day-message > a,
        .national-day-header .national-day-notifications > div > button,
        .national-day-header .national-day-quests > div > button {
          border: 1px solid rgba(255, 216, 111, 0.45) !important;
          background: rgba(102, 5, 19, 0.52) !important;
          color: #fff0bd !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .national-day-header .national-day-language > button:hover,
        .national-day-header .national-day-theme-toggle > button:hover,
        .national-day-header .national-day-message > a:hover,
        .national-day-header .national-day-notifications > div > button:hover,
        .national-day-header .national-day-quests > div > button:hover {
          background: rgba(123, 8, 23, 0.78) !important;
          color: #fff5d2 !important;
        }
        .national-day-header .national-day-language > button svg,
        .national-day-header .national-day-theme-toggle > button svg,
        .national-day-header .national-day-message > a svg,
        .national-day-header .national-day-notifications > div > button svg,
        .national-day-header .national-day-quests > div > button svg {
          color: #ffe49a !important;
        }
      `}</style>
    </header>
    <DailyQuestBanner />
    </>
  );
}
