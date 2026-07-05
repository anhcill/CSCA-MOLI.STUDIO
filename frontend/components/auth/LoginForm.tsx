'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  login,
  googleAuth,
  getCurrentUser,
  verifyOtp,
  resendOtp,
  getDeviceLoginStatus,
  approveDeviceLogin,
  sendDeviceReplacementOtp,
  verifyDeviceReplacementOtp,
  startAdminMfaSetup,
  confirmAdminMfaSetup,
  verifyAdminMfa,
  type AdminMfaSetupData,
  type AuthResponse,
  type DeviceLimitData,
  type OtpVerifyResponse,
  type User,
} from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDefaultAdminRoute } from '@/lib/utils/permissions';
import { sanitizeInput } from '@/lib/utils/security';
import { useLanguage } from '@/context/LanguageContext';
import SocialAuthButtons from './SocialAuthButtons';
import TermsModal from './TermsModal';
import TurnstileBox, { isTurnstileEnabled } from './TurnstileBox';
import { FiArrowRight, FiLock, FiMail, FiShield } from 'react-icons/fi';

export default function LoginForm() {
  const router = useRouter();
  const { login: setAuth, logout: clearAuth, setLoading, isAuthenticated } = useAuthStore();
  const { t, format } = useLanguage();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'terms' | 'privacy'>('terms');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);
  // ── OTP Step ────────────────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [adminMfaStep, setAdminMfaStep] = useState<'verify' | 'setup' | 'backup' | null>(null);
  const [adminMfaToken, setAdminMfaToken] = useState('');
  const [adminMfaEmail, setAdminMfaEmail] = useState('');
  const [adminMfaCode, setAdminMfaCode] = useState('');
  const [adminMfaSetup, setAdminMfaSetup] = useState<AdminMfaSetupData | null>(null);
  const [adminMfaBackupCodes, setAdminMfaBackupCodes] = useState<string[]>([]);
  const [adminMfaError, setAdminMfaError] = useState('');
  const [adminMfaLoading, setAdminMfaLoading] = useState(false);
  const [deviceLimitData, setDeviceLimitData] = useState<DeviceLimitData | null>(null);
  const [deviceApprovalToken, setDeviceApprovalToken] = useState('');
  const [deviceApprovalMessage, setDeviceApprovalMessage] = useState('');
  const [deviceApprovalError, setDeviceApprovalError] = useState('');
  const [deviceApprovalLoading, setDeviceApprovalLoading] = useState(false);
  const [deviceOtpOpen, setDeviceOtpOpen] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState('');
  const [deviceOtpSending, setDeviceOtpSending] = useState(false);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('deviceApproval') || '';
    if (token) setDeviceApprovalToken(token);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitized = sanitizeInput(value);
    setFormData((prev) => ({ ...prev, [name]: sanitized }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!formData.email) {
      newErrors.email = t('auth.requiredEmail');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (!formData.password) {
      newErrors.password = t('auth.requiredPassword');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.passwordMin6');
    }
    if (isTurnstileEnabled && !turnstileToken) {
      newErrors.general = 'Vui lòng xác nhận Cloudflare trước khi đăng nhập.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const deviceTypeLabel = deviceLimitData?.deviceType === 'mobile' ? 'điện thoại' : 'máy tính';
  const deviceApproveUrl = deviceLimitData?.approveUrl
    || (deviceLimitData?.requestToken && typeof window !== 'undefined'
      ? `${window.location.origin}/login?deviceApproval=${encodeURIComponent(deviceLimitData.requestToken)}`
      : '');
  const deviceQrUrl = deviceApproveUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deviceApproveUrl)}`
    : '';

  const completeAuth = async (user: User, token: string, refreshToken: string) => {
    setAuth(user, token, refreshToken);
    setLoginAttempts(0);

    let effectiveUser = user;
    try {
      const me = await getCurrentUser();
      if (me?.success && me?.data?.user) {
        effectiveUser = me.data.user;
        setAuth(effectiveUser, token, refreshToken);
      }
    } catch {
      // Keep fallback
    }
    router.push(getDefaultAdminRoute(effectiveUser));
  };

  const completeAuthData = async (data?: AuthResponse['data'] | OtpVerifyResponse['data']) => {
    if (!data?.user || !data.token || !data.refreshToken) return false;
    await completeAuth(data.user, data.token, data.refreshToken);
    return true;
  };

  const startAdminMfaFlow = async (response: AuthResponse | OtpVerifyResponse) => {
    if (!response.mfaToken) return false;

    setOtpStep(false);
    setAdminMfaToken(response.mfaToken);
    setAdminMfaEmail(response.adminEmail || '');
    setAdminMfaCode('');
    setAdminMfaError('');
    setAdminMfaBackupCodes([]);

    if (response.requiresAdminMfaSetup) {
      setAdminMfaStep('setup');
      setAdminMfaLoading(true);
      try {
        const setupResponse = await startAdminMfaSetup(response.mfaToken);
        setAdminMfaSetup(setupResponse.data);
      } catch (error: any) {
        setAdminMfaError(error.response?.data?.message || 'Khong tao duoc ma QR. Vui long dang nhap lai.');
      } finally {
        setAdminMfaLoading(false);
      }
      return true;
    }

    if (response.requiresAdminMfa) {
      setAdminMfaStep('verify');
      setAdminMfaSetup(null);
      return true;
    }

    return false;
  };

  const handleAdminMfaSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = adminMfaCode.trim();
    if (!adminMfaToken || code.length < 6) {
      setAdminMfaError('Nhap ma 6 so trong Microsoft Authenticator.');
      return;
    }

    setAdminMfaLoading(true);
    setAdminMfaError('');
    try {
      const response = adminMfaStep === 'setup'
        ? await confirmAdminMfaSetup(adminMfaToken, code)
        : await verifyAdminMfa(adminMfaToken, code);

      if (response.success && response.data) {
        if (response.backupCodes?.length) {
          setAuth(response.data.user, response.data.token, response.data.refreshToken);
          setAdminMfaBackupCodes(response.backupCodes);
          setAdminMfaStep('backup');
          return;
        }
        await completeAuth(response.data.user, response.data.token, response.data.refreshToken);
      } else {
        setAdminMfaError(response.message || 'Ma Microsoft Authenticator khong dung.');
      }
    } catch (error: any) {
      setAdminMfaError(error.response?.data?.message || 'Ma Microsoft Authenticator khong dung.');
    } finally {
      setAdminMfaLoading(false);
    }
  };

  const finishAdminMfaBackup = async () => {
    const token = sessionStorage.getItem('token');
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (token && refreshToken) {
      try {
        const me = await getCurrentUser();
        if (me?.success && me?.data?.user) {
          router.push(getDefaultAdminRoute(me.data.user));
        }
      } catch {
        router.push('/admin');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!validateForm()) return;
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});

    try {
      const response = await login({ ...formData, turnstileToken });
      if (response.success) {
        if (await startAdminMfaFlow(response)) {
          setIsSubmitting(false);
          setLoading(false);
          return;
        }

        // ── OTP Flow ──────────────────────────────────────────────────────
        if (response.requiresOtp && response.userId) {
          setPendingUserId(response.userId);
          setOtpStep(true);
          setOtpCountdown(60);
          setOtpValues(['', '', '', '', '', '']);
          setOtpError('');
          setIsSubmitting(false);
          setLoading(false);
          // Focus first OTP input after render
          setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
          return;
        }

        // ── Direct login (no OTP) ─────────────────────────────────────────
        await completeAuthData(response.data);
      }
    } catch (error: any) {
      setTurnstileToken('');
      setTurnstileResetKey(key => key + 1);
      if (error.response?.data?.code === 'DEVICE_LIMIT_REACHED' && error.response?.data?.data) {
        setDeviceLimitData(error.response.data.data as DeviceLimitData);
        setDeviceApprovalMessage('');
        setDeviceApprovalError('');
        setDeviceOtpOpen(false);
        setDeviceOtp('');
        setErrors({});
        return;
      }
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 5) {
        const lockDuration = Math.min(5 * 60 * 1000, newAttempts * 60000);
        setLockedUntil(Date.now() + lockDuration);
        setErrors({ general: format('auth.tooManyAttempts', { minutes: Math.ceil(lockDuration / 60000) }) });
      } else {
        const message = error.response?.data?.message || t('auth.loginFailed');
        const remaining = 5 - newAttempts;
        setErrors({ general: format('auth.failedWithRemaining', { message, remaining }) });
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleAccessToken = async (accessToken: string) => {
    if (!accessToken) return;
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});
    setLoginAttempts(0);

    try {
      const response = await googleAuth({ accessToken });
      if (response.success && await startAdminMfaFlow(response)) {
        return;
      }
      if (response.success) await completeAuthData(response.data);
    } catch (error: any) {
      setErrors({ general: error.response?.data?.message || t('auth.googleLoginFailed') });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({ general: t('auth.googleLoginFailed') });
  };

  const handleGoogleNotConfigured = () => {
    setErrors({ general: t('auth.googleLoginNotConfigured') });
  };

  const handleFacebookLogin = () => {
    if (typeof window === 'undefined') return;

    setIsSubmitting(true);
    setLoading(true);
    setErrors({});
    setLoginAttempts(0);

    const redirect = `${window.location.origin}/auth/facebook/callback`;
    const authUrl = `/api/auth/facebook?redirect=${encodeURIComponent(redirect)}`;
    window.location.href = authUrl;
  };

  // ── OTP Handlers ──────────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = digit;
    setOtpValues(newOtp);
    setOtpError('');

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    const fullOtp = newOtp.join('');
    if (fullOtp.length === 6) {
      handleOtpVerify(fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtpValues(newOtp);
      setOtpError('');
      handleOtpVerify(pasted);
    }
  };

  const handleOtpVerify = async (otp: string) => {
    if (!pendingUserId) return;
    setIsSubmitting(true);
    setOtpError('');

    try {
      const response = await verifyOtp(pendingUserId, otp);
      if (response.success && await startAdminMfaFlow(response)) {
        return;
      }
      if (response.success && await completeAuthData(response.data)) {
        return;
      } else {
        setOtpError(response.message || t('auth.otpInvalid'));
        setOtpValues(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      setOtpError(error.response?.data?.message || t('auth.otpInvalid'));
      setOtpValues(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingUserId || otpResending) return;
    setOtpResending(true);
    try {
      await resendOtp(pendingUserId);
      setOtpCountdown(60);
      setOtpValues(['', '', '', '', '', '']);
      setOtpError('');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      setOtpError(error.response?.data?.message || t('auth.otpResendFailed'));
    } finally {
      setOtpResending(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setPendingUserId(null);
    setOtpValues(['', '', '', '', '', '']);
    setOtpError('');
  };

  const handleCheckDeviceApproval = async () => {
    if (!deviceLimitData?.requestToken) return;
    setDeviceApprovalLoading(true);
    setDeviceApprovalError('');
    try {
      const response = await getDeviceLoginStatus(deviceLimitData.requestToken);
      if (response.success && response.data && await completeAuthData(response.data)) return;
      setDeviceApprovalMessage(response.status === 'pending'
        ? 'Thiết bị cũ chưa duyệt yêu cầu này.'
        : response.message || 'Chưa thể đăng nhập thiết bị mới.');
    } catch (error: any) {
      setDeviceApprovalError(error.response?.data?.message || 'Không kiểm tra được trạng thái thay thiết bị.');
    } finally {
      setDeviceApprovalLoading(false);
    }
  };

  const handleApproveDeviceLogin = async () => {
    if (!deviceApprovalToken) return;
    if (!isAuthenticated) {
      setDeviceApprovalError('Vui lòng đăng nhập trên thiết bị cũ trước khi duyệt thiết bị mới.');
      return;
    }
    setDeviceApprovalLoading(true);
    setDeviceApprovalError('');
    try {
      const response = await approveDeviceLogin(deviceApprovalToken);
      setDeviceApprovalMessage(response.message || 'Đã duyệt thiết bị mới.');
      clearAuth();
      router.replace('/login');
    } catch (error: any) {
      setDeviceApprovalError(error.response?.data?.message || 'Không duyệt được thiết bị mới.');
    } finally {
      setDeviceApprovalLoading(false);
    }
  };

  const handleSendDeviceOtp = async () => {
    if (!deviceLimitData?.requestToken) return;
    setDeviceOtpSending(true);
    setDeviceApprovalError('');
    try {
      const response = await sendDeviceReplacementOtp(deviceLimitData.requestToken);
      setDeviceOtpOpen(true);
      setDeviceApprovalMessage(response.message || 'Đã gửi OTP đến email tài khoản.');
    } catch (error: any) {
      setDeviceApprovalError(error.response?.data?.message || 'Không gửi được OTP thay thiết bị.');
    } finally {
      setDeviceOtpSending(false);
    }
  };

  const handleVerifyDeviceOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceLimitData?.requestToken || deviceOtp.trim().length < 6) return;
    setDeviceApprovalLoading(true);
    setDeviceApprovalError('');
    try {
      const response = await verifyDeviceReplacementOtp(deviceLimitData.requestToken, deviceOtp.trim());
      if (response.success && await completeAuthData(response.data)) return;
      setDeviceApprovalError(response.message || 'OTP không đúng.');
    } catch (error: any) {
      setDeviceApprovalError(error.response?.data?.message || 'OTP không đúng.');
    } finally {
      setDeviceApprovalLoading(false);
    }
  };

  const loginInputBaseClass = 'auth-login-input w-full rounded-2xl border px-4 py-3.5 pl-12 font-semibold text-[#2f2926] shadow-[0_12px_30px_rgba(90,54,24,0.08)] outline-none transition-all placeholder:text-[#7a675a] focus:border-[#c1121f] focus:ring-4 focus:ring-[#c1121f]/12 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="auth-login-form w-full max-w-md">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r from-[#df1f24] to-[#f0b45a]" />
        <h1 className="text-3xl font-black tracking-tight text-[#2d2926] sm:text-4xl">Chào mừng trở lại!</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-[#3f352f]">
          Đăng nhập để tiếp tục hành trình chinh phục học bổng Trung Quốc
        </p>
      </div>

      {isLocked && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {format('auth.waitBeforeRetry', { minutes: Math.ceil((lockedUntil! - Date.now()) / 60000) })}
        </div>
      )}

      {/* ── OTP Step ─────────────────────────────────────────────────────── */}
      {deviceApprovalToken ? (
        <div className="space-y-5">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <FiShield className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Duyệt thiết bị mới</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Nhấn duyệt trên thiết bị cũ để đăng xuất thiết bị này và cho thiết bị mới đăng nhập.
            </p>
          </div>

          {deviceApprovalMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {deviceApprovalMessage}
            </div>
          )}
          {deviceApprovalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deviceApprovalError}
            </div>
          )}

          <button
            type="button"
            onClick={handleApproveDeviceLogin}
            disabled={deviceApprovalLoading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deviceApprovalLoading ? 'Đang duyệt...' : 'Duyệt thiết bị mới'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeviceApprovalToken('');
              setDeviceApprovalError('');
              setDeviceApprovalMessage('');
              if (typeof window !== 'undefined') window.history.replaceState(null, '', '/login');
            }}
            className="w-full text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline"
          >
            Quay lại đăng nhập
          </button>
        </div>
      ) : adminMfaStep ? (
        <div className="space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <FiShield className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bảo mật Admin</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {adminMfaEmail || 'Admin'} cần xác minh bằng Microsoft Authenticator.
            </p>
          </div>

          {adminMfaStep === 'setup' && (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="text-sm text-emerald-900">
                Mở Microsoft Authenticator → bấm + → chọn tài khoản khác → quét QR.
              </div>
              {adminMfaLoading && !adminMfaSetup ? (
                <div className="h-56 rounded-xl bg-white/70 animate-pulse" />
              ) : adminMfaSetup ? (
                <>
                  <div className="flex justify-center rounded-2xl bg-white p-4 border border-emerald-100">
                    <img src={adminMfaSetup.qrDataUrl} alt="Microsoft Authenticator QR" className="h-56 w-56" />
                  </div>
                  <div className="rounded-xl bg-white border border-emerald-100 p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Mã nhập tay</p>
                    <p className="break-all font-mono text-sm font-bold text-gray-900">{adminMfaSetup.manualKey}</p>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {adminMfaStep === 'backup' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Lưu các mã dự phòng này. Mỗi mã dùng một lần khi mất điện thoại.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {adminMfaBackupCodes.map(code => (
                  <div key={code} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center font-mono text-sm font-bold text-gray-900">
                    {code}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={finishAdminMfaBackup}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                Tôi đã lưu mã dự phòng
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminMfaSubmit} className="space-y-4">
              <div>
                <label htmlFor="adminMfaCode" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
                  Mã 6 số hoặc mã dự phòng
                </label>
                <input
                  id="adminMfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={adminMfaCode}
                  onChange={e => setAdminMfaCode(e.target.value.replace(/\s/g, '').slice(0, 16))}
                  disabled={adminMfaLoading}
                  style={{ color: '#020617', WebkitTextFillColor: '#020617' }}
                  className="w-full rounded-lg border border-emerald-300 bg-emerald-50/50 px-4 py-3 text-center text-xl font-bold tracking-normal !text-slate-950 caret-emerald-700 outline-none placeholder:!text-slate-500 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nhập mã vào đây"
                />
              </div>

              {adminMfaError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {adminMfaError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminMfaLoading || adminMfaCode.trim().length < 6}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adminMfaLoading ? 'Đang xác minh...' : adminMfaStep === 'setup' ? 'Bật Authenticator' : 'Xác minh'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminMfaStep(null);
                  setAdminMfaToken('');
                  setAdminMfaCode('');
                  setAdminMfaError('');
                }}
                className="w-full text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline"
              >
                Quay lại đăng nhập
              </button>
            </form>
          )}
        </div>
      ) : deviceLimitData ? (
        <div className="space-y-5">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
              <FiShield className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hết slot {deviceTypeLabel}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Tài khoản đang dùng {deviceLimitData.sessions?.length || 0}/{deviceLimitData.maxDevices} slot {deviceTypeLabel}.
              Duyệt bằng thiết bị cũ hoặc xác minh email để thay thiết bị.
            </p>
          </div>

          {deviceApproveUrl && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-4 text-center">
              {deviceQrUrl && (
                <img src={deviceQrUrl} alt="QR duyệt thiết bị mới" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
              )}
              <p className="mt-3 break-all text-xs text-gray-500 dark:text-slate-400">{deviceApproveUrl}</p>
            </div>
          )}

          {deviceApprovalMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {deviceApprovalMessage}
            </div>
          )}
          {deviceApprovalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deviceApprovalError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCheckDeviceApproval}
              disabled={deviceApprovalLoading}
              className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deviceApprovalLoading ? 'Đang kiểm tra...' : 'Tôi đã duyệt'}
            </button>
            <button
              type="button"
              onClick={handleSendDeviceOtp}
              disabled={deviceOtpSending}
              className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deviceOtpSending ? 'Đang gửi...' : 'Không còn thiết bị cũ'}
            </button>
          </div>

          {deviceOtpOpen && (
            <form onSubmit={handleVerifyDeviceOtp} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <label htmlFor="deviceOtp" className="block text-sm font-medium text-amber-900">
                OTP email
              </label>
              <input
                id="deviceOtp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={deviceOtp}
                onChange={e => setDeviceOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-amber-300 dark:border-amber-500 bg-white dark:bg-slate-950 px-4 py-3 text-center text-xl font-bold tracking-normal text-slate-950 dark:text-white outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500"
                placeholder="Nhập 6 số"
              />
              <button
                type="submit"
                disabled={deviceApprovalLoading || deviceOtp.length < 6}
                className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deviceApprovalLoading ? 'Đang xác minh...' : 'Xác minh và đăng nhập'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setDeviceLimitData(null);
              setDeviceApprovalError('');
              setDeviceApprovalMessage('');
              setDeviceOtpOpen(false);
              setDeviceOtp('');
            }}
            className="w-full text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline"
          >
            Quay lại đăng nhập
          </button>
        </div>
      ) : otpStep ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('auth.otpTitle')}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{t('auth.otpSent')}</p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otpValues.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpInputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                disabled={isSubmitting}
                className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-xl sm:text-2xl font-bold border rounded-xl text-slate-950 dark:text-white transition-all outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${digit ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/20' : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950'} ${isSubmitting ? 'opacity-50' : ''}`}
              />
            ))}
          </div>

          {otpError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
              {otpError}
            </div>
          )}

          {isSubmitting && (
            <div className="flex justify-center">
              <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {t('auth.noOtp')}{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCountdown > 0 || otpResending}
                className={`font-semibold ${otpCountdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-500'}`}
              >
                {otpCountdown > 0 ? format('auth.resendIn', { seconds: otpCountdown }) : otpResending ? t('auth.resending') : t('auth.resendCode')}
              </button>
            </p>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline"
            >
              ← {t('auth.backToLogin')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {errors.general && (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-black text-[#342a24]">{t('auth.email')}</label>
          <div className="relative">
            <FiMail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd111c]" />
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting || isLocked}
              className={`${loginInputBaseClass} ${errors.email ? 'border-red-500' : 'border-white/80'}`}
              placeholder="example@email.com"
            />
          </div>
          {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-black text-[#342a24]">{t('auth.password')}</label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd111c]" />
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting || isLocked}
              className={`${loginInputBaseClass} ${errors.password ? 'border-red-500' : 'border-white/80'}`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>}
        </div>

        <TurnstileBox
          action="login"
          disabled={isSubmitting || isLocked}
          resetKey={turnstileResetKey}
          onTokenChange={handleTurnstileToken}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="h-4 w-4 rounded border-[#d8bca0] text-[#c1121f] focus:ring-[#c1121f]" />
            <span className="ml-2 text-sm font-bold text-[#40352e]">{t('auth.remember')}</span>
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-[#bd111c] hover:text-[#8d0d14]">{t('auth.forgot')}</Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLocked || (isTurnstileEnabled && !turnstileToken)}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#df1f24] to-[#a80f14] px-4 py-3.5 font-black text-white shadow-[0_18px_34px_rgba(190,28,32,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_42px_rgba(190,28,32,0.34)] focus:outline-none focus:ring-4 focus:ring-[#c1121f]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('auth.loggingIn')}
            </span>
          ) : (
            <>
              {t('auth.login')}
              <FiArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <SocialAuthButtons
          dividerLabel="Hoặc đăng nhập với"
          disabled={isSubmitting || isLocked}
          onGoogleAccessToken={handleGoogleAccessToken}
          onGoogleError={handleGoogleError}
          onGoogleNotConfigured={handleGoogleNotConfigured}
          onFacebookClick={handleFacebookLogin}
        />
      </form>
      )}

      {/* Terms and Privacy Links */}
      <div className="mt-6 space-y-2 border-t border-white/70 pt-5">
        <p className="text-center text-xs font-semibold leading-relaxed text-[#44372f]">
          {t('auth.loginConsentPrefix')}{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('terms'); setShowTermsModal(true); }}
            className="font-bold text-[#bd111c] hover:text-[#8d0d14] hover:underline"
          >
            {t('auth.terms')}
          </button>
          {' '}{t('auth.and')}{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('privacy'); setShowTermsModal(true); }}
            className="font-bold text-[#bd111c] hover:text-[#8d0d14] hover:underline"
          >
            {t('auth.privacy')}
          </button>
          {t('auth.consentSuffix')}
        </p>
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-[#44372f]">
        Chưa có tài khoản? <Link href="/register" className="font-black text-[#bd111c] hover:text-[#8d0d14]">{t('auth.registerNow')}</Link>
      </p>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} type={termsModalType} />
    </div>
  );
}
