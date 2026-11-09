import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../api/auth';
import axios, { clearStoredAuth, clearTokenCache } from '../utils/axios';

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
  rememberMe: boolean;

  // Actions
  setUser: (user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setRememberMe: (remember: boolean) => void;
  syncVipFromToken: () => void;
}

type PersistedAuthState = Pick<
  AuthState,
  'user' | 'token' | 'refreshToken' | 'isAuthenticated' | 'rememberMe'
>;

function writeSessionUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (user) sessionStorage.setItem('user', JSON.stringify(user));
  else sessionStorage.removeItem('user');
}

function readSessionAuth(): Partial<PersistedAuthState> | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem('token');
  const refreshToken = sessionStorage.getItem('refreshToken');
  const rawUser = sessionStorage.getItem('user');
  if (!token || !refreshToken || !rawUser) return null;
  try {
    return {
      user: JSON.parse(rawUser) as User,
      token,
      refreshToken,
      isAuthenticated: true,
      rememberMe: true,
    };
  } catch {
    sessionStorage.removeItem('user');
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      rememberMe: true,

      setUser: (user) => {
        writeSessionUser(user);
        set({ user, isAuthenticated: true });
      },

      setTokens: (token, refreshToken) => {
        clearTokenCache();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('refreshToken', refreshToken);
          writeSessionUser(get().user);
        }
        set({ token, refreshToken });
      },

      login: (user, token, refreshToken) => {
        clearTokenCache();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('refreshToken', refreshToken);
          writeSessionUser(user);
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
          rememberMe: true,
        });
      },

      updateUser: (userData) =>
        set((state) => {
          const nextUser = state.user ? { ...state.user, ...userData } : null;
          writeSessionUser(nextUser);
          return { ...state, user: nextUser };
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setRememberMe: () => {
        // Kept for compatibility with older callers. Browser sessions now
        // survive closing a tab; explicit logout still clears all auth data.
        set({ rememberMe: true });
      },

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
      version: 3,
      skipHydration: false,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        rememberMe: true,
      }),
      migrate: (persistedState) => {
        const legacy = (persistedState || {}) as Partial<PersistedAuthState>;
        return {
          user: legacy.user || null,
          token: legacy.token || null,
          refreshToken: legacy.refreshToken || null,
          isAuthenticated: legacy.isAuthenticated === true,
          rememberMe: true,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as Partial<PersistedAuthState>;
        const sessionAuth = readSessionAuth();
        const persistedHasSession = Boolean(persisted.token && persisted.refreshToken && persisted.user);
        return persistedHasSession
          ? { ...currentState, ...persisted, rememberMe: true }
          : sessionAuth
            ? { ...currentState, ...sessionAuth, rememberMe: true }
            : { ...currentState, ...persisted, rememberMe: true };
      },
      onRehydrateStorage: () => {
        return (state) => {
          // Sync token to sessionStorage after hydration so axios interceptor picks it up
          if (state?.token && state.refreshToken && typeof window !== 'undefined') {
            clearTokenCache();
            sessionStorage.setItem('token', state.token);
            sessionStorage.setItem('refreshToken', state.refreshToken);
            writeSessionUser(state.user);
          }
          // Persist an already-open legacy tab so its next newly opened tab
          // can restore the same login without another credential challenge.
          if (state && typeof window !== 'undefined') {
            queueMicrotask(() => useAuthStore.setState({ rememberMe: true }));
          }
        };
      },
    }
  )
);
