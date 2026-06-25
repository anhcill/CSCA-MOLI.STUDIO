'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowLeft, FiCheck, FiInbox, FiMessageCircle, FiMessageSquare, FiSearch, FiSend } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import ChatPanel from '@/components/forum/ChatPanel';
import { getConversations, Conversation, ForumMessage } from '@/lib/api/messages';
import {
  initSocket, onNewMessage, onMessageDeleted, onUnreadCountUpdate,
  joinConversation, leaveConversation
} from '@/lib/socket';

const LIMIT = 20;
type InboxFilter = 'all' | 'unread' | 'sent';

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
  const [filter, setFilter] = useState<InboxFilter>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousRootOverflow = root.style.overflow;
    const previousRootHeight = root.style.height;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyHeight = body.style.height;
    const syncViewportHeight = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      root.style.setProperty('--messages-visual-height', `${height}px`);
      root.style.setProperty('--messages-visual-top', `${offsetTop}px`);
    };

    syncViewportHeight();
    root.style.overflow = 'hidden';
    root.style.height = '100%';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('scroll', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);

    return () => {
      root.style.overflow = previousRootOverflow;
      root.style.height = previousRootHeight;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.height = previousBodyHeight;
      root.style.removeProperty('--messages-visual-height');
      root.style.removeProperty('--messages-visual-top');
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      window.scrollTo(0, scrollY);
    };
  }, []);

  const loadConversations = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const res = await getConversations(pageNum, LIMIT);
      const data = res.data;
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

    const unsubMessage = onNewMessage((msg: unknown) => {
      const message = msg as ForumMessage;
      if (!message?.id || !user?.id) return;

      setConversations(prev => {
        const partnerId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
        const existing = prev.find(c => c.partner_id === partnerId);

        if (!existing) {
          void loadConversations(1);
          return prev;
        }

        if (existing.last_message_id === message.id) return prev;

        const isOpen = selectedPartner === partnerId;
        const isMine = message.sender_id === user.id;
        const updated: Conversation = {
          ...existing,
          last_message_id: message.id,
          last_message_content: message.content,
          last_message_at: message.created_at,
          last_message_is_deleted: message.is_deleted,
          is_read: isMine || isOpen ? true : message.is_read,
          sender_id: message.sender_id,
          unread_count: isMine || isOpen ? 0 : existing.unread_count + 1,
        };

        return [updated, ...prev.filter(c => c.partner_id !== partnerId)];
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

    const unsubDeleted = onMessageDeleted(({ messageId }) => {
      setConversations(prev => prev.map(c =>
        c.last_message_id === messageId
          ? { ...c, last_message_content: 'Tin nhắn đã được thu hồi', last_message_is_deleted: true, unread_count: 0, is_read: true }
          : c
      ));
      void loadConversations(1);
    });

    return () => {
      unsubMessage();
      unsubUnread();
      unsubDeleted();
    };
  }, [isAuthenticated, user?.id, selectedPartner, loadConversations]);

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
    c.avatar_url || c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name || c.username || 'User')}&background=random&size=80`;

  const getFallbackAvatar = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&size=80`;

  const getLastMessage = (conv: Conversation) => {
    if (conv.last_message_is_deleted) return 'Tin nhắn đã được thu hồi';
    if (conv.sender_id === user?.id) return `Bạn: ${conv.last_message_content}`;
    return conv.last_message_content;
  };

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

  const unreadTotal = conversations.reduce((total, c) => total + (c.unread_count || 0), 0);
  const sentCount = conversations.filter(c => c.sender_id === user?.id).length;

  const filtered = conversations.filter(c => {
    const keyword = search.trim().toLowerCase();
    const matchesSearch = !keyword ||
      c.full_name.toLowerCase().includes(keyword) ||
      c.username.toLowerCase().includes(keyword);
    const hasUnread = c.unread_count > 0 && c.sender_id !== user?.id;
    if (filter === 'unread') return matchesSearch && hasUnread;
    if (filter === 'sent') return matchesSearch && c.sender_id === user?.id;
    return matchesSearch;
  });

  const selectedConv = conversations.find(c => c.partner_id === selectedPartner);

  const handleSelect = (partnerId: number) => {
    setSelectedPartner(partnerId);
    router.replace(`/tin-nhan?to=${partnerId}`, { scroll: false });
  };

  const handleConversationActivity = (message?: ForumMessage) => {
    if (!selectedPartner) return;

    setConversations(prev => {
      const existing = prev.find(c => c.partner_id === selectedPartner);
      if (!existing) {
        void loadConversations(1);
        return prev;
      }

      const updated: Conversation = {
        ...existing,
        is_read: true,
        unread_count: 0,
        last_message_id: message?.id ?? existing.last_message_id,
        last_message_content: message?.content ?? existing.last_message_content,
        last_message_at: message?.created_at ?? new Date().toISOString(),
        sender_id: message?.sender_id ?? existing.sender_id,
        last_message_is_deleted: message?.is_deleted ?? existing.last_message_is_deleted,
      };

      return [updated, ...prev.filter(c => c.partner_id !== selectedPartner)];
    });
  };

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden overscroll-none bg-slate-50 [touch-action:manipulation]"
      style={{
        height: 'var(--messages-visual-height, 100dvh)',
        transform: 'translateY(var(--messages-visual-top, 0px))',
      }}
    >

      {/* ── Top Header ── */}
      <div className="shrink-0 px-3 py-3 sm:px-6 sm:py-4 flex items-center gap-3 sm:gap-4 bg-white border-b border-slate-200">
        <button
          onClick={() => router.push('/forum')}
          className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
        >
          <FiArrowLeft size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
            <FiMessageSquare size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-gray-900 text-lg leading-tight">Tin nhắn</h1>
            <p className="text-[11px] text-slate-500 font-semibold">
              {unreadTotal > 0 ? `${unreadTotal} tin chưa đọc` : 'Nhắn tin riêng tư giữa học viên'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          Đang hoạt động
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Conversation List ── */}
        <div className={`${selectedPartner ? 'hidden xl:flex' : 'flex'} flex-col w-full xl:w-[380px] shrink-0 bg-white min-h-0 border-r border-slate-200`}>

          {/* Search */}
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="w-full pl-11 pr-4 py-3 text-base sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'all' as const, label: 'Tất cả', count: conversations.length, icon: FiInbox },
                { key: 'unread' as const, label: 'Chưa đọc', count: unreadTotal, icon: FiMessageCircle },
                { key: 'sent' as const, label: 'Đã gửi', count: sentCount, icon: FiSend },
              ].map(item => {
                const Icon = item.icon;
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-extrabold transition-all ${
                      active
                        ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50'
                    }`}
                  >
                    <Icon size={13} />
                    <span className="truncate">{item.label}</span>
                    <span className={active ? 'text-white/80' : 'text-slate-400'}>{item.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div className="px-5 pb-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
              {filter === 'unread' ? 'Tin cần trả lời' : filter === 'sent' ? 'Tin bạn vừa gửi' : 'Cuộc trò chuyện gần đây'}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-slate-100 rounded-xl w-3/4" />
                      <div className="h-3 bg-slate-100 rounded-xl w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <FiMessageSquare size={26} className="text-slate-400" />
                </div>
                <p className="font-bold text-gray-600 text-sm mb-1">
                  {search ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">Vào hồ sơ học viên trên forum để bắt đầu nhắn tin riêng.</p>
              </div>
            ) : (
              <>
                {filtered.map((conv, idx) => {
                  const hasUnread = !conv.is_read && conv.sender_id !== user?.id;
                  return (
                    <button
                      key={conv.partner_id}
                      onClick={() => handleSelect(conv.partner_id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-violet-50 transition-all border-b border-slate-100 text-left group sm:px-5 ${
                        selectedPartner === conv.partner_id
                          ? 'bg-violet-50 border-l-4 border-l-violet-500'
                          : ''
                      }`}
                      style={{ animationDelay: `${idx * 25}ms` }}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <img
                          src={getAvatar(conv)}
                          alt={conv.full_name}
                          className={`w-12 h-12 rounded-xl object-cover transition-all shadow-sm group-hover:shadow-md ${
                            selectedPartner === conv.partner_id
                              ? 'ring-2 ring-violet-400 shadow-md'
                              : 'ring-2 ring-white group-hover:ring-slate-200'
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
                            {conv.sender_id === user?.id && <FiCheck size={12} className="inline mr-1" />}
                            {getLastMessage(conv)}
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
                    className="w-full py-4 text-center text-xs font-bold text-violet-600 hover:text-violet-700 hover:bg-violet-50 transition-colors active:bg-violet-100"
                  >
                    {loadingMore ? 'Đang tải...' : 'Tải thêm cuộc trò chuyện ↓'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className={`${selectedPartner ? 'flex' : 'hidden xl:flex'} h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent`}>
          {selectedPartner ? (
            <ChatPanel
              partnerId={selectedPartner}
              partnerName={selectedConv?.full_name || 'User'}
              partnerAvatar={selectedConv ? getAvatar(selectedConv) : getFallbackAvatar(selectedPartner.toString())}
              onBack={() => { setSelectedPartner(null); router.replace('/tin-nhan'); }}
              onNewMessageReceived={handleConversationActivity}
            />
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm border border-slate-200">
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
              <h2 className="text-xl font-black text-gray-800 mb-2">Hộp thư học viên</h2>
              <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                Chọn một cuộc trò chuyện để trao đổi riêng, theo dõi tin chưa đọc và tiếp tục học cùng bạn bè.
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
