'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowRight, FiLock, FiMail, FiUser } from 'react-icons/fi';
import { register, googleAuth, getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDefaultAdminRoute } from '@/lib/utils/permissions';
import { sanitizeInput } from '@/lib/utils/security';
import { useLanguage } from '@/context/LanguageContext';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import SocialAuthButtons from './SocialAuthButtons';
import TermsModal from './TermsModal';

export default function RegisterForm() {
  const router = useRouter();
  const { login: setAuth, setLoading } = useAuthStore();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'terms' | 'privacy'>('terms');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const inputBaseClass = 'auth-login-input w-full rounded-2xl border px-4 py-3.5 pl-12 font-semibold text-[#2f2926] shadow-[0_12px_30px_rgba(90,54,24,0.08)] outline-none transition-all placeholder:text-[#7a675a] focus:border-[#c1121f] focus:ring-4 focus:ring-[#c1121f]/12 disabled:cursor-not-allowed disabled:opacity-60';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitized = sanitizeInput(value);
    setFormData((prev) => ({ ...prev, [name]: sanitized }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!formData.username) {
      newErrors.username = t('auth.requiredUsername');
    } else if (formData.username.length < 3) {
      newErrors.username = t('auth.usernameMin3');
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = t('auth.usernameInvalid');
    }
    if (!formData.email) {
      newErrors.email = t('auth.requiredEmail');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    if (!formData.password) {
      newErrors.password = t('auth.requiredPassword');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth.passwordMin8');
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.confirmRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }
    if (!acceptedTerms) {
      newErrors.terms = 'Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setLoading(true);
    setErrors({});

    try {
      const response = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name || formData.username,
        acceptedTerms,
        termsVersion: '2026-08',
        privacyVersion: '2026-08',
      });
      if (response.success && response.data) {
        const { user: registerUser, token, refreshToken } = response.data;
        if (!registerUser || !token || !refreshToken) {
          router.push(`/login?verification=sent&email=${encodeURIComponent(formData.email)}`);
          return;
        }
        setAuth(registerUser, token, refreshToken);
        let effectiveUser = registerUser;
        try {
          const me = await getCurrentUser();
          if (me?.success && me?.data?.user) {
            effectiveUser = me.data.user;
            setAuth(effectiveUser, token, refreshToken);
          }
        } catch {
          /* Keep fallback */
        }
        router.push(getDefaultAdminRoute(effectiveUser));
      }
    } catch (error: any) {
      setErrors({ general: error.response?.data?.message || t('auth.registerFailed') });
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

    try {
      if (!acceptedTerms) {
        setErrors({ terms: 'Bạn cần đồng ý Điều khoản sử dụng và Chính sách bảo mật.' });
        return;
      }
      const response = await googleAuth({
        accessToken,
        acceptedTerms: true,
        termsVersion: '2026-08',
        privacyVersion: '2026-08',
      });
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
          /* Keep fallback */
        }
        router.push(getDefaultAdminRoute(effectiveUser));
      }
    } catch (error: any) {
      setErrors({ general: error.response?.data?.message || t('auth.googleRegisterFailed') });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({ general: t('auth.googleRegisterFailed') });
  };

  const handleGoogleNotConfigured = () => {
    setErrors({ general: t('auth.googleRegisterNotConfigured') });
  };

  const handleFacebookLogin = () => {
    if (typeof window === 'undefined') return;

    setIsSubmitting(true);
    setLoading(true);
    setErrors({});

    const redirect = `${window.location.origin}/auth/facebook/callback`;
    const authUrl = `/api/auth/facebook?redirect=${encodeURIComponent(redirect)}`;
    window.location.href = authUrl;
  };

  return (
    <div className="auth-login-form w-full max-w-md">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r from-[#df1f24] to-[#f2a34a]" />
        <h1 className="text-3xl font-black tracking-tight text-[#2d2926] sm:text-4xl">{t('auth.registerTitle')}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-[#3f352f]">
          {t('auth.registerSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {errors.general && (
          <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-300 bg-red-50/95 px-4 py-3 text-sm font-bold text-red-700 shadow-sm">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="username" className="mb-2 block text-sm font-black text-[#342a24]">{t('auth.username')}</label>
          <div className="relative">
            <FiUser className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd111c]" />
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`${inputBaseClass} ${errors.username ? 'border-red-500' : 'border-white/80'}`}
              placeholder="username123"
            />
          </div>
          {errors.username && <p className="mt-1.5 text-sm text-red-600">{errors.username}</p>}
        </div>

        <div>
          <label htmlFor="full_name" className="mb-2 block text-sm font-black text-[#342a24]">
            {t('auth.fullName')} <span className="font-bold text-[#6d5b4f]">({t('auth.optional')})</span>
          </label>
          <div className="relative">
            <FiUser className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd111c]" />
            <input
              type="text"
              id="full_name"
              name="full_name"
              autoComplete="name"
              value={formData.full_name}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`${inputBaseClass} border-white/80`}
              placeholder={t('auth.fullNamePlaceholder')}
            />
          </div>
        </div>

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
              disabled={isSubmitting}
              className={`${inputBaseClass} ${errors.email ? 'border-red-500' : 'border-white/80'}`}
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
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`${inputBaseClass} ${errors.password ? 'border-red-500' : 'border-white/80'}`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>}
          <PasswordStrengthIndicator password={formData.password} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-black text-[#342a24]">{t('auth.confirmPassword')}</label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#bd111c]" />
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`${inputBaseClass} ${errors.confirmPassword ? 'border-red-500' : 'border-white/80'}`}
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword}</p>}
        </div>

        <div className="flex items-start rounded-2xl border border-white/60 bg-white/35 p-3">
          <input
            type="checkbox"
            id="terms"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              if (errors.terms) setErrors((current) => ({ ...current, terms: '' }));
            }}
            className="mt-0.5 h-4 w-4 rounded border-[#d8bca0] text-[#c1121f] focus:ring-[#c1121f]"
          />
          <label htmlFor="terms" className="ml-2 text-sm font-semibold leading-relaxed text-[#44372f]">
            {t('auth.registerConsentPrefix')}{' '}
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
          </label>
        </div>
        {errors.terms && <p className="-mt-2 text-sm font-semibold text-red-600">{errors.terms}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#df1f24] to-[#a80f14] px-4 py-3.5 font-black text-white shadow-[0_18px_34px_rgba(190,28,32,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_42px_rgba(190,28,32,0.34)] focus:outline-none focus:ring-4 focus:ring-[#c1121f]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('auth.registering')}
            </span>
          ) : (
            <>
              {t('auth.createAccount')}
              <FiArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        {acceptedTerms && (
          <SocialAuthButtons
            dividerLabel={t('auth.socialRegister')}
            disabled={isSubmitting}
            onGoogleAccessToken={handleGoogleAccessToken}
            onGoogleError={handleGoogleError}
            onGoogleNotConfigured={handleGoogleNotConfigured}
            onFacebookClick={handleFacebookLogin}
          />
        )}
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-[#44372f]">
        {t('auth.haveAccount')} <Link href="/login" className="font-black text-[#bd111c] hover:text-[#8d0d14]">{t('auth.loginNow')}</Link>
      </p>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} type={termsModalType} />
    </div>
  );
}
