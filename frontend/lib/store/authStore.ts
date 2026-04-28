import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../api/auth';
import { clearTokenCache } from '../utils/axios';

// Decode JWT payload (base64url)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Sync VIP fields from live JWT token (called on app init)
function syncVipFromToken(user: User | null, token: string | null): User | null {
  if (!user || !token) return user;
  const payload = decodeJwtPayload(token);
  if (!payload) return user;

  const isVip = payload.is_vip === true;
  const vipExpiresAt =
    typeof payload.vip_expires_at === 'string' && payload.vip_expires_at.length > 0
      ? payload.vip_expires_at
      : undefined;

  if (user.is_vip !== isVip || user.vip_expires_at !== vipExpiresAt) {
    return { ...user, is_vip: isVip, vip_expires_at: vipExpiresAt };
  }
  return user;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  syncVipFromToken: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], Pick<AuthState, 'user' | 'token' | 'refreshToken' | 'isAuthenticated'>>(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setTokens: (token, refreshToken) => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('refreshToken', refreshToken);
        }
        set({ token, refreshToken });
      },

      login: (user, token, refreshToken) => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('refreshToken', refreshToken);
        }
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        clearTokenCache();
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refreshToken');
        }
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (userData) =>
        set((state) => {
          const nextUser = state.user ? { ...state.user, ...userData } : null;
          return { ...state, user: nextUser };
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      syncVipFromToken: () => {
        const { user, token } = get();
        const updated = syncVipFromToken(user, token);
        if (updated && updated !== user) {
          set({ user: updated });
        }
      },
    }),
    {
      name: 'auth-storage',
      skipHydration: false,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // Sync token to sessionStorage after hydration so axios interceptor picks it up
          if (state?.token && state?.refreshToken && typeof window !== 'undefined') {
            sessionStorage.setItem('token', state.token);
            sessionStorage.setItem('refreshToken', state.refreshToken);
          }
        };
      },
    }
  )
);
