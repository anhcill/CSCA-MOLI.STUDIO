'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import { FiUsers, FiFileText, FiTrendingUp, FiMessageSquare, FiActivity } from 'react-icons/fi';
import Link from 'next/link';

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
    const { user, isAuthenticated } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0, totalExams: 0, totalAttempts: 0, totalPosts: 0, recentActivities: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getDashboardStats();
            setStats(data);
        } catch {
            setStats({ totalUsers: 0, totalExams: 0, totalAttempts: 0, totalPosts: 0, recentActivities: [] });
        } finally {
            setLoading(false);
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
        { title: 'Bài Viết Forum', value: stats.totalPosts, icon: FiMessageSquare, tone: 'orange' },
    ];

    const quickLinks = [
        canManageUsers && { label: 'Quản lý Users', href: '/admin/users', desc: 'Phân quyền, khóa/mở tài khoản', color: 'blue' },
        canManageExams && { label: 'Tạo đề thi', href: '/admin/exams/create', desc: 'Tạo đề mới với shuffle + video', color: 'emerald' },
        canManageExams && { label: 'Kho đề thi', href: '/admin/exams', desc: 'Xem, sửa, xóa đề thi', color: 'purple' },
        canManageContent && { label: 'Tài liệu', href: '/admin/materials', desc: 'Upload và quản lý tài liệu', color: 'pink' },
        canManageContent && { label: 'Từ vựng', href: '/admin/vocabulary', desc: 'Quản lý từ vựng HSK', color: 'cyan' },
        canManageForum && { label: 'Forum', href: '/admin/posts', desc: 'Kiểm duyệt bài viết', color: 'orange' },
    ].filter(Boolean) as { label: string; href: string; desc: string; color: string }[];

    const colorMap: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-fuchsia-500', orange: 'from-orange-500 to-orange-600',
        pink: 'from-pink-500 to-rose-500', cyan: 'from-cyan-500 to-teal-500',
        purple: 'from-purple-500 to-indigo-600',
    };

    return (
        <AdminLayout title="Tổng quan" description="Bảng điều khiển hệ thống CSCA">
            {/* Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {statCards.map(card => {
                    const Icon = card.icon;
                    return (
                        <div key={card.title} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colorMap[card.tone]} text-white mb-3`}>
                                <Icon size={18} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                            <p className="text-3xl font-black text-gray-900 mt-1">
                                {loading ? '...' : card.value.toLocaleString()}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Quick links */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-4">Thao tác nhanh</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quickLinks.map(link => (
                            <Link key={link.href} href={link.href}
                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all group">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[link.color]} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                                    <FiActivity size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700">{link.label}</p>
                                    <p className="text-xs text-gray-500">{link.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-4">Hoạt động gần đây</h3>
                    {loading ? (
                        <div className="space-y-3">{[...Array(4)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                        ))}</div>
                    ) : stats.recentActivities.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <FiActivity size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Chưa có hoạt động nào</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.recentActivities.slice(0, 8).map(a => (
                                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                                            {a.user_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">{a.user_name}</p>
                                            <p className="text-xs text-gray-400 truncate">{a.exam_title}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-sm font-bold text-gray-900">{a.total_score ?? 0}đ</p>
                                        <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('vi-VN')}</p>
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
