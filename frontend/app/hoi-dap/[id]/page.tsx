"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import { FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle, FiChevronLeft } from 'react-icons/fi';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';

export default function StudentQADetailPage() {
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();
    const params = useParams();
    const ticketId = parseInt(params.id as string);

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [content, setContent] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            loadDetail();
        }
    }, [user]);

    const loadDetail = async () => {
        try {
            const data = await qaApi.getTicketDetail(ticketId);
            setTicket(data);
        } catch (error) {
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

        // --- OPTIMISTIC UI UPDATE ---
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
                sender_avatar: user?.avatar_url || 'https://ui-avatars.com/api/?name=H'
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

            await qaApi.replyToTicket(ticketId, {
                content: currentContent,
                imageUrl
            });

            loadDetail(); // Reload chat
        } catch (error) {
             alert("Lỗi khi gửi tin nhắn.");
             loadDetail(); // rollback
        } finally {
             setIsSubmitting(false);
        }
    };

    if (!ticket) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
                <Header />
                <div className="p-8 text-center text-gray-500">Đang tải đoạn chat...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            <Header />
            <div className="max-w-4xl mx-auto p-4 md:p-8">
                <Link href="/hoi-dap" className="inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 mb-6 font-medium">
                    <FiChevronLeft /> Quay lại Danh sách Câu hỏi
                </Link>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col h-[75vh]">
                    
                    {/* Header Ticket (Bản góc) */}
                    <div className="p-6 bg-gray-50 dark:bg-slate-800 border-b flex flex-col sm:flex-row gap-4 shrink-0">
                        <img src={ticket.author_avatar || 'https://ui-avatars.com/api/?name=H'} alt="avatar" className="w-12 h-12 rounded-full hidden sm:block" />
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="font-bold text-gray-900 dark:text-white">Câu hỏi gốc của bạn</h2>
                                <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleString('vi-VN')}</span>
                                 <span className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${
                                    ticket.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    ticket.status === 'answered' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {ticket.status === 'pending' ? 'ĐANG CHỜ' : ticket.status === 'answered' ? 'CỐ VẤN ĐÃ TRẢ LỜI' : 'ĐÃ ĐÓNG'}
                                </span>
                            </div>
                            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{ticket.content}</p>
                            {ticket.image_url && (
                                 <img src={ticket.image_url} alt="Image" className="mt-3 max-w-sm rounded-lg border shadow-sm cursor-pointer hover:opacity-90" onClick={()=>window.open(ticket.image_url as string, '_blank')} />
                            )}
                        </div>
                    </div>

                    {/* Box Chat */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-slate-900">
                        {ticket.replies?.length === 0 ? (
                             <div className="text-center text-gray-400 mt-10">Đang chờ hệ thống phân công cố vấn. Bạn sẽ nhận được thông báo ngay khi có người giải đáp!</div>
                        ) : (
                            ticket.replies?.map(reply => (
                                <div key={reply.id} className={`flex gap-4 ${reply.sender_id === user?.id ? 'flex-row-reverse' : ''}`}>
                                    <img src={reply.sender_avatar || (reply.is_admin_reply ? 'https://ui-avatars.com/api/?name=G&background=2563eb&color=fff' : 'https://ui-avatars.com/api/?name=H')} alt="avatar" className="w-10 h-10 rounded-full shadow-sm" />
                                    <div className={`flex flex-col max-w-[75%] ${reply.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                                {reply.is_admin_reply ? '👨‍🏫 Cố Vấn CSCA' : 'Bạn (Học viên)'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div className={`p-3.5 rounded-2xl ${
                                            reply.sender_id === user?.id 
                                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                                : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white rounded-tl-none border dark:border-slate-700'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{reply.content}</p>
                                            {reply.image_url && (
                                                <img src={reply.image_url} alt="Attach" className="mt-2 rounded-lg max-h-60 cursor-pointer border" onClick={()=>window.open(reply.image_url as string, '_blank')} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Khung chat */}
                    {ticket.status !== 'closed' ? (
                         <div className="p-4 bg-white dark:bg-slate-800 border-t flex flex-col shrink-0">
                             {image && (
                                <div className="mb-2 relative inline-block">
                                    <img src={URL.createObjectURL(image)} alt="Preview" className="h-16 rounded border" />
                                    <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><FiX size={12}/></button>
                                </div>
                             )}
                             <form onSubmit={handleReply} className="flex gap-2 items-end">
                                <label className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition">
                                    <FiImage size={24} />
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                                </label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    className="flex-1 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[50px] max-h-[150px]"
                                    placeholder="Viết phản hồi cho cố vấn..."
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleReply(e);
                                        }
                                    }}
                                />
                                <button disabled={isSubmitting || (!content && !image)} type="submit" className="p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-bold flex items-center justify-center transition">
                                    <FiSend size={20} />
                                </button>
                             </form>
                         </div>
                    ) : (
                        <div className="p-4 bg-gray-100 text-center text-gray-500 italic border-t">
                            📌 Cuộc tư vấn này đã được đóng lại. Không thể nhắn tin thêm.
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
