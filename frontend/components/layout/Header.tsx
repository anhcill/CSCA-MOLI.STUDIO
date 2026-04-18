'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  FiUser, FiChevronDown, FiLogIn, FiUserPlus, FiLogOut, 
  FiSearch, FiMenu, FiX, FiBookOpen, FiMap, FiMonitor, 
  FiMessageSquare, FiFileText, FiGift, FiAward, FiShield
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';

const COURSES = [
  { id: 'toan',          name: 'Toán',           href: '/mon/toan' },
  { id: 'vatly',         name: 'Vật Lý',         href: '/mon/vatly' },
  { id: 'hoahoc',        name: 'Hóa Học',        href: '/mon/hoa' },
  { id: 'tiengtrung-xh', name: 'Tiếng Trung XH', href: '/tiengtrung-xahoi' },
  { id: 'tiengtrung-tn', name: 'Tiếng Trung TN', href: '/tiengtrung-tunhien' },
];

const MAIN_NAV = [
  { id: 'home', name: 'Trang chủ', href: '/' },
  // Khóa học is handled specially
  { id: 'roadmap', name: 'Lộ trình', href: '/lo-trinh', icon: FiMap },
  { id: 'exam', name: 'Phòng thi', href: '/exam-room', icon: FiMonitor },
  { id: 'docs', name: 'Tài liệu', href: '/tailieu', icon: FiFileText },
  { id: 'forum', name: 'Diễn đàn', href: '/forum', icon: FiMessageSquare },
];

