'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission, canAccessAdminPanel } from '@/lib/utils/permissions';
import {
  FiActivity, FiUsers, FiFileText, FiBook, FiMessageSquare,
  FiImage, FiTag, FiMap, FiSettings, FiMonitor, FiShield,
  FiX, FiChevronLeft, FiChevronRight, FiLogOut, FiHelpCircle
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import ThemeToggle from './ThemeToggle';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

const NAV_SECTIONS = [
  {
    label: 'Quản lý',
    items: [
      {
        label: 'Tổng quan',
        icon: FiActivity,
        href: '/admin',
        permission: 'admin.dashboard.view',
        roles: [],
      },
      {
        label: 'Users',
        icon: FiUsers,
        href: '/admin/users',
        permission: 'users.manage',
        roles: [],
      },
      {
        label: 'VIP & Doanh thu',
        icon: FaCrown,
        href: '/admin/vip',
        permission: 'users.manage',
        roles: [],
      },
      {
        label: 'Đề thi',
        icon: FiFileText,
        href: '/admin/exams',
        permission: 'exams.manage',
        roles: [],
      },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      {
        label: 'Tài liệu',
        icon: FiBook,
        href: '/admin/materials',
        permission: 'content.manage',
        roles: [],
      },
      {
        label: 'Từ vựng',
        icon: FiTag,
        href: '/admin/vocabulary',
        permission: 'content.manage',
        roles: [],
      },
      {
        label: 'Hình ảnh',
        icon: FiImage,
        href: '/admin/images',
        permission: 'content.manage',
        roles: [],
      },
    ],
  },
  {
    label: 'Cộng đồng',
    items: [
      {
        label: 'Forum',
        icon: FiMessageSquare,
        href: '/admin/posts',
        permission: 'forum.manage',
        roles: [],
      },
      {
        label: 'Hỏi-Đáp VIP',
        icon: FiHelpCircle,
        href: '/admin/qa',
        permission: 'admin.dashboard.view',
        roles: [],
      },
      {
        label: 'Lộ trình',
        icon: FiMap,
        href: '/admin/roadmap',
        permission: 'roadmap.manage',
        roles: [],
      },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      {
        label: 'Cấu hình',
        icon: FiSettings,
        href: '/admin/settings',
        permission: 'system.manage',
        roles: [],
      },
    ],
  },
];

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!_token && (!isAuthenticated || !canAccessAdminPanel(user))) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  const userInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'A';

  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => hasPermission(user, item.permission)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 flex flex-col
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-500/30">
              CSCA
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Admin</p>
              <p className="text-xs text-slate-500">Control Panel</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
            <FiX size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon size={16} className={active ? 'opacity-90' : ''} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <FiLogOut size={15} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <FiActivity size={18} />
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>

          <Link href="/"
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            ← Về trang chủ
          </Link>

          <ThemeToggle />

          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {userInitial}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
