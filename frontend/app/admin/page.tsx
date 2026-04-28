'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiUsers, FiFileText, FiTrendingUp, FiMessageSquare, FiActivity, FiMonitor, FiAward, FiCalendar } from 'react-icons/fi';
import Link from 'next/link';

interface DashboardStats {
    totalUsers: number;
    totalExams: number;
    totalAttempts: number;
    totalPosts: number;
    revenue: number;
    dateRange: { from: string | null; to: string | null };
    recentActivities: {
        id: number;
        created_at: string;
        user_name: string;
        exam_title: string;
        total_score: number;
        status: string;
    }[];
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | '3months' | 'custom';

export default function AdminDashboard() {
    const { user, isAuthenticated } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0, totalExams: 0, totalAttempts: 0, totalPosts: 0,
        revenue: 0, dateRange: { from: null, to: null }, recentActivities: []
    });
    const [loading, setLoading] = useState(true);
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    useEffect(() => {
        loadStats({});
    }, []);

    const getDateRange = (preset: DatePreset): { from?: string; to?: string } => {
        const now = new Date();
        if (preset === 'today') {
            return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0] };
        }
        if (preset === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            return { from: d.toISOString().split('T')[0] };
        }
        if (preset === 'month') {
            const d = new Date(now); d.setMonth(d.getMonth() - 1);
            return { from: d.toISOString().split('T')[0] };
        }
        if (preset === '3months') {
            const d = new Date(now); d.setMonth(d.getMonth() - 3);
            return { from: d.toISOString().split('T')[0] };
        }
        if (preset === 'custom') {
            return { from: customFrom || undefined, to: customTo || undefined };
        }
        return {};
    };

    const loadStats = async (overrideRange?: { from?: string; to?: string }) => {
        try {
            setLoading(true);
            const range = Object.keys(overrideRange || {}).length > 0
                ? overrideRange!
                : getDateRange(datePreset);
            const params = new URLSearchParams();
            if (range.from) params.set('from', range.from);
            if (range.to) params.set('to', range.to);
            const query = params.toString() ? `?${params.toString()}` : '';
            const data = await adminApi.getDashboardStats(query);
            setStats(data);
        } catch {
            setStats({ totalUsers: 0, totalExams: 0, totalAttempts: 0, totalPosts: 0,
                revenue: 0, dateRange: { from: null, to: null }, recentActivities: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleDatePreset = (preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            loadStats(getDateRange(preset));
        }
    };

    const canManageUsers = hasPermission(user, 'users.manage');
    const canManageExams = hasPermission(user, 'exams.manage');
    const canManageContent = hasPermission(user, 'content.manage');
    const canManageForum = hasPermission(user, 'forum.manage');

    const statCards = [
        { title: 'Tổng Users', value: stats.totalUsers, icon: FiUsers, tone: 'blue' },
        { title: 'Tổng Đề Thi', value: stats.totalExams, icon: FiFileText, tone: 'emerald' },
        { title: 'Lượt Thi', value: stats.totalAttempts, icon: FiTrendingUp, tone: 'violet' },
        { title: 'Doanh Thu', value: stats.revenue, icon: FiAward, tone: 'orange', prefix: '' },
    ];

    const quickLinks = [
        canManageUsers && { label: 'Quản lý Users', href: '/admin/users', desc: 'Phân quyền, khóa/mở tài khoản', color: 'blue' },
        canManageExams && { label: 'Tạo đề thi', href: '/admin/exams/create', desc: 'Tạo đề mới với shuffle + video', color: 'emerald' },
        canManageExams && { label: 'Kho đề thi', href: '/admin/exams', desc: 'Xem, sửa, xóa đề thi', color: 'purple' },
        canManageExams && { label: 'Phòng thi', href: '/exam-room', desc: 'Xem phòng thi đang hoạt động', color: 'pink' },
        canManageContent && { label: 'Tài liệu', href: '/admin/materials', desc: 'Upload và quản lý tài liệu', color: 'cyan' },
        canManageContent && { label: 'Từ vựng', href: '/admin/vocabulary', desc: 'Quản lý từ vựng HSK', color: 'cyan' },
        canManageForum && { label: 'Forum', href: '/admin/posts', desc: 'Kiểm duyệt bài viết', color: 'orange' },
        { label: 'Bảng xếp hạng', href: '/bang-xep-hang', desc: 'Xem top học viên', color: 'violet' },
    ].filter(Boolean) as { label: string; href: string; desc: string; color: string }[];

    const colorMap: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-fuchsia-500', orange: 'from-orange-500 to-orange-600',
        pink: 'from-pink-500 to-rose-500', cyan: 'from-cyan-500 to-teal-500',
        purple: 'from-purple-500 to-indigo-600',
    };

    return (
        <AdminLayout title="Tổng quan" description="Bảng điều khiển hệ thống CSCA">
            {/* Date filter */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                <FiCalendar size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500 mr-1">Lọc:</span>
                {([
                    { key: 'all', label: 'Tất cả' },
                    { key: 'today', label: 'Hôm nay' },
                    { key: 'week', label: '7 ngày' },
                    { key: 'month', label: '30 ngày' },
                    { key: '3months', label: '3 tháng' },
                    { key: 'custom', label: 'Tùy chỉnh' },
                ] as { key: DatePreset; label: string }[]).map(p => (
                    <button
                        key={p.key}
                        onClick={() => handleDatePreset(p.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            datePreset === p.key
                                ? 'bg-violet-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                {datePreset === 'custom' && (
                    <div className="flex items-center gap-2 ml-2">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-500" />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-500" />
                        <button onClick={() => loadStats(getDateRange('custom'))}
                            className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                            Áp dụng
                        </button>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {statCards.map(card => {
                    const Icon = card.icon;
                    const isRevenue = card.title === 'Doanh Thu';
                    return (
                        <div key={card.title} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
                            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colorMap[card.tone]} text-white mb-3`}>
                                <Icon size={18} />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{card.title}</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {loading ? '...' : isRevenue
                                    ? `${card.value.toLocaleString('vi-VN')}đ`
                                    : card.value.toLocaleString()}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick links */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Thao tác nhanh</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quickLinks.map(link => (
                            <Link key={link.href} href={link.href}
                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[link.color]} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                                    <FiActivity size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400">{link.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{link.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Hoạt động gần đây</h3>
                    {loading ? (
                        <div className="space-y-3">{[...Array(4)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                        ))}</div>
                    ) : stats.recentActivities.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <FiActivity size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Chưa có hoạt động nào</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.recentActivities.slice(0, 8).map(a => (
                                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                                            {a.user_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{a.user_name}</p>
                                            <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{a.exam_title}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{a.total_score ?? 0}đ</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(a.created_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
