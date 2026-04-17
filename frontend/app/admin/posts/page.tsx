'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import {
    FiMessageSquare, FiTrash2, FiSearch, FiChevronLeft,
    FiChevronRight, FiUser, FiHeart, FiEye, FiAlertCircle,
} from 'react-icons/fi';
import Link from 'next/link';

interface Post {
    id: number;
    content: string;
    image_url: string | null;
    like_count: number;
    comment_count: number;
    created_at: string;
    user_id: number;
    author_name: string;
    author_email: string;
}

const LIMIT = 20;

export default function AdminPostsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState('');
    const [deleting, setDeleting] = useState<number | null>(null);

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'forum.manage'))) {
            router.push('/');
            return;
        }
        loadPosts();
    }, [isAuthenticated, user, offset]);

    const loadPosts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/admin/forum/posts', { params: { limit: LIMIT, offset } });
            const data = res.data;
            setPosts(data.data || []);
            setTotal(data.pagination?.total || data.data?.length || 0);
        } catch (err) {
            console.error('Load posts error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (postId: number) => {
        if (!confirm('Xác nhận xóa bài viết này?')) return;
        try {
            setDeleting(postId);
            await axios.delete(`/admin/forum/posts/${postId}`);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            setTotal((t) => t - 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Xóa thất bại');
        } finally {
            setDeleting(null);
        }
    };

    const filtered = posts.filter((p) =>
        !search ||
        p.content.toLowerCase().includes(search.toLowerCase()) ||
        p.author_name?.toLowerCase().includes(search.toLowerCase()),
    );

    const totalPages = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT) + 1;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="text-gray-500 hover:text-gray-800 transition-colors">
                            <FiChevronLeft size={22} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Quản lý Bài viết Forum</h1>
                            <p className="text-sm text-gray-500">{total} bài viết trong hệ thống</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Search */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-3">
                    <FiSearch className="text-gray-400 shrink-0" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo nội dung hoặc tên tác giả..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 outline-none text-gray-800 placeholder-gray-400 text-sm"
                    />
                </div>

                {/* Table */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <FiMessageSquare size={48} className="mx-auto mb-3 opacity-40" />
                        <p>Không có bài viết nào</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-8">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nội dung</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">Tác giả</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 hidden lg:table-cell">Lượt thích</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 hidden lg:table-cell">Bình luận</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">Ngày đăng</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((post) => (
                                        <tr key={post.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-4 py-3 text-gray-400 text-xs">#{post.id}</td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-gray-800 line-clamp-2 text-sm">{post.content}</p>
                                                {post.image_url && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-blue-500 mt-1">
                                                        <FiEye size={11} /> Có ảnh
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {post.author_name?.charAt(0)?.toUpperCase() || <FiUser size={12} />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-xs">{post.author_name || '—'}</p>
                                                        <p className="text-gray-400 text-xs">{post.author_email || ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                                    <FiHeart size={12} className="text-red-400" /> {post.like_count ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                                                <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                                                    <FiMessageSquare size={12} className="text-blue-400" /> {post.comment_count ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">
                                                {new Date(post.created_at).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleDelete(post.id)}
                                                    disabled={deleting === post.id}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Xóa bài viết"
                                                >
                                                    {deleting === post.id
                                                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                        : <FiTrash2 size={15} />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                                <span>
                                    Trang {currentPage}/{totalPages} · {total} bài viết
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        disabled={offset === 0}
                                        onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <FiChevronLeft size={14} /> Trước
                                    </button>
                                    <button
                                        disabled={offset + LIMIT >= total}
                                        onClick={() => setOffset(offset + LIMIT)}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Sau <FiChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
