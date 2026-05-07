'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiMessageSquare, FiSearch, FiChevronRight, FiSend, FiSmile, FiImage } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';
import ChatPanel from '@/components/forum/ChatPanel';
import {
  initSocket, onNewMessage, onUnreadCountUpdate,
  joinConversation, leaveConversation
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

  // ── Load conversations (only once on mount) ──────────────────────────────
  const loadConversations = useCallback(async (pageNum: number) => {
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
    } catch {
      console.error('Load conversations error:');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    loadConversations(1);
  }, [isAuthenticated, loadConversations]);

  // ── Socket: real-time update WITHOUT full reload ─────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    initSocket();

    const unsubMessage = onNewMessage((msg: any) => {
      // Optimistic update: update conversation in place, no full fetch
      setConversations(prev => {
        const senderId = msg.sender_id;
        const myId = user?.id;

        if (senderId === myId) {
          // Tin nhắn tôi gửi → cập nhật conversation của partner
          return prev.map(c =>
            c.partner_id === msg.receiver_id
              ? { ...c, last_message_content: msg.content, last_message_at: msg.created_at, last_message_id: msg.id, is_read: true }
              : c
          );
        } else {
          // Tin nhắn từ partner → cập nhật conversation
          return prev.map(c =>
            c.partner_id === senderId
              ? { ...c, last_message_content: msg.content, last_message_at: msg.created_at, last_message_id: msg.id, is_read: false, unread_count: c.unread_count + 1 }
              : c
          );
        }
      });
    });

    const unsubUnread = onUnreadCountUpdate(() => {
      // Mark current chat partner's conversation as read
      if (selectedPartner) {
        setConversations(prev => prev.map(c =>
          c.partner_id === selectedPartner
            ? { ...c, is_read: true, unread_count: 0 }
            : c
        ));
      }
    });

    return () => {
      unsubMessage();
      unsubUnread();
    };
  }, [isAuthenticated, user?.id, selectedPartner]);

  // Join/leave conversation on partner change
  useEffect(() => {
    if (selectedPartner) {
      joinConversation(selectedPartner);
      // Mark as read optimistically
      setConversations(prev => prev.map(c =>
        c.partner_id === selectedPartner
          ? { ...c, is_read: true, unread_count: 0 }
          : c
      ));
    }
    return () => {
      if (selectedPartner) leaveConversation(selectedPartner);
    };
  }, [selectedPartner]);

  const getAvatar = (c: Conversation) =>
    c.avatar_url || c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=random&size=80`;

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'vừa';
    if (diff < 3600) return `${Math.floor(diff / 60)}p`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      <div className="flex flex-1 max-w-6xl mx-auto w-full h-full overflow-hidden">

        {/* ── Conversation List ── */}
        <div className={`${selectedPartner ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 shrink-0 bg-white/80 backdrop-blur-xl border-r border-violet-100/50`}>
          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-violet-100/50">
            <button
              onClick={() => router.push('/forum')}
              className="w-9 h-9 rounded-2xl bg-violet-100 hover:bg-violet-200 flex items-center justify-center text-violet-600 transition-all active:scale-90"
            >
              <FiChevronRight size={16} className="rotate-180" />
            </button>
            <div>
              <h1 className="font-black text-gray-900 text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Tin nhắn
              </h1>
              <p className="text-[11px] text-gray-400">Gen Z Chat</p>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-300" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-violet-50/70 border border-violet-100 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-violet-300"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto pb-safe">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-13 h-13 rounded-2xl bg-violet-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-violet-100 rounded-xl w-3/4" />
                      <div className="h-3 bg-violet-50 rounded-xl w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-center px-6">
                <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                  <FiMessageSquare size={28} className="text-violet-300" />
                </div>
                <p className="font-bold text-gray-500 text-sm">Chưa có cuộc trò chuyện nào</p>
                <p className="text-xs text-gray-400 mt-1">Bắt đầu nhắn tin với mọi người trên forum</p>
              </div>
            ) : (
              <>
                {filtered.map((conv, idx) => (
                  <button
                    key={conv.partner_id}
                    onClick={() => handleSelect(conv.partner_id)}
                    className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-violet-50/60 active:bg-violet-100/40 transition-all border-b border-gray-50/60 text-left group animate-in fade-in slide-in-from-bottom-2 ${
                      selectedPartner === conv.partner_id ? 'bg-violet-50/80 border-l-3 border-l-violet-500' : ''
                    }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={getAvatar(conv)}
                        alt={conv.full_name}
                        className="w-13 h-13 rounded-2xl object-cover ring-2 ring-violet-100 group-hover:ring-violet-200 transition-all shadow-sm"
                      />
                      {!conv.is_read && conv.sender_id !== user?.id && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-75 duration-200">
                          <span className="text-white text-[9px] font-black">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-bold truncate ${
                          !conv.is_read && conv.sender_id !== user?.id ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {conv.full_name}
                        </span>
                        <span className={`text-[10px] shrink-0 ${!conv.is_read && conv.sender_id !== user?.id ? 'text-violet-500 font-semibold' : 'text-gray-400'}`}>
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${
                        !conv.is_read && conv.sender_id !== user?.id
                          ? 'text-gray-800 font-semibold'
                          : conv.sender_id === user?.id
                            ? 'text-violet-500 font-medium'
                            : 'text-gray-400'
                      }`}>
                        {conv.sender_id === user?.id ? '✓ ' : ''}{conv.last_message_content}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!conv.is_read && conv.sender_id !== user?.id && (
                      <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 shadow-sm shadow-violet-200" />
                    )}
                  </button>
                ))}

                {hasMore && (
                  <button
                    onClick={() => loadConversations(page + 1)}
                    disabled={loadingMore}
                    className="w-full py-3.5 text-center text-xs font-bold text-violet-500 hover:text-violet-700 hover:bg-violet-50 transition-colors active:bg-violet-100"
                  >
                    {loadingMore ? 'Loading...' : 'Tải thêm ↓'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className={`${selectedPartner ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-white/40 backdrop-blur-xl min-h-0`}>
          {selectedPartner ? (
            <ChatPanel
              partnerId={selectedPartner}
              partnerName={selectedConv?.full_name || 'User'}
              partnerAvatar={selectedConv ? getAvatar(selectedConv) : ''}
              onBack={() => { setSelectedPartner(null); router.replace('/tin-nhan', undefined); }}
              onNewMessageReceived={() => {
                // Optimistic update without full reload
                setConversations(prev => {
                  const updated = prev.map(c =>
                    c.partner_id === selectedPartner
                      ? { ...c, is_read: true, last_message_at: new Date().toISOString() }
                      : c
                  );
                  // Move to top
                  const conv = updated.find(c => c.partner_id === selectedPartner);
                  if (conv) {
                    return [conv, ...updated.filter(c => c.partner_id !== selectedPartner)];
                  }
                  return updated;
                });
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-6 shadow-xl shadow-violet-100/50">
                <FiMessageSquare size={40} className="text-violet-400" />
              </div>
              <h2 className="text-xl font-black text-gray-800 mb-2">Gen Z Chat 💬</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Chọn một cuộc trò chuyện để bắt đầu nhắn tin với mọi người
              </p>
              <div className="mt-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">Online • Không reload khi nhắn tin</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
