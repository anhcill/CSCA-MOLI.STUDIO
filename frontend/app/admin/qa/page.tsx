"use client";
import React, { useEffect, useState } from 'react';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import { FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle, FiInbox } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';

export default function AdminQADashboard() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered' | 'closed'>('all');
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [content, setContent] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        loadTickets();
    }, [statusFilter]);

    const loadTickets = async () => {
        setLoadError('');
        try {
            const data = await qaApi.adminGetAllTickets(statusFilter);
            setTickets(data);
            if (selectedTicket) {
                try {
                    const detail = await qaApi.adminGetTicketDetail(selectedTicket.id);
                    setSelectedTicket(detail);
                } catch {
                    // ticket may have been deleted
                }
            }
        } catch (error: any) {
            console.error("Admin Get Tickets Error:", error);
            setLoadError(error.response?.data?.message || "Lỗi lấy danh sách Tickets");
        }
    };

    const handleSelectTicket = async (ticket: Ticket) => {
        try {
            const detail = await qaApi.adminGetTicketDetail(ticket.id);
            setSelectedTicket(detail);
            setContent('');
            setImage(null);
        } catch (error) {
            alert("Lỗi xem chi tiết");
        }
    };

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket) return;
        if (!content.trim() && !image) return alert("Vui lòng nhập phản hồi");

        setIsSubmitting(true);
        try {
            let imageUrl = '';
            if (image) {
                const uploadRes = await qaApi.uploadImage(image);
                imageUrl = uploadRes.data?.url || uploadRes.url;
            }

            await qaApi.adminReplyTicket(selectedTicket.id, {
                content,
                imageUrl
            });

            setContent('');
            setImage(null);
            await loadTickets();
        } catch (error) {
            alert("Lỗi gửi phản hồi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangeStatus = async (status: string) => {
        if (!selectedTicket) return;
        try {
            await qaApi.adminChangeStatus(selectedTicket.id, status);
            alert("Đã đổi trạng thái thành " + status);
            loadTickets();
        } catch (error) {
            alert("Lỗi cập nhật trạng thái");
        }
    };

    return (
        <AdminLayout title="Hỏi-Đáp VIP" description="Quản lý hỗ trợ học viên 1:1">
            <div className="flex h-[calc(100vh-120px)] bg-gray-50 dark:bg-slate-900 rounded-xl overflow-hidden border dark:border-slate-800">
                {/* CỘT TRÁI: Danh sách Ticket */}
                <div className="w-1/3 min-w-[300px] max-w-sm border-r bg-white dark:bg-slate-800 flex flex-col">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
                            <FiInbox /> Hỗ trợ Học viên
                        </h2>
                        <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg">
                            <button onClick={()=>setStatusFilter('pending')} className={`flex-1 text-sm py-1.5 font-semibold rounded-md transition ${statusFilter==='pending'?'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400':'text-gray-500'}`}>Tồn đọng</button>
                            <button onClick={()=>setStatusFilter('all')} className={`flex-1 text-sm py-1.5 font-semibold rounded-md transition ${statusFilter==='all'?'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white':'text-gray-500'}`}>Toàn bộ</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loadError ? (
                            <div className="p-6 text-center text-red-400 text-sm">{loadError}</div>
                        ) : tickets.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">Không có ticket nào.</div>
                        ) : (
                            tickets.map(ticket => (
                                <button
                                    key={ticket.id}
                                    onClick={() => handleSelectTicket(ticket)}
                                    className={`w-full text-left p-4 border-b hover:bg-gray-50 dark:hover:bg-slate-700 transition ${selectedTicket?.id === ticket.id ? 'bg-blue-50 dark:bg-slate-700' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{ticket.author_name || ticket.author_email || 'Học viên'}</div>
                                        <span className="text-[10px] text-gray-400">{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{ticket.content}</div>
                                    <div className="mt-2 flex justify-between items-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                            ticket.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            ticket.status === 'answered' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-200 text-gray-600'
                                        }`}>
                                            {ticket.status === 'pending' ? '⏳ CHỜ' : ticket.status === 'answered' ? '✅ ĐÃ TRẢ LỜI' : 'ĐÓNG'}
                                        </span>
                                        {ticket.reply_count ? <span className="text-xs text-gray-400">{ticket.reply_count} tin nhắn</span> : null}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* CỘT PHẢI: Khung Chat */}
                <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900">
                    {!selectedTicket ? (
                        <div className="m-auto flex flex-col items-center gap-4 text-gray-400">
                            <FiMessageSquare size={64} className="opacity-20" />
                            <p>Chọn một câu hỏi từ danh sách để trả lời</p>
                        </div>
                    ) : (
                        <>
                            {/* Box Header */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-b flex justify-between items-center shadow-sm shrink-0">
                                <div>
                                    <h2 className="font-bold text-lg">{selectedTicket.author_name || 'Học viên'}</h2>
                                    <p className="text-xs text-gray-500">{selectedTicket.author_email} • Hỏi lúc {new Date(selectedTicket.created_at).toLocaleString('vi-VN')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={()=>handleChangeStatus('pending')} className="text-xs font-bold px-3 py-1.5 border border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded">Mark Unread</button>
                                    <button onClick={()=>handleChangeStatus('closed')} className="text-xs font-bold px-3 py-1.5 border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded">Đóng Ticket</button>
                                </div>
                            </div>

                            {/* List Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Original Question */}
                                <div className="flex gap-4 items-start">
                                    <img src={selectedTicket.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTicket.author_name || 'H')}&background=eee`} alt="avatar" className="w-10 h-10 rounded-full" />
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm border max-w-2xl">
                                        <div className="text-sm font-bold text-blue-600 mb-1">Câu hỏi của học viên</div>
                                        <p className="whitespace-pre-wrap">{selectedTicket.content}</p>
                                        {selectedTicket.image_url && <img src={selectedTicket.image_url} onClick={()=>window.open(selectedTicket?.image_url as string, '_blank')} className="mt-3 rounded cursor-pointer border max-h-80" />}
                                    </div>
                                </div>
                                
                                {/* Replies */}
                                {selectedTicket.replies?.map(reply => (
                                    <div key={reply.id} className={`flex gap-4 ${reply.is_admin_reply ? 'flex-row-reverse' : ''}`}>
                                        <img src={reply.is_admin_reply ? 'https://ui-avatars.com/api/?name=Admin&background=2563eb&color=fff' : (selectedTicket.author_avatar || 'https://ui-avatars.com/api/?name=U')} alt="avatar" className="w-10 h-10 rounded-full" />
                                        <div className={`p-4 rounded-2xl shadow-sm border max-w-2xl ${
                                            reply.is_admin_reply ? 'bg-blue-600 text-white rounded-tr-none border-blue-500' : 'bg-white dark:bg-slate-800 border-gray-100 rounded-tl-none'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{reply.content}</p>
                                            {reply.image_url && <img src={reply.image_url} onClick={()=>window.open(reply.image_url as string, '_blank')} className="mt-3 rounded cursor-pointer border border-black/10 max-h-80" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Chat */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-t shrink-0">
                                {image && (
                                    <div className="mb-2 relative inline-block">
                                        <img src={URL.createObjectURL(image)} alt="Preview" className="h-20 rounded border" />
                                        <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><FiX size={12}/></button>
                                    </div>
                                )}
                                <form onSubmit={handleReply} className="flex gap-2 items-end">
                                    <label className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl cursor-pointer transition">
                                        <FiImage size={24} />
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                                    </label>
                                    <textarea
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        className="flex-1 p-3 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[50px] max-h-[150px]"
                                        placeholder="Viết câu trả lời cho học viên..."
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
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
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
