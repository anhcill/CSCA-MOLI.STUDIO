'use client';

import { useState, useEffect } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';
import axios from '@/lib/utils/axios';

export default function MessageBadge() {
  const { user, isAuthenticated } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchUnread = async () => {
      try {
        const res = await axios.get('/messages/unread-count');
        setUnreadCount(res.data.data?.count || 0);
      } catch {
        // ignore
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // poll every 15s
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
