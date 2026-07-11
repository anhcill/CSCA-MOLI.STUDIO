"use client";
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import {
  FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle,
  FiChevronLeft, FiSmile, FiPaperclip
} from 'react-icons/fi';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/* ─────────────── helpers ─────────────── */
function groupByDate(replies: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  let currentLabel = '';
  for (const r of replies) {
    const d = new Date(r.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Hôm nay';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Hôm qua';
    else label = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (label !== currentLabel) {
      groups.push({ label, items: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].items.push(r);
  }
  return groups;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/* ─────────────── Typing Indicator ─────────────── */
function TypingDots() {
  return (
    <div className="flex items-end gap-3 px-4 py-1">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm shadow-md shadow-indigo-200 shrink-0">
        <span className="text-base">👨‍🏫</span>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function StudentQADetailPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const ticketId = parseInt(params.id as string);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── smart scroll helpers ── */
  const isNearBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  }, []);

  /* ── load data ── */
  useEffect(() => {
    // Force scroll to top of page on mount
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    if (user) loadDetail();
  }, [user]);

  const loadDetail = async () => {
    try {
      const data = await qaApi.getFeedbackDetail(ticketId);
      setTicket(data);
    } catch {
      alert('Không tìm thấy góp ý hoặc bạn không có quyền xem.');
      router.push('/gop-y');
    }
  };

  /* ── smart auto-scroll ── */
  useEffect(() => {
    if (!ticket?.replies) return;
    if (justSent) {
      scrollToBottom('smooth');
      setJustSent(false);
    } else if (isNearBottom()) {
      scrollToBottom('smooth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.replies]);

  /* initial scroll — instant jump to bottom on first load */
  useEffect(() => {
    if (ticket) scrollToBottom('instant' as ScrollBehavior);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!ticket]);

  /* ── auto-resize textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [content]);

  /* ── send reply ── */
  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !image) return;

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
        sender_avatar: (user as any)?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((user as any)?.full_name || 'H')}&background=6366f1&color=fff`,
      };
      setTicket({ ...ticket, replies: [...(ticket.replies || []), tempReply] });
    }

    setContent('');
    setImage(null);
    setJustSent(true);
    setIsSubmitting(true);

    try {
      let imageUrl = '';
      if (currentImage) {
        const uploadRes = await qaApi.uploadImage(currentImage);
        imageUrl = uploadRes.data?.url || uploadRes.url;
      }
      await qaApi.replyToFeedbackTicket(ticketId, { content: currentContent, imageUrl });
      loadDetail();
    } catch {
      alert('Lỗi khi gửi tin nhắn.');
      loadDetail();
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── loading state ── */
  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #faf5ff 100%)' }}>
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-lg">💬</div>
        </div>
        <p className="text-gray-400 font-medium mt-4">Đang tải hội thoại...</p>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';
  const groups = groupByDate(ticket.replies || []);
  const isPending = ticket.status === 'pending';

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* ── Back bar (replaces full Header for more chat space) ── */}
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-2.5 z-20 flex items-center gap-3">
        <Link
          href="/gop-y"
          className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 transition-colors font-medium text-sm group"
        >
          <FiChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Quay lại</span>
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-bold text-gray-700">Góp Ý & Hỗ Trợ</span>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar (xl only) ── */}
        <div className="hidden xl:flex flex-col w-72 border-r border-gray-100 bg-white/60 backdrop-blur-sm shrink-0 overflow-y-auto">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold text-gray-700 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full" />
              Thông tin góp ý
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={ticket.author_avatar || 'https://ui-avatars.com/api/?name=H&background=6366f1&color=fff'}
                alt="avatar"
                className="w-10 h-10 rounded-full ring-2 ring-indigo-100 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{ticket.author_name || 'Người dùng'}</p>
                <p className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl ${
              ticket.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
              ticket.status === 'answered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              {ticket.status === 'pending' ? (
                <><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> Đang chờ phản hồi</>
              ) : ticket.status === 'answered' ? (
                <><FiCheckCircle size={11} /> Admin đã phản hồi</>
              ) : 'Đã đóng'}
            </span>
          </div>

          <div className="p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nội dung gốc</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{ticket.content}</p>
            {ticket.image_url && (
              <img
                src={ticket.image_url}
                alt="Đính kèm"
                className="w-full rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(ticket.image_url as string, '_blank')}
              />
            )}
          </div>

          <div className="p-5 border-t border-gray-100 mt-auto">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <FiMessageSquare size={12} />
              <span>{ticket.replies?.length || 0} tin nhắn</span>
            </div>
          </div>
        </div>

        {/* ── Right: Chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{
          background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 50%, #faf5ff 100%)'
        }}>

          {/* Chat Header */}
          <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-5 py-3.5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <span className="text-lg">👨‍🏫</span>
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isClosed ? 'bg-gray-400' : 'bg-emerald-400'}`} />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-sm tracking-tight">Admin CSCA</h2>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    {isClosed
                      ? <><span className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> Đã kết thúc</>
                      : isPending
                        ? <><span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> Đang xử lý nội dung của bạn...</>
                        : <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Đang hoạt động</>
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  ticket.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                  ticket.status === 'answered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {ticket.status === 'pending' ? 'ĐANG CHỜ' : ticket.status === 'answered' ? 'ĐÃ TRẢ LỜI' : 'ĐÃ ĐÓNG'}
                </span>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#e0e7ff transparent' }}
          >
            {/* Empty state */}
            {(!ticket.replies || ticket.replies.length === 0) && (
              <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-16">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-3xl flex items-center justify-center">
                    <span className="text-4xl">👨‍🏫</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                    <span className="text-xs">⏳</span>
                  </div>
                </div>
                <div>
                  <p className="font-black text-gray-800 text-lg mb-1">Đang chờ admin phản hồi</p>
                  <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                    Admin sẽ phản hồi trong vòng 2-4 giờ làm việc.<br />Bạn có thể nhắn thêm thông tin bên dưới.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-indigo-500 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                  Nội dung đã được gửi thành công
                </div>
              </div>
            )}

            {/* Message groups by date */}
            {groups.map((group, gi) => (
              <div key={gi} className="space-y-3">
                {/* Date separator */}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                  <span className="text-[10px] font-bold text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-100 shadow-sm tracking-wider">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                </div>

                {/* Messages */}
                {group.items.map((reply, ri) => {
                  const isMe = reply.sender_id === user?.id;
                  const isLast = ri === group.items.length - 1;
                  const nextSame = ri < group.items.length - 1 && group.items[ri + 1].sender_id === reply.sender_id;
                  const showAvatar = !nextSame;

                  return (
                    <div
                      key={reply.id}
                      className={`flex gap-2.5 items-end ${isMe ? 'flex-row-reverse' : ''} ${nextSame ? 'mb-0.5' : 'mb-3'}`}
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 shrink-0">
                        {showAvatar && (
                          <img
                            src={reply.sender_avatar || (
                              reply.is_admin_reply
                                ? 'https://ui-avatars.com/api/?name=CV&background=6366f1&color=fff'
                                : `https://ui-avatars.com/api/?name=H&background=8b5cf6&color=fff`
                            )}
                            alt="avatar"
                            className={`w-8 h-8 rounded-full object-cover ${reply.is_admin_reply ? 'ring-2 ring-indigo-200 shadow-sm shadow-indigo-100' : ''}`}
                          />
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`flex flex-col max-w-[68%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender name (only show first in group) */}
                        {ri === 0 || group.items[ri - 1]?.sender_id !== reply.sender_id ? (
                          <span className={`text-[11px] font-bold mb-1 px-1 ${isMe ? 'text-indigo-500' : 'text-gray-500'}`}>
                            {reply.is_admin_reply ? 'Admin CSCA' : 'Bạn'}
                          </span>
                        ) : null}

                        <div className={`group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all ${
                          isMe
                            ? 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white rounded-br-sm shadow-indigo-200'
                            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-gray-100'
                        } ${isLast && !nextSame ? '' : ''}`}>
                          {reply.content && <p className="whitespace-pre-wrap break-words">{reply.content}</p>}
                          {reply.image_url && (
                            <img
                              src={reply.image_url}
                              alt="Ảnh đính kèm"
                              className="mt-2 rounded-xl max-h-56 cursor-pointer border border-black/10 hover:opacity-90 transition-opacity"
                              onClick={() => window.open(reply.image_url as string, '_blank')}
                            />
                          )}

                          {/* Timestamp tooltip on hover */}
                          <div className={`absolute ${isMe ? 'right-0 -translate-x-full pr-2' : 'left-0 translate-x-full pl-2'} bottom-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap bg-white/90 px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                              {formatTime(reply.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Time shown on last message of group */}
                        {isLast && (
                          <span className={`text-[10px] text-gray-400 mt-1 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                            {formatTime(reply.created_at)}
                            {isMe && <span className="ml-1 text-indigo-400">✓✓</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Typing indicator when user sent a message and admin has not replied yet */}
            {isPending && (ticket.replies?.length || 0) === 0 && (
              <div className="pt-2">
                <TypingDots />
              </div>
            )}

            <div ref={chatEndRef} className="h-2" />
          </div>

          {/* ── Input Area ── */}
          {isClosed ? (
            <div className="px-5 py-4 bg-white/70 backdrop-blur-sm border-t border-gray-100 shrink-0">
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm bg-gray-50 rounded-2xl py-3 border border-dashed border-gray-200">
                <FiMessageSquare size={14} />
                <span>Cuộc tư vấn đã kết thúc · Không thể nhắn tin thêm</span>
              </div>
            </div>
          ) : (
            <div className="px-4 md:px-5 py-3 bg-white/80 backdrop-blur-md border-t border-gray-100 shrink-0">
              {/* Image preview */}
              {image && (
                <div className="mb-2.5 flex items-center gap-2 bg-indigo-50 rounded-2xl px-3 py-2 border border-indigo-100">
                  <img src={URL.createObjectURL(image)} alt="Preview" className="h-10 rounded-xl border border-indigo-200 shadow-sm" />
                  <span className="text-xs text-indigo-600 font-medium flex-1 truncate">{image.name}</span>
                  <button
                    onClick={() => setImage(null)}
                    className="p-1 bg-red-100 hover:bg-red-200 text-red-500 rounded-full transition-colors"
                  >
                    <FiX size={11} />
                  </button>
                </div>
              )}

              <form onSubmit={handleReply} className="flex items-end gap-2">
                {/* Attach image */}
                <label className="p-2.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-2xl cursor-pointer transition-all shrink-0 border border-transparent hover:border-indigo-100">
                  <FiPaperclip size={18} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                </label>

                {/* Text input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (content.trim() || image) handleReply(e as any);
                      }
                    }}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm leading-relaxed text-gray-900 caret-indigo-500 outline-none transition-all placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-950"
                    placeholder="Nhắn cho admin... (Enter để gửi)"
                    rows={1}
                    style={{ maxHeight: '120px', minHeight: '46px' }}
                  />
                </div>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={isSubmitting || (!content.trim() && !image)}
                  className="w-11 h-11 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white rounded-2xl flex items-center justify-center hover:shadow-lg hover:shadow-indigo-300 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none transition-all flex-shrink-0"
                >
                  {isSubmitting
                    ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <FiSend size={16} />
                  }
                </button>
              </form>

              <p className="text-center text-[10px] text-gray-300 mt-2">Shift+Enter để xuống dòng</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
