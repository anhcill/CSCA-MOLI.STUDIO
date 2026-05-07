'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiMessageSquare, FiSearch, FiChevronRight } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';
import ChatPanel from '@/components/forum/ChatPanel';
import {
  initSocket, onNewMessage, onUnreadCountUpdate
} from '@/lib/socket';

interface Conversation {
  partner_id: number;
  username: string;
  full_name: string;
  avatar: string | null;
  avatar_url: string | null;
  role: string;
  is_vip: boolean;
  subscription_tier: string | null;
  last_message_id: number;
  last_message_content: string;
  is_read: boolean;
  sender_id: number;
  last_message_at: string;
  unread_count: number;
}

const LIMIT = 20;

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<number | null>(
    searchParams.get('to') ? parseInt(searchParams.get('to')!) : null
  );
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
      const res = await axios.get('/messages', {
        params: { page: pageNum, limit: LIMIT }
      });
      const data = res.data.data;
      const convs: Conversation[] = data?.conversations || [];
      setConversations(prev => pageNum === 1 ? convs : [...prev, ...convs]);
      setHasMore(pageNum < (data?.pagination?.totalPages || 1));
      setPage(pageNum);
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

  // Socket: refresh conversation list on new message + init socket
  useEffect(() => {
    if (!isAuthenticated) return;

    initSocket();

    const unsubMessage = onNewMessage((msg: unknown) => {
      // Refresh conversation list when a new message arrives
      if (!selectedPartner) {
        loadConversations(1);
      }
    });

    const unsubUnread = onUnreadCountUpdate(() => {
      loadConversations(1);
    });

    return () => {
      unsubMessage();
      unsubUnread();
    };
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
    router.replace(`/tin-nhan?to=${partnerId}`, undefined);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header />

      <div className="flex flex-1 max-w-5xl mx-auto w-full p-4 gap-4" style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* ── Conversation List ── */}
        <div className={`${selectedPartner ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`}>
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={() => router.push('/forum')}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors shrink-0"
            >
              <FiChevronRight size={16} className="rotate-180" />
            </button>
            <h1 className="font-black text-lg text-gray-900 flex items-center gap-2">
              <FiMessageSquare className="text-violet-600" /> Tin nhắn
            </h1>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm người..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
              />
            </div>
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
                <p className="text-sm font-semibold">Chưa có cuộc trò chuyện</p>
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
                        <span className={`text-sm font-bold truncate ${!conv.is_read && conv.sender_id !== user?.id ? 'text-gray-900' : 'text-gray-700'}`}>
                          {conv.full_name}
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
              partnerName={selectedConv?.full_name || 'Người dùng'}
              partnerAvatar={selectedConv ? getAvatar(selectedConv) : `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConv?.full_name || 'User')}&background=random&size=80`}
              onBack={() => { setSelectedPartner(null); router.replace('/tin-nhan', undefined); }}
              onNewMessageReceived={() => {
                if (!selectedPartner) return;
                loadConversations(1);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FiMessageSquare size={56} className="mb-3 opacity-20" />
              <p className="font-bold text-base">Chọn cuộc trò chuyện</p>
              <p className="text-sm mt-1">Chọn một người để bắt đầu nhắn tin</p>
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
        <FiMessageSquare className="text-violet-600" size={22} />
        <div>
          <h1 className="font-black text-gray-900">Tin nhắn</h1>
          <p className="text-[11px] text-gray-400">Trao đổi học tập cùng cộng đồng</p>
        </div>
      </div>
    </header>
  );
}
