'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiMessageSquare, FiSearch, FiChevronRight, FiHelpCircle, FiShield } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import ChatPanel from '@/components/forum/ChatPanel';
import { getConversations, Conversation } from '@/lib/api/messages';

const LIMIT = 20;

const isAdminRole = (role?: string | null) =>
  ['admin', 'super_admin', 'forum_admin', 'exam_admin', 'content_admin', 'user_admin', 'roadmap_admin'].includes(String(role || '').toLowerCase());

function AminBadge() {
  return (
    <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
      Amin
    </span>
  );
}

export default function HoTroMessagesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    loadConversations(1);
  }, [isAuthenticated]);

  const loadConversations = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const res = await getConversations(pageNum, LIMIT);
      if (res.success && res.data) {
        const convs: Conversation[] = res.data.conversations || [];
        setConversations(prev => pageNum === 1 ? convs : [...prev, ...convs]);
        setHasMore(pageNum < (res.data.pagination?.totalPages || 1));
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Load conversations error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) loadConversations(page + 1);
  };

  // Poll every 15s
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (!selectedPartner) loadConversations(1);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedPartner]);

  const getAvatar = (c: Conversation) =>
    c.avatar_url || c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=random&size=80`;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)}p`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}ngày`;
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  };

  const filtered = conversations.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  const selectedConv = conversations.find(c => c.partner_id === selectedPartner);

  const handleSelect = (partnerId: number) => {
    setSelectedPartner(partnerId);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <div className="flex flex-1 max-w-5xl mx-auto w-full p-4 gap-4" style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* ── Conversation List ── */}
        <div className={`${selectedPartner ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}>
          <div className="p-4 border-b border-gray-100">
            <h1 className="font-black text-lg text-gray-900 flex items-center gap-2">
              <FiMessageSquare className="text-violet-600" /> Tin nhắn hỗ trợ
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Hỏi đáp và trao đổi cùng đội ngũ hỗ trợ</p>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              />
            </div>
          </div>

          {/* Info banner */}
          <div className="mx-4 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
            <FiHelpCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng giúp đỡ bạn 24/7. Nhắn tin để được giải đáp nhanh nhất!
            </p>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-2 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <FiMessageSquare size={32} className="mb-2 opacity-30" />
                <p className="text-sm font-semibold">Chưa có cuộc trò chuyện nào</p>
                <p className="text-xs mt-1">Bắt đầu nhắn tin với đội ngũ hỗ trợ</p>
              </div>
            ) : (
              <>
                {filtered.map(conv => (
                  <button
                    key={conv.partner_id}
                    onClick={() => handleSelect(conv.partner_id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${
                      selectedPartner === conv.partner_id ? 'bg-violet-50' : ''
                    } ${!conv.is_read && conv.sender_id !== user?.id ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={getAvatar(conv)}
                        alt={conv.full_name}
                        className="w-11 h-11 rounded-2xl object-cover"
                      />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-[9px] font-black">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`truncate text-sm font-bold ${!conv.is_read && conv.sender_id !== user?.id ? 'text-gray-900' : 'text-gray-700'}`}>
                            {conv.full_name}
                          </span>
                          {isAdminRole(conv.role) && <AminBadge />}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${!conv.is_read && conv.sender_id !== user?.id ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                        {conv.sender_id === user?.id ? 'Bạn: ' : ''}{conv.last_message_content}
                      </p>
                    </div>
                    {!conv.is_read && conv.sender_id !== user?.id && (
                      <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                    )}
                  </button>
                ))}

                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full py-3 text-center text-xs font-bold text-violet-600 hover:bg-violet-50 transition-colors"
                  >
                    {loadingMore ? 'Đang tải...' : 'Tải thêm'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className={`${selectedPartner ? 'flex' : 'hidden md:hidden'} flex-1 flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-0`}>
          {selectedPartner ? (
            <ChatPanel
              partnerId={selectedPartner}
              partnerName={selectedConv?.full_name || ''}
              partnerAvatar={selectedConv ? getAvatar(selectedConv) : ''}
              partnerRole={selectedConv?.role}
              onBack={() => setSelectedPartner(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FiShield size={56} className="mb-3 opacity-20" />
              <p className="font-bold text-base">Hỗ trợ trực tuyến</p>
              <p className="text-sm mt-1">Chọn một cuộc trò chuyện để bắt đầu</p>
              <div className="mt-6 flex flex-col gap-2">
                <a href="/ho-tro" className="flex items-center gap-2 text-xs text-violet-500 hover:text-violet-700 font-semibold">
                  <FiChevronRight size={14} /> Xem trang hỗ trợ chung
                </a>
                <a href="/cau-hoi-thuong-gap" className="flex items-center gap-2 text-xs text-violet-500 hover:text-violet-700 font-semibold">
                  <FiChevronRight size={14} /> Câu hỏi thường gặp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 py-3 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-3">
        <FiHelpCircle className="text-violet-600" size={22} />
        <div>
          <h1 className="font-black text-gray-900">Hỗ trợ tin nhắn</h1>
          <p className="text-[11px] text-gray-400">Kênh liên lạc với đội ngũ hỗ trợ</p>
        </div>
      </div>
    </header>
  );
}
