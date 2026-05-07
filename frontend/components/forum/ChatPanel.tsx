'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiArrowLeft, FiSend, FiSmile, FiMoreVertical,
  FiUserX, FiFlag, FiCheck, FiCheckCircle
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { getMessages, sendMessage, reportMessage, blockUser, ForumMessage } from '@/lib/api/messages';
import {
  initSocket, joinConversation, leaveConversation,
  startTyping, stopTyping,
  onNewMessage, onTyping, onStoppedTyping,
  disconnectSocket
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
  onNewMessageReceived?: () => void;
}

export default function ChatPanel({ partnerId, partnerName, partnerAvatar, onBack, onNewMessageReceived }: Props) {
  const { user } = useAuthStore();
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
  const [blocked, setBlocked] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<number>(0);

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

  // Track if user is near the bottom
  const updateScrollPosition = () => {
    if (!messagesScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesScrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  // Initialize scroll position tracking (start as false to avoid auto-scroll on mount)
  useEffect(() => {
    isAtBottomRef.current = false; // Don't auto-scroll until we've measured actual position
    const el = messagesScrollRef.current;
    if (!el) return;
    const measure = () => {
      // Wait for layout to settle
      requestAnimationFrame(() => {
        if (el) {
          const { scrollTop, scrollHeight, clientHeight } = el;
          isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
        }
      });
    };
    measure();
    // Re-measure after a short delay (layout may not be ready on first render)
    const t = setTimeout(measure, 100);
    el.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => {
      el.removeEventListener('scroll', updateScrollPosition);
      clearTimeout(t);
    };
  }, []);

  // Load messages
  const loadMessages = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      setError(null);

      // Save scroll height before prepending old messages
      if (pageNum > 1 && messagesScrollRef.current) {
        scrollHeightBeforeRef.current = messagesScrollRef.current.scrollHeight;
      }

      const res = await getMessages(partnerId, pageNum, PAGE_SIZE);
      if (res.success && res.data) {
        const msgs: ForumMessage[] = res.data.messages || [];
        setMessages(prev => pageNum === 1 ? msgs : [...prev, ...msgs]);
        setHasMore(pageNum < (res.data.pagination?.totalPages || 1));
        setPage(pageNum);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải tin nhắn';
      if (pageNum === 1) {
        if (status === 403 && msg.includes('chặn')) {
          setBlocked(true);
          setError('Bạn đã chặn hoặc bị chặn bởi người dùng này.');
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [partnerId]);

  // Restore scroll position after prepending older messages
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

  // Initial load + socket setup
  useEffect(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    loadMessages(1);

    // Init socket and join conversation
    initSocket();
    joinConversation(partnerId);

    // Socket event: new message
    const unsubMessage = onNewMessage((msg: unknown) => {
      const m = msg as ForumMessage;
      if (m.sender_id === partnerId) {
        setMessages(prev => {
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, m];
        });
        onNewMessageReceived?.();
      }
    });

    // Socket event: partner typing
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
      unsubTyping();
      unsubStoppedTyping();
      leaveConversation(partnerId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isPartnerTypingTimerRef.current) clearTimeout(isPartnerTypingTimerRef.current);
    };
  }, [partnerId, user?.id]);

  // Auto-scroll on new messages only when already at bottom
  useEffect(() => {
    if (loading) return;
    if (isAutoScrollingRef.current) return;
    // Only scroll if user is at the bottom (not when scrolled up reading old messages)
    if (isAtBottomRef.current && messagesEndRef.current && messagesScrollRef.current) {
      // Wait for DOM to fully update, then scroll to true bottom
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesScrollRef.current && messagesEndRef.current) {
            messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
          }
        });
      });
    }
  }, [messages, loading]);

  // Load more (infinite scroll top)
  const handleScroll = () => {
    if (!messagesScrollRef.current || loadingMore || !hasMore) return;
    updateScrollPosition();
    if (messagesScrollRef.current.scrollTop < 80) {
      loadMessages(page + 1);
    }
  };

  // Send message
  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    stopTyping(partnerId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    try {
      const res = await sendMessage(partnerId, content);
      if (res.success && res.data?.message) {
        setMessages(prev => [...prev, res.data.message]);
        // Don't manually scroll here - let the useEffect handle it via messages dependency
        onNewMessageReceived?.();
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

  // Emit typing indicator on input change
  const handleInputChange = (value: string) => {
    setText(value);

    // Emit typing start
    const now = Date.now();
    if (now - lastTypingEmitRef.current > TYPING_DEBOUNCE) {
      startTyping(partnerId);
      lastTypingEmitRef.current = now;
    }

    // Auto-stop after timeout
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping(partnerId);
    }, TYPING_TIMEOUT);
  };

  // Submit on Enter (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Emoji insert
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

  // Report message
  const handleReportMessage = async () => {
    if (!reportReason.trim() || reportReason.length < 5) return;
    setReporting(true);
    try {
      await reportMessage(selectedMsgId || messages[messages.length - 1]?.id, reportReason);
      setShowReport(false);
      setReportReason('');
      setSelectedMsgId(null);
      alert('Đã gửi report. Cảm ơn bạn!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi gửi report');
    } finally {
      setReporting(false);
    }
  };

  // Block/Unblock user
  const handleBlockUser = async () => {
    setBlocking(true);
    setShowMenu(false);
    try {
      await blockUser(partnerId);
      alert('Đã chặn người dùng.');
      onBack();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi chặn');
    } finally {
      setBlocking(false);
    }
  };

  // Long press / context menu on message to select for report
  const handleMsgTouchStart = (msgId: number) => {
    touchStartRef.current = Date.now();
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
      setShowMenu(false);
      setShowReport(true);
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
    setShowReport(true);
  };

  // Close selected message on outside click
  useEffect(() => {
    const handler = () => setSelectedMsgId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Close menu on outside click
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
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors bg-gray-50 border border-gray-200"
        >
          <FiArrowLeft size={18} className="text-gray-600" />
        </button>

        <img
          src={partnerAvatar}
          alt={partnerName}
          className="w-9 h-9 rounded-xl object-cover"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{partnerName}</p>
          <p className="text-[11px] text-gray-400">Đang nhắn tin</p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <FiMoreVertical size={18} className="text-gray-500" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); setShowReport(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <FiFlag size={14} /> Report tin nhắn
              </button>
              <button
                onClick={handleBlockUser}
                disabled={blocking}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <FiUserX size={14} /> {blocking ? 'Đang chặn...' : 'Chặn người này'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesScrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-anchor-none px-4 py-3 space-y-1"
        style={{ contain: 'layout' }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-xs text-gray-400">Đang tải tin nhắn...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <p className="text-sm text-red-500 font-semibold">{error}</p>
            <button
              onClick={() => loadMessages(1)}
              className="text-xs font-bold text-violet-600 hover:text-violet-700"
            >
              Thử lại
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-400 font-semibold">Chưa có tin nhắn nào</p>
            <p className="text-xs text-gray-300 mt-1">Gửi lời chào đến {partnerName} nhé!</p>
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              </div>
            )}

            {hasMore && !loadingMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={() => loadMessages(page + 1)}
                  className="text-xs text-violet-500 font-semibold hover:text-violet-700"
                >
                  Tải tin nhắn cũ hơn
                </button>
              </div>
            )}

            {groups.map(group => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {group.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex mb-1.5 ${isOwn(msg) ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] flex items-end gap-1.5 ${
                        isOwn(msg) ? 'flex-row-reverse' : 'flex-row'
                      }`}
                      onContextMenu={(e) => handleMsgContextMenu(e, msg.id)}
                      onTouchStart={() => handleMsgTouchStart(msg.id)}
                      onTouchEnd={handleMsgTouchEnd}
                      onClick={() => setSelectedMsgId(prev => prev === msg.id ? null : prev)}
                    >
                      <img
                        src={isOwn(msg)
                          ? (user?.avatar_url || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || '')}&background=random&size=40`)
                          : partnerAvatar
                        }
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover shrink-0 mb-1"
                      />
                      <div className="flex flex-col gap-0.5">
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isOwn(msg)
                              ? 'bg-violet-600 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-800 rounded-bl-md'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${
                          isOwn(msg) ? 'justify-end' : 'justify-start'
                        }`}>
                          <span>{formatTime(msg.created_at)}</span>
                          {isOwn(msg) && (
                            msg.is_read
                              ? <FiCheckCircle size={10} className="text-violet-400" />
                              : <FiCheck size={10} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div ref={messagesEndRef} />

            {/* Typing indicator */}
            {partnerTyping && (
              <div className="flex items-center gap-2 px-4 py-1">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400 italic">{partnerName} đang nhắn...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
        {blocked && (
          <div className="mb-2 p-2 bg-red-50 rounded-xl text-center text-xs text-red-600 font-semibold">
            Bạn đã chặn hoặc bị chặn bởi người dùng này.
          </div>
        )}
        {/* Emoji picker */}
        {showEmoji && (
          <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-2xl mb-2 max-h-32 overflow-y-auto">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { insertEmoji(emoji); setShowEmoji(false); }}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white rounded-xl hover:shadow-sm transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowEmoji(v => !v)}
            disabled={blocked}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              blocked ? 'bg-gray-50 text-gray-300 cursor-not-allowed' :
              showEmoji ? 'bg-violet-100 text-violet-600' : 'hover:bg-gray-100 text-gray-400'
            }`}
          >
            <FiSmile size={18} />
          </button>

          <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={blocked ? "Không thể nhắn tin" : "Nhập tin nhắn..."}
            rows={1}
            disabled={blocked}
            className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-gray-50 border border-gray-200 text-sm resize-none focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: '44px', maxHeight: '120px', overflowY: 'auto' }}
          />
          </div>

          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || blocked}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              text.trim() && !sending && !blocked
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FiSend size={16} />
            )}
          </button>
        </div>

        <p className="text-[10px] text-gray-300 mt-1 text-center">
          Nhấn Enter để gửi • Shift+Enter để xuống dòng
        </p>
      </div>

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900">Report tin nhắn</h3>
              <button onClick={() => setShowReport(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Mô tả lý do báo cáo tin nhắn này. Đội ngũ kiểm duyệt sẽ xem xét trong thời gian sớm nhất.
            </p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Lý do báo cáo (tối thiểu 5 ký tự)..."
              className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none h-24"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleReportMessage}
                disabled={reportReason.trim().length < 5 || reporting}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
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
