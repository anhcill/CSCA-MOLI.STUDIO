"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import { FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle, FiChevronLeft, FiPhone, FiMoreVertical } from 'react-icons/fi';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function StudentQADetailPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const params = useParams();
    const ticketId = parseInt(params.id as string);

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [content, setContent] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) loadDetail();
    }, [user]);

    const loadDetail = async () => {
        try {
            const data = await qaApi.getTicketDetail(ticketId);
            setTicket(data);
        } catch {
            alert("Không tìm thấy câu hỏi hoặc bạn không có quyền xem.");
            router.push('/hoi-dap');
        }
    };

    const chatEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.replies]);

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !image) return alert("Vui lòng nhập nội dung nhắn tin");

        const fakeId = Date.now();
        const fakeImageUrl = image ? URL.createObjectURL(image) : null;
        const currentContent = content;
        const currentImage = image;

        if (ticket) {
            const tempReply = {
                id: fakeId,
                ticket_id: ticketId,
                sender_id: user?.id || 0,
                is_admin_reply: false,
                content: currentContent,
                image_url: fakeImageUrl,
                created_at: new Date().toISOString(),
                sender_avatar: (user as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((user as any)?.full_name || 'H')}`
            };
            setTicket({ ...ticket, replies: [...(ticket.replies || []), tempReply] });
        }

        setContent('');
        setImage(null);
        setIsSubmitting(true);

        try {
            let imageUrl = '';
            if (currentImage) {
                const uploadRes = await qaApi.uploadImage(currentImage);
                imageUrl = uploadRes.data?.url || uploadRes.url;
            }
            await qaApi.replyToTicket(ticketId, { content: currentContent, imageUrl });
            loadDetail();
        } catch {
            alert("Lỗi khi gửi tin nhắn.");
            loadDetail();
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!ticket) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <Header />
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-gray-500">Đang tải cuộc trò chuyện...</p>
                </div>
            </div>
        );
    }

    const isClosed = ticket.status === 'closed';

    return (
        <div className="flex flex-col" style={{ height: '100vh' }}>
            <Header />

            {/* Back button */}
            <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 shrink-0">
                <Link href="/hoi-dap" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm">
                    <FiChevronLeft size={18} />
                    <span>Danh sách câu hỏi</span>
                </Link>
            </div>

            {/* Main Chat Area */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left: Ticket Info Panel */}
                <div className="hidden xl:flex flex-col w-72 border-r border-gray-100 bg-white shrink-0 overflow-y-auto">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 text-sm mb-3">Thông tin câu hỏi</h3>
                        <div className="flex items-center gap-3 mb-4">
                            <img
                                src={ticket.author_avatar || 'https://ui-avatars.com/api/?name=H'}
                                alt="avatar"
                                className="w-10 h-10 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {ticket.author_name || 'Học viên'}
                                </p>
                                <p className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</p>
                            </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${
                            ticket.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            ticket.status === 'answered' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-gray-100 text-gray-500'
                        }`}>
                            {ticket.status === 'pending' ? (
                                <><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> ĐANG CHỜ PHẢN HỒI</>
                            ) : ticket.status === 'answered' ? (
                                <><FiCheckCircle size={12} /> CỐ VẤN ĐÃ TRẢ LỜI</>
                            ) : (
                                'ĐÃ ĐÓNG'
                            )}
                        </span>
                    </div>

                    {/* Original question */}
                    <div className="p-5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Câu hỏi gốc</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{ticket.content}</p>
                        {ticket.image_url && (
                            <img
                                src={ticket.image_url}
                                alt="Image"
                                className="w-full rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(ticket.image_url as string, '_blank')}
                            />
                        )}
                    </div>

                    {/* Reply count */}
                    <div className="p-5 border-t border-gray-100 mt-auto">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <FiMessageSquare size={13} />
                            <span>{ticket.replies?.length || 0} tin nhắn</span>
                        </div>
                    </div>
                </div>

                {/* Right: Chat Thread */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">

                    {/* Chat Header */}
                    <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                                        <span className="text-lg">👨‍🏫</span>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-900 text-sm">Cố Vấn CSCA</h2>
                                    <p className="text-xs text-gray-500">
                                        {isClosed ? 'Cuộc tư vấn đã kết thúc' : 'Đang hoạt động'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 mr-2 hidden md:block">
                                    {ticket.status === 'answered' ? 'Phản hồi trong 2-4h' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Empty state */}
                        {(!ticket.replies || ticket.replies.length === 0) && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                                    <span className="text-3xl">👨‍🏫</span>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-700 text-base mb-1">Chờ cố vấn phản hồi</p>
                                    <p className="text-gray-400 text-sm">Cố vấn sẽ trả lời trong vòng 2-4 giờ làm việc. Bạn có thể nhắn thêm thông tin bên dưới.</p>
                                </div>
                            </div>
                        )}

                        {ticket.replies?.map(reply => {
                            const isMe = reply.sender_id === user?.id;
                            return (
                                <div key={reply.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    {/* Avatar */}
                                    <img
                                        src={reply.sender_avatar || (
                                            reply.is_admin_reply
                                                ? 'https://ui-avatars.com/api/?name=G&background=2563eb&color=fff'
                                                : 'https://ui-avatars.com/api/?name=H&background=3b82f6&color=fff'
                                        )}
                                        alt="avatar"
                                        className={`w-9 h-9 rounded-xl shadow-sm shrink-0 mt-0.5 ${reply.is_admin_reply ? 'ring-2 ring-blue-100' : ''}`}
                                    />

                                    <div className="max-w-[72%]">
                                        {/* Name + time */}
                                        <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <span className="text-xs font-semibold text-gray-600">
                                                {reply.is_admin_reply ? 'Cố Vấn CSCA' : 'Bạn'}
                                            </span>
                                            <span className="text-[11px] text-gray-400">
                                                {new Date(reply.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Bubble */}
                                        <div className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                                            isMe
                                                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                                                : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{reply.content}</p>
                                            {reply.image_url && (
                                                <img
                                                    src={reply.image_url}
                                                    alt="Attach"
                                                    className="mt-2.5 rounded-xl max-h-64 cursor-pointer border border-black/10 hover:opacity-90 transition-opacity"
                                                    onClick={() => window.open(reply.image_url as string, '_blank')}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    {isClosed ? (
                        <div className="px-6 py-5 bg-gray-100 border-t border-gray-200 shrink-0">
                            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                                <FiMessageSquare size={15} />
                                <span>Cuộc tư vấn này đã được đóng lại. Không thể nhắn tin thêm.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
                            {image && (
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="relative">
                                        <img src={URL.createObjectURL(image)} alt="Preview" className="h-16 rounded-xl border border-gray-200 shadow-sm" />
                                        <button
                                            onClick={() => setImage(null)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow"
                                        >
                                            <FiX size={11} />
                                        </button>
                                    </div>
                                    <span className="text-xs text-gray-400">{image.name}</span>
                                </div>
                            )}
                            <form onSubmit={handleReply} className="flex gap-3 items-end">
                                <label className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all shrink-0">
                                    <FiImage size={20} />
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                                </label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleReply(e);
                                        }
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                    placeholder="Nhắn cho cố vấn..."
                                    rows={2}
                                    style={{ maxHeight: '120px' }}
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (!content && !image)}
                                    className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                                >
                                    <FiSend size={18} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
