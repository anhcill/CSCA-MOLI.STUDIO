'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { getCurrentUser } from '@/lib/api/auth';
import { getDefaultAdminRoute } from '@/lib/utils/permissions';

type CallbackPayload = {
  token?: string;
  refreshToken?: string;
  error?: string;
  message?: string;
  requestToken?: string;
};

const parseHashParams = (): CallbackPayload => {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  return {
    token: params.get('token') || undefined,
    refreshToken: params.get('refreshToken') || undefined,
    error: params.get('error') || undefined,
    message: params.get('message') || undefined,
    requestToken: params.get('requestToken') || undefined,
  };
};

export default function FacebookCallbackPage() {
  const router = useRouter();
  const { setTokens, setUser, setLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const payload = parseHashParams();
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (payload.error) {
      if (payload.error === 'device_limit_reached' && payload.requestToken) {
        router.replace(`/login?deviceRequest=${encodeURIComponent(payload.requestToken)}`);
        return;
      }
      setError(payload.message || 'Đăng nhập Facebook thất bại. Vui lòng thử lại.');
      setLoading(false);
      return;
    }

    if (!payload.token || !payload.refreshToken) {
      setError('Thiếu token xác thực. Vui lòng thử lại.');
      setLoading(false);
      return;
    }

    setTokens(payload.token, payload.refreshToken);
    setLoading(true);

    getCurrentUser()
      .then((response) => {
        if (response?.success && response?.data?.user) {
          setUser(response.data.user);
          if ((response.data as any).token) {
            setTokens((response.data as any).token, payload.refreshToken as string);
          }
          router.push(getDefaultAdminRoute(response.data.user));
          return;
        }
        setError('Không thể lấy thông tin người dùng.');
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Đăng nhập Facebook thất bại. Vui lòng thử lại.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, setTokens, setUser, setLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-sky-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Đăng nhập thất bại</h1>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Quay lại đăng nhập
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Đang hoàn tất đăng nhập...</h1>
            <p className="text-sm text-gray-600">Vui lòng chờ trong giây lát.</p>
          </>
        )}
      </div>
    </div>
  );
}
