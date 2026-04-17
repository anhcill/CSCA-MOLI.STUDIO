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
    router.push(`/forum`);
  };

  if (!mounted || !isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
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
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Thông báo</span>
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
              className="text-xs text-violet-600 hover:text-violet-800 font-medium"
            >
              Đọc tất cả
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading && (
              <div className="py-8 text-center text-sm text-gray-400">Đang tải...</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">
                Không có thông báo nào
              </div>
            )}
            {!loading && notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-violet-50/60' : ''}`}
              >
                {/* Avatar */}
                <img
                  src={n.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor_name || 'U')}&size=36`}
                  alt={n.actor_name}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug">
                    <span className="font-semibold text-gray-900">{n.actor_name}</span>
                    {' '}{TYPE_LABEL[n.type] || 'đã tương tác với bài viết của bạn'}
                  </p>
                  {n.post_preview && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      "{n.post_preview?.slice(0, 60)}{(n.post_preview?.length ?? 0) > 60 ? '…' : ''}"
                    </p>
                  )}
                  <p className="text-[11px] text-violet-500 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