export default function Header() {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCourseMenu, setShowCourseMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCourseOpen, setMobileCourseOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false);
      if (courseMenuRef.current && !courseMenuRef.current.contains(e.target as Node))
        setShowCourseMenu(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur-md transition-all duration-300 ${scrolled ? 'shadow-lg border-b border-gray-100/50 py-1' : 'shadow-sm border-b border-gray-100 py-3'}`}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between gap-4">

          {/* ── LOGO ── */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-[0_10px_22px_rgba(14,116,244,0.35)] group-hover:shadow-[0_14px_26px_rgba(14,116,244,0.45)] group-hover:-translate-y-0.5 group-hover:rotate-2 transition-all duration-300">
              <span className="text-white font-black text-lg leading-none lowercase">m</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-100 border border-white/90 shadow-sm"></span>
            </div>
            <span className="text-2xl font-black tracking-tight lowercase bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-500 bg-clip-text text-transparent">
              moly.study
            </span>
          </Link>

          {/* ── DESKTOP NAVIGATION ── */}
          <nav className="hidden xl:flex items-center justify-center gap-1 flex-1">
            {/* Trang chủ */}
             <Link
                href={MAIN_NAV[0].href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive(MAIN_NAV[0].href)
                    ? 'text-violet-700 bg-violet-50'
                    : 'text-gray-600 hover:text-violet-700 hover:bg-gray-50'
                }`}
              >
                {MAIN_NAV[0].name}
              </Link>

            {/* Khóa Học Dropdown */}
            <div className="relative" ref={courseMenuRef}
                 onMouseEnter={() => setShowCourseMenu(true)}
                 onMouseLeave={() => setShowCourseMenu(false)}>
              <button 
                onClick={() => setShowCourseMenu(!showCourseMenu)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  pathname.includes('/mon/') || pathname.includes('tiengtrung')
                  ? 'text-violet-700 bg-violet-50'
                  : 'text-gray-600 hover:text-violet-700 hover:bg-gray-50'
                }`}
              >
                <FiBookOpen className="text-lg" /> Khóa học
                <FiChevronDown className={`transition-transform duration-200 ${showCourseMenu ? 'rotate-180 text-violet-600' : ''}`} />
              </button>
              
              {/* Mega Menu popup */}
              <div className={`absolute top-full left-0 pt-3 transition-all duration-200 origin-top-left ${showCourseMenu ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                <div className="w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 overflow-hidden">
                  <div className="text-xs font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-wider">Chọn môn học</div>
                  {COURSES.map(course => (
                    <Link key={course.id} href={course.href} className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 hover:bg-violet-50 rounded-xl transition-colors">
                      {course.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Other static links */}
            {MAIN_NAV.slice(1).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive(item.href)
                      ? 'text-violet-700 bg-violet-50'
                      : 'text-gray-600 hover:text-violet-700 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon className="text-lg" />} {item.name}
                </Link>
              );
            })}
          </nav>

          {/* ── RIGHT ACTIONS ── */}
          <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-3 flex-shrink min-w-0">
            {/* Search Bar - Hidden on very small screens, visible on md upwards */}
            <div className="hidden md:block w-48 lg:w-60 flex-shrink-0">
              <SearchBar />
            </div>

            <button className="md:hidden p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Tim kiem">
              <FiSearch size={18} sm:size={20} />
            </button>

            {mounted && (!user || !user.is_vip) && (
              <Link href="/vip" className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-sm font-bold shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out skew-x-12"></div>
                <FaCrown className="drop-shadow-sm text-yellow-200 animate-pulse" size={16} /> <span className="tracking-wide">Nâng cấp PRO</span>
              </Link>
            )}

            {/* Quests Mock UI */}
            {mounted && isAuthenticated && (
               <button className="hidden sm:flex relative p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200" title="Nhiệm vụ hàng ngày">
                  <FiGift size={20} />
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
               </button>
            )}

            <NotificationBell />

            {mounted && isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center ring-2 ring-white shadow-sm">
                    {user.avatar
                      ? <img src={user.avatar} alt={user.full_name} className="w-full h-full object-cover" />
                      : <FiUser size={16} className="text-white" />
                    }
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                     <span className="text-sm font-bold text-gray-800 max-w-[100px] truncate">
                       {user.full_name}
                     </span>
                     {user.is_vip && (
                       <span className="text-[10px] font-bold text-orange-500 tracking-wider">PRO MEMBER</span>
                     )}
                  </div>
                  <FiChevronDown size={16} className={`hidden sm:block text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-3 w-60 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="px-5 py-3 border-b border-gray-100 mb-2 flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <FiUser className="text-gray-400"/>}
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-bold text-gray-900 truncate">{user.full_name}</p>
                         <p className="text-xs text-gray-500 truncate">{user.email}</p>
                       </div>
                    </div>
                    <Link href="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600"><FiUser size={16} /></div> Hồ sơ cá nhân
                    </Link>
                    {user.role === 'admin' && (
                       <Link href="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
                         <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><FiShield size={16} /></div> Trang Quản trị
                       </Link>
                    )}
                    {!user.is_vip && (
                       <Link href="/vip" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors">
                         <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><FaCrown size={16} /></div> Nâng cấp VIP
                       </Link>
                    )}
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button onClick={() => { logout(); setShowUserMenu(false); }} className="flex items-center gap-3 w-full px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600"><FiLogOut size={16} /></div> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-3 ml-2">
                <Link href="/login" className="px-5 py-2.5 rounded-xl text-gray-700 font-bold hover:bg-gray-100 transition-colors">
                  Đăng nhập
                </Link>
                <Link href="/register" className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                  Đăng ký
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Layout */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="xl:hidden p-2 text-gray-800 hover:bg-gray-100 rounded-xl transition-colors shrink-0" aria-label="Menu">
              {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE MENU ── */}
      <div className={`xl:hidden absolute top-full left-0 w-full bg-white border-t border-gray-100 shadow-2xl transition-all duration-300 origin-top overflow-hidden ${mobileOpen ? 'max-h-[80vh] opacity-100 visible overflow-y-auto' : 'max-h-0 opacity-0 invisible'}`}>
        <div className="p-4 space-y-2">
           <div className="mb-4 md:hidden">
              <SearchBar />
           </div>

           {/* Mobile VIP Banner */}
           {mounted && (!user || !user.is_vip) && (
              <Link href="/vip" onClick={() => setMobileOpen(false)} className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md mb-4 bg-opacity-90">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><FaCrown size={20} className="text-yellow-200" /></div>
                   <div>
                     <p className="font-bold text-sm tracking-wide">Nâng cấp tài khoản PRO</p>
                     <p className="text-xs text-white/80">Mở khoá toàn bộ siêu tính năng</p>
                   </div>
                </div>
                <div className="bg-white text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">Xem ngay</div>
              </Link>
           )}

           <nav className="space-y-1">
             <Link href={MAIN_NAV[0].href} className="flex items-center gap-3 p-4 rounded-2xl text-gray-800 font-bold hover:bg-gray-50">
               Trang chủ
             </Link>
             
             {/* Mobile Course Menu */}
             <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <button onClick={() => setMobileCourseOpen(!mobileCourseOpen)} className="flex items-center justify-between w-full p-4 text-gray-800 font-bold hover:bg-gray-50 bg-gray-50/50">
                   <div className="flex items-center gap-3"><FiBookOpen/> Môn học / Khóa học</div>
                   <FiChevronDown className={`transition-transform duration-300 ${mobileCourseOpen ? 'rotate-180': ''}`} />
                </button>
                <div className={`transition-all duration-300 bg-white ${mobileCourseOpen ? 'max-h-[400px] opacity-100 visible py-2' : 'max-h-0 opacity-0 invisible'}`}>
                   {COURSES.map(course => (
                     <Link key={course.id} href={course.href} className="block px-10 py-3 text-sm font-semibold text-gray-600 hover:text-violet-700 hover:bg-violet-50">
                       • {course.name}
                     </Link>
                   ))}
                </div>
             </div>

             {/* Other Navs */}
             {MAIN_NAV.slice(1).map(item => {
               const Icon = item.icon;
               return (
                 <Link key={item.id} href={item.href} className="flex items-center gap-3 p-4 rounded-2xl text-gray-800 font-bold hover:bg-gray-50">
                   {Icon && <Icon className="text-gray-400" />} {item.name}
                 </Link>
               )
             })}
           </nav>

           {(!mounted || !isAuthenticated) && (
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 mt-4">
              <Link href="/login" className="text-center py-3 rounded-2xl border-2 border-gray-100 text-gray-700 font-bold">
                Đăng nhập
              </Link>
              <Link href="/register" className="text-center py-3 rounded-2xl bg-gray-900 text-white font-bold">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
