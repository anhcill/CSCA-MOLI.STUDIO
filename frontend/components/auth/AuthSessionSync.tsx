'use client';

import { useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthSessionSync() {
  const { isAuthenticated, setUser, logout, setTokens, token, refreshToken } = useAuthStore();
  const syncedRef = useRef(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;

    getCurrentUser()
      .then((response) => {
        if (response?.success && response?.data?.user) {
          setUser(response.data.user);
          // Cập nhật token mới nếu backend gửi kèm (ví dụ: để đồng bộ trạng thái VIP)
          if ((response.data as any).token) {
             setTokens((response.data as any).token, refreshToken || '');
          }
        }
      })
      .catch((error: any) => {
        if (error?.response?.status === 401) {
          logout();
        }
      });
  }, [isAuthenticated, setUser, logout]);

  return null;
}
