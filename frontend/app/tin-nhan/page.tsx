'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiMessageSquare, FiSearch, FiChevronRight, FiUsers } from 'react-icons/fi';
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

  useEffect(() => {
    if (!isAuthenticated) return;

    initSocket();

    const unsubMessage = onNewMessage((msg: any) => {
      setConversations(prev => {
        const senderId = msg.sender_id;
        const myId = user?.id;

        if (senderId === myId) {
          return prev.map(c =>
            c.partner_id === msg.receiver_id
              ? { ...c, last_message_content: msg.content, last_message_at: msg.created_at, last_message_id: msg.id, is_read: true }
              : c
          );
        } else {
          return prev.map(c =>
            c.partner_id === senderId
              ? { ...c, last_message_content: msg.content, last_message_at: msg.created_at, last_message_id: msg.id, is_read: false, unread_count: c.unread_count + 1 }
              : c
          );
        }
      });
    });

    const unsubUnread = onUnreadCountUpdate(() => {
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

  useEffect(() => {
    if (selectedPartner) {
      joinConversation(selectedPartner);
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
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)' }}>

      {/* ── Top Glass Header ── */}
      <div className="shrink-0 px-6 py-4 flex items-center gap-4 bg-white/70 backdrop-blur-xl border-b border-violet-100/50 shadow-sm">
        <button
          onClick={() => router.push('/forum')}
          className="w-10 h-10 rounded-2xl bg-white/80 border border-violet-100 flex items-center justify-center text-violet-500 hover:bg-violet-50 hover:border-violet-200 transition-all active:scale-95 shadow-sm"
        >
          <FiChevronRight size={18} className="rotate-180" />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <FiMessageSquare size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-gray-900 text-lg leading-tight">Tin nhắn</h1>
            <p className="text-[11px] text-violet-400 font-semibold">Nhắn tin riêng tư</p>
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Conversation List ── */}
        <div className={`${selectedPartner ? 'hidden xl:flex' : 'flex'} flex-col w-full xl:w-[340px] shrink-0 bg-white/40 backdrop-blur-xl min-h-0 border-r border-violet-100/40`}>

          {/* Search */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-300" size={15} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full pl-11 pr-4 py-3 text-sm rounded-2xl bg-white/80 border border-violet-100 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-violet-300 shadow-sm"
              />
            </div>
          </div>

          {/* Label */}
          <div className="px-5 pb-2">
            <span className="text-[11px] font-extrabold text-violet-400 uppercase tracking-widest">
              Tất cả cuộc trò chuyện
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
                    <div className="w-12 h-12 rounded-2xl bg-violet-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-violet-100 rounded-xl w-3/4" />
                      <div className="h-3 bg-violet-50 rounded-xl w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="w-16 h-16 rounded-3xl bg-violet-50 flex items-center justify-center mb-4 shadow-inner">
                  <FiMessageSquare size={26} className="text-violet-300" />
                </div>
                <p className="font-bold text-gray-500 text-sm mb-1">Chưa có cuộc trò chuyện nào</p>
                <p className="text-xs text-gray-400 leading-relaxed">Bắt đầu nhắn tin với mọi người trên forum</p>
              </div>
            ) : (
              <>
                {filtered.map((conv, idx) => {
                  const hasUnread = !conv.is_read && conv.sender_id !== user?.id;
                  return (
                    <button
                      key={conv.partner_id}
                      onClick={() => handleSelect(conv.partner_id)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/60 active:bg-violet-50/40 transition-all border-b border-violet-50/50 text-left group ${
                        selectedPartner === conv.partner_id
                          ? 'bg-white/80 border-l-4 border-l-violet-500'
                          : ''
                      }`}
                      style={{ animationDelay: `${idx * 25}ms` }}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <img
                          src={getAvatar(conv)}
                          alt={conv.full_name}
                          className={`w-12 h-12 rounded-2xl object-cover transition-all shadow-sm group-hover:shadow-md ${
                            selectedPartner === conv.partner_id
                              ? 'ring-2 ring-violet-400 shadow-md'
                              : 'ring-2 ring-white group-hover:ring-violet-200'
                          }`}
                        />
                        {conv.is_vip && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-sm border-2 border-white text-[8px]">
                            ⭐
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-extrabold truncate ${
                            hasUnread ? 'text-gray-900' : 'text-gray-600'
                          }`}>
                            {conv.full_name}
                          </span>
                          <span className={`text-[10px] shrink-0 font-semibold ${
                            hasUnread ? 'text-violet-500' : 'text-gray-400'
                          }`}>
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`text-xs truncate flex-1 ${
                            hasUnread
                              ? 'text-gray-800 font-semibold'
                              : conv.sender_id === user?.id
                                ? 'text-violet-500 font-medium'
                                : 'text-gray-400'
                          }`}>
                            {conv.sender_id === user?.id && (
                              <span className="inline-flex items-center mr-1">
                                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="inline"><path d="M1 5L3 7L6 4L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            )}
                            {conv.last_message_content}
                          </p>
                          {hasUnread && (
                            <span className="w-5 h-5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-md shrink-0 animate-in zoom-in-75">
                              <span className="text-white text-[9px] font-black">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {hasMore && (
                  <button
                    onClick={() => loadConversations(page + 1)}
                    disabled={loadingMore}
                    className="w-full py-4 text-center text-xs font-bold text-violet-500 hover:text-violet-700 hover:bg-violet-50/50 transition-colors active:bg-violet-100/50"
                  >
                    {loadingMore ? 'Đang tải...' : 'Tải thêm cuộc trò chuyện ↓'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className={`${selectedPartner ? 'flex' : 'hidden xl:flex'} flex-1 flex-col bg-transparent min-h-0`}>
          {selectedPartner ? (
            <ChatPanel
              partnerId={selectedPartner}
              partnerName={selectedConv?.full_name || 'User'}
              partnerAvatar={selectedConv ? getAvatar(selectedConv) : ''}
              onBack={() => { setSelectedPartner(null); router.replace('/tin-nhan', undefined); }}
              onNewMessageReceived={() => {
                setConversations(prev => {
                  const updated = prev.map(c =>
                    c.partner_id === selectedPartner
                      ? { ...c, is_read: true, last_message_at: new Date().toISOString() }
                      : c
                  );
                  const conv = updated.find(c => c.partner_id === selectedPartner);
                  if (conv) {
                    return [conv, ...updated.filter(c => c.partner_id !== selectedPartner)];
                  }
                  return updated;
                });
              }}
            />
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-24 h-24 rounded-3xl bg-white/80 backdrop-blur-xl flex items-center justify-center mb-6 shadow-2xl shadow-violet-100/50 border border-violet-100/50">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <path d="M8 12C8 9.79086 9.79086 8 12 8H32C34.2091 8 36 9.79086 36 12V28C36 30.2091 34.2091 32 32 32H20L12 38V32H12C9.79086 32 8 30.2091 8 28V12Z" fill="url(#grad)" fillOpacity="0.15"/>
                  <path d="M8 12C8 9.79086 9.79086 8 12 8H32C34.2091 8 36 9.79086 36 12V28C36 30.2091 34.2091 32 32 32H20L12 38V32H12C9.79086 32 8 30.2091 8 28V12Z" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="16" cy="19" r="1.5" fill="url(#grad)"/>
                  <circle cx="22" cy="19" r="1.5" fill="url(#grad)"/>
                  <circle cx="28" cy="19" r="1.5" fill="url(#grad)"/>
                  <defs>
                    <linearGradient id="grad" x1="8" y1="8" x2="36" y2="38" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#7C3AED"/>
                      <stop offset="1" stopColor="#EC4899"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-800 mb-2">Gen Z Chat</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Chọn một cuộc trò chuyện để bắt đầu nhắn tin riêng tư với mọi người
              </p>
              <div className="mt-8 flex items-center gap-3">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-violet-200" />
                <span className="flex items-center gap-1.5 text-xs text-violet-400 font-semibold">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Trực tuyến
                </span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-violet-200" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
