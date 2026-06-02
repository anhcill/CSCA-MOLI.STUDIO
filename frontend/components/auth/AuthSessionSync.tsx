'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthSessionSync() {
  const { isAuthenticated, setUser, logout, setTokens, refreshToken } = useAuthStore();
  const syncedRef = useRef(false);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
  }, []);

  const syncSession = useCallback((force = false) => {
    if (!isAuthenticated) return;
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 30000) return;
    lastSyncRef.current = now;
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
  }, [isAuthenticated, setUser, logout, setTokens, refreshToken]);

  useEffect(() => {
    if (!isAuthenticated || syncedRef.current) return;
    syncedRef.current = true;
    syncSession(true);
  }, [isAuthenticated, syncSession]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return;
    const onFocus = () => syncSession(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncSession(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, syncSession]);

  return null;
}
