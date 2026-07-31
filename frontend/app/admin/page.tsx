'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { AIUsageStats, OnlineUsersResponse, adminApi } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiUsers, FiFileText, FiTrendingUp, FiActivity, FiAward, FiCalendar, FiWifi, FiCpu, FiDollarSign } from 'react-icons/fi';
import Link from 'next/link';
import { initSocket } from '@/lib/socket';

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
type DashboardTab = 'overview' | 'ai';

const emptyAIUsage: AIUsageStats = {
    overview: {
        total_requests: 0,
        total_prompt_tokens: 0,
        total_cache_hit_tokens: 0,
        total_cache_miss_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0,
        unique_users: 0,
    },
    perUser: [],
    perModel: [],
    perFeature: [],
    daily: [],
    pricing: {},
};

function num(value: number | string | null | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatTokens(value: number | string | null | undefined) {
    const tokens = num(value);
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return Math.round(tokens).toLocaleString('vi-VN');
}

function formatUsd(value: number | string | null | undefined) {
    return `$${num(value).toFixed(4)}`;
}

function formatModelPricing(pricing?: { input?: number; inputCached?: number; output?: number }) {
    if (!pricing) return 'Chưa có giá';
    return `In $${num(pricing.input).toFixed(3)}/1M · cache $${num(pricing.inputCached).toFixed(3)}/1M · out $${num(pricing.output).toFixed(3)}/1M`;
}

export default function AdminDashboard() {
    const { user, isAuthenticated } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0, totalExams: 0, totalAttempts: 0, totalPosts: 0,
        revenue: 0, dateRange: { from: null, to: null }, recentActivities: []
    });
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUsersResponse>({
        online: 0,
        active: 0,
        connections: 0,
        users: [],
    });
    const [onlineLoading, setOnlineLoading] = useState(true);
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [aiUsage, setAiUsage] = useState<AIUsageStats>(emptyAIUsage);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        loadStats({});
    }, []);

    useEffect(() => {
        let disposed = false;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;

        const loadOnline = async () => {
            try {
                const data = await adminApi.getOnlineUsers();
                if (!disposed) setOnlineUsers(data);
            } catch {
                if (!disposed) {
                    setOnlineUsers({ online: 0, active: 0, connections: 0, users: [] });
                }
            } finally {
                if (!disposed) setOnlineLoading(false);
            }
        };

        const scheduleRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(loadOnline, 250);
        };
        const joinPresenceRoom = () => socket?.emit('join_admin_presence');

        loadOnline();
        const interval = setInterval(loadOnline, 15_000);
        const socket = initSocket();
        joinPresenceRoom();
        socket?.on('connect', joinPresenceRoom);
        socket?.on('presence:changed', scheduleRefresh);

        return () => {
            disposed = true;
            clearInterval(interval);
            if (refreshTimer) clearTimeout(refreshTimer);
            socket?.emit('leave_admin_presence');
            socket?.off('connect', joinPresenceRoom);
            socket?.off('presence:changed', scheduleRefresh);
        };
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

    const loadAIUsage = async (overrideRange?: { from?: string; to?: string }) => {
        try {
            setAiLoading(true);
            const range = Object.keys(overrideRange || {}).length > 0
                ? overrideRange!
                : getDateRange(datePreset);
            const response = await adminApi.getAIUsageStats({ ...range, limit: 100 });
            setAiUsage(response.data || emptyAIUsage);
        } catch {
            setAiUsage(emptyAIUsage);
        } finally {
            setAiLoading(false);
        }
    };

    const handleDatePreset = (preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            loadStats(getDateRange(preset));
            if (activeTab === 'ai') loadAIUsage(getDateRange(preset));
        }
    };

    const canManageUsers = hasPermission(user, 'users.manage');
    const canManageExams = hasPermission(user, 'exams.manage');
    const canManageContent = hasPermission(user, 'content.manage');
    const canManageForum = hasPermission(user, 'forum.manage');
    const isSuperAdmin = hasPermission(user, 'admin.super');

    useEffect(() => {
        if (activeTab === 'ai' && isSuperAdmin) {
            loadAIUsage();
        }
    }, [activeTab, isSuperAdmin]);

    const statCards = [
        { title: 'Tổng Users', value: stats.totalUsers, icon: FiUsers, tone: 'blue' },
        { title: 'Tổng Đề Thi', value: stats.totalExams, icon: FiFileText, tone: 'emerald' },
        { title: 'Lượt Thi', value: stats.totalAttempts, icon: FiTrendingUp, tone: 'violet' },
        { title: 'Doanh Thu', value: stats.revenue, icon: FiAward, tone: 'orange', prefix: '' },
        { title: 'Đang Online', value: onlineUsers.online, icon: FiWifi, tone: 'green', pulse: true },
    ];

    const quickLinks = [
        isSuperAdmin && { label: 'Kiểm soát Admin', href: '/admin/admins', desc: 'Giám sát, cấp quyền admin hệ thống', color: 'pink' },
        canManageUsers && { label: 'Quản lý Users', href: '/admin/users', desc: 'Phân quyền, khóa/mở tài khoản', color: 'blue' },
        canManageExams && { label: 'Tạo đề thi', href: '/admin/exams/create', desc: 'Tạo đề mới với shuffle + video', color: 'emerald' },
        canManageExams && { label: 'Kho đề thi', href: '/admin/exams', desc: 'Xem, sửa, xóa đề thi', color: 'purple' },
        canManageExams && { label: 'Phòng thi', href: '/exam-room', desc: 'Xem phòng thi đang hoạt động', color: 'pink' },
        canManageContent && { label: 'Tài liệu', href: '/admin/materials', desc: 'Upload và quản lý tài liệu', color: 'cyan' },
        canManageContent && { label: 'Từ vựng', href: '/admin/vocabulary', desc: 'Quản lý từ vựng HSK', color: 'cyan' },
        canManageForum && { label: 'Forum', href: '/admin/posts', desc: 'Kiểm duyệt bài viết', color: 'orange' },
        (isSuperAdmin || hasPermission(user, 'exams.manage')) && { label: 'Thống kê quản trị', href: '/admin/analytics', desc: 'Hiệu suất admin đăng đề, chất lượng đề thi, báo cáo vận hành', color: 'violet' },
        { label: 'Bảng xếp hạng', href: '/bang-xep-hang', desc: 'Xem top học viên', color: 'violet' },
    ].filter(Boolean) as { label: string; href: string; desc: string; color: string }[];

    const colorMap: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-fuchsia-500', orange: 'from-orange-500 to-orange-600',
        pink: 'from-pink-500 to-rose-500', cyan: 'from-cyan-500 to-teal-500',
        purple: 'from-purple-500 to-indigo-600', green: 'from-green-500 to-emerald-600',
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
                        <button onClick={() => {
                            const range = getDateRange('custom');
                            loadStats(range);
                            if (activeTab === 'ai') loadAIUsage(range);
                        }}
                            className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                            Áp dụng
                        </button>
                    </div>
                )}
            </div>

            {isSuperAdmin && (
                <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {([
                        { key: 'overview', label: 'Tổng quan' },
                        { key: 'ai', label: 'AI chi tiết' },
                    ] as { key: DashboardTab; label: string }[]).map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-violet-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'overview' && (
                <>
            {/* Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
                {statCards.map(card => {
                    const Icon = card.icon;
                    const isRevenue = card.title === 'Doanh Thu';
                    const isOnline = card.title === 'Đang Online';
                    return (
                        <div key={card.title} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm relative overflow-hidden">
                            {isOnline && !onlineLoading && onlineUsers.online > 0 && (
                                <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                            )}
                            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colorMap[card.tone]} text-white mb-3`}>
                                <Icon size={18} />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{card.title}</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {onlineLoading ? '...' : isRevenue
                                    ? `${card.value.toLocaleString('vi-VN')}đ`
                                    : card.value.toLocaleString()}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
                    <div>
                        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                            <FiWifi className="text-emerald-500" />
                            Người đang truy cập
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            Tài khoản đã đăng nhập trên mọi trang của website
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {onlineUsers.active} đang xem
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                            {onlineUsers.online} tài khoản · {onlineUsers.connections} tab
                        </span>
                    </div>
                </div>

                {onlineLoading ? (
                    <div className="space-y-3 p-5">
                        {[0, 1].map((item) => (
                            <div key={item} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
                        ))}
                    </div>
                ) : onlineUsers.users.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-400">
                        Chưa có tài khoản nào đang truy cập.
                    </div>
                ) : (
                    <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-slate-800">
                        {onlineUsers.users.map((onlineUser) => (
                            <div key={onlineUser.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                        onlineUser.active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                                    }`} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                            {onlineUser.fullName || onlineUser.email}
                                        </p>
                                        <p className="truncate text-xs text-gray-400">
                                            {onlineUser.email} · ID {onlineUser.id}
                                            {onlineUser.connections > 1 ? ` · ${onlineUser.connections} tab` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="min-w-0 sm:max-w-[55%] sm:text-right">
                                    <Link
                                        href={onlineUser.currentPage.path || '/'}
                                        className="block truncate text-sm font-semibold text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-400"
                                        title={onlineUser.currentPage.title || onlineUser.currentPage.path}
                                    >
                                        {onlineUser.currentPage.title || onlineUser.currentPage.path || '/'}
                                    </Link>
                                    <p className="truncate text-xs text-gray-400" title={onlineUser.currentPage.path}>
                                        {onlineUser.currentPage.path || '/'} · {onlineUser.active ? 'đang xem' : 'tab nền'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                </>
            )}
            {activeTab === 'ai' && isSuperAdmin && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                        {[
                            { title: 'AI requests', value: num(aiUsage.overview.total_requests).toLocaleString('vi-VN'), icon: FiCpu, tone: 'violet' },
                            { title: 'Người dùng AI', value: num(aiUsage.overview.unique_users).toLocaleString('vi-VN'), icon: FiUsers, tone: 'blue' },
                            { title: 'Tổng token', value: formatTokens(aiUsage.overview.total_tokens), icon: FiActivity, tone: 'emerald' },
                            { title: 'Output token', value: formatTokens(aiUsage.overview.total_completion_tokens), icon: FiTrendingUp, tone: 'orange' },
                            { title: 'Chi phí ước tính', value: formatUsd(aiUsage.overview.total_cost_usd), icon: FiDollarSign, tone: 'pink' },
                        ].map(card => {
                            const Icon = card.icon;
                            return (
                                <div key={card.title} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
                                    <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colorMap[card.tone]} text-white mb-3`}>
                                        <Icon size={18} />
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{card.title}</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{aiLoading ? '...' : card.value}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Người dùng tốn AI nhiều nhất</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-0 text-sm">
                                    <thead className="text-xs uppercase text-gray-400">
                                        <tr>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-left dark:border-slate-700">User</th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-left dark:border-slate-700">Model / giá</th>
                                            <th className="border-b border-r border-gray-200 px-3 py-2 text-right dark:border-slate-700">Token</th>
                                            <th className="border-b border-gray-200 px-3 py-2 text-right dark:border-slate-700">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {aiUsage.perUser.slice(0, 12).map(row => (
                                            <tr key={`${row.user_id || 'unknown'}-${row.email || ''}`}>
                                                <td className="border-b border-r border-gray-100 px-3 py-3 align-top dark:border-slate-800">
                                                    <p className="font-bold text-gray-900 dark:text-white">{row.full_name || 'Không rõ user'}</p>
                                                    <p className="text-xs text-gray-400">{row.email || `user_id: ${row.user_id || 'N/A'}`}</p>
                                                </td>
                                                <td className="border-b border-r border-gray-100 px-3 py-3 align-top dark:border-slate-800">
                                                    <div className="space-y-2">
                                                        {(row.models || []).slice(0, 3).map(model => (
                                                            <div key={`${row.user_id || 'unknown'}-${model.provider}-${model.model}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <span className="max-w-[220px] truncate text-xs font-black text-gray-800 dark:text-slate-100" title={model.model}>
                                                                        {model.model}
                                                                    </span>
                                                                    <span className="text-xs font-black text-rose-600">{formatUsd(model.cost_usd)}</span>
                                                                </div>
                                                                <p className="mt-0.5 text-[11px] text-gray-400">
                                                                    {model.provider} · {num(model.requests).toLocaleString('vi-VN')} req · {formatTokens(model.total_tokens)}
                                                                </p>
                                                                <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
                                                                    {formatModelPricing(model.pricing)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                        {(!row.models || row.models.length === 0) && (
                                                            <span className="text-xs text-gray-400">Chưa ghi nhận model</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="border-b border-r border-gray-100 px-3 py-3 text-right align-top font-semibold dark:border-slate-800">{formatTokens(row.total_tokens)}</td>
                                                <td className="border-b border-gray-100 px-3 py-3 text-right align-top font-black text-rose-600 dark:border-slate-800">{formatUsd(row.cost_usd)}</td>
                                            </tr>
                                        ))}
                                        {!aiLoading && aiUsage.perUser.length === 0 && (
                                            <tr><td colSpan={4} className="border-b border-gray-100 px-3 py-8 text-center text-gray-400 dark:border-slate-800">Chưa có log AI trong khoảng này.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Model đang được dùng</h3>
                            <div className="space-y-3">
                                {aiUsage.perModel.map(row => (
                                    <div key={`${row.provider}-${row.model}`} className="rounded-xl border border-gray-100 p-3 dark:border-slate-800">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-black text-gray-900 dark:text-white">{row.model}</p>
                                                <p className="text-xs text-gray-400">{row.provider} · {num(row.requests).toLocaleString('vi-VN')} requests</p>
                                            </div>
                                            <p className="font-black text-rose-600">{formatUsd(row.cost_usd)}</p>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500">
                                            Input {formatTokens(row.prompt_tokens)} · cache hit {formatTokens(row.cache_hit_tokens)} · output {formatTokens(row.completion_tokens)}
                                        </p>
                                    </div>
                                ))}
                                {!aiLoading && aiUsage.perModel.length === 0 && (
                                    <div className="py-8 text-center text-sm text-gray-400">Chưa có model nào được ghi nhận.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Tính năng dùng AI</h3>
                            <div className="space-y-2">
                                {aiUsage.perFeature.map(row => (
                                    <div key={row.feature} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-slate-100">{row.feature}</p>
                                            <p className="text-xs text-gray-400">{num(row.requests).toLocaleString('vi-VN')} requests · {formatTokens(row.total_tokens)} token</p>
                                        </div>
                                        <p className="font-black text-rose-600">{formatUsd(row.cost_usd)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">30 ngày gần đây</h3>
                            <div className="space-y-2">
                                {aiUsage.daily.map(row => (
                                    <div key={row.date} className="grid grid-cols-4 gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm dark:bg-slate-800">
                                        <span className="font-bold text-gray-700 dark:text-slate-200">{new Date(row.date).toLocaleDateString('vi-VN')}</span>
                                        <span className="text-right">{num(row.requests).toLocaleString('vi-VN')} req</span>
                                        <span className="text-right">{formatTokens(row.total_tokens)}</span>
                                        <span className="text-right font-black text-rose-600">{formatUsd(row.cost_usd)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
