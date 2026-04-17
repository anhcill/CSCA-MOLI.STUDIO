'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import axios from '@/lib/utils/axios';
import { hasPermission } from '@/lib/utils/permissions';
import { FiUsers, FiFileText, FiBook, FiActivity, FiTrendingUp, FiMessageSquare, FiImage, FiTag, FiSettings, FiCalendar, FiMap, FiMonitor, FiArrowRight, FiShield } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface DashboardStats {
    totalUsers: number;
    totalExams: number;
    totalAttempts: number;
    totalPosts: number;
    recentActivities: {
        id: number;
        created_at: string;
        user_name: string;
        exam_title: string;
        total_score: number;
        status: string;
    }[];
}

export default function AdminDashboard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        totalExams: 0,
        totalAttempts: 0,
        totalPosts: 0,
        recentActivities: []
    });
    const [loading, setLoading] = useState(true);
    const [examDateInput, setExamDateInput] = useState('');
    const [savingDate, setSavingDate] = useState(false);
    const [dateSaved, setDateSaved] = useState(false);

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'admin.dashboard.view'))) {
            router.push('/');
            return;
        }

        loadStats();
        loadExamDate();
    }, [isAuthenticated, user, router]);

    const loadExamDate = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/settings/public`);
            const json = await res.json();
            if (json?.data?.exam_date) {
                // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
                const dt = json.data.exam_date.slice(0, 16);
                setExamDateInput(dt);
            }
        } catch { /* keep current env value */ }
    };

    const saveExamDate = async () => {
        if (!examDateInput) return;
        if (!hasPermission(user, 'system.manage')) {
            alert('Bạn không có quyền cấu hình hệ thống');
            return;
        }

        try {
            setSavingDate(true);
            await axios.put('/settings', { exam_date: examDateInput });
            setDateSaved(true);
            setTimeout(() => setDateSaved(false), 3000);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lưu thất bại');
        } finally {
            setSavingDate(false);
        }
    };

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
            // Fallback to empty data if API fails
            setStats({
                totalUsers: 0,
                totalExams: 0,
                totalAttempts: 0,
                totalPosts: 0,
                recentActivities: []
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    const canManageUsers = hasPermission(user, 'users.manage');
    const canManageExams = hasPermission(user, 'exams.manage');
    const canManageContent = hasPermission(user, 'content.manage');
    const canManageForum = hasPermission(user, 'forum.manage');
    const canManageRoadmap = hasPermission(user, 'roadmap.manage');
    const canManageSystem = hasPermission(user, 'system.manage');
    const userInitial = user?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'A';

    const statCards = [
        {
            title: 'Tổng Users',
            value: stats.totalUsers,
            icon: FiUsers,
            tone: 'blue',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-700',
            ringColor: 'ring-blue-200'
        },
        {
            title: 'Tổng Đề Thi',
            value: stats.totalExams,
            icon: FiFileText,
            tone: 'emerald',
            bgColor: 'bg-green-50',
            textColor: 'text-green-700',
            ringColor: 'ring-green-200'
        },
        {
            title: 'Lượt Thi',
            value: stats.totalAttempts,
            icon: FiTrendingUp,
            tone: 'violet',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-700',
            ringColor: 'ring-purple-200'
        },
        {
            title: 'Bài Viết Forum',
            value: stats.totalPosts,
            icon: FiMessageSquare,
            tone: 'orange',
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-700',
            ringColor: 'ring-orange-200'
        }
    ];

    const navItems = [
        { label: 'Tổng quan', icon: FiActivity, onClick: () => null, active: true, visible: true },
        { label: 'Users', icon: FiUsers, onClick: () => router.push('/admin/users'), active: false, visible: canManageUsers },
        { label: 'VIP & Doanh thu', icon: FaCrown, onClick: () => router.push('/admin/vip'), active: false, visible: canManageUsers },
        { label: 'Đề thi', icon: FiFileText, onClick: () => router.push('/admin/exams'), active: false, visible: canManageExams },
        { label: 'Câu hỏi', icon: FiShield, onClick: () => router.push('/admin/questions'), active: false, visible: canManageExams },
        { label: 'Phòng thi', icon: FiMonitor, onClick: () => router.push('/exam-room'), active: false, visible: canManageExams },
        { label: 'Từ vựng', icon: FiTag, onClick: () => router.push('/admin/vocabulary'), active: false, visible: canManageContent },
        { label: 'Forum', icon: FiMessageSquare, onClick: () => router.push('/admin/posts'), active: false, visible: canManageForum },
        { label: 'Lộ trình', icon: FiMap, onClick: () => router.push('/admin/roadmap'), active: false, visible: canManageRoadmap },
    ].filter((item) => item.visible);

    const quickActions = [
        {
            title: 'Quản lý Users',
            desc: 'Xem hồ sơ, phân quyền và trạng thái thành viên.',
            icon: FiUsers,
            href: '/admin/users',
            hover: 'hover:border-violet-400',
            iconBg: 'bg-violet-100 text-violet-700',
            visible: canManageUsers,
        },
        {
            title: 'VIP & Doanh thu',
            desc: 'Theo dõi nâng cấp gói và lịch sử giao dịch.',
            icon: FaCrown,
            href: '/admin/vip',
            hover: 'hover:border-yellow-400',
            iconBg: 'bg-yellow-100 text-yellow-700',
            visible: canManageUsers,
        },
        {
            title: 'Tạo đề thi mới',
            desc: 'Tạo đề với ảnh, cấu trúc và thời gian thi.',
            icon: FiFileText,
            href: '/admin/exams/create',
            hover: 'hover:border-emerald-400',
            iconBg: 'bg-emerald-100 text-emerald-700',
            visible: canManageExams,
        },
        {
            title: 'Quản lý phòng thi',
            desc: 'Đặt lịch, theo dõi trạng thái và log hoạt động.',
            icon: FiMonitor,
            href: '/admin/exams',
            hover: 'hover:border-indigo-400',
            iconBg: 'bg-indigo-100 text-indigo-700',
            visible: canManageExams,
        },
        {
            title: 'Quản lý tài liệu',
            desc: 'Upload PDF và chỉnh danh mục hiển thị.',
            icon: FiBook,
            href: '/admin/materials',
            hover: 'hover:border-pink-400',
            iconBg: 'bg-pink-100 text-pink-700',
            visible: canManageContent,
        },
        {
            title: 'Quản lý hình ảnh',
            desc: 'Kho ảnh dùng cho đề thi và nội dung.',
            icon: FiImage,
            href: '/admin/images',
            hover: 'hover:border-sky-400',
            iconBg: 'bg-sky-100 text-sky-700',
            visible: canManageContent,
        },
        {
            title: 'Quản lý từ vựng',
            desc: 'Thêm, sửa và chuẩn hóa dữ liệu từ vựng.',
            icon: FiTag,
            href: '/admin/vocabulary',
            hover: 'hover:border-cyan-400',
            iconBg: 'bg-cyan-100 text-cyan-700',
            visible: canManageContent,
        },
        {
            title: 'Quản lý forum',
            desc: 'Kiểm duyệt nội dung và xử lý báo cáo.',
            icon: FiMessageSquare,
            href: '/admin/posts',
            hover: 'hover:border-orange-400',
            iconBg: 'bg-orange-100 text-orange-700',
            visible: canManageForum,
        },
        {
            title: 'Quản lý lộ trình',
            desc: 'Chỉnh sửa milestone và tiến độ roadmap.',
            icon: FiMap,
            href: '/admin/roadmap',
            hover: 'hover:border-fuchsia-400',
            iconBg: 'bg-fuchsia-100 text-fuchsia-700',
            visible: canManageRoadmap,
        },
    ].filter((item) => item.visible);

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-r from-violet-600/20 via-fuchsia-500/15 to-cyan-500/20 blur-3xl" />

            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">Control Center</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Admin Dashboard</h1>
                        <p className="mt-0.5 text-sm text-slate-500">Quản lý vận hành hệ thống CSCA theo thời gian thực.</p>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="hidden items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 sm:flex"
                        >
                            <span>←</span>
                            <span>Về Trang Khách</span>
                        </button>

                        <div className="hidden text-right sm:block">
                            <p className="text-xs text-slate-500">Xin chào</p>
                            <p className="text-sm font-semibold text-slate-900">{user?.full_name || 'Quản trị viên'}</p>
                        </div>

                        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 font-bold text-white shadow-lg shadow-violet-500/30">
                            {userInitial}
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-5 py-6 sm:px-6 sm:py-8">
                <section className="overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-slate-900 via-violet-900 to-fuchsia-900 p-6 text-white shadow-2xl shadow-violet-900/20 sm:p-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Snapshot</p>
                            <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Bảng điều khiển điều hành toàn bộ hệ thống</h2>
                            <p className="mt-2 text-sm text-violet-100/90 sm:text-base">Theo dõi người dùng, đề thi, hoạt động forum và thao tác quản trị ở một nơi.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                                <p className="text-xs text-violet-100">Tổng Users</p>
                                <p className="mt-1 text-2xl font-black">{stats.totalUsers.toLocaleString()}</p>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                                <p className="text-xs text-violet-100">Lượt Thi</p>
                                <p className="mt-1 text-2xl font-black">{stats.totalAttempts.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="flex gap-2 overflow-x-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onClick={item.onClick}
                                    className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${item.active
                                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                >
                                    <Icon size={15} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Thao tác nhanh</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{quickActions.length} tác vụ</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {quickActions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.title}
                                    href={action.href}
                                    className={`group rounded-2xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${action.hover}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className={`grid h-11 w-11 place-items-center rounded-xl ${action.iconBg}`}>
                                            <Icon size={19} />
                                        </div>
                                        <FiArrowRight className="text-slate-300 transition-colors group-hover:text-slate-500" size={17} />
                                    </div>

                                    <h4 className="mt-3 font-semibold text-slate-900">{action.title}</h4>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{action.desc}</p>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <article key={card.title} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ${card.ringColor}`}>
                                <div className="flex items-center justify-between">
                                    <div className={`grid h-12 w-12 place-items-center rounded-xl ${card.bgColor}`}>
                                        <Icon className={card.textColor} size={20} />
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.tone}</span>
                                </div>
                                <p className="mt-4 text-sm font-medium text-slate-500">{card.title}</p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{card.value.toLocaleString()}</p>
                            </article>
                        );
                    })}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                            <FiActivity size={18} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Hoạt động gần đây</h3>
                    </div>

                    {stats.recentActivities.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-slate-500">
                            <FiActivity className="mx-auto mb-3 opacity-50" size={34} />
                            <p>Chưa có hoạt động nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[760px]">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-3 font-semibold">Thời gian</th>
                                        <th className="px-4 py-3 font-semibold">Người dùng</th>
                                        <th className="px-4 py-3 font-semibold">Đề thi</th>
                                        <th className="px-4 py-3 font-semibold">Điểm</th>
                                        <th className="px-4 py-3 font-semibold">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentActivities.map((activity) => (
                                        <tr key={activity.id} className="border-t border-slate-100 text-sm text-slate-700">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                                {new Date(activity.created_at).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-900">{activity.user_name}</td>
                                            <td className="px-4 py-3">{activity.exam_title}</td>
                                            <td className="px-4 py-3 font-semibold">{activity.total_score ?? 0}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activity.status === 'completed'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {activity.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {canManageSystem && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                                <FiSettings size={18} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Cấu hình hệ thống</h3>
                        </div>

                        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <FiCalendar size={15} className="text-violet-500" />
                                Ngày thi chính thức (hiển thị trên homepage)
                            </label>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    type="datetime-local"
                                    value={examDateInput}
                                    onChange={e => setExamDateInput(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                                <button
                                    onClick={saveExamDate}
                                    disabled={savingDate || !examDateInput}
                                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${dateSaved
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50'
                                        }`}
                                >
                                    {savingDate ? '...' : dateSaved ? '✓ Đã lưu' : 'Lưu'}
                                </button>
                            </div>

                            <p className="mt-2 text-xs text-slate-500">Countdown trên homepage sẽ tự cập nhật sau khi lưu.</p>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
