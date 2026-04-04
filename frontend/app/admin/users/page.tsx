'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import { FiUsers, FiTrash2, FiEdit, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';

interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'student' | 'admin';
    created_at: string;
    total_attempts: number;
}

interface Pagination {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    limit: number;
}

export default function UsersPage() {
    const router = useRouter();
    const { user: currentUser, isAuthenticated } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        currentPage: 1,
        totalPages: 1,
        totalUsers: 0,
        limit: 20
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isAuthenticated || currentUser?.role !== 'admin') {
            router.push('/');
            return;
        }

        loadUsers();
    }, [isAuthenticated, currentUser, router, pagination.currentPage]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getUsers(pagination.currentPage, pagination.limit);
            setUsers(data.users);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Bạn có chắc muốn xóa user này?')) return;

        try {
            await adminApi.deleteUser(userId);
            loadUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Xóa user thất bại');
        }
    };

    const handleChangeRole = async (userId: number, newRole: 'student' | 'admin') => {
        if (!confirm(`Đổi role thành ${newRole}?`)) return;

        try {
            await adminApi.updateUserRole(userId, newRole);
            loadUsers();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Đổi role thất bại');
        }
    };

    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Quản lý Users
                            </h1>
                            <p className="text-gray-600 mt-1">Danh sách người dùng trong hệ thống</p>
                        </div>
                        <button
                            onClick={() => router.push('/admin')}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                        >
                            ← Quay lại Dashboard
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Search Bar */}
                <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên hoặc email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Tên
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Lượt thi
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Ngày tạo
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            #{user.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                                                    {user.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{user.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleChangeRole(user.id, e.target.value as 'student' | 'admin')}
                                                disabled={user.id === currentUser?.id}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'admin'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                    } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                <option value="student">Student</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {user.total_attempts || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(user.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={user.id === currentUser?.id}
                                                className={`text-red-600 hover:text-red-800 ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                                                    }`}
                                                title="Xóa user"
                                            >
                                                <FiTrash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Hiển thị {((pagination.currentPage - 1) * pagination.limit) + 1} - {Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)} trong tổng {pagination.totalUsers} users
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                                disabled={pagination.currentPage === 1}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronLeft />
                            </button>
                            <div className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold">
                                {pagination.currentPage}
                            </div>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                                disabled={pagination.currentPage >= pagination.totalPages}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiChevronRight />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
