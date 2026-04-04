'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import axios from '@/lib/utils/axios';
import { FiUsers, FiFileText, FiBook, FiActivity, FiTrendingUp, FiMessageSquare, FiImage, FiTag, FiSettings, FiCalendar } from 'react-icons/fi';

interface DashboardStats {
    totalUsers: number;
    totalExams: number;
    totalAttempts: number;
    totalPosts: number;
    recentActivities: any[];
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
        // Check if user is admin
        if (!isAuthenticated || user?.role !== 'admin') {
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

    const statCards = [
        {
            title: 'Tổng Users',
            value: stats.totalUsers,
            icon: FiUsers,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600'
        },
        {
            title: 'Tổng Đề Thi',
            value: stats.totalExams,
            icon: FiFileText,
            color: 'from-green-500 to-green-600',
            bgColor: 'bg-green-50',
            textColor: 'text-green-600'
        },
        {
            title: 'Lượt Thi',
            value: stats.totalAttempts,
            icon: FiTrendingUp,
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-50',
            textColor: 'text-purple-600'
        },
        {
            title: 'Bài Viết Forum',
            value: stats.totalPosts,
            icon: FiMessageSquare,
            color: 'from-orange-500 to-orange-600',
            bgColor: 'bg-orange-50',
            textColor: 'text-orange-600'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Admin Dashboard
                            </h1>
                            <p className="text-gray-600 mt-1">Quản lý hệ thống CSCA</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Xin chào,</p>
                                <p className="font-semibold text-gray-900">{user?.full_name}</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                                {user?.full_name?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-sm border mb-6 p-2 flex gap-2 overflow-x-auto">
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold whitespace-nowrap">
                        📊 Tổng quan
                    </button>
                    <button
                        onClick={() => router.push('/admin/users')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold whitespace-nowrap"
                    >
                        👥 Users
                    </button>
                    <button
                        onClick={() => router.push('/admin/exams')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold whitespace-nowrap"
                    >
                        📝 Đề thi
                    </button>
                    <button
                        onClick={() => router.push('/admin/questions')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold whitespace-nowrap"
                    >
                        ❓ Câu hỏi
                    </button>
                    <button
                        onClick={() => router.push('/admin/vocabulary')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold whitespace-nowrap"
                    >
                        📚 Từ vựng
                    </button>
                    <button
                        onClick={() => router.push('/admin/posts')}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold whitespace-nowrap"
                    >
                        💬 Forum
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Thao tác nhanh</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Link
                            href="/admin/users"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all group"
                        >
                            <FiUsers className="text-3xl text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Quản lý Users</h3>
                            <p className="text-sm text-gray-600 mt-1">Xem và quản lý người dùng</p>
                        </Link>

                        <Link
                            href="/admin/exams/create"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all group"
                        >
                            <FiFileText className="text-3xl text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Tạo Đề Thi Mới</h3>
                            <p className="text-sm text-gray-600 mt-1">Tạo đề thi với kéo thả ảnh</p>
                        </Link>

                        <Link
                            href="/admin/materials"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-pink-500 hover:shadow-md transition-all group"
                        >
                            <FiBook className="text-3xl text-pink-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Quản lý Tài Liệu</h3>
                            <p className="text-sm text-gray-600 mt-1">Upload PDF tài liệu</p>
                        </Link>

                        <Link
                            href="/admin/images"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
                        >
                            <FiImage className="text-3xl text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Quản lý Hình ảnh</h3>
                            <p className="text-sm text-gray-600 mt-1">Upload ảnh cho đề thi</p>
                        </Link>

                        <Link
                            href="/admin/vocabulary"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-cyan-500 hover:shadow-md transition-all group"
                        >
                            <FiTag className="text-3xl text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Quản lý Từ Vựng</h3>
                            <p className="text-sm text-gray-600 mt-1">Thêm/sửa/xóa từ vựng</p>
                        </Link>

                        <Link
                            href="/admin/posts"
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:shadow-md transition-all group"
                        >
                            <FiMessageSquare className="text-3xl text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                            <h3 className="font-semibold text-gray-900">Quản lý Forum</h3>
                            <p className="text-sm text-gray-600 mt-1">Kiểm duyệt bài viết</p>
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {statCards.map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <div key={index} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                                        <Icon className={`text-xl ${card.textColor}`} />
                                    </div>
                                </div>
                                <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
                                <p className="text-3xl font-black text-gray-900">{card.value.toLocaleString()}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <FiActivity className="text-2xl text-purple-600" />
                        <h2 className="text-xl font-bold text-gray-900">Hoạt động gần đây</h2>
                    </div>
                    <div className="text-center py-12 text-gray-500">
                        <FiActivity className="text-4xl mx-auto mb-3 opacity-50" />
                        <p>Chưa có hoạt động nào</p>
                    </div>
                </div>

                {/* Site Settings */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <FiSettings className="text-2xl text-violet-600" />
                        <h2 className="text-xl font-bold text-gray-900">Cấu hình hệ thống</h2>
                    </div>
                    <div className="max-w-md">
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <FiCalendar size={15} className="text-violet-500" />
                            Ngày thi chính thức (hiện thị trên homepage)
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="datetime-local"
                                value={examDateInput}
                                onChange={e => setExamDateInput(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                            <button
                                onClick={saveExamDate}
                                disabled={savingDate || !examDateInput}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${dateSaved
                                    ? 'bg-green-500 text-white'
                                    : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50'
                                    }`}
                            >
                                {savingDate ? '...' : dateSaved ? '✓ Đã lưu' : 'Lưu'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Countdown trên homepage sẽ tự cập nhật sau khi lưu.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
