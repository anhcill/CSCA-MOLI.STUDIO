'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { register, googleAuth } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';

export default function RegisterForm() {
  const router = useRouter();
  const { login: setAuth, setLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!formData.username) {
      newErrors.username = 'Tên đăng nhập là bắt buộc';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới';
    }

    if (!formData.email) {
      newErrors.email = 'Email là bắt buộc';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.password) {
      newErrors.password = 'Mật khẩu là bắt buộc';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Mật khẩu phải chứa chữ hoa, chữ thường và số';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp';
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
      });

      if (response.success) {
        const { user, token, refreshToken } = response.data;
        setAuth(user, token, refreshToken);

        // Redirect to home or onboarding
        router.push('/');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      setErrors({
        general: error.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.',
      });
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

    try {
      const response = await googleAuth(credentialResponse.credential);

      if (response.success) {
        const { user, token, refreshToken } = response.data;
        setAuth(user, token, refreshToken);
        router.push('/');
      }
    } catch (error: any) {
      console.error('Google signup error:', error);
      setErrors({
        general: error.response?.data?.message || 'Đăng ký Google thất bại',
      });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrors({
      general: 'Đăng ký Google thất bại. Vui lòng thử lại.',
    });
  };

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tạo tài khoản mới</h1>
        <p className="text-gray-600">Bắt đầu hành trình học tập của bạn</p>
      </div>

      {/* Social Signup Buttons */}
      <div className="mb-6">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
          theme="outline"
          size="large"
          text="signup_with"
          width="100%"
        />
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Hoặc đăng ký bằng email</span>
        </div>
      </div>

      {/* Register Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General Error */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errors.general}
          </div>
        )}

        {/* Username Field */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tên đăng nhập
          </label>
          <input
            type="text"
            id="username"
            name="username"
            autoComplete="username"
            value={formData.username}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.username ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="username123"
          />
          {errors.username && <p className="mt-1.5 text-sm text-red-600">{errors.username}</p>}
        </div>

        {/* Full Name Field */}
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Họ và tên <span className="text-gray-400">(Tùy chọn)</span>
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            autoComplete="name"
            value={formData.full_name}
            onChange={handleChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400"
            placeholder="Nguyễn Văn A"
          />
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="example@email.com"
          />
          {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Mật khẩu
          </label>
          <input
            type="password"
            id="password"
            name="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="••••••••"
          />
          {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password}</p>}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
            Xác nhận mật khẩu
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors outline-none text-gray-900 placeholder-gray-400 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="••••••••"
          />
          {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword}</p>}
        </div>

        {/* Terms & Conditions */}
        <div className="flex items-start">
          <input
            type="checkbox"
            id="terms"
            className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            required
          />
          <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
            Tôi đồng ý với{' '}
            <Link href="/terms" className="text-indigo-600 hover:text-indigo-500">
              Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
            <Link href="/privacy" className="text-indigo-600 hover:text-indigo-500">
              Chính sách bảo mật
            </Link>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang đăng ký...
            </span>
          ) : (
            'Đăng ký'
          )}
        </button>
      </form>

      {/* Login Link */}
      <p className="mt-6 text-center text-sm text-gray-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
