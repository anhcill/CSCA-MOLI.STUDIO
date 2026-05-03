"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { qaApi, Ticket } from '@/lib/api/qaApi';
import {
  FiMessageSquare, FiImage, FiSend, FiX, FiCheckCircle,
  FiClock, FiPlus, FiAlertCircle, FiZap
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import Link from 'next/link';
import Header from '@/components/layout/Header';

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-100 text-amber-700">
      <FiClock size={9} /> ĐANG CHỜ
    </span>
  );
  if (status === 'answered') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-100 text-emerald-700">
      <FiCheckCircle size={9} /> CỐ VẤN ĐÃ TRẢ LỜI
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-gray-100 text-gray-500">
      ĐÃ ĐÓNG
    </span>
  );
}

export default function StudentQAPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hỏi đáp cố vấn chỉ dành cho gói PREMIUM
  const isPremium = user?.subscription_tier === 'premium' || user?.role === 'super_admin';
  const isVip = user?.is_vip || user?.subscription_tier === 'vip';

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

      await qaApi.createTicket({ category: 'general', content, imageUrl });
      setContent('');
      setImage(null);
      setShowForm(false);
      loadTickets();
    } catch (error: any) {
      alert(error.response?.data?.message || "Lỗi khi gửi câu hỏi. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <Header />
        <div className="max-w-4xl mx-auto p-8 flex items-center justify-center gap-3 text-gray-500 mt-20">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Đang tải...
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <Header />
        <div className="max-w-lg mx-auto my-20 p-8 bg-white rounded-2xl shadow-xl text-center border border-gray-100">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cần đăng nhập</h2>
          <p className="text-gray-500 text-sm mb-6">Vui lòng đăng nhập để sử dụng tính năng Hỏi đáp cùng Cố vấn.</p>
          <Link href="/login" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
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
        <div className="max-w-5xl mx-auto px-4 py-12">
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
                    <FiAlertCircle size={14} /> Tài khoản VIP của bạn chưa có quyền này — cần nâng lên <strong>Premium</strong>
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
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <span className="p-2.5 bg-blue-100 text-blue-600 rounded-xl"><FiMessageSquare size={22} /></span>
              Hỏi Đáp Cùng Cố Vấn
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Gửi câu hỏi — cố vấn sẽ giải đáp chi tiết trong thời gian sớm nhất!</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5">
            <FiPlus /> Câu hỏi mới
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Tổng câu hỏi', value: tickets.length, color: 'text-gray-900', bg: 'bg-gray-50 border-gray-200' },
            { label: 'Đang chờ', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Đã được trả lời', value: answeredCount, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl border text-center ${s.bg}`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Create form overlay */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FiMessageSquare className="text-blue-600" /> Gửi câu hỏi mới
                </h2>
                <button onClick={() => { setShowForm(false); setContent(''); setImage(null); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <FiX size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nội dung câu hỏi *</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-3.5 rounded-xl border bg-gray-50 border-gray-200 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all focus:bg-white text-sm"
                    placeholder="Mô tả câu hỏi hoặc bài toán bạn cần giải đáp..."
                  />
                </div>

                {image ? (
                  <div className="relative inline-block">
                    <img src={URL.createObjectURL(image)} alt="Preview" className="h-28 rounded-xl border border-gray-200 shadow-sm" />
                    <button type="button" onClick={() => setImage(null)}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600">
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
                    {isSubmitting ? 'Đang gửi...' : <><FiSend /> Gửi cho Cố vấn</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ticket list */}
        {tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="font-bold text-gray-700 text-lg mb-2">Chưa có câu hỏi nào</h3>
            <p className="text-gray-400 text-sm mb-6">Đừng ngại hỏi khi gặp bài khó — cố vấn luôn sẵn sàng giúp bạn!</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
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
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge status={ticket.status} />
                      {ticket.status === 'answered' && (
                        <span className="animate-pulse text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          🔔 Mới
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-gray-900 font-medium text-sm line-clamp-2">{ticket.content || '(Chỉ có hình ảnh)'}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <FiMessageSquare size={11} /> {ticket.reply_count || 0} phản hồi
                      </span>
                      <span className="text-xs text-blue-600 font-semibold group-hover:underline ml-auto">
                        Vào xem →
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
