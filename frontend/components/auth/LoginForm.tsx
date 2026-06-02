'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CredentialResponse } from '@react-oauth/google';
import { login, googleAuth, getCurrentUser, verifyOtp, resendOtp } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDefaultAdminRoute } from '@/lib/utils/permissions';
import { sanitizeInput } from '@/lib/utils/security';
import { useLanguage } from '@/context/LanguageContext';
import SocialAuthButtons from './SocialAuthButtons';
import TermsModal from './TermsModal';

export default function LoginForm() {
  const router = useRouter();
  const { login: setAuth, setLoading } = useAuthStore();
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
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';
  const isFacebookEnabled = Boolean(facebookAppId);
  // ── OTP Step ────────────────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    if (!validateForm()) return;
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});

    try {
      const response = await login(formData);
      if (response.success) {
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
        if (response.data) {
          const { user: loginUser, token, refreshToken } = response.data;
          setAuth(loginUser, token, refreshToken);
          setLoginAttempts(0);

          let effectiveUser = loginUser;
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
        }
      }
    } catch (error: any) {
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

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});
    setLoginAttempts(0);

    try {
      const response = await googleAuth(credentialResponse.credential);
      if (response.success && response.data) {
        const { user: loginUser, token, refreshToken } = response.data;
        setAuth(loginUser, token, refreshToken);

        let effectiveUser = loginUser;
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
      }
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
    if (!isFacebookEnabled) {
      setErrors({ general: t('auth.facebookLoginNotConfigured') });
      return;
    }
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
      if (response.success && response.data) {
        const { user, token, refreshToken } = response.data;
        setAuth(user, token, refreshToken);
        setLoginAttempts(0);

        let effectiveUser = user;
        try {
          const me = await getCurrentUser();
          if (me?.success && me?.data?.user) {
            effectiveUser = me.data.user;
            setAuth(effectiveUser, token, refreshToken);
          }
        } catch { /* keep fallback */ }
        router.push(getDefaultAdminRoute(effectiveUser));
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

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('auth.loginTitle')}</h1>
        <p className="text-gray-600">{t('auth.loginSubtitle')}</p>
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
      {otpStep ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('auth.otpTitle')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('auth.otpSent')}</p>
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
                className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-xl sm:text-2xl font-bold border rounded-xl transition-all outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${digit ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'} ${isSubmitting ? 'opacity-50' : ''}`}
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
            <p className="text-sm text-gray-500">
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
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              ← {t('auth.backToLogin')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isSubmitting || isLocked}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.email ? 'border-red-500' : 'border-gray-300'} ${(isSubmitting || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder="example@email.com"
          />
          {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            disabled={isSubmitting || isLocked}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.password ? 'border-red-500' : 'border-gray-300'} ${(isSubmitting || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder="••••••••"
          />
          {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <span className="ml-2 text-sm text-gray-600">{t('auth.remember')}</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500">{t('auth.forgot')}</Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLocked}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('auth.loggingIn')}
            </span>
          ) : t('auth.login')}
        </button>

        <SocialAuthButtons
          dividerLabel={t('auth.socialLogin')}
          disabled={isSubmitting || isLocked}
          googleText="signin_with"
          onGoogleSuccess={handleGoogleSuccess}
          onGoogleError={handleGoogleError}
          onGoogleNotConfigured={handleGoogleNotConfigured}
          onFacebookClick={handleFacebookLogin}
        />
      </form>
      )}

      {/* Terms and Privacy Links */}
      <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          {t('auth.loginConsentPrefix')}{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('terms'); setShowTermsModal(true); }}
            className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
          >
            {t('auth.terms')}
          </button>
          {' '}{t('auth.and')}{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('privacy'); setShowTermsModal(true); }}
            className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
          >
            {t('auth.privacy')}
          </button>
          {t('auth.consentSuffix')}
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-gray-600">
        {t('auth.noAccount')} <Link href="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">{t('auth.registerNow')}</Link>
      </p>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} type={termsModalType} />
    </div>
  );
}
