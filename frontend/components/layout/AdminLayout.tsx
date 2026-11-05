'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission, canAccessAdminPanel } from '@/lib/utils/permissions';
import {
  FiActivity, FiUsers, FiFileText, FiBook, FiMessageSquare, FiFlag,
  FiImage, FiTag, FiMap, FiSettings, FiMonitor, FiShield, FiAlertTriangle,
  FiX, FiChevronLeft, FiChevronRight, FiLogOut, FiGift,
  FiBarChart2, FiAward, FiVideo, FiMail, FiDatabase, FiTarget, FiEye
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import ThemeToggle from './ThemeToggle';
import AdminDailyLetter from '@/components/admin/AdminDailyLetter';
import AdminNotificationBell from '@/components/admin/AdminNotificationBell';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

type AdminNavChild = {
  label: string;
  href: string;
};

type AdminNavItem = {
  label: string;
  icon: IconType;
  href: string;
  permission: string;
  anyPermissions?: string[];
  roles: string[];
  children?: AdminNavChild[];
};

type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

const REPORT_CENTER_ITEM: AdminNavItem = {
  label: 'Quản lý báo cáo',
  icon: FiFlag,
  href: '/admin/report-center?source=all',
  permission: 'reports.view',
  roles: [],
  children: [
    { label: 'Tất cả báo cáo', href: '/admin/report-center?source=all' },
    { label: 'Người dùng & tin nhắn', href: '/admin/report-center?source=forum' },
    { label: 'Báo lỗi đề', href: '/admin/report-center?source=question' },
    { label: 'Góp ý & hỗ trợ', href: '/admin/report-center?source=feedback' },
    { label: 'Hỏi-Đáp VIP', href: '/admin/report-center?source=qa' },
    { label: 'Liên hệ', href: '/admin/report-center?source=contact' },
  ],
};

const NAV_SECTIONS: AdminNavSection[] = [
  {
    label: 'Ưu tiên',
    items: [REPORT_CENTER_ITEM],
  },
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
        label: 'Gói video & combo',
        icon: FiVideo,
        href: '/admin/video-commerce',
        permission: 'users.manage',
        roles: [],
      },
      {
        label: 'Hiệu suất Admin',
        icon: FiBarChart2,
        href: '/admin/analytics',
        permission: 'exams.manage',
        roles: [],
      },
      {
        label: 'Thống kê hệ thống',
        icon: FiMonitor,
        href: '/admin/analytics/system',
        permission: 'admin.super',
        roles: [],
      },
      {
        label: 'Mã giảm giá',
        icon: FiGift,
        href: '/admin/coupons',
        permission: 'users.manage',
        roles: [],
      },
      {
        label: 'Game, Rank & Xu',
        icon: FiAward,
        href: '/admin/gamification',
        permission: 'game.manage',
        roles: [],
      },
      {
        label: 'Đề thi',
        icon: FiFileText,
        href: '/admin/exams',
        permission: 'exams.manage',
        roles: [],
      },
      {
        label: 'Phòng thi',
        icon: FiMonitor,
        href: '/admin/exam-room',
        permission: 'exams.manage',
        roles: [],
      },
      {
        label: 'Luyện chủ đề',
        icon: FiTarget,
        href: '/admin/topic-practice',
        permission: 'exams.manage',
        roles: [],
      },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      {
        label: 'Khóa học',
        icon: FiVideo,
        href: '/admin/courses',
        permission: '*',
        roles: [],
      },
      {
        label: 'Giao & chấm bài',
        icon: FiFileText,
        href: '/admin/teaching',
        permission: 'courses.manage_assigned',
        roles: [],
      },
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
        label: 'SEO Blog AI',
        icon: FiFileText,
        href: '/admin/seo-blog',
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
        label: 'Báo cáo Forum',
        icon: FiFlag,
        href: '/admin/reports',
        permission: 'forum.manage',
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
        label: 'Kiểm soát Admin',
        icon: FiShield,
        href: '/admin/admins',
        permission: 'admin.super',
        roles: [],
      },
      {
        label: 'Gửi thông báo',
        icon: FiMail,
        href: '/admin/email-campaign',
        permission: 'admin.super',
        roles: [],
      },
      {
        label: 'Cấu hình',
        icon: FiSettings,
        href: '/admin/settings',
        permission: 'system.manage',
        roles: [],
      },
      {
        label: 'Màn chào mừng & 404',
        icon: FiEye,
        href: '/admin/welcome-screen',
        permission: 'system.manage',
        roles: [],
      },
      {
        label: 'Risk Center',
        icon: FiAlertTriangle,
        href: '/admin/risk-center',
        permission: 'risk_center.view',
        anyPermissions: ['risk_center.view', 'exams.manage'],
        roles: [],
      },
      {
        label: 'Sao lưu dữ liệu',
        icon: FiDatabase,
        href: '/admin/backups',
        permission: 'admin.super',
        roles: [],
      },
    ],
  },
];

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reportMenuOpen, setReportMenuOpen] = useState(pathname.startsWith('/admin/report-center'));

  useEffect(() => {
    setMounted(true);
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!_token && (!isAuthenticated || !canAccessAdminPanel(user))) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (pathname.startsWith('/admin/report-center')) setReportMenuOpen(true);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isActive = (href: string) => {
    const [hrefPath, rawQuery] = href.split('?');
    if (rawQuery) {
      const expectedSource = new URLSearchParams(rawQuery).get('source');
      const currentSource = searchParams.get('source') || 'all';
      return pathname === hrefPath && expectedSource === currentSource;
    }
    if (href === '/admin') return pathname === '/admin';
    if (href === '/admin/analytics') return pathname === href;
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
  const canViewRiskNotifications = hasPermission(user, 'risk_center.view') || hasPermission(user, 'exams.manage');

  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        hasPermission(user, item.permission) ||
        ('anyPermissions' in item && item.anyPermissions?.some(permission => hasPermission(user, permission))),
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex">
      <AdminDailyLetter />

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 flex h-dvh w-64 flex-col border-r border-slate-800 bg-slate-900
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:sticky lg:top-0 lg:bottom-auto lg:h-dvh lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-5">
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
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-color:rgb(71_85_105)_transparent] [scrollbar-width:thin]">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = item.children
                    ? pathname.startsWith('/admin/report-center')
                    : isActive(item.href);
                  if (item.children) {
                    return (
                      <div key={item.href}>
                        <button
                          type="button"
                          onClick={() => setReportMenuOpen(open => !open)}
                          aria-expanded={reportMenuOpen}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                            active
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon size={16} className={active ? 'opacity-90' : ''} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <FiChevronRight size={14} className={`transition-transform ${reportMenuOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {reportMenuOpen && (
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                            {item.children.map(child => {
                              const childActive = isActive(child.href);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`block rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                    childActive
                                      ? 'bg-violet-500/20 text-violet-200'
                                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
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
        <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-3">
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
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 sm:px-6 sm:py-4 sm:gap-4">
          <button onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden">
            <FiActivity size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>

          <Link href="/"
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            ← Về trang chủ
          </Link>

          {canViewRiskNotifications && <AdminNotificationBell />}

          <ThemeToggle />

          <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {userInitial}
          </div>
        </header>

        {/* Page content */}
        <main className="admin-dark-surface min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
