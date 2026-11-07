'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthSessionSync() {
  const { isAuthenticated, setUser, setTokens } = useAuthStore();
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
    const sessionToken = useAuthStore.getState().token;
    getCurrentUser()
      .then((response) => {
        if (useAuthStore.getState().token !== sessionToken) return;
        if (response?.success && response?.data?.user) {
          setUser(response.data.user);
          // Cập nhật token mới nếu backend gửi kèm (ví dụ: để đồng bộ trạng thái VIP)
          if (response.data.token) {
             setTokens(response.data.token, useAuthStore.getState().refreshToken || '');
          }
        }
      })
      // The HTTP interceptor handles expiry/revocation. A background sync
      // must never send logout for a session that another tab just renewed.
      .catch(() => {});
  }, [isAuthenticated, setUser, setTokens]);

  useEffect(() => {
    if (!isAuthenticated) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
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
