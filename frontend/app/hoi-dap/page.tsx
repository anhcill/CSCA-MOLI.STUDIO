"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import { canChatInstructor } from '@/lib/utils/permissions';
import { getCurrentUser } from '@/lib/api/auth';
import {
  FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle,
  FiClock, FiPlus, FiAlertCircle, FiZap, FiChevronRight
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import Link from 'next/link';
import Header from '@/components/layout/Header';

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-700">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
      ĐANG CHỜ
    </span>
  );
  if (status === 'answered') return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-700">
      <FiCheckCircle size={12} /> CỐ VẤN ĐÃ TRẢ LỜI
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-500">
      ĐÃ ĐÓNG
    </span>
  );
}

export default function StudentQAPage() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const syncedUser = useAuthStore((s) => s.user);
  const isPremium = canChatInstructor(syncedUser);
  const isVip = syncedUser?.is_vip || syncedUser?.subscription_tier === 'vip';

  useEffect(() => {
    const init = async () => {
      if (!user) { setIsLoading(false); return; }
      try {
        const res = await getCurrentUser();
        if (res?.success && res?.data?.user) {
          useAuthStore.getState().setUser(res.data.user as any);
        }
      } catch {}
      setIsLoading(false);
      if (canChatInstructor(useAuthStore.getState().user)) {
        loadTickets();
      }
    };
    init();
  }, [user]);

  const loadTickets = async () => {
    try {
      const data = await qaApi.getMyTickets();
      setTickets(data);
    } catch {
      console.error("Load tickets error");
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

      await qaApi.createTicket({ category: 'general', content, imageUrl });
      setContent('');
      setImage(null);
      setShowForm(false);
      loadTickets();
    } catch (error: any) {
      alert(error.response?.data?.message || "Lỗi khi gửi câu hỏi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <Header />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <Header />
        <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiMessageSquare size={28} className="text-blue-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Cần đăng nhập</h2>
          <p className="text-gray-500 text-sm mb-6">Vui lòng đăng nhập để sử dụng tính năng Hỏi đáp cùng Cố vấn.</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  // ── Not Premium → Upsell ─────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-orange-50/10">
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-10">
          {/* Hero upsell */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-8 md:p-12 mb-8 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-300/20 rounded-full blur-2xl" />
            <div className="relative flex flex-col md:flex-row items-center gap-8">
              <div className="text-7xl shrink-0">👨‍🏫</div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full text-xs font-bold mb-3">
                  <FaCrown size={11} /> CHỈ DÀNH CHO PREMIUM
                </div>
                <h1 className="text-2xl md:text-3xl font-black mb-3">Hỏi Đáp 1-1 Cùng Cố Vấn CSCA</h1>
                <p className="text-white/85 text-base max-w-xl">
                  Gửi bất kỳ câu hỏi nào — text hoặc hình ảnh đề bài — và nhận lời giải đáp chi tiết 1-1 từ đội ngũ chuyên gia CSCA.
                </p>
                {isVip && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/15 border border-white/30 rounded-xl text-sm font-medium">
                    <FiAlertCircle size={14} /> Tài khoản VIP cần nâng lên <strong>Premium</strong> để sử dụng
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: '💬', title: 'Hỏi không giới hạn', desc: 'Gửi bao nhiêu câu hỏi tùy thích, không bị giới hạn số lượng mỗi ngày.' },
              { icon: '⚡', title: 'Phản hồi nhanh', desc: 'Cố vấn sẽ trả lời trong vòng 2-4 giờ trong giờ hành chính.' },
              { icon: '📸', title: 'Gửi ảnh đề bài', desc: 'Chụp ảnh bài toán khó gửi trực tiếp, cố vấn giải thích từng bước.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">{f.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/vip"
              className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-2xl shadow-xl hover:shadow-orange-500/40 transition-all hover:scale-105 text-lg">
              <FiZap /> Nâng cấp Premium ngay
            </Link>
            <p className="text-gray-400 text-xs mt-4">Kích hoạt ngay lập tức sau thanh toán</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Premium → Full QA UI ─────────────────────────────────────────────────────
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const answeredCount = tickets.filter(t => t.status === 'answered').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <Header />
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <FiMessageSquare size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Hỏi Đáp Cùng Cố Vấn</h1>
              <p className="text-gray-500 text-sm">Cố vấn CSCA sẽ giải đáp chi tiết trong 2-4 giờ</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all">
            <FiPlus size={16} />
            <span>Câu hỏi mới</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Tổng câu hỏi', value: tickets.length, color: 'from-gray-600 to-gray-700', bg: 'bg-gray-50 border-gray-200' },
            { label: 'Đang chờ', value: pendingCount, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Đã trả lời', value: answeredCount, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50 border-emerald-200' },
          ].map((s, i) => (
            <div key={i} className={`p-5 rounded-2xl border text-center ${s.bg}`}>
              <p className={`text-3xl font-black bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
              <p className="text-sm text-gray-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Create form overlay */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FiMessageSquare size={16} className="text-blue-600" />
                  </div>
                  Gửi câu hỏi mới
                </h2>
                <button onClick={() => { setShowForm(false); setContent(''); setImage(null); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <FiX size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nội dung câu hỏi *</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3.5 rounded-xl border bg-gray-50 border-gray-200 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all focus:bg-white focus:border-blue-300 text-sm"
                    placeholder="Mô tả câu hỏi hoặc bài toán bạn cần giải đáp..."
                  />
                </div>

                {image ? (
                  <div className="relative inline-block">
                    <img src={URL.createObjectURL(image)} alt="Preview" className="h-28 rounded-xl border border-gray-200 shadow-sm" />
                    <button type="button" onClick={() => setImage(null)}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors">
                      <FiX size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50 text-blue-600 font-medium transition-colors text-sm">
                    <FiImage size={18} />
                    <span>Đính kèm ảnh đề bài (nếu có)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && setImage(e.target.files[0])} />
                  </label>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setContent(''); setImage(null); }}
                    className="flex-1 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors text-sm">Hủy</button>
                  <button type="submit" disabled={isSubmitting || (!content && !image)}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-sm">
                    {isSubmitting ? 'Đang gửi...' : <><FiSend size={14} /> Gửi cho Cố vấn</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ticket list */}
        {tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiMessageSquare size={28} className="text-blue-400" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg mb-2">Chưa có câu hỏi nào</h3>
            <p className="text-gray-400 text-sm mb-6">Đừng ngại hỏi khi gặp bài khó — cố vấn luôn sẵn sàng giúp bạn!</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25">
              <FiPlus /> Đặt câu hỏi đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(ticket => (
              <Link key={ticket.id} href={`/hoi-dap/${ticket.id}`}
                className={`block p-5 bg-white rounded-2xl border transition-all hover:shadow-md group ${
                  ticket.status === 'answered' ? 'border-emerald-200 hover:border-emerald-300' : 'border-gray-100 hover:border-blue-200'
                }`}>
                <div className="flex items-start gap-4">
                  {ticket.image_url && (
                    <img src={ticket.image_url} alt="Problem" className="w-16 h-16 object-cover rounded-xl border border-gray-100 shrink-0 hidden sm:block" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                      <StatusBadge status={ticket.status} />
                      {ticket.status === 'answered' && (
                        <span className="animate-pulse text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          🔔 Mới
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-gray-900 font-medium text-sm line-clamp-2 mb-2">{ticket.content || '(Chỉ có hình ảnh)'}</p>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <FiMessageSquare size={12} /> {ticket.reply_count || 0} phản hồi
                      </span>
                      <span className="ml-auto text-xs text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Vào xem <FiChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
