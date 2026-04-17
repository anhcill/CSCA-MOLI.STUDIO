"use client";

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaCheckCircle, FaExclamationCircle, FaCrown, FaClock,
  FaArrowRight, FaStar, FaGift, FaShieldAlt
} from 'react-icons/fa';
import { FiArrowRight, FiLoader, FiZap } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { getCurrentUser } from '@/lib/api/auth';
import axios from '@/lib/utils/axios';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    status: string;
    data?: any;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const orderId = searchParams?.get('orderId') || '';
  const resultCode = searchParams?.get('resultCode');
  const isApiSuccess = resultCode === '0' || resultCode === '00' || searchParams?.get('simulated') === 'true';

  useEffect(() => {
    if (!mounted) return;

    const verify = async () => {
      if (!orderId) {
        setVerifying(false);
        setResult({ success: false, status: 'missing_order' });
        return;
      }

      try {
        const verifyRes = await axios.post('/payments/verify-return', {
          orderId,
          resultCode: resultCode || '0',
        });

        if (verifyRes.data.success) {
          try {
            const userRes = await getCurrentUser();
            if (userRes.success && userRes.data?.user) {
              setUser(userRes.data.user);
            }
          } catch (_) {}

          setResult({
            success: verifyRes.data.status === 'completed',
            status: verifyRes.data.status,
            data: verifyRes.data.data,
          });
        } else {
          setResult({ success: false, status: verifyRes.data.status || 'unknown' });
        }
      } catch (err) {
        console.error('Verify return error:', err);
        try {
          const userRes = await getCurrentUser();
          if (userRes.success && userRes.data?.user) {
            setUser(userRes.data.user);
            if (userRes.data.user.is_vip) {
              setResult({ success: true, status: 'completed' });
              return;
            }
          }
        } catch (_) {}
        setResult({ success: false, status: 'error' });
      } finally {
        setVerifying(false);
      }
    };

    verify();
  }, [mounted, orderId, resultCode, setUser]);

  if (!mounted) return null;

  const isSuccess = result?.success === true;
  const isPending = verifying;
  const isFailed = !isPending && !isSuccess;

  return (
    <div className="space-y-8 text-center">

      {/* Status Icon */}
      <div className="flex justify-center">
        {isPending ? (
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center">
              <FiLoader size={48} className="text-indigo-600 animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping" />
          </div>
        ) : isSuccess ? (
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center shadow-xl shadow-emerald-200">
              <FaCheckCircle size={52} className="text-emerald-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center shadow-xl shadow-red-200">
            <FaExclamationCircle size={52} className="text-red-500" />
          </div>
        )}
      </div>

      {/* Title block */}
      <div className="space-y-2">
        {isPending ? (
          <h2 className="text-3xl font-black text-gray-900">Đang xác minh thanh toán...</h2>
        ) : isSuccess ? (
          <>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
              Thanh toán thành công!
            </h2>
            <p className="text-gray-500 text-base max-w-md mx-auto">
              Cảm ơn bạn đã tin tưởng CSCA. Bạn đã được nâng cấp lên tài khoản PRO!
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black text-red-700">Thanh toán không thành công</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Giao dịch bị hủy hoặc có lỗi từ cổng thanh toán. Bạn chưa bị trừ tiền.
            </p>
          </>
        )}
      </div>

      {/* VIP Info Card */}
      {isSuccess && result?.data && (
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-3xl p-7 space-y-4 shadow-xl shadow-amber-100 max-w-sm mx-auto">
          {/* Package */}
          <div className="flex items-center gap-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
              <FaCrown size={24} className="text-white" />
            </div>
            <div>
              <p className="font-black text-xl text-gray-900">{result.data.package_name}</p>
              <p className="text-sm text-amber-700 font-semibold">
                {result.data.package_duration} ngày · {result.data.amount?.toLocaleString('vi-VN')}đ
              </p>
            </div>
          </div>

          {/* Expiry */}
          {result.data.vip_expires_at && (
            <div className="flex items-center gap-3 bg-amber-100/80 rounded-2xl px-5 py-3 text-left">
              <FaClock size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-xs text-amber-600 font-medium">Ngày hết hạn VIP</p>
                <p className="text-sm font-bold text-amber-900">
                  {new Date(result.data.vip_expires_at).toLocaleDateString('vi-VN', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Stars decoration */}
          <div className="flex justify-center gap-1 pt-2">
            {[...Array(5)].map((_, i) => (
              <FaStar key={i} size={16} className="text-amber-400 fill-amber-400" />
            ))}
          </div>
        </div>
      )}

          {/* Confetti effect */}
          {isSuccess && (
            <div className="flex justify-center gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${['bg-indigo-400', 'bg-purple-400', 'bg-pink-400', 'bg-amber-400', 'bg-emerald-400'][i]}`}
                  style={{
                    animation: `confetti-${i} ${1.5 + i * 0.3}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }} />
              ))}
            </div>
          )}

      {isFailed && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white space-y-3 shadow-xl max-w-sm mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <FaExclamationCircle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Mã lỗi: {searchParams?.get('resultCode') || '—'}</p>
              <p className="text-xs text-gray-400">Giao dịch chưa hoàn tất</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-3 text-sm text-gray-300 space-y-1">
            <p>✗ Tiền của bạn <strong className="text-white">chưa bị trừ</strong></p>
            <p>✗ VIP <strong className="text-white">chưa được kích hoạt</strong></p>
            <p>✗ Bạn có thể thử lại bất cứ lúc nào</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
        {isSuccess ? (
          <>
            <Link
              href="/de-mo-phong"
              className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition shadow-xl shadow-indigo-200 text-base"
            >
              Làm bài thi ngay <FaArrowRight size={16} />
            </Link>
            <Link
              href="/profile"
              className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition text-base"
            >
              Xem hồ sơ PRO
            </Link>
          </>
        ) : isFailed ? (
          <>
            <Link
              href="/checkout"
              className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition shadow-xl shadow-indigo-200 text-base"
            >
              Thử lại thanh toán
            </Link>
            <Link
              href="/vip"
              className="flex-1 flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition text-base"
            >
              Bảng giá VIP
            </Link>
          </>
        ) : null}
      </div>

      {/* Trust badges */}
      {isSuccess && (
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {[
            { icon: <FaShieldAlt size={14} />, text: 'Thanh toán bảo mật' },
            { icon: <FiZap size={14} />, text: 'VIP đã kích hoạt' },
            { icon: <FaGift size={14} />, text: 'Hoàn tiền 7 ngày' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
              <span className="text-indigo-400">{t.icon}</span>
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center py-12 px-4 pt-28">
      <div className="w-full max-w-xl">
        <div className="bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100">
          {/* Top gradient */}
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500" />

          <div className="p-8 sm:p-12">
            <Suspense fallback={
              <div className="flex justify-center items-center py-24">
                <FiLoader size={40} className="animate-spin text-indigo-600" />
              </div>
            }>
              <SuccessContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
