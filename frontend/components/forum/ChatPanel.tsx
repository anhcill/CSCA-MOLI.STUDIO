'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiArrowLeft, FiSend, FiSmile, FiMoreVertical,
  FiUserX, FiFlag, FiCheck, FiX, FiSliders, FiUpload, FiTrash2
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { useChatBgStore, CHAT_BG_PRESETS } from '@/lib/store/chatBgStore';
import { getMessages, sendMessage, reportMessage, blockUser, deleteMessage, ForumMessage } from '@/lib/api/messages';
import {
  initSocket, joinConversation, leaveConversation,
  startTyping, stopTyping,
  onNewMessage, onMessageDeleted, onTyping, onStoppedTyping,
} from '@/lib/socket';

const QUICK_EMOJIS = ['😀', '👍', '🙏', '❤️', '😊', '🎉', '💯', '🔥', '😍', '🤔', '😅', '😂'];

const PAGE_SIZE = 50;
const TYPING_TIMEOUT = 3000;
const TYPING_DEBOUNCE = 500;

interface Props {
  partnerId: number;
  partnerName: string;
  partnerAvatar: string;
  onBack: () => void;
  onNewMessageReceived?: (message?: ForumMessage) => void;
}

export default function ChatPanel({ partnerId, partnerName, partnerAvatar, onBack, onNewMessageReceived }: Props) {
  const { user } = useAuthStore();
  const { bgType, bgPresetId, bgValue, setBgPreset, setBgCustom, resetBg } = useChatBgStore();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<ForumMessage | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPartnerTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);
  const scrollHeightBeforeRef = useRef<number>(0);

  // Background picker state
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [bgError, setBgError] = useState('');
  const bgInputRef = useRef<HTMLInputElement>(null);

  const updateScrollPosition = () => {
    if (!messagesScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesScrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const keepMobileViewportStable = useCallback(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const scrollY = window.scrollY;
    window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
    window.setTimeout(() => window.scrollTo(0, scrollY), 80);
  }, []);

  useEffect(() => {
    isAtBottomRef.current = false;
    const el = messagesScrollRef.current;
    if (!el) return;
    const measure = () => {
      requestAnimationFrame(() => {
        if (el) {
          const { scrollTop, scrollHeight, clientHeight } = el;
          isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
        }
      });
    };
    measure();
    const t = setTimeout(measure, 100);
    el.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => {
      el.removeEventListener('scroll', updateScrollPosition);
      clearTimeout(t);
    };
  }, []);

  const loadMessages = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      setError(null);
      if (pageNum > 1 && messagesScrollRef.current) {
        scrollHeightBeforeRef.current = messagesScrollRef.current.scrollHeight;
      }
      const res = await getMessages(partnerId, pageNum, PAGE_SIZE);
      if (res.success && res.data) {
        const msgs: ForumMessage[] = res.data.messages || [];
        setMessages(prev => pageNum === 1 ? msgs : [...prev, ...msgs]);
        setHasMore(pageNum < (res.data.pagination?.totalPages || 1));
        setPage(pageNum);
        setBlocked(false);
        setBlockedByMe(false);
        setBlockedByOther(false);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải tin nhắn';
      if (pageNum === 1) {
        if (status === 403 && msg.includes('chặn')) {
          const blockData = err?.response?.data?.data;
          setBlocked(true);
          setBlockedByMe(Boolean(blockData?.blockedByMe));
          setBlockedByOther(Boolean(blockData?.blockedMe));
          setError(null);
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (page <= 1 || loading || loadingMore) return;
    if (!messagesScrollRef.current || scrollHeightBeforeRef.current === 0) return;
    const newHeight = messagesScrollRef.current.scrollHeight;
    const diff = newHeight - scrollHeightBeforeRef.current;
    if (diff > 0) {
      messagesScrollRef.current.scrollTop += diff;
    }
    scrollHeightBeforeRef.current = 0;
  }, [messages, page, loading, loadingMore]);

  useEffect(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    setBlocked(false);
    setBlockedByMe(false);
    setBlockedByOther(false);
    setError(null);
    setText('');
    setReplyingTo(null);
    setSelectedMsgId(null);
    setShowEmoji(false);
    setShowMenu(false);
    setShowReport(false);
    setIsOnline(true);
    loadMessages(1);
    initSocket();
    joinConversation(partnerId);

    const unsubMessage = onNewMessage((msg: unknown) => {
      const m = msg as ForumMessage;
      if (m.sender_id === partnerId) {
        setMessages(prev => {
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, m];
        });
        onNewMessageReceived?.(m);
      }
    });

    const unsubDelete = onMessageDeleted(({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true } : m));
    });

    const unsubTyping = onTyping(({ userId }) => {
      if (userId === user?.id) return;
      setPartnerTyping(true);
      if (isPartnerTypingTimerRef.current) clearTimeout(isPartnerTypingTimerRef.current);
      isPartnerTypingTimerRef.current = setTimeout(() => setPartnerTyping(false), 4000);
    });

    const unsubStoppedTyping = onStoppedTyping(({ userId }) => {
      if (userId === user?.id) return;
      setPartnerTyping(false);
      if (isPartnerTypingTimerRef.current) clearTimeout(isPartnerTypingTimerRef.current);
    });

    return () => {
      unsubMessage();
      unsubDelete();
      unsubTyping();
      unsubStoppedTyping();
      leaveConversation(partnerId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isPartnerTypingTimerRef.current) clearTimeout(isPartnerTypingTimerRef.current);
    };
  }, [partnerId, user?.id]);

  useEffect(() => {
    if (loading) return;
    if (isAutoScrollingRef.current) return;
    if (isAtBottomRef.current && messagesEndRef.current && messagesScrollRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesScrollRef.current && messagesEndRef.current) {
            messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
          }
        });
      });
    }
  }, [messages, loading]);

  const handleScroll = () => {
    if (!messagesScrollRef.current || loadingMore || !hasMore) return;
    updateScrollPosition();
    if (messagesScrollRef.current.scrollTop < 80) {
      loadMessages(page + 1);
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);
    stopTyping(partnerId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    try {
      const res = await sendMessage(partnerId, content, replyId);
      if (res.success && res.data?.message) {
        setMessages(prev => [...prev, res.data.message]);
        onNewMessageReceived?.(res.data.message);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể gửi tin nhắn';
      setText(content);
      alert(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleInputChange = (value: string) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingEmitRef.current > TYPING_DEBOUNCE) {
      startTyping(partnerId);
      lastTypingEmitRef.current = now;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping(partnerId);
    }, TYPING_TIMEOUT);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 0);
  };

  const isImageUrl = (content: string) =>
    /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|mp4|webm)/i.test(content.trim());

  const handleReportMessage = async () => {
    const selectedMessage = selectedMsgId
      ? messages.find(msg => msg.id === selectedMsgId)
      : [...messages].reverse().find(msg => !isOwn(msg) && !msg.is_deleted);

    if (!selectedMessage) {
      alert('Vui lòng chọn một tin nhắn của người khác để báo cáo.');
      return;
    }
    if (isOwn(selectedMessage)) {
      alert('Không thể báo cáo tin nhắn của chính bạn.');
      return;
    }
    if (!reportReason.trim() || reportReason.length < 5) {
      alert('Lý do báo cáo phải từ 5 ký tự trở lên.');
      return;
    }
    setReporting(true);
    try {
      await reportMessage(selectedMessage.id, reportReason);
      setShowReport(false);
      setReportReason('');
      setSelectedMsgId(null);
      alert('Đã gửi báo cáo. Cảm ơn bạn!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi gửi báo cáo');
    } finally {
      setReporting(false);
    }
  };

  const handleBlockUser = async () => {
    if (blocked && blockedByOther && !blockedByMe) {
      alert('Người này đã chặn bạn nên bạn không thể mở chặn từ phía mình.');
      return;
    }

    const isUnblocking = blocked && blockedByMe;
    if (!isUnblocking && !confirm(`Chặn ${partnerName}? Hai bên sẽ không thể nhắn tin cho nhau cho tới khi bạn bỏ chặn.`)) {
      return;
    }

    setBlocking(true);
    setShowMenu(false);
    try {
      const res = await blockUser(partnerId);
      const isBlocked = res.blocked ?? res.data?.blocked ?? false;
      setBlocked(isBlocked);
      setBlockedByMe(isBlocked);
      setBlockedByOther(false);
      setError(null);
      if (isBlocked) {
        alert('Đã chặn người dùng.');
      } else {
        alert('Đã bỏ chặn người dùng.');
        loadMessages(1);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || (isUnblocking ? 'Lỗi khi bỏ chặn' : 'Lỗi khi chặn'));
    } finally {
      setBlocking(false);
    }
  };

  const handleRecallMessage = async (msgId: number) => {
    try {
      await deleteMessage(msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true } : m));
      setSelectedMsgId(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi thu hồi tin nhắn');
    }
  };

  const handleReplyMessage = (msg: ForumMessage) => {
    setReplyingTo(msg);
    setSelectedMsgId(null);
    inputRef.current?.focus();
  };

  const handleMsgTouchStart = (msgId: number) => {
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
      setShowMenu(false);
    }, 500);
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMsgContextMenu = (e: React.MouseEvent, msgId: number) => {
    e.preventDefault();
    setSelectedMsgId(msgId);
    setShowMenu(false);
  };

  // ── Background picker handlers ───────────────────────────────────────────────
  const handleApplyCustomBg = () => {
    const url = customBgUrl.trim();
    if (!url) {
      setBgError('Vui lòng nhập URL hình ảnh.');
      return;
    }
    // Basic URL validation
    if (!/^https?:\/\/.+/i.test(url)) {
      setBgError('URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    setBgError('');
    setBgCustom(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBgError('Chỉ chấp nhận file hình ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBgError('File quá lớn. Tối đa 5MB.');
      return;
    }
    setBgError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgCustom(dataUrl);
      setCustomBgUrl('');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handler = () => setSelectedMsgId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hôm nay';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const groupByDate = (msgs: ForumMessage[]) => {
    const groups: { date: string; messages: ForumMessage[] }[] = [];
    let currentDate = '';
    for (const msg of msgs) {
      const d = formatDate(msg.created_at);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    }
    return groups;
  };

  const groups = groupByDate(messages);
  const isOwn = (msg: ForumMessage) => msg.sender_id === user?.id;

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 border-b border-gray-100/60 bg-white/90 backdrop-blur-xl shrink-0 shadow-sm relative z-50">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all bg-gray-50 border border-gray-200 shadow-sm"
        >
          <FiArrowLeft size={17} className="text-gray-600" />
        </button>

        <div className="relative shrink-0">
          <img
            src={partnerAvatar}
            alt={partnerName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-violet-100 shadow-sm"
          />
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            isOnline ? 'bg-green-400' : 'bg-gray-300'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-gray-900 truncate">{partnerName}</p>
          <p className={`text-[11px] font-medium ${partnerTyping ? 'text-violet-500' : isOnline ? 'text-green-500' : 'text-gray-400'}`}>
            {partnerTyping ? 'Đang soạn tin nhắn...' : isOnline ? 'Đang hoạt động' : 'Offline'}
          </p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          >
            <FiMoreVertical size={18} className="text-gray-500" />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-11 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-[100] overflow-hidden"
            >
              <button
                onClick={() => { setShowMenu(false); setShowBgPicker(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <FiSliders size={14} /> Đổi nền chat
              </button>
              <button
                onClick={() => { setShowMenu(false); setShowReport(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
              >
                <FiFlag size={14} /> Report tin nhắn
              </button>
              <button
                onClick={handleBlockUser}
                disabled={blocking || (blocked && blockedByOther && !blockedByMe)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                  blockedByMe
                    ? 'text-emerald-600 hover:bg-emerald-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FiUserX size={14} /> {blocking ? 'Đang xử lý...' : blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn người dùng'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Background ── */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: bgValue }}>
        {/* Overlay for custom images to ensure readability */}
        {bgType === 'custom' && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] pointer-events-none" />
        )}

        <div ref={messagesScrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto px-2 py-3 sm:px-3 sm:py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-8 h-8 border-[2.5px] border-violet-200/50 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-xs text-violet-400 font-semibold">Đang tải tin nhắn...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <p className="text-sm text-red-400 font-bold">{error}</p>
              <button onClick={() => loadMessages(1)} className="text-xs font-bold text-violet-600 hover:text-violet-700">
                Thử lại
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/60 backdrop-blur flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">👋</span>
              </div>
              <p className="text-sm font-bold text-violet-700/70">Chưa có tin nhắn nào</p>
              <p className="text-xs text-violet-400/70 mt-1">Gửi lời chào đến {partnerName} nhé!</p>
            </div>
          ) : (
            <>
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-violet-200/50 border-t-violet-600 rounded-full animate-spin" />
                </div>
              )}

              {hasMore && !loadingMore && (
                <div className="flex justify-center py-2">
                  <button onClick={() => loadMessages(page + 1)} className="text-xs text-violet-500 font-bold hover:text-violet-700 px-3 py-1 rounded-full bg-white/50 hover:bg-white/80 transition-all">
                    Tải tin nhắn cũ hơn
                  </button>
                </div>
              )}

              {groups.map(group => (
                <div key={group.date}>
                  {/* Date divider */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-violet-200/40" />
                    <span className="text-[10px] font-extrabold text-violet-500/70 bg-white/70 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                      {group.date}
                    </span>
                    <div className="flex-1 h-px bg-violet-200/40" />
                  </div>

                  {group.messages.map(msg => (
                    <div key={msg.id}>
                      {/* Typing space between different senders */}
                      {msg.id !== group.messages[0].id && isOwn(msg) !== isOwn(group.messages[group.messages.indexOf(msg) - 1]) && (
                        <div className="h-2" />
                      )}
                      <div
                        className={`flex mb-1.5 ${isOwn(msg) ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                      >
                        <div
                          className={`max-w-[88%] sm:max-w-[78%] flex items-end gap-1.5 sm:gap-2 ${
                            isOwn(msg) ? 'flex-row-reverse' : 'flex-row'
                          }`}
                          onContextMenu={(e) => handleMsgContextMenu(e, msg.id)}
                          onTouchStart={() => handleMsgTouchStart(msg.id)}
                          onTouchEnd={handleMsgTouchEnd}
                          onClick={() => setSelectedMsgId(prev => prev === msg.id ? null : prev)}
                        >
                          {/* Avatar — only show for first message in a sequence */}
                          {isOwn(msg) ? (
                            <img
                              src={user?.avatar_url || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || '')}&background=random&size=40`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm ring-1 ring-white/50"
                            />
                          ) : (
                            <img
                              src={partnerAvatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm ring-1 ring-white/50"
                            />
                          )}

                          <div className="flex flex-col gap-0.5 relative group">
                            
                            {/* Option actions popup */}
                            {selectedMsgId === msg.id && (
                              <div className={`absolute top-0 flex items-center gap-1 bg-white/90 backdrop-blur shadow-md border border-gray-100 rounded-lg p-1 z-10 ${
                                isOwn(msg) ? 'right-full mr-2' : 'left-full ml-2'
                              }`}>
                                <button
                                  onClick={() => handleReplyMessage(msg)}
                                  className="px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 rounded"
                                >
                                  Trả lời
                                </button>
                                {!isOwn(msg) && !msg.is_deleted && (
                                  <button
                                    onClick={() => {
                                      setSelectedMsgId(msg.id);
                                      setShowReport(true);
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 rounded"
                                  >
                                    Báo cáo
                                  </button>
                                )}
                                {isOwn(msg) && !msg.is_deleted && (
                                  <button
                                    onClick={() => handleRecallMessage(msg.id)}
                                    className="px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 rounded"
                                  >
                                    Thu hồi
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Reply preview inside bubble */}
                            {msg.reply_to_id && (
                              <div className={`text-xs opacity-75 mb-1 px-3 py-1.5 rounded-xl border-l-2 ${
                                isOwn(msg) ? 'bg-white/10 border-white/40' : 'bg-black/5 border-violet-300/40'
                              }`}>
                                <p className="font-bold text-[10px] mb-0.5">
                                  {msg.reply_sender_name || 'Người dùng'}
                                </p>
                                <p className="truncate max-w-[200px]">
                                  {msg.reply_is_deleted ? 'Tin nhắn đã bị thu hồi' : (msg.reply_content || 'Hình ảnh / File')}
                                </p>
                              </div>
                            )}

                            {/* Chat bubble */}
                            <div
                              className={`px-3.5 py-2.5 sm:px-4 rounded-2xl text-sm leading-relaxed break-words shadow-sm cursor-pointer ${
                                msg.is_deleted 
                                  ? 'bg-gray-100 italic text-gray-500 border border-gray-200' 
                                  : isOwn(msg)
                                    ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-br-sm'
                                    : 'bg-white/90 backdrop-blur-sm text-gray-800 rounded-bl-sm border border-violet-100/50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMsgId(prev => prev === msg.id ? null : msg.id);
                              }}
                            >
                              {msg.is_deleted ? (
                                <span className="flex items-center gap-1"><FiTrash2 size={12} className="opacity-50" /> Tin nhắn đã thu hồi</span>
                              ) : isImageUrl(msg.content) ? (
                                <img
                                  src={msg.content}
                                  alt="Hình ảnh"
                                  className="max-w-[220px] max-h-[180px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); window.open(msg.content, '_blank') }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <span className="whitespace-pre-wrap">{msg.content}</span>
                              )}
                            </div>

                            {/* Time + read receipt */}
                            <div className={`flex items-center gap-1 text-[10px] text-violet-400/60 ${
                              isOwn(msg) ? 'justify-end' : 'justify-start'
                            }`}>
                              <span>{formatTime(msg.created_at)}</span>
                              {isOwn(msg) && (
                                msg.is_read
                                  ? <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5L3 7L6 4L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5L8 7L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  : <FiCheck size={10} />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div ref={messagesEndRef} className="h-2" />

              {/* Typing indicator */}
              {partnerTyping && (
                <div className="flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-bottom-1">
                  <img src={partnerAvatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-white/50" />
                  <div className="bg-white/90 backdrop-blur-sm rounded-2xl rounded-bl-sm border border-violet-100/50 px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="shrink-0 border-t border-violet-100/50 bg-white/95 px-2 py-2 backdrop-blur-xl shadow-[0_-4px_20px_rgba(139,92,246,0.05)] sm:px-3 sm:py-3" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {blocked && (
          <div className="mb-2 flex flex-col gap-2 rounded-2xl border border-red-100 bg-red-50 p-2.5 text-center text-xs font-bold text-red-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <span>
              {blockedByMe
                ? 'Bạn đã chặn người dùng này. Bỏ chặn để nhắn tin lại.'
                : 'Người dùng này đã chặn bạn nên hiện không thể nhắn tin.'}
            </span>
            {blockedByMe && (
              <button
                onClick={handleBlockUser}
                disabled={blocking}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-emerald-600 shadow-sm ring-1 ring-emerald-100 disabled:opacity-50"
              >
                {blocking ? 'Đang xử lý...' : 'Bỏ chặn'}
              </button>
            )}
          </div>
        )}

        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-violet-50 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 border border-violet-100">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-bold text-violet-600">Đang trả lời {isOwn(replyingTo) ? 'chính bạn' : partnerName}</span>
              <span className="text-xs text-gray-500 truncate mr-2">{replyingTo.is_deleted ? 'Tin nhắn đã thu hồi' : replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition-colors">
              <FiX size={14} />
            </button>
          </div>
        )}

        {showEmoji && (
          <div className="flex flex-wrap gap-1 p-3 bg-gray-50/80 backdrop-blur rounded-2xl mb-2 max-h-36 overflow-y-auto border border-gray-100 shadow-sm">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { insertEmoji(emoji); setShowEmoji(false); }}
                className="w-9 h-9 flex items-center justify-center text-xl hover:bg-white rounded-xl hover:shadow-md transition-all active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5 sm:gap-2">
          <button
            onClick={() => { setShowEmoji(v => !v); }}
            disabled={blocked}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 ${
              blocked ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
              showEmoji ? 'bg-violet-100 text-violet-600 shadow-md' : 'bg-gray-50 hover:bg-violet-50 text-gray-400 hover:text-violet-500'
            }`}
            title="Biểu cảm"
          >
            <FiSmile size={20} />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={keepMobileViewportStable}
              placeholder={blocked ? "Không thể nhắn tin" : "Nhập tin nhắn..."}
              rows={1}
              disabled={blocked}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50/80 border border-gray-200 text-sm resize-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
              style={{ height: '48px', maxHeight: '120px', overflowY: 'auto' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || blocked}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
              text.trim() && !sending && !blocked
                ? 'bg-gradient-to-br from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FiSend size={18} />
            )}
          </button>
        </div>
      </div>

      {/* ── Background Picker Modal ── */}
      {showBgPicker && (
        <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar for mobile */}
            <div className="sm:hidden w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:pt-5 sm:pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-md">
                  <FiSliders size={15} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm">Đổi nền chat</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Chọn màu hoặc hình ảnh yêu thích</p>
                </div>
              </div>
              <button
                onClick={() => setShowBgPicker(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all active:scale-90"
              >
                <FiX size={15} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

              {/* Preset gradients */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Màu nền có sẵn</p>
                  <button
                    onClick={resetBg}
                    className="text-[10px] text-violet-500 font-bold hover:text-violet-700 transition-colors"
                  >
                    Đặt lại mặc định
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {CHAT_BG_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setBgPreset(preset.id)}
                      title={preset.label}
                      className={`relative w-full aspect-square rounded-2xl shadow-md overflow-hidden transition-all active:scale-90 ${
                        bgPresetId === preset.id
                          ? 'ring-2 ring-violet-500 ring-offset-2 shadow-xl -translate-y-0.5'
                          : 'hover:-translate-y-0.5 hover:shadow-lg'
                      }`}
                      style={{ background: preset.bg }}
                    >
                      {bgPresetId === preset.id && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md">
                            <FiCheck size={11} className="text-violet-600" />
                          </div>
                        </div>
                      )}
                      <span className="absolute bottom-0.5 left-0 right-0 text-[8px] font-bold text-center text-white drop-shadow-md truncate px-0.5">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">hoặc</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Custom image URL */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Dùng hình ảnh</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customBgUrl}
                    onChange={(e) => { setCustomBgUrl(e.target.value); setBgError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomBg()}
                    placeholder="Dán URL hình ảnh vào đây..."
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-gray-300"
                  />
                  <button
                    onClick={handleApplyCustomBg}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
                  >
                    Áp dụng
                  </button>
                </div>
                {bgError && (
                  <p className="text-[10px] text-red-500 mt-1.5 font-semibold">{bgError}</p>
                )}
              </div>

              {/* Upload from device */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Tải ảnh lên</p>
                <button
                  onClick={() => bgInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 hover:bg-violet-50/40 transition-all group"
                >
                  <FiUpload size={16} className="text-gray-400 group-hover:text-violet-500 transition-colors" />
                  <span className="text-xs font-bold text-gray-400 group-hover:text-violet-600 transition-colors">
                    Chọn ảnh từ thiết bị (tối đa 5MB)
                  </span>
                </button>
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {bgType === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg overflow-hidden ring-2 ring-violet-200">
                      <img src={bgValue.replace('url(', '').replace(')', '')} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-violet-500 font-semibold flex-1 truncate">Đang dùng ảnh tùy chỉnh</span>
                    <button
                      onClick={resetBg}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-bold transition-colors"
                    >
                      <FiTrash2 size={10} /> Xóa ảnh
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom safe area for mobile */}
            <div className="h-5 sm:hidden" />
          </div>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900 text-base">Report tin nhắn</h3>
              <button onClick={() => setShowReport(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <FiX size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Mô tả lý do báo cáo tin nhắn này. Đội ngũ kiểm duyệt sẽ xem xét trong thời gian sớm nhất.
            </p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Lý do báo cáo (tối thiểu 5 ký tự)..."
              className="w-full p-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-50 resize-none h-24"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-2.5 rounded-2xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 active:scale-98 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleReportMessage}
                disabled={reportReason.trim().length < 5 || reporting}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm font-bold hover:shadow-lg active:scale-98 disabled:opacity-50 transition-all"
              >
                {reporting ? 'Đang gửi...' : 'Gửi Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
