import axios from '../utils/axios';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
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
  subscription_tier?: 'vip' | 'premium' | null;
  vip_expires_at?: string;
  created_at?: string;
  is_verified?: boolean;
  is_active?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  requiresOtp?: boolean;
  userId?: number;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
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
export const googleAuth = async (credential: string): Promise<AuthResponse> => {
  const response = await axios.post('/auth/google', { credential });
  return response.data;
};

// ─── OTP Authentication ─────────────────────────────────────────────────────────

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
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

/**
 * Verify OTP for password change
 */
export const verifyOtpForPasswordReset = async (userId: number, otp: string): Promise<OtpVerifyResponse> => {
  const response = await axios.post('/auth/otp/verify', { userId, otp, reason: 'password_change' });
  return response.data;
};
