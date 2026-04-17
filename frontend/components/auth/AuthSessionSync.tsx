'use client';

import { useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthSessionSync() {
  const { isAuthenticated, setUser, logout } = useAuthStore();
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
