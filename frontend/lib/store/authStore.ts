import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../api/auth';
import axios, { clearStoredAuth } from '../utils/axios';

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
  const subscription_tier = typeof payload.subscription_tier === 'string' ? payload.subscription_tier : user.subscription_tier;
  const vipPackageId = typeof payload.vip_package_id === 'number' ? payload.vip_package_id : user.vip_package_id;
  const vipAllowedSubjects = Array.isArray(payload.vip_allowed_subjects)
    ? payload.vip_allowed_subjects.filter((item): item is string => typeof item === 'string')
    : user.vip_allowed_subjects;

  if (
    user.is_vip !== isVip ||
    user.vip_expires_at !== vipExpiresAt ||
    user.subscription_tier !== subscription_tier ||
    user.vip_package_id !== vipPackageId ||
    JSON.stringify(user.vip_allowed_subjects || []) !== JSON.stringify(vipAllowedSubjects || [])
  ) {
    return {
      ...user,
      is_vip: isVip,
      vip_expires_at: vipExpiresAt,
      subscription_tier: subscription_tier as any,
      vip_package_id: vipPackageId,
      vip_allowed_subjects: vipAllowedSubjects,
    };
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
        const token = typeof window !== 'undefined'
          ? sessionStorage.getItem('token') || get().token
          : get().token;

        if (token) {
          axios.post('/auth/logout', undefined, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }

        clearStoredAuth();
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
