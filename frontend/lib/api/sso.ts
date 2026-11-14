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

export interface SsoLaunchResult {
  launchUrl: string | null;
  targetPath: string;
  offeringId: string | null;
  expiresAt: string;
  expiresInSeconds: number;
}

export function isSafeRelativeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('..')) {
    return false;
  }
  return !/[\u0000-\u0020\u007f]/.test(trimmed);
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
  async launchCourseSso(params: { courseId?: number | null; targetPath?: string | null }): Promise<SsoLaunchResult> {
    const response = await axiosInstance.post('/sso/course/launch', params);
    return response.data.data;
  },

  async consumeCode(params: { code: string; state: string }): Promise<SsoConsumeResult> {
    const response = await axiosInstance.post('/sso/consume', params);
    return response.data.data;
  },

  async confirmSafeLink(params: { linkToken: string; password?: string | null }): Promise<SsoConsumeResult> {
    const response = await axiosInstance.post('/sso/link/confirm', params);
    return response.data.data;
  },
};
