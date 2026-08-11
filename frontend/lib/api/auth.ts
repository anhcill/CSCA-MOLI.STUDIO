import axios from '../utils/axios';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  turnstileToken?: string;
  acceptedTerms: boolean;
  termsVersion?: string;
  privacyVersion?: string;
}

export interface LoginData {
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  display_name?: string;
  avatar: string;
  avatar_url?: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  bio?: string;
  target_score?: number;
  is_vip?: boolean;
  subscription_tier?: 'basic' | 'vip' | 'premium' | null;
  vip_expires_at?: string;
  vip_package_id?: number | null;
  vip_allowed_subjects?: string[];
  created_at?: string;
  is_verified?: boolean;
  is_active?: boolean;
  coins?: number;
  current_streak?: number;
  longest_streak?: number;
  exp?: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  code?: string;
  requiresOtp?: boolean;
  userId?: number;
  requiresAdminMfa?: boolean;
  requiresAdminMfaSetup?: boolean;
  mfaToken?: string;
  adminEmail?: string;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
    email?: string;
    emailVerificationSent?: boolean;
  };
}

export interface DeviceSession {
  id?: number;
  jti: string;
  device_info?: string;
  device_type?: 'mobile' | 'desktop';
  ip_address?: string;
  last_active?: string;
  created_at?: string;
}

export interface DeviceLimitData {
  deviceType: 'mobile' | 'desktop';
  maxDevices: number;
  sessions: DeviceSession[];
  requestToken: string;
  approveUrl: string;
  expiresAt: string;
  targetSessionJti?: string | null;
}

export interface DeviceLoginStatusResponse extends AuthResponse {
  status?: string;
  expiresAt?: string;
  deviceType?: 'mobile' | 'desktop';
  deviceLimit?: DeviceLimitData;
}

export interface AdminMfaSetupData {
  issuer: string;
  accountName: string;
  manualKey: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface AdminMfaAuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
  backupCodes?: string[];
}

/**
 * Register new user
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await axios.post('/auth/register', data);
  return response.data;
};

/**
 * Login user
 */
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await axios.post('/auth/login', data);
  return response.data;
};

/**
 * Get current user
 */
export const getCurrentUser = async (): Promise<{ success: boolean; data: { user: User } }> => {
  const response = await axios.get('/auth/me');
  return response.data;
};

/**
 * Logout user
 */
export const logout = async (): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post('/auth/logout');
  return response.data;
};

/**
 * Refresh token
 */
export const refreshToken = async (refreshToken: string): Promise<{ success: boolean; data: { token: string; refreshToken: string } }> => {
  const response = await axios.post('/auth/refresh', { refreshToken });
  return response.data;
};

/**
 * Google OAuth authentication
 */
export const googleAuth = async (
  auth: string | { credential?: string; accessToken?: string; acceptedTerms?: boolean; termsVersion?: string; privacyVersion?: string }
): Promise<AuthResponse> => {
  const payload = typeof auth === 'string' ? { credential: auth } : auth;
  const response = await axios.post('/auth/google', payload);
  return response.data;
};

export const startAdminMfaSetup = async (mfaToken: string): Promise<{ success: boolean; message: string; data: AdminMfaSetupData }> => {
  const response = await axios.post('/auth/admin-mfa/setup/start', { mfaToken });
  return response.data;
};

export const confirmAdminMfaSetup = async (mfaToken: string, code: string): Promise<AdminMfaAuthResponse> => {
  const response = await axios.post('/auth/admin-mfa/setup/confirm', { mfaToken, code });
  return response.data;
};

export const verifyAdminMfa = async (mfaToken: string, code: string): Promise<AdminMfaAuthResponse> => {
  const response = await axios.post('/auth/admin-mfa/verify', { mfaToken, code });
  return response.data;
};

// ─── OTP Authentication ─────────────────────────────────────────────────────────

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  requiresAdminMfa?: boolean;
  requiresAdminMfaSetup?: boolean;
  mfaToken?: string;
  adminEmail?: string;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
}

/**
 * Verify OTP sent during login
 */
export const verifyOtp = async (userId: number, otp: string): Promise<OtpVerifyResponse> => {
  const response = await axios.post('/auth/otp/verify', { userId, otp, reason: 'login' });
  return response.data;
};

/**
 * Resend OTP code
 */
export const resendOtp = async (userId: number): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post('/auth/otp/resend', { userId, reason: 'login' });
  return response.data;
};

export const resendVerificationEmail = async (
  email: string,
  turnstileToken: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post('/auth/resend-verification-email', {
    email,
    turnstileToken,
  });
  return response.data;
};

export const getDeviceLoginStatus = async (token: string): Promise<DeviceLoginStatusResponse> => {
  const response = await axios.get(`/auth/device-login-requests/${token}/status`);
  return response.data;
};

export const selectDeviceLoginTarget = async (token: string, sessionJti: string): Promise<{ success: boolean; message: string; targetSessionJti: string }> => {
  const response = await axios.post(`/auth/device-login-requests/${token}/target`, { sessionJti });
  return response.data;
};

export const approveDeviceLogin = async (token: string): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post(`/auth/device-login-requests/${token}/approve`);
  return response.data;
};

export const sendDeviceReplacementOtp = async (token: string): Promise<{ success: boolean; message: string; maskedEmail?: string; retryAfterSeconds?: number }> => {
  const response = await axios.post(`/auth/device-login-requests/${token}/otp`);
  return response.data;
};

export const verifyDeviceReplacementOtp = async (token: string, otp: string): Promise<OtpVerifyResponse> => {
  const response = await axios.post(`/auth/device-login-requests/${token}/otp/verify`, { otp });
  return response.data;
};

/**
 * Verify OTP for password change
 */
export const verifyOtpForPasswordReset = async (userId: number, otp: string): Promise<OtpVerifyResponse> => {
  const response = await axios.post('/auth/otp/verify', { userId, otp, reason: 'password_change' });
  return response.data;
};
