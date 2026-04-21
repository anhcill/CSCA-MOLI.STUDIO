'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CredentialResponse, GoogleLogin, googleLogout } from '@react-oauth/google';
import { login, googleAuth, getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { getDefaultAdminRoute } from '@/lib/utils/permissions';
import { sanitizeInput } from '@/lib/utils/security';
import TermsModal from './TermsModal';

export default function LoginForm() {
  const router = useRouter();
  const { login: setAuth, setLoading } = useAuthStore();

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
      newErrors.email = 'Email là bắt buộc';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    if (!formData.password) {
      newErrors.password = 'Mật khẩu là bắt buộc';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
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
    } catch (error: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 5) {
        const lockDuration = Math.min(5 * 60 * 1000, newAttempts * 60000);
        setLockedUntil(Date.now() + lockDuration);
        setErrors({ general: `Quá nhiều lần thử. Vui lòng chờ ${Math.ceil(lockDuration / 60000)} phút.` });
      } else {
        const message = error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        const remaining = 5 - newAttempts;
        setErrors({ general: `${message} (Còn ${remaining} lần thử)` });
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
      if (response.success) {
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
      setErrors({ general: error.response?.data?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.' });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({ general: 'Đăng nhập Google thất bại. Vui lòng thử lại.' });
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Chào mừng trở lại!</h1>
        <p className="text-gray-600">Đăng nhập để tiếp tục học tập</p>
      </div>

      {/* Google Login - Custom button for better mobile responsiveness */}
      <div className="mb-6">
        <div className="w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            theme="outline"
            size="large"
            text="signin_with"
            width="100%"
          />
        </div>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500 dark:bg-gray-100">Hoặc đăng nhập bằng email</span>
        </div>
      </div>

      {isLocked && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Vui lòng chờ {Math.ceil((lockedUntil! - Date.now()) / 60000)} phút trước khi thử lại.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errors.general}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
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

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
            <span className="ml-2 text-sm text-gray-600">Ghi nhớ đăng nhập</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-500">Quên mật khẩu?</Link>
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
              Đang đăng nhập...
            </span>
          ) : 'Đăng nhập'}
        </button>
      </form>

      {/* Terms and Privacy Links */}
      <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          Bằng việc đăng nhập, bạn đồng ý với{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('terms'); setShowTermsModal(true); }}
            className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
          >
            Điều khoản sử dụng
          </button>
          {' '}và{' '}
          <button
            type="button"
            onClick={() => { setTermsModalType('privacy'); setShowTermsModal(true); }}
            className="text-indigo-600 hover:text-indigo-500 font-medium hover:underline"
          >
            Chính sách bảo mật
          </button>
          {' '}của chúng tôi.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-gray-600">
        Chưa có tài khoản? <Link href="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">Đăng ký ngay</Link>
      </p>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} type={termsModalType} />
    </div>
  );
}
