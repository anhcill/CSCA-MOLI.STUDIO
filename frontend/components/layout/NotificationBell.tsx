'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiBell } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import {
  getNotifications,
  markRead,
  markAllRead,
  type Notification,
} from '@/lib/api/notifications';
import { onNotification } from '@/lib/socket';

type NotificationResponse = {
  data: Notification[];
  unread_count: number;
};

const NOTIFICATION_CACHE_TTL = 3000;
let notificationCache: (NotificationResponse & { cachedAt: number }) | null = null;
let notificationRequest: Promise<NotificationResponse> | null = null;

const fetchNotificationsShared = async (): Promise<NotificationResponse> => {
  const now = Date.now();
  if (notificationCache && now - notificationCache.cachedAt < NOTIFICATION_CACHE_TTL) {
    return { data: notificationCache.data, unread_count: notificationCache.unread_count };
  }

  if (!notificationRequest) {
    notificationRequest = getNotifications(20).then((res) => {
      const payload = { data: res.data || [], unread_count: res.unread_count || 0 };
      notificationCache = { ...payload, cachedAt: Date.now() };
      return payload;
    }).finally(() => {
      notificationRequest = null;
    });
  }

  return notificationRequest;
};

const TYPE_LABEL: Record<string, string> = {
  like_post:     'đã thích bài viết của bạn',
  comment_post:  'đã bình luận bài viết của bạn',
  reply_comment: 'đã trả lời bình luận của bạn',
  admin_announcement: 'đã gửi một thông báo mới',
};

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)  return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await fetchNotificationsShared();
      setNotifications(res.data);
      setUnread(res.unread_count);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  // Poll every 2 minutes, only when tab is visible
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifications();
    }, 120_000);
    return () => clearInterval(interval);
  }, [mounted, isAuthenticated, fetchNotifications]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    const unsubscribe = onNotification(() => {
      notificationCache = null;
      fetchNotifications();
    });
    return () => { unsubscribe(); };
  }, [mounted, isAuthenticated, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = async () => {
    setOpen(prev => !prev);
    if (!open && unread > 0) {
      // Optimistic UI: clear badge immediately
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      if (notificationCache) {
        notificationCache = {
          ...notificationCache,
          unread_count: 0,
          data: notificationCache.data.map((n) => ({ ...n, is_read: true })),
          cachedAt: Date.now(),
        };
      }
      try { await markAllRead(); } catch { /* silent */ }
    }
  };

  const handleClickNotification = async (n: Notification) => {
    if (!n.is_read) {
      try { await markRead(n.id); } catch { /* silent */ }
      if (notificationCache) {
        notificationCache = {
          ...notificationCache,
          unread_count: Math.max(0, notificationCache.unread_count - 1),
          data: notificationCache.data.map((item) => item.id === n.id ? { ...item, is_read: true } : item),
          cachedAt: Date.now(),
        };
      }
    }
    setOpen(false);
    router.push(n.link || `/forum`);
  };

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-violet-600 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-violet-400"
        aria-label="Thông báo"
      >
        <FiBell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-[9999] max-h-[calc(100svh-env(safe-area-inset-top)-5rem)] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl transition-all duration-150 animate-in fade-in slide-in-from-top-2 dark:border-gray-800 dark:bg-gray-900 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-88 sm:max-h-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Thông báo</span>
            <button
              onClick={async () => {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                setUnread(0);
                if (notificationCache) {
                  notificationCache = {
                    ...notificationCache,
                    unread_count: 0,
                    data: notificationCache.data.map((n) => ({ ...n, is_read: true })),
                    cachedAt: Date.now(),
                  };
                }
                try { await markAllRead(); } catch { /* silent */ }
              }}
              className="text-xs font-semibold text-violet-600 transition-colors hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
            >
              Đọc tất cả
            </button>
          </div>

          {/* List */}
          <div className="max-h-[calc(100svh-env(safe-area-inset-top)-9rem)] divide-y divide-gray-100 overflow-y-auto overscroll-contain dark:divide-gray-800/80 sm:max-h-96">
            {loading && (
              <div className="py-8 text-center text-sm font-medium text-gray-400 dark:text-gray-500">Đang tải...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                Không có thông báo nào
              </div>
            )}
            {!loading && notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                  !n.is_read ? 'bg-violet-50/60 dark:bg-violet-950/25' : 'bg-transparent'
                }`}
              >
                {/* Avatar */}
                <img
                  src={n.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor_name || 'U')}&size=36`}
                  alt={n.actor_name}
                  className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                />
                <div className="min-w-0 flex-1">
                  {n.type === 'admin_announcement' ? (
                    <>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{n.title || 'Thông báo từ MOLY.STUDIO'}</p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-600 dark:text-gray-300">{n.message}</p>
                    </>
                  ) : (
                    <p className="text-xs leading-snug text-gray-700 dark:text-gray-300">
                      <span className="font-bold text-gray-900 dark:text-white">{n.actor_name}</span>
                      {' '}{TYPE_LABEL[n.type] || 'đã tương tác với bài viết của bạn'}
                    </p>
                  )}
                  {n.post_preview && (
                    <p className="mt-1 truncate text-xs italic text-gray-400 dark:text-gray-500">
                      "{n.post_preview?.slice(0, 60)}{(n.post_preview?.length ?? 0) > 60 ? '…' : ''}"
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600 shadow-sm dark:bg-violet-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
