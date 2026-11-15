import axiosInstance from '@/lib/utils/axios';

export interface SsoConsumeResult {
  status: 'AUTHENTICATED' | 'LINK_REQUIRED';
  redirectPath?: string;
  user?: Record<string, unknown>;
  token?: string;
  refreshToken?: string;
  linkToken?: string;
  email?: string;
  hasPassword?: boolean;
  targetPath?: string;
}

export interface SsoIntentResult {
  destinationStartUrl: string | null;
  targetPath: string;
  offeringId: string | null;
  courseId?: number | null;
  scopeType?: string;
}

export interface SsoStartResult {
  authorizeUrl: string | null;
  targetPath: string;
  expiresAt: string;
}

export interface SsoAuthorizeResult {
  redirectUrl: string | null;
  launchUrl: string | null;
  targetPath: string;
  offeringId: string | null;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface PendingSafeLinkState {
  linkToken: string;
  email: string;
  hasPassword: boolean;
  targetPath: string;
}

const MOLY_PENDING_LINK_STORAGE_KEY = 'moly_sso_pending_link';

export function getSsoApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (axiosInstance.defaults.baseURL as string) || '/api';
  }
  const configured = process.env.NEXT_PUBLIC_API_URL || '/api';
  if (!configured.startsWith('http://') && !configured.startsWith('https://')) {
    return configured;
  }
  try {
    const parsed = new URL(configured, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      // Proxy through same-origin Next.js /api rewrite so SameSite=Lax SSO cookies stay first-party.
      return '/api';
    }
    return configured;
  } catch {
    return '/api';
  }
}

export function isSafeRelativeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('..')) {
    return false;
  }
  return !/[\u0000-\u0020\u007f]/.test(trimmed);
}

export function savePendingSafeLink(state: PendingSafeLinkState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MOLY_PENDING_LINK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPendingSafeLink(): PendingSafeLinkState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MOLY_PENDING_LINK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSafeLinkState>;
    if (!parsed || typeof parsed.linkToken !== 'string' || !parsed.linkToken.trim()) return null;
    return {
      linkToken: parsed.linkToken.trim(),
      email: typeof parsed.email === 'string' ? parsed.email : '',
      hasPassword: Boolean(parsed.hasPassword),
      targetPath: isSafeRelativeRedirectPath(parsed.targetPath) ? parsed.targetPath : '/khoa-hoc',
    };
  } catch {
    return null;
  }
}

export function clearPendingSafeLink(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(MOLY_PENDING_LINK_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

let cachedStrictModeParams: { pathname: string; code: string; state: string; expiresAt: number } | null = null;

export function extractAndStripSsoParams(): { code: string; state: string } | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(rawHash);
  const queryParams = new URLSearchParams(window.location.search);

  const code = (hashParams.get('code') || queryParams.get('code') || '').trim();
  const state = (hashParams.get('state') || queryParams.get('state') || '').trim();

  if (window.location.hash || window.location.search) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  if (code && state) {
    cachedStrictModeParams = {
      pathname: window.location.pathname,
      code,
      state,
      expiresAt: Date.now() + 3000,
    };
    return { code, state };
  }

  if (
    cachedStrictModeParams
    && cachedStrictModeParams.pathname === window.location.pathname
    && cachedStrictModeParams.expiresAt > Date.now()
  ) {
    return { code: cachedStrictModeParams.code, state: cachedStrictModeParams.state };
  }

  return null;
}

export const ssoApi = {
  async intentCourseSso(params: { courseId?: number | null; offeringId?: string | null; targetPath?: string | null }): Promise<SsoIntentResult> {
    const response = await axiosInstance.post('/sso/course/intent', params, {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },

  async startIncomingCourseSso(params: { targetPath?: string | null }): Promise<SsoStartResult> {
    const response = await axiosInstance.post('/sso/csca-course/start', params, {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },

  async authorizeCourseSso(params: {
    state: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    courseId?: number | null;
    offeringId?: string | null;
    targetPath?: string | null;
  }): Promise<SsoAuthorizeResult> {
    const response = await axiosInstance.post('/sso/course/authorize', params, {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },

  async consumeCode(params: { code: string; state: string }): Promise<SsoConsumeResult> {
    const response = await axiosInstance.post('/sso/consume', params, {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },

  async getSafeLinkStatus(): Promise<{ status: string; email: string; hasPassword: boolean; targetPath: string; expiresAt: string }> {
    const response = await axiosInstance.get('/sso/link/status', {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },

  async confirmSafeLink(params: { linkToken: string; password?: string | null }): Promise<SsoConsumeResult> {
    const response = await axiosInstance.post('/sso/link/confirm', params, {
      baseURL: getSsoApiBaseUrl(),
      withCredentials: true,
    });
    return response.data.data;
  },
};
