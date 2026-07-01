"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store/authStore';
import { getCurrentUser } from '@/lib/api/auth';
import { canChatInstructor } from '@/lib/utils/permissions';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiImage,
  FiMessageSquare,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiX,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

type StatusFilter = 'all' | 'pending' | 'answered' | 'closed';

const statusMeta: Record<Ticket['status'], { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Đang chờ', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock },
  answered: { label: 'Đã trả lời', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle },
  closed: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: FiX },
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

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudentQAPage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);

  const isPremium = canChatInstructor(authUser);
  const isVip = authUser?.is_vip || authUser?.subscription_tier === 'vip';

  const counts = useMemo(() => ({
    all: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    answered: tickets.filter((ticket) => ticket.status === 'answered').length,
    closed: tickets.filter((ticket) => ticket.status === 'closed').length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesQuery = !keyword || [ticket.content, ticket.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
      return matchesStatus && matchesQuery;
    });
  }, [tickets, query, statusFilter]);

  const loadTickets = async () => {
    try {
      setError('');
      const data = await qaApi.getMyTickets();
      setTickets(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được danh sách câu hỏi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!authUser) {
        setLoading(false);
        return;
      }
      try {
        const res = await getCurrentUser();
        if (res?.success && res?.data?.user) setUser(res.data.user as any);
      } catch {}
      setLoading(false);
    };
    init();
  }, [authUser?.id, setUser]);

  useEffect(() => {
    if (isPremium && !loadedRef.current) {
      loadedRef.current = true;
      loadTickets();
    }
  }, [isPremium]);

  const closeForm = () => {
    setShowForm(false);
    setContent('');
    setImage(null);
    setError('');
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() && !image) {
      setError('Vui lòng nhập nội dung hoặc đính kèm ảnh câu hỏi.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let imageUrl = '';
      if (image) {
        const uploadRes = await qaApi.uploadImage(image);
        imageUrl = uploadRes.data?.url || uploadRes.url;
      }
      await qaApi.createTicket({
        category: 'exam_question',
        content: content.trim(),
        imageUrl,
        referenceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      closeForm();
      await loadTickets();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gửi câu hỏi thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex h-[60vh] items-center justify-center">
          <FiRefreshCw className="animate-spin text-3xl text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <FiMessageSquare className="mx-auto mb-4 text-indigo-500" size={42} />
            <h1 className="text-xl font-black text-gray-900">Cần đăng nhập</h1>
            <p className="mt-2 text-sm text-gray-500">Đăng nhập để gửi câu hỏi 1:1 cho giảng viên.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700">
              Đăng nhập
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-10">
          <section className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  <FaCrown size={12} />
                  Dành cho tài khoản Pre
                </div>
                <h1 className="text-2xl font-black text-gray-900">Hỏi giảng viên 1:1</h1>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  Góc hỏi bài riêng cho gói Pre: gửi câu hỏi hoặc ảnh đề, giảng viên sẽ trả lời trong một hội thoại riêng.
                </p>
                {isVip && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                    <FiAlertCircle size={15} />
                    Bạn đang dùng VIP, cần nâng lên Pre để dùng tính năng này.
                  </p>
                )}
              </div>
              <Link href="/vip" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-white hover:bg-amber-600">
                <FaCrown size={14} />
                Nâng cấp Pre
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Hỏi giảng viên</h1>
            <p className="mt-1 text-sm text-gray-500">Theo dõi toàn bộ câu hỏi 1:1 của bạn với giảng viên.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
          >
            <FiPlus size={16} />
            Câu hỏi mới
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            { key: 'all', label: 'Tất cả', count: counts.all },
            { key: 'pending', label: 'Đang chờ', count: counts.pending },
            { key: 'answered', label: 'Đã trả lời', count: counts.answered },
            { key: 'closed', label: 'Đã đóng', count: counts.closed },
          ] as { key: StatusFilter; label: string; count: number }[]).map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                statusFilter === item.key
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <p className="text-2xl font-black">{item.count}</p>
              <p className="mt-1 text-xs font-bold">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
          <FiSearch className="text-gray-400" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 text-sm outline-none"
            placeholder="Tìm trong nội dung câu hỏi..."
          />
          <button onClick={loadTickets} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-indigo-600">
            <FiRefreshCw size={16} />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        {filteredTickets.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <FiMessageSquare className="mx-auto mb-3 text-gray-300" size={44} />
            <h2 className="font-black text-gray-800">Chưa có câu hỏi phù hợp</h2>
            <p className="mt-1 text-sm text-gray-400">Tạo câu hỏi mới khi bạn cần giảng viên giải thích thêm.</p>
            <button onClick={() => setShowForm(true)} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">
              Đặt câu hỏi
            </button>
          </section>
        ) : (
          <div className="grid gap-3">
            {filteredTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/hoi-dap/${ticket.id}`}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex gap-4">
                  {ticket.image_url && (
                    <img src={ticket.image_url} alt="Đính kèm" className="hidden h-16 w-16 shrink-0 rounded-xl border border-gray-100 object-cover sm:block" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      <span className="text-xs text-gray-400">{formatDate(ticket.updated_at || ticket.created_at)}</span>
                      <span className="ml-auto text-xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Mở hội thoại
                      </span>
                    </div>
                    <p className="line-clamp-2 font-semibold text-gray-900">{ticket.content || '(Bạn đã gửi ảnh đề bài)'}</p>
                    <p className="mt-2 text-xs text-gray-400">{ticket.reply_count || 0} phản hồi</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-black text-gray-900">Gửi câu hỏi cho giảng viên</h2>
                <p className="mt-0.5 text-xs text-gray-400">Có thể gửi chữ, ảnh đề bài hoặc cả hai.</p>
              </div>
              <button onClick={closeForm} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={submitQuestion} className="space-y-4 p-5">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="Nhập câu hỏi, phần chưa hiểu, hoặc yêu cầu giảng viên giải thích..."
              />

              {image ? (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <img src={URL.createObjectURL(image)} alt="Preview" className="h-16 w-16 rounded-lg border border-indigo-200 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-indigo-800">{image.name}</p>
                    <p className="text-xs text-indigo-500">Ảnh đính kèm</p>
                  </div>
                  <button type="button" onClick={() => setImage(null)} className="rounded-full bg-white p-2 text-rose-500">
                    <FiX size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm font-bold text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                  <FiImage size={18} />
                  Đính kèm ảnh đề bài
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] || null)} />
                </label>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={closeForm} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">
                  Hủy
                </button>
                <button
                  disabled={submitting || (!content.trim() && !image)}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  type="submit"
                >
                  <span className="inline-flex items-center gap-2">
                    {submitting ? <FiRefreshCw className="animate-spin" size={15} /> : <FiSend size={15} />}
                    {submitting ? 'Đang gửi...' : 'Gửi câu hỏi'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
