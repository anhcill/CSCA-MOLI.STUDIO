'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiUser, FiChevronDown, FiLogIn, FiUserPlus, FiLogOut, FiSearch, FiMenu, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { id: 'toan',          name: 'Toán',           href: '/mon/toan' },
  { id: 'vatly',         name: 'Vật Lý',         href: '/mon/vatly' },
  { id: 'hoahoc',        name: 'Hóa Học',        href: '/mon/hoa' },
  { id: 'tiengtrung-xh', name: 'Tiếng Trung XH', href: '/tiengtrung-xahoi' },
  { id: 'tiengtrung-tn', name: 'Tiếng Trung TN', href: '/tiengtrung-tunhien' },
  { id: 'forum',         name: 'Diễn Đàn',       href: '/forum' },
  { id: 'tailieu',       name: 'Tài Liệu',       href: '/tailieu' },
];

export default function Header() {
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
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
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className={`sticky top-0 z-50 bg-white transition-all duration-200 ${scrolled ? 'shadow-md' : 'shadow-sm border-b border-gray-100'}`}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-[68px] gap-4">

          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-sm group-hover:shadow-violet-300 group-hover:shadow-md transition-all duration-200">
              <span className="text-white font-black text-[13px] leading-none">C</span>
            </div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent">
              CSCA
            </span>
          </Link>

          <nav className="hidden md:flex items-center justify-center gap-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`px-3.5 py-2 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive(item.href)
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                    : 'text-gray-600 hover:text-violet-700 hover:bg-violet-50'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden lg:block">
              <SearchBar />
            </div>

            <NotificationBell />

            <button className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Tim kiem">
              <FiSearch size={19} />
            </button>

            {mounted && isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center ring-2 ring-white shadow-sm">
                    {user.avatar
                      ? <img src={user.avatar} alt={user.full_name} className="w-full h-full object-cover" />
                      : <FiUser size={15} className="text-white" />
                    }
                  </div>
                  <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[110px] truncate">
                    {user.full_name}
                  </span>
                  <FiChevronDown size={14} className={`hidden sm:block text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100 mb-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <Link href="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                      <FiUser size={14} /> Hồ sơ cá nhân
                    </Link>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={() => { logout(); setShowUserMenu(false); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <FiLogOut size={14} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-violet-200 text-violet-700 text-sm font-semibold hover:bg-violet-50 hover:border-violet-400 transition-all duration-150">
                  <FiLogIn size={14} />
                  Đăng nhập
                </Link>
                <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white text-sm font-semibold shadow-sm hover:shadow-violet-300 hover:shadow-md transition-all duration-150">
                  <FiUserPlus size={14} />
                  Đăng ký
                </Link>
              </div>
            )}

            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Menu">
              {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
          <nav className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.id} href={item.href} className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="px-4 pb-3">
            <SearchBar />
          </div>
          {(!mounted || !isAuthenticated) && (
            <div className="px-4 pb-4 flex gap-2">
              <Link href="/login" className="flex-1 text-center py-2.5 rounded-xl border border-violet-200 text-violet-700 text-sm font-semibold hover:bg-violet-50 transition-colors">
                Đăng nhập
              </Link>
              <Link href="/register" className="flex-1 text-center py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white text-sm font-semibold hover:from-violet-700 hover:to-indigo-600 transition-all">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
