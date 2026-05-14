'use client';

import { useState, useEffect } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';
import axios from '@/lib/utils/axios';

const UNREAD_CACHE_TTL = 30_000;
const UNREAD_POLL_INTERVAL = 60_000;
let unreadCache: { count: number; cachedAt: number } | null = null;
let unreadRequest: Promise<number> | null = null;

async function fetchUnreadShared() {
  const now = Date.now();
  if (unreadCache && now - unreadCache.cachedAt < UNREAD_CACHE_TTL) {
    return unreadCache.count;
  }

  if (!unreadRequest) {
    unreadRequest = axios.get('/messages/unread-count')
      .then((res) => {
        const count = res.data.data?.count || 0;
        unreadCache = { count, cachedAt: Date.now() };
        return count;
      })
      .finally(() => {
        unreadRequest = null;
      });
  }

  return unreadRequest;
}

export default function MessageBadge() {
  const { user, isAuthenticated } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchUnread = async () => {
      try {
        const count = await fetchUnreadShared();
        setUnreadCount(count);
      } catch {
        // ignore
      }
    };

    fetchUnread();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnread();
    }, UNREAD_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  if (!mounted || !isAuthenticated || !user) return null;

  return (
    <Link
      href="/tin-nhan"
      className="relative p-2 text-gray-500 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
      title="Tin nhắn"
    >
      <FiMessageSquare size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
