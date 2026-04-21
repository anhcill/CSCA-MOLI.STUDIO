"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import { FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function StudentQAPage() {
    const { user, isAuthenticated } = useAuthStore();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [content, setContent] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Hỏi đáp cố vấn chỉ dành cho gói PREMIUM
    const isPremium = user?.subscription_tier === 'premium' || user?.role === 'super_admin';

    useEffect(() => {
        if (user && isPremium) {
            loadTickets();
        } else {
            setIsLoading(false);
        }
    }, [user, isPremium]);

    const loadTickets = async () => {
        try {
            const data = await qaApi.getMyTickets();
            setTickets(data);
        } catch (error) {
            console.error("Load tickets error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !image) return alert("Vui lòng nhập nội dung câu hỏi");

        setIsSubmitting(true);
        try {
            let imageUrl = '';
            if (image) {
                const uploadRes = await qaApi.uploadImage(image);
                imageUrl = uploadRes.data?.url || uploadRes.url;
            }

            await qaApi.createTicket({
                category: 'general',
                content,
                imageUrl
            });

            alert("Đã gửi câu hỏi thành công! Cố vấn sẽ phản hồi bạn sớm nhất.");
            setContent('');
            setImage(null);
            loadTickets();
        } catch (error: any) {
             alert(error.response?.data?.message || "Lỗi khi gửi câu hỏi. Vui lòng thử lại!");
        } finally {
             setIsSubmitting(false);
        }
    };

    // LOADING STATE
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <Header />
                <div className="max-w-5xl mx-auto p-8 text-center text-gray-500">Đang tải dữ liệu...</div>
            </div>
        );
    }

    // NOT LOGGED IN
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <Header />
                <div className="max-w-4xl mx-auto my-12 p-8 bg-white rounded-2xl shadow-xl text-center">
                    <p className="text-red-500 font-semibold text-lg">Vui lòng đăng nhập để sử dụng tính năng này!</p>
                    <Link href="/login" className="mt-4 inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                        Đăng nhập ngay
                    </Link>
                </div>
            </div>
        );
    }

    // KHÔNG CÓ PREMIUM → UPSELL
    if (!isPremium) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <Header />
                <div className="max-w-4xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl text-center border-t-4 border-amber-500">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500 text-4xl">👑</div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Tính năng Cố vấn Học tập 1:1</h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg mb-2">
                        Hỏi bài thỏa thích bằng Text hoặc Hình ảnh.<br/>
                        Đội ngũ chuyên gia CSCA sẽ giải đáp 1-1 cho mọi câu hỏi của bạn.
                    </p>
                    {user?.is_vip && user?.subscription_tier !== 'premium' && (
                        <p className="text-amber-600 font-semibold mb-4 text-sm bg-amber-50 rounded-xl px-4 py-2">
                            ⚠️ Tài khoản VIP của bạn chưa hỗ trợ tính năng này. Nâng cấp lên <strong>Premium</strong> để mở khóa nhắn tin với Cố vấn!
                        </p>
                    )}
                    <p className="text-gray-500 text-sm mb-8">Đây là đặc quyền <strong>chỉ dành riêng cho Tài khoản Premium</strong>.</p>
                    <Link href="/vip" className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full shadow-lg hover:shadow-orange-500/30 transition-all hover:scale-105">
                        🚀 Nâng cấp Premium ngay bây giờ
                    </Link>
                </div>
            </div>
        );
    }

    // PREMIUM → FULL QA INTERFACE
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            <Header />
            <div className="max-w-5xl mx-auto p-4 md:p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <span className="p-2 bg-blue-100 text-blue-600 rounded-xl"><FiMessageSquare size={24} /></span>
                        Hỏi Đáp Cùng Cố Vấn CSCA
                    </h1>
                    <p className="text-gray-500 mt-2">Gửi bức ảnh đề bài hoặc câu hỏi của bạn, thầy cô sẽ giải đáp chi tiết nhất!</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form gửi câu hỏi */}
                    <div className="lg:col-span-1">
                        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 sticky top-24">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mở Câu Hỏi Mới</h2>
                            
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full p-4 rounded-xl border bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                                placeholder="Gõ nội dung bạn không hiểu ở đây..."
                            />

                            {image ? (
                                <div className="mt-4 relative">
                                    <img src={URL.createObjectURL(image)} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                                    <button type="button" onClick={() => setImage(null)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600">
                                        <FiX />
                                    </button>
                                </div>
                            ) : (
                                <label className="mt-4 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-200 dark:border-blue-900/50 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium transition-colors">
                                    <FiImage size={20} />
                                    <span>Tải ảnh đề lên (nếu có)</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                                </label>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || (!content && !image)}
                                className="mt-6 w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20"
                            >
                                {isSubmitting ? 'ĐANG GỬI...' : <><FiSend /> GỬI CHO CỐ VẤN</>}
                            </button>
                        </form>
                    </div>

                    {/* Lịch sử câu hỏi */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold mb-4">Lịch sử câu hỏi của bạn ({tickets.length})</h2>
                        
                        {tickets.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed">
                                Bạn chưa có câu hỏi nào. Đừng ngại hỏi khi gặp bài khó nhé!
                            </div>
                        ) : (
                            tickets.map(ticket => (
                                <div key={ticket.id} className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 flex flex-col sm:flex-row gap-5">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${
                                                ticket.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                ticket.status === 'answered' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {ticket.status === 'pending' ? '⏳ ĐANG CHỜ' : ticket.status === 'answered' ? <><FiCheckCircle/> ĐÃ CÓ LỜI GIẢI</> : 'ĐÃ ĐÓNG'}
                                            </span>
                                            <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-medium line-clamp-2">{ticket.content}</p>
                                        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <FiMessageSquare /> {ticket.reply_count || 0} phản hồi
                                            </div>
                                            <Link href={`/hoi-dap/${ticket.id}`} className="text-blue-600 font-semibold hover:underline">
                                                Vào xem tin nhắn →
                                            </Link>
                                        </div>
                                    </div>
                                    {ticket.image_url && (
                                        <div className="shrink-0">
                                            <img src={ticket.image_url} alt="Problem" className="w-full sm:w-24 h-24 object-cover rounded-xl border border-gray-200" />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
