import axios from 'axios';
import { getPreviousSessionToken, rememberPreviousSession } from './previousSession';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Cache token in memory to avoid localStorage blocking
let cachedToken: string | null = null;
let tokenLastChecked = 0;
const TOKEN_CACHE_DURATION = 5000; // 5 seconds
let lastOfflineAuthToastAt = 0;
const AUTH_REVOKED_CODES = new Set(['SESSION_REVOKED', 'TOKEN_REVOKED', 'ADMIN_MFA_REQUIRED']);
let refreshInFlight: Promise<{ token: string; refreshToken: string }> | null = null;

export function clearTokenCache() {
  cachedToken = null;
  tokenLastChecked = 0;
}

export function clearStoredAuth() {
  if (typeof window !== 'undefined') {
    rememberPreviousSession(sessionStorage.getItem('token'));
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('auth-storage');
  }
  clearTokenCache();
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  clearStoredAuth();
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
              const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
              const tokens = response.data.data;
              // Update Zustand and its persisted state as well as sessionStorage,
              // so reopening the app cannot restore the old refresh token.
              const { useAuthStore } = await import('../store/authStore');
              useAuthStore.getState().setTokens(tokens.token, tokens.refreshToken);
              cachedToken = tokens.token;
              tokenLastChecked = Date.now();
              return tokens;
            })().finally(() => { refreshInFlight = null; });
          }
          const { token } = await refreshInFlight;

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError: any) {
        // If offline during refresh → don't logout, keep session
        if (!refreshError.response && typeof navigator !== 'undefined' && !navigator.onLine) {
          notifyOfflineAuthRequired();
          return Promise.reject(refreshError);
        }
        // Online but refresh truly failed → logout
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
