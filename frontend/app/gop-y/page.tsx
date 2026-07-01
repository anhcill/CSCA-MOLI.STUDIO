"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store/authStore';
import { getCurrentUser } from '@/lib/api/auth';
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
  FiTag,
  FiX,
} from 'react-icons/fi';

type StatusFilter = 'all' | 'pending' | 'answered' | 'closed';
type FeedbackCategory = 'question' | 'issue' | 'feature_request' | 'upgrade_request' | 'experience' | 'other';

const statusMeta: Record<Ticket['status'], { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Đang chờ', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock },
  answered: { label: 'Đã trả lời', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle },
  closed: { label: 'Đã đóng', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: FiX },
};

const categoryMeta: Record<string, { label: string; className: string }> = {
  question: { label: 'Câu hỏi', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  issue: { label: 'Báo lỗi', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  feature_request: { label: 'Đề xuất tính năng', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  upgrade_request: { label: 'Muốn nâng cấp', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  experience: { label: 'Trải nghiệm', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  other: { label: 'Khác', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  general: { label: 'Khác', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  exam_question: { label: 'Câu hỏi bài học', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

const categoryOptions: Array<{ value: FeedbackCategory; label: string; desc: string }> = [
  { value: 'question', label: 'Câu hỏi', desc: 'Thắc mắc khi học hoặc dùng web' },
  { value: 'issue', label: 'Báo lỗi', desc: 'Lỗi đề, lỗi giao diện, lỗi thanh toán' },
  { value: 'feature_request', label: 'Đề xuất tính năng', desc: 'Ý tưởng giúp học tốt hơn' },
  { value: 'upgrade_request', label: 'Muốn nâng cấp', desc: 'Nhu cầu thêm gói, môn, nội dung' },
  { value: 'experience', label: 'Trải nghiệm', desc: 'Chia sẻ cảm nhận khi dùng web' },
  { value: 'other', label: 'Khác', desc: 'Nội dung khác cần admin xem' },
];

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
  const [category, setCategory] = useState<FeedbackCategory>('question');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const loadedUserRef = useRef<number | null>(null);

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
      const data = await qaApi.getMyFeedbackTickets();
      setTickets(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được danh sách góp ý.');
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
    if (authUser?.id && loadedUserRef.current !== authUser.id) {
      loadedUserRef.current = authUser.id;
      loadTickets();
    }
  }, [authUser?.id]);

  const closeForm = () => {
    setShowForm(false);
    setCategory('question');
    setContent('');
    setImage(null);
    setError('');
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() && !image) {
      setError('Vui lòng nhập nội dung góp ý, câu hỏi hoặc đính kèm ảnh.');
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
      await qaApi.createFeedbackTicket({
        category,
        content: content.trim(),
        imageUrl,
        referenceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      closeForm();
      await loadTickets();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gửi góp ý thất bại.');
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
            <p className="mt-2 text-sm text-gray-500">Đăng nhập để gửi câu hỏi, báo lỗi hoặc góp ý cho admin.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700">
              Đăng nhập
            </Link>
          </div>
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
            <h1 className="text-2xl font-black text-gray-900">Góp ý & hỗ trợ</h1>
            <p className="mt-1 text-sm text-gray-500">Gửi câu hỏi, báo lỗi, chia sẻ trải nghiệm hoặc đề xuất nâng cấp để admin xử lý.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700"
          >
            <FiPlus size={16} />
            Gửi góp ý
          </button>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <FiAlertCircle className="mt-0.5 shrink-0" size={17} />
          <p>
            Thả vài dòng ở đây nha, admin sẽ đọc để biết bạn đang kẹt chỗ nào và muốn Moli xịn hơn ra sao.
          </p>
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
            placeholder="Tìm trong nội dung góp ý..."
          />
          <button onClick={loadTickets} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-indigo-600">
            <FiRefreshCw size={16} />
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        {filteredTickets.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <FiMessageSquare className="mx-auto mb-3 text-gray-300" size={44} />
            <h2 className="font-black text-gray-800">Chưa có góp ý phù hợp</h2>
            <p className="mt-1 text-sm text-gray-400">Gửi nội dung mới khi bạn có câu hỏi, thắc mắc hoặc đề xuất nâng cấp.</p>
            <button onClick={() => setShowForm(true)} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">
              Gửi góp ý
            </button>
          </section>
        ) : (
          <div className="grid gap-3">
            {filteredTickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/gop-y/${ticket.id}`}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex gap-4">
                  {ticket.image_url && (
                    <img src={ticket.image_url} alt="Đính kèm" className="hidden h-16 w-16 shrink-0 rounded-xl border border-gray-100 object-cover sm:block" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      <CategoryBadge category={ticket.category} />
                      <span className="text-xs text-gray-400">{formatDate(ticket.updated_at || ticket.created_at)}</span>
                      <span className="ml-auto text-xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                        Mở hội thoại
                      </span>
                    </div>
                    <p className="line-clamp-2 font-semibold text-gray-900">{ticket.content || '(Bạn đã gửi ảnh đính kèm)'}</p>
                    <p className="mt-2 text-xs text-gray-400">{ticket.reply_count || 0} phản hồi</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-4 backdrop-blur-sm sm:items-center sm:py-6">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h2 className="font-black text-gray-900">Gửi góp ý cho admin</h2>
                <p className="mt-0.5 text-xs text-gray-400">Có thể gửi chữ, ảnh minh họa hoặc cả hai.</p>
              </div>
              <button onClick={closeForm} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50">
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={submitQuestion} className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {categoryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategory(option.value)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      category === option.value
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200'
                    }`}
                  >
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-gray-400">{option.desc}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="Nhập câu hỏi, lỗi gặp phải, trải nghiệm khi dùng web hoặc đề xuất bạn muốn admin bổ sung..."
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
                  Đính kèm ảnh minh họa
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
                    {submitting ? 'Đang gửi...' : 'Gửi góp ý'}
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
