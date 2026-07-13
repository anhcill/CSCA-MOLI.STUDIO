'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiAlertTriangle, FiBell, FiCheck, FiFileText, FiShield } from 'react-icons/fi';
import { AdminNotification, riskCenterApi } from '@/lib/api/riskCenter';
import { initSocket } from '@/lib/socket';

function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
}

function targetFor(notification: AdminNotification) {
  if (notification.type === 'question_report') return '/admin/risk-center?tab=question';
  if (notification.type === 'exam_violation' || notification.type === 'exam_risk') {
    return '/admin/risk-center?tab=exam';
  }
  return '/admin/risk-center?tab=notification';
}

function announceRiskCenterTab(target: string) {
  const tab = new URL(target, window.location.origin).searchParams.get('tab');
  if (tab) window.dispatchEvent(new CustomEvent('admin-risk-center-tab', { detail: { tab } }));
}

function NotificationIcon({ type }: { type: string }) {
  if (type === 'question_report') return <FiFileText size={15} />;
  if (type === 'exam_violation' || type === 'exam_risk') return <FiShield size={15} />;
  return <FiAlertTriangle size={15} />;
}

export default function AdminNotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        riskCenterApi.getNotifications({ page: 1, limit: 8 }),
        riskCenterApi.getUnreadCount(),
      ]);
      setNotifications(list.data);
      setUnreadCount(unread);
    } catch {
      // The bell is supplementary; do not block the admin page if it fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const socket = initSocket();
    socket?.emit('join_admin_risk_center');
    const handleNotification = (notification: AdminNotification) => {
      setNotifications((current) => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, 8));
      setUnreadCount((current) => current + 1);
    };
    socket?.on('admin_notification', handleNotification);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      socket?.off('admin_notification', handleNotification);
      socket?.emit('leave_admin_risk_center');
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const openNotification = async (notification: AdminNotification) => {
    if (!notification.read_at) {
      try {
        await riskCenterApi.markRead(notification.id);
        setNotifications(current => current.map(item => (
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )));
        setUnreadCount(current => Math.max(0, current - 1));
      } catch {
        // Navigation is still useful even if marking as read failed.
      }
    }
    setOpen(false);
    const target = targetFor(notification);
    announceRiskCenterTab(target);
    router.push(target);
  };

  const markAllRead = async () => {
    try {
      await riskCenterApi.markAllRead();
      setUnreadCount(0);
      setNotifications(current => current.map(item => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    } catch {
      // Keep the current state so the admin can retry.
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`relative flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
          unreadCount > 0
            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
        aria-label={`Thông báo admin${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
      >
        <FiBell size={17} className={unreadCount > 0 ? 'animate-pulse' : ''} />
        {unreadCount > 0 && <span className="hidden sm:inline">{unreadCount} việc mới</span>}
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Việc cần admin xử lý</p>
              <p className="text-[11px] text-slate-500">Gian lận thi và báo lỗi đề mới nhất</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-700">
                <FiCheck size={12} /> Đọc hết
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {loading && <p className="px-4 py-10 text-center text-xs text-slate-400">Đang tải thông báo...</p>}
            {!loading && notifications.length === 0 && (
              <div className="px-4 py-10 text-center text-slate-400">
                <FiBell size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">Chưa có việc mới</p>
              </div>
            )}
            {!loading && notifications.map(notification => (
              <button
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
                className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
                  notification.read_at ? '' : 'bg-violet-50/60 dark:bg-violet-950/20'
                }`}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  notification.type === 'question_report'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                }`}>
                  <NotificationIcon type={notification.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2">
                    <span className="line-clamp-2 flex-1 text-xs font-bold text-slate-900 dark:text-white">{notification.title}</span>
                    {!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
                  </span>
                  {notification.message && <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-500">{notification.message}</span>}
                  <span className="mt-1 block text-[10px] font-medium text-slate-400">{timeAgo(notification.created_at)}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const target = '/admin/risk-center?tab=notification';
              setOpen(false);
              announceRiskCenterTab(target);
              router.push(target);
            }}
            className="w-full border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-violet-600 hover:bg-violet-50 dark:border-slate-800 dark:hover:bg-violet-950/20"
          >
            Xem tất cả trong Risk Center
          </button>
        </div>
      )}
    </div>
  );
}
