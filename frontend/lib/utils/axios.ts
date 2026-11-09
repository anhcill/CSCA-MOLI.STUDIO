import axios, { type InternalAxiosRequestConfig } from 'axios';
import { forgetPreviousSession, getPreviousSessionToken, rememberPreviousSession } from './previousSession';
import { getDeviceIdentity } from './deviceIdentity';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Cache token in memory to avoid localStorage blocking
let cachedToken: string | null = null;
let tokenLastChecked = 0;
const TOKEN_CACHE_DURATION = 5000; // 5 seconds
let lastOfflineAuthToastAt = 0;
const AUTH_REVOKED_CODES = new Set(['SESSION_REVOKED', 'TOKEN_REVOKED', 'ADMIN_MFA_REQUIRED', 'INVALID_TOKEN']);
let refreshInFlight: Promise<{ token: string; refreshToken: string }> | null = null;

type AuthRequestConfig = InternalAxiosRequestConfig & { _authAccountId?: string | null };

function getStoredAccountId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = JSON.parse(sessionStorage.getItem('user') || 'null')?.id;
    return id == null ? null : String(id);
  } catch {
    return null;
  }
}

function belongsToCurrentAccount(config: AuthRequestConfig | undefined) {
  return Boolean(config?._authAccountId && config._authAccountId === getStoredAccountId());
}

export function clearTokenCache() {
  cachedToken = null;
  tokenLastChecked = 0;
}

async function recoverNewerToken(config: AuthRequestConfig) {
  if (!belongsToCurrentAccount(config)) return null;
  const { useAuthStore } = await import('../store/authStore');
  const current = useAuthStore.getState();
  try {
    const persisted = JSON.parse(localStorage.getItem('auth-storage') || 'null')?.state;
    if (current.rememberMe && persisted?.rememberMe && String(persisted.user?.id) === config._authAccountId
      && persisted.token && persisted.token !== current.token) {
      await useAuthStore.persist.rehydrate();
    }
  } catch {
    // A storage failure must not invalidate the active tab's session.
  }
  if (!belongsToCurrentAccount(config)) return null;
  const token = sessionStorage.getItem('token');
  return token && `Bearer ${token}` !== config.headers?.Authorization ? token : null;
}

export function clearStoredAuth(preservePreviousSession = false) {
  if (typeof window !== 'undefined') {
    if (preservePreviousSession) {
      rememberPreviousSession(sessionStorage.getItem('token'));
    } else {
      forgetPreviousSession();
    }
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('auth-storage');
  }
  clearTokenCache();
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  // A revoked or expired token is no longer an authorization credential, but
  // its signed session identity lets this browser reclaim its device slot.
  clearStoredAuth(true);
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function isJwtExpired(token: string | null) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now() + 30000;
  } catch {
    return false;
  }
}

function notifyOfflineAuthRequired() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastOfflineAuthToastAt < 15000) return;
  lastOfflineAuthToastAt = now;
  (window as any).moliToast?.('Cần mạng để đăng nhập lại. Bài làm vẫn được giữ trên máy.', 'warning');
}

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased from 10s to 30s
});

// Request interceptor - Add token to requests (OPTIMIZED)
axiosInstance.interceptors.request.use(
  (config) => {
    const authConfig = config as AuthRequestConfig;
    if ('_authAccountId' in authConfig && authConfig._authAccountId !== getStoredAccountId()) {
      throw new axios.CanceledError('Account changed before retry');
    }
    authConfig._authAccountId = getStoredAccountId();
    const deviceId = getDeviceIdentity();
    if (deviceId) config.headers['X-Device-Id'] = deviceId;
    if (config.url?.startsWith('/auth/')) {
      const previousSessionToken = getPreviousSessionToken();
      if (previousSessionToken) config.headers['X-Previous-Session'] = previousSessionToken;
    }
    const now = Date.now();
    // Only read from sessionStorage if cache is stale
    if (!cachedToken || now - tokenLastChecked > TOKEN_CACHE_DURATION) {
      cachedToken = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      tokenLastChecked = now;
    }
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
      if (typeof navigator !== 'undefined' && !navigator.onLine && isJwtExpired(cachedToken)) {
        notifyOfflineAuthRequired();
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const responseCode = error.response?.data?.code;

    // A delayed response from a logged-out/switched account must neither
    // replay its action nor clear the new account's credentials.
    if (error.response?.status === 401 && !belongsToCurrentAccount(originalRequest)) {
      return Promise.reject(error);
    }

    // Another request or tab may already have replaced this request's token.
    if (error.response?.status === 401 && originalRequest && !originalRequest._authResynced
      && originalRequest.headers?.Authorization) {
      const newerToken = await recoverNewerToken(originalRequest);
      if (!belongsToCurrentAccount(originalRequest)) return Promise.reject(error);
      if (newerToken) {
        originalRequest._authResynced = true;
        clearTokenCache();
        originalRequest.headers.Authorization = `Bearer ${newerToken}`;
        return axiosInstance(originalRequest);
      }
    }

    // ── Offline guard: never logout when no network ──
    if (!error.response && typeof navigator !== 'undefined' && !navigator.onLine) {
      // Network error while offline → reject silently, keep user logged in
      if (isJwtExpired(cachedToken || sessionStorage.getItem('token'))) {
        notifyOfflineAuthRequired();
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && AUTH_REVOKED_CODES.has(responseCode)) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // If token expired
    if (error.response?.status === 401 && responseCode === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (refreshToken) {
          if (!refreshInFlight) {
            refreshInFlight = (async () => {
              const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 30000 });
              const tokens = response.data.data;
              // Update Zustand and its persisted state as well as sessionStorage,
              // so reopening the app cannot restore the old refresh token.
              const { useAuthStore } = await import('../store/authStore');
              if (!belongsToCurrentAccount(originalRequest) || sessionStorage.getItem('refreshToken') !== refreshToken) {
                throw new Error('Session changed while refreshing');
              }
              useAuthStore.getState().setTokens(tokens.token, tokens.refreshToken);
              cachedToken = tokens.token;
              tokenLastChecked = Date.now();
              return tokens;
            })().finally(() => { refreshInFlight = null; });
          }
          const { token } = await refreshInFlight;
          if (!belongsToCurrentAccount(originalRequest)) return Promise.reject(error);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        }
        redirectToLogin();
      } catch (refreshError: any) {
        // If offline during refresh → don't logout, keep session
        if (!refreshError.response && typeof navigator !== 'undefined' && !navigator.onLine) {
          notifyOfflineAuthRequired();
          return Promise.reject(refreshError);
        }
        // Only a definitive rejection invalidates credentials. Timeouts,
        // throttling and server failures can be retried on the next request.
        if ([401, 403, 404].includes(refreshError.response?.status)
          && belongsToCurrentAccount(originalRequest)
          && !await recoverNewerToken(originalRequest)
          && belongsToCurrentAccount(originalRequest)) {
          redirectToLogin();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
