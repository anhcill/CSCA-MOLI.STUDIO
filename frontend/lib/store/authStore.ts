import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../api/auth';
import { clearTokenCache } from '../utils/axios';

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const safeSessionSet = (key: string, value: string) => {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(key, value);
};

const safeSessionRemove = (key: string) => {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(key);
};

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
function syncVipFromToken(user: User, token: string | null): User | null {
  if (!user || !token) return user;
  const payload = decodeJwtPayload(token);
  if (!payload) return user;

  const isVip = payload.is_vip === true;
  const vipExpiresAt = (payload.vip_expires_at as string) || null;

  // Only update if different from stored
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

type PersistedAuthState = Pick<
  AuthState,
  'user' | 'token' | 'refreshToken' | 'isAuthenticated'
>;

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) =>
        set((state) => {
          safeSessionSet('user', JSON.stringify(user));
          return { ...state, user, isAuthenticated: true };
        }),

      setTokens: (token, refreshToken) =>
        set({ token, refreshToken }),

      login: (user, token, refreshToken) => {
        // Save to sessionStorage (per-tab isolation)
        safeSessionSet('token', token);
        safeSessionSet('refreshToken', refreshToken);
        safeSessionSet('user', JSON.stringify(user));

        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Clear sessionStorage
        safeSessionRemove('token');
        safeSessionRemove('refreshToken');
        safeSessionRemove('user');

        // Clear axios token cache
        clearTokenCache();

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
          if (nextUser) {
            safeSessionSet('user', JSON.stringify(nextUser));
          }
          return {
            ...state,
            user: nextUser,
          };
        }),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      // Re-check live VIP status from JWT (call after payment success, token refresh, etc.)
      syncVipFromToken: () => {
        const { user, token } = get();
        const updated = syncVipFromToken(user, token);
        if (updated && updated !== user) {
          safeSessionSet('user', JSON.stringify(updated));
          set({ user: updated });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: {
        getItem: (name) => {
          const storage = getSessionStorage();
          if (!storage) return null;
          const str = storage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          const storage = getSessionStorage();
          if (!storage) return;
          storage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          const storage = getSessionStorage();
          if (!storage) return;
          storage.removeItem(name);
        },
      },
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
