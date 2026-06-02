"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import {
  FiArchive,
  FiChevronLeft,
  FiCheckCircle,
  FiClock,
  FiImage,
  FiInbox,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTag,
  FiTrash2,
  FiX,
} from 'react-icons/fi';

type StatusFilter = 'all' | 'pending' | 'answered' | 'closed';

const statusMeta: Record<Ticket['status'], { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Chờ trả lời', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock },
  answered: { label: 'Đã trả lời', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle },
  closed: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: FiArchive },
};

const categoryMeta: Record<string, { label: string; className: string }> = {
  question: { label: 'Câu hỏi', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  issue: { label: 'Báo lỗi', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  feature_request: { label: 'Đề xuất tính năng', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  upgrade_request: { label: 'Muốn nâng cấp', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  experience: { label: 'Trải nghiệm', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  other: { label: 'Khác', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  general: { label: 'Khác', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const meta = statusMeta[status] || statusMeta.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

function CategoryBadge({ category }: { category?: string }) {
  const meta = categoryMeta[category || 'other'] || categoryMeta.other;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
      <FiTag size={12} />
      {meta.label}
    </span>
  );
}

function formatTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function authorInitial(ticket: Ticket) {
  return (ticket.author_name || ticket.author_email || 'H').charAt(0).toUpperCase();
}

export default function AdminFeedbackDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => ({
    all: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    answered: tickets.filter((ticket) => ticket.status === 'answered').length,
    closed: tickets.filter((ticket) => ticket.status === 'closed').length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tickets;
    return tickets.filter((ticket) =>
      [ticket.author_name, ticket.author_email, ticket.content, ticket.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [tickets, query]);

  const messages = useMemo(() => {
    if (!selectedTicket) return [];
    return [
      {
        id: `ticket-${selectedTicket.id}`,
        sender_id: selectedTicket.user_id,
        is_admin_reply: false,
        content: selectedTicket.content,
        image_url: selectedTicket.image_url,
        created_at: selectedTicket.created_at,
        sender_name: selectedTicket.author_name || 'Người dùng',
        sender_avatar: selectedTicket.author_avatar,
      },
      ...(selectedTicket.replies || []),
    ];
  }, [selectedTicket]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const loadTickets = async (keepSelection = true) => {
    setLoadError('');
    setLoading(true);
    try {
      const data = await qaApi.adminGetAllTickets(statusFilter, 'feedback');
      setTickets(data);

      if (keepSelection && selectedTicket) {
        const stillVisible = data.some((ticket) => ticket.id === selectedTicket.id);
        if (stillVisible) {
          const detail = await qaApi.adminGetTicketDetail(selectedTicket.id);
          setSelectedTicket(detail);
        } else {
          setSelectedTicket(null);
        }
      }
    } catch (error: any) {
      setLoadError(error.response?.data?.message || 'Không tải được danh sách góp ý.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets(false);
  }, [statusFilter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedTicket?.id]);

  const selectTicket = async (ticket: Ticket) => {
    try {
      const detail = await qaApi.adminGetTicketDetail(ticket.id);
      setSelectedTicket(detail);
      setContent('');
      setImage(null);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Không mở được hội thoại.');
    }
  };

  const refreshSelectedTicket = async () => {
    if (!selectedTicket) return;
    const detail = await qaApi.adminGetTicketDetail(selectedTicket.id);
    setSelectedTicket(detail);
  };

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || selectedTicket.status === 'closed') return;
    if (!content.trim() && !image) return;

    const currentContent = content.trim();
    const currentImage = image;
    const previewUrl = currentImage ? URL.createObjectURL(currentImage) : null;

    setSelectedTicket((ticket) => ticket ? {
      ...ticket,
      status: 'answered',
      replies: [
        ...(ticket.replies || []),
        {
          id: Date.now(),
          ticket_id: ticket.id,
          sender_id: 0,
          is_admin_reply: true,
          content: currentContent,
          image_url: previewUrl,
          created_at: new Date().toISOString(),
          sender_name: 'Admin CSCA',
        },
      ],
    } : ticket);
    setContent('');
    setImage(null);
    setIsSubmitting(true);

    try {
      let imageUrl = '';
      if (currentImage) {
        const uploadRes = await qaApi.uploadImage(currentImage);
        imageUrl = uploadRes.data?.url || uploadRes.url;
      }

      await qaApi.adminReplyTicket(selectedTicket.id, { content: currentContent, imageUrl });
      await Promise.all([loadTickets(true), refreshSelectedTicket()]);
      showToast('Đã gửi phản hồi cho người dùng.');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Gửi phản hồi thất bại.');
      await refreshSelectedTicket().catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (status: Ticket['status']) => {
    if (!selectedTicket) return;
    try {
      await qaApi.adminChangeStatus(selectedTicket.id, status);
      await loadTickets(true);
      showToast(status === 'closed' ? 'Đã đóng hội thoại.' : 'Đã cập nhật trạng thái.');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Không cập nhật được trạng thái.');
    }
  };

  const deleteTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm('Xóa vĩnh viễn hội thoại này?')) return;
    try {
      await qaApi.adminDeleteTicket(selectedTicket.id);
      setSelectedTicket(null);
      await loadTickets(false);
      showToast('Đã xóa hội thoại.');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Không xóa được hội thoại.');
    }
  };

  return (
    <AdminLayout title="Góp Ý Người Dùng" description="Quản lý câu hỏi, báo lỗi, trải nghiệm và yêu cầu nâng cấp">
      <div className="relative h-[calc(100dvh-132px)] min-h-[560px] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {toast && (
          <div className="absolute right-4 top-4 z-30 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        )}

        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[360px_1fr]">
          <aside className={`${selectedTicket ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-col bg-gray-50 lg:border-r lg:border-gray-200`}>
            <div className="border-b border-gray-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { key: 'pending', label: 'Chờ', count: counts.pending },
                  { key: 'answered', label: 'Đã đáp', count: counts.answered },
                  { key: 'closed', label: 'Đóng', count: counts.closed },
                  { key: 'all', label: 'Tất cả', count: counts.all },
                ] as { key: StatusFilter; label: string; count: number }[]).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setStatusFilter(item.key)}
                    className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                      statusFilter === item.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {item.label}
                    <span className="ml-1 opacity-75">{item.count}</span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="Tìm người dùng, email, nội dung..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <FiInbox size={16} />
                {filteredTickets.length} góp ý
              </div>
              <button
                onClick={() => loadTickets(true)}
                className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-indigo-600"
                title="Làm mới"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadError ? (
                <div className="p-6 text-center text-sm font-semibold text-rose-600">{loadError}</div>
              ) : loading && tickets.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">Đang tải...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Không có góp ý phù hợp.</div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => selectTicket(ticket)}
                    className={`w-full border-b border-gray-100 p-4 text-left transition-colors ${
                      selectedTicket?.id === ticket.id ? 'bg-white' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-black text-indigo-700">
                        {authorInitial(ticket)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {ticket.author_name || ticket.author_email || 'Người dùng'}
                          </p>
                          <span className="shrink-0 text-[11px] text-gray-400">{formatTime(ticket.updated_at || ticket.created_at)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                          {ticket.content || '(Người dùng gửi ảnh)'}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge status={ticket.status} />
                            <CategoryBadge category={ticket.category} />
                          </div>
                          <span className="text-xs text-gray-400">{ticket.reply_count || 0} tin</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className={`${selectedTicket ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col bg-slate-50`}>
            {!selectedTicket ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-400">
                <FiInbox size={54} className="mb-3 opacity-40" />
                <p className="text-sm font-semibold">Chọn một góp ý để phản hồi người dùng.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 lg:hidden"
                      aria-label="Quay lai danh sach"
                    >
                      <FiChevronLeft size={18} />
                    </button>
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h2 className="truncate text-base font-black text-gray-900">
                        {selectedTicket.author_name || selectedTicket.author_email || 'Người dùng'}
                      </h2>
                      <StatusBadge status={selectedTicket.status} />
                      <CategoryBadge category={selectedTicket.category} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedTicket.author_email || 'Không có email'} · Tạo lúc {formatTime(selectedTicket.created_at)}
                    </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {selectedTicket.status === 'closed' ? (
                      <button
                        onClick={() => changeStatus('pending')}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        Mở lại
                      </button>
                    ) : (
                      <button
                        onClick={() => changeStatus('closed')}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
                      >
                        Đóng
                      </button>
                    )}
                    <button
                      onClick={deleteTicket}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <span className="inline-flex items-center gap-1"><FiTrash2 size={13} /> Xóa</span>
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
                  <div className="mx-auto max-w-4xl space-y-4">
                    {messages.map((message) => {
                      const isAdmin = message.is_admin_reply;
                      return (
                        <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[76%] ${
                            isAdmin
                              ? 'rounded-br-md bg-indigo-600 text-white'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'
                          }`}>
                            <div className={`mb-1 text-xs font-bold ${isAdmin ? 'text-indigo-100' : 'text-gray-500'}`}>
                              {isAdmin ? 'Admin CSCA' : selectedTicket.author_name || 'Người dùng'}
                            </div>
                            {message.content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>}
                            {message.image_url && (
                              <img
                                src={message.image_url}
                                alt="Đính kèm"
                                className="mt-3 max-h-80 cursor-pointer rounded-xl border border-black/10 object-contain"
                                onClick={() => window.open(message.image_url || '', '_blank', 'noopener,noreferrer')}
                              />
                            )}
                            <div className={`mt-2 text-[11px] ${isAdmin ? 'text-indigo-100' : 'text-gray-400'}`}>
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                <div className="border-t border-gray-200 bg-white p-3 sm:p-4">
                  {selectedTicket.status === 'closed' ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-3 text-center text-sm font-semibold text-gray-400">
                      Hội thoại đã đóng. Mở lại để tiếp tục trả lời.
                    </div>
                  ) : (
                    <form onSubmit={submitReply} className="mx-auto max-w-4xl">
                      {image && (
                        <div className="mb-3 inline-flex max-w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                          <img src={URL.createObjectURL(image)} alt="Preview" className="h-12 rounded-lg border border-indigo-200 object-cover" />
                          <span className="min-w-0 max-w-[180px] truncate text-xs font-semibold text-indigo-700 sm:max-w-[260px]">{image.name}</span>
                          <button type="button" onClick={() => setImage(null)} className="rounded-full bg-white p-1 text-rose-500">
                            <FiX size={13} />
                          </button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100">
                          <FiImage size={18} />
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] || null)} />
                        </label>
                        <textarea
                          value={content}
                          onChange={(event) => setContent(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              if (content.trim() || image) submitReply(event);
                            }
                          }}
                          rows={1}
                          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:bg-white"
                          placeholder="Phản hồi người dùng... Enter để gửi, Shift+Enter để xuống dòng"
                        />
                        <button
                          disabled={isSubmitting || (!content.trim() && !image)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                          type="submit"
                        >
                          {isSubmitting ? <FiRefreshCw className="animate-spin" size={17} /> : <FiSend size={17} />}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}
