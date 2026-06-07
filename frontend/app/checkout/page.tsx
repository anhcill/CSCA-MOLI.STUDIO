"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { getCurrentUser } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { canAccessSubject, getTierLevel, type TierLevel } from '@/lib/utils/permissions';
import { FaCrown, FaShieldAlt, FaBolt, FaGift, FaLock, FaArrowRight, FaCopy, FaCheckCircle } from 'react-icons/fa';
import { FiArrowLeft, FiCheck, FiLoader, FiRefreshCw } from 'react-icons/fi';

interface DbPackage {
  id: number;
  name: string;
  tier?: string;
  duration_days: number;
  price: number;
  original_price?: number | null;
  price_note?: string | null;
  original_price_note?: string | null;
  subject_prices?: Record<string, number> | null;
  subject_original_prices?: Record<string, number> | null;
  allowed_subjects?: string[];
  requires_subject_choice?: boolean;
  description: string;
  features: string[];
}

interface PromotionBanner {
  id: number;
  title: string;
  content: string;
  coupon_code: string | null;
  cta_text: string | null;
  badge_text: string | null;
  theme: 'gold' | 'violet' | 'emerald' | 'rose' | 'blue';
  ends_at: string | null;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;
}

function derivePackageUI(pkg: DbPackage) {
  const name = String(pkg.name || '').toLowerCase();
  const baseTier = pkg.tier === 'premium' || /pre|premium/i.test(pkg.name) ? 'premium' as const : 'vip' as const;

  if (name.includes('mini')) {
    return {
      tier: baseTier,
      color: 'from-slate-500 to-gray-700',
      stepBg: 'bg-gradient-to-br from-slate-500 to-gray-700',
      accentText: 'text-slate-700',
      accentIcon: 'text-slate-500',
      pill: 'bg-slate-100 text-slate-700',
      selectedCard: 'border-slate-500 bg-slate-50 shadow-md shadow-slate-100 ring-1 ring-slate-200',
      cardHover: 'hover:border-slate-300 hover:shadow-slate-100',
      selectedStripe: 'bg-slate-600',
      selectedCheck: 'border-slate-600 bg-slate-600',
      featureIcon: 'text-slate-500',
      subjectSelected: 'border-slate-500 bg-slate-50 ring-1 ring-slate-200',
      subjectHover: 'hover:border-slate-300 hover:bg-slate-50',
      summaryCard: 'border-slate-200 bg-slate-50',
      summaryInner: 'bg-white ring-1 ring-slate-200',
      totalText: 'text-slate-800',
      payButton: 'bg-gradient-to-r from-slate-600 to-gray-800 hover:from-slate-700 hover:to-gray-900 hover:shadow-slate-200',
    };
  }

  if (name.includes('tự nhiên') || name.includes('tu nhien')) {
    return {
      tier: baseTier,
      color: 'from-sky-600 to-emerald-600',
      stepBg: 'bg-gradient-to-br from-sky-600 to-emerald-600',
      accentText: 'text-sky-700',
      accentIcon: 'text-sky-600',
      pill: 'bg-sky-100 text-sky-700',
      selectedCard: 'border-sky-500 bg-sky-50 shadow-md shadow-sky-100 ring-1 ring-sky-200',
      cardHover: 'hover:border-sky-300 hover:shadow-sky-100',
      selectedStripe: 'bg-sky-600',
      selectedCheck: 'border-sky-600 bg-sky-600',
      featureIcon: 'text-sky-600',
      subjectSelected: 'border-sky-500 bg-sky-50 ring-1 ring-sky-200',
      subjectHover: 'hover:border-sky-300 hover:bg-sky-50',
      summaryCard: 'border-sky-200 bg-sky-50',
      summaryInner: 'bg-white ring-1 ring-sky-200',
      totalText: 'text-sky-700',
      payButton: 'bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-700 hover:to-emerald-700 hover:shadow-sky-200',
    };
  }

  if (name.includes('xã hội') || name.includes('xa hoi')) {
    return {
      tier: baseTier,
      color: 'from-rose-500 to-orange-500',
      stepBg: 'bg-gradient-to-br from-rose-500 to-orange-500',
      accentText: 'text-rose-700',
      accentIcon: 'text-rose-500',
      pill: 'bg-rose-100 text-rose-700',
      selectedCard: 'border-rose-500 bg-rose-50 shadow-md shadow-rose-100 ring-1 ring-rose-200',
      cardHover: 'hover:border-rose-300 hover:shadow-rose-100',
      selectedStripe: 'bg-rose-600',
      selectedCheck: 'border-rose-600 bg-rose-600',
      featureIcon: 'text-rose-500',
      subjectSelected: 'border-rose-500 bg-rose-50 ring-1 ring-rose-200',
      subjectHover: 'hover:border-rose-300 hover:bg-rose-50',
      summaryCard: 'border-rose-200 bg-rose-50',
      summaryInner: 'bg-white ring-1 ring-rose-200',
      totalText: 'text-rose-700',
      payButton: 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 hover:shadow-rose-200',
    };
  }

  if (baseTier === 'premium') {
    return {
      tier: 'premium' as const,
      color: 'from-teal-700 to-emerald-700',
      stepBg: 'bg-gradient-to-br from-teal-700 to-emerald-700',
      accentText: 'text-teal-700',
      accentIcon: 'text-teal-600',
      pill: 'bg-teal-100 text-teal-700',
      selectedCard: 'border-teal-600 bg-teal-50 shadow-md shadow-teal-100 ring-1 ring-teal-200',
      cardHover: 'hover:border-teal-300 hover:shadow-teal-100',
      selectedStripe: 'bg-teal-700',
      selectedCheck: 'border-teal-700 bg-teal-700',
      featureIcon: 'text-teal-600',
      subjectSelected: 'border-teal-600 bg-teal-50 ring-1 ring-teal-200',
      subjectHover: 'hover:border-teal-300 hover:bg-teal-50',
      summaryCard: 'border-teal-200 bg-teal-50',
      summaryInner: 'bg-white ring-1 ring-teal-200',
      totalText: 'text-teal-700',
      payButton: 'bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 hover:shadow-teal-200',
    };
  }

  return {
    tier: 'vip' as const,
    color: 'from-indigo-600 to-purple-700',
    stepBg: 'bg-gradient-to-br from-indigo-600 to-purple-700',
    accentText: 'text-indigo-700',
    accentIcon: 'text-indigo-500',
    pill: 'bg-indigo-100 text-indigo-700',
    selectedCard: 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100 ring-1 ring-indigo-200',
    cardHover: 'hover:border-indigo-300 hover:shadow-indigo-100',
    selectedStripe: 'bg-indigo-600',
    selectedCheck: 'border-indigo-600 bg-indigo-600',
    featureIcon: 'text-indigo-500',
    subjectSelected: 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200',
    subjectHover: 'hover:border-indigo-300 hover:bg-indigo-50',
    summaryCard: 'border-indigo-200 bg-indigo-50',
    summaryInner: 'bg-white ring-1 ring-indigo-200',
    totalText: 'text-indigo-700',
    payButton: 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 hover:shadow-indigo-200',
  };
}

const SUBJECT_OPTIONS: Record<string, { label: string; short: string }> = {
  MATH: { label: 'Toán', short: 'Toán' },
  PHYSICS: { label: 'Vật lý', short: 'Lý' },
  CHEMISTRY: { label: 'Hóa học', short: 'Hóa' },
  CHINESE_SOC: { label: 'Tiếng Trung Xã hội', short: 'TTXH' },
  CHINESE_SCI: { label: 'Tiếng Trung Tự nhiên', short: 'TTTN' },
};

function normalizeSubjectCode(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function getPackageSubjects(pkg: DbPackage | null): string[] {
  return Array.isArray(pkg?.allowed_subjects)
    ? pkg.allowed_subjects.map(normalizeSubjectCode).filter(Boolean)
    : [];
}

function packageRequiresSubjectChoice(pkg: DbPackage | null) {
  return !!pkg?.requires_subject_choice && getPackageSubjects(pkg).filter(code => code !== '*').length > 0;
}

function getSubjectPrice(pkg: DbPackage | null, subjectCode?: string | null) {
  if (!pkg) return 0;
  const code = normalizeSubjectCode(subjectCode);
  const subjectPrice = code ? Number(pkg.subject_prices?.[code]) : 0;
  return Number.isFinite(subjectPrice) && subjectPrice > 0 ? subjectPrice : Number(pkg.price || 0);
}

function getSubjectOriginalPrice(pkg: DbPackage | null, subjectCode?: string | null) {
  if (!pkg) return null;
  const code = normalizeSubjectCode(subjectCode);
  const subjectOriginal = code ? Number(pkg.subject_original_prices?.[code]) : 0;
  if (Number.isFinite(subjectOriginal) && subjectOriginal > 0) return subjectOriginal;
  return pkg.original_price || null;
}

function getPositivePriceValues(map?: Record<string, number> | null) {
  return Object.values(map || {})
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
}

function getPackageStartingPrice(pkg: DbPackage) {
  const subjectPrices = getPositivePriceValues(pkg.subject_prices);
  if (pkg.requires_subject_choice && subjectPrices.length > 0) {
    return Math.min(...subjectPrices);
  }
  return Number(pkg.price) || 0;
}

function getPackageStartingOriginalPrice(pkg: DbPackage) {
  const subjectOriginalPrices = getPositivePriceValues(pkg.subject_original_prices);
  if (pkg.requires_subject_choice && subjectOriginalPrices.length > 0) {
    return Math.min(...subjectOriginalPrices);
  }
  return Number(pkg.original_price) || 0;
}

function packageFullyCoveredByUser(user: any, pkg: DbPackage) {
  const userTier = getTierLevel(user);
  if (userTier === 'premium') return true;
  if (derivePackageUI(pkg).tier === 'premium') return false;
  const subjects = getPackageSubjects(pkg).filter(code => code !== '*');
  return subjects.length > 0 && subjects.every(subject => canAccessSubject(user, subject));
}

function selectedEntitlementCovered(user: any, pkg: DbPackage | null, subjectCode?: string | null) {
  if (!pkg) return false;
  const userTier = getTierLevel(user);
  if (userTier === 'premium') return true;
  if (derivePackageUI(pkg).tier === 'premium') return false;
  if (packageRequiresSubjectChoice(pkg)) {
    return !!subjectCode && canAccessSubject(user, subjectCode);
  }
  const subjects = getPackageSubjects(pkg).filter(code => code !== '*');
  return subjects.length > 0 && subjects.every(subject => canAccessSubject(user, subject));
}

const PAYMENT_METHODS = [
  {
    id: 'bank_transfer',
    name: 'Chuyển khoản ngân hàng',
    sub: 'QR Code • Tự động kích hoạt',
    icon: (
      <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-black">QR</div>
    ),
    bg: 'bg-white',
    border: 'border-gray-200',
    hoverBg: 'hover:border-emerald-300 hover:bg-emerald-50/40',
    selectedBg: 'border-emerald-500 bg-white ring-2 ring-emerald-100',
    color: 'text-emerald-700',
    badge: 'Miễn phí phí giao dịch',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    recommended: true,
  },
];

const COIN_VALUE_VND = 100;
const MAX_COIN_DISCOUNT_RATIO = 0.2;

function getStoredCheckoutToken() {
  if (typeof window === 'undefined') return null;
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken) return sessionToken;

  try {
    const raw = localStorage.getItem('auth-storage');
    const parsed = raw ? JSON.parse(raw) : null;
    const token = typeof parsed?.state?.token === 'string' ? parsed.state.token : null;
    const refreshToken = typeof parsed?.state?.refreshToken === 'string' ? parsed.state.refreshToken : null;
    if (token) {
      sessionStorage.setItem('token', token);
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    }
    return token;
  } catch {
    return null;
  }
}

function getPromotionTheme(theme: PromotionBanner['theme']) {
  switch (theme) {
    case 'violet':
      return {
        shell: 'border-violet-200 bg-violet-50 text-violet-950',
        button: 'bg-violet-600 text-white hover:bg-violet-700',
        badge: 'bg-violet-100 text-violet-700',
      };
    case 'emerald':
      return {
        shell: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        button: 'bg-emerald-600 text-white hover:bg-emerald-700',
        badge: 'bg-emerald-100 text-emerald-700',
      };
    case 'rose':
      return {
        shell: 'border-rose-200 bg-rose-50 text-rose-950',
        button: 'bg-rose-600 text-white hover:bg-rose-700',
        badge: 'bg-rose-100 text-rose-700',
      };
    case 'blue':
      return {
        shell: 'border-sky-200 bg-sky-50 text-sky-950',
        button: 'bg-sky-600 text-white hover:bg-sky-700',
        badge: 'bg-sky-100 text-sky-700',
      };
    default:
      return {
        shell: 'border-amber-200 bg-amber-50 text-amber-950',
        button: 'bg-amber-600 text-white hover:bg-amber-700',
        badge: 'bg-amber-100 text-amber-700',
      };
  }
}

// ── QR Payment Screen ──────────────────────────────────────────────────────────
function BankTransferScreen({
  orderId,
  bank,
  onPaid,
}: {
  orderId: string;
  bank: { bankCode: string; accountNumber: string; accountName: string; amount: number; content: string; qrUrl: string };
  onPaid: (data: any) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [dots, setDots] = useState('.');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Chạy polling mỗi 4 giây
  useEffect(() => {
    if (!polling) return;

    const check = async () => {
      try {
        const res = await axios.get(`/payments/check-status?orderId=${orderId}&t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });
        if (res.data.status === 'completed') {
          setPolling(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          onPaid(res.data.data);
        }
      } catch (_) {}
    };

    check();
    intervalRef.current = setInterval(check, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [orderId, polling]);

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600);
    return () => clearInterval(t);
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const InfoRow = ({ label, value, copyKey }: { label: string; value: string; copyKey: string }) => (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-32 sm:shrink-0 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-gray-500">{label}</span>
      <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
        <span className="min-w-0 break-all font-bold text-gray-900 text-sm sm:truncate">{value}</span>
        <button
          onClick={() => copy(value, copyKey)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
          title="Sao chép"
        >
          {copied === copyKey ? <FiCheck size={14} className="text-green-500" /> : <FaCopy size={12} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 rounded-full text-green-700 text-sm font-bold mb-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Đang chờ thanh toán{dots}
        </div>
        <h2 className="text-xl font-black text-gray-900">Quét QR để thanh toán</h2>
        <p className="text-gray-500 text-sm mt-1">Mở app ngân hàng → Quét QR → Xác nhận</p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-lg border-2 border-indigo-100">
          <img
            src={bank.qrUrl}
            alt="QR Chuyển khoản"
            className="h-48 w-48 object-contain sm:h-52 sm:w-52"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`Bank:${bank.bankCode}|Acc:${bank.accountNumber}|Amount:${bank.amount}|Content:${bank.content}`)}`;
            }}
          />
        </div>
      </div>

      {/* Bank Info */}
      <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Thông tin chuyển khoản</h3>
        <InfoRow label="Ngân hàng" value={bank.bankCode} copyKey="bank" />
        <InfoRow label="Số tài khoản" value={bank.accountNumber} copyKey="account" />
        <InfoRow label="Chủ tài khoản" value={bank.accountName} copyKey="name" />
        <InfoRow label="Số tiền" value={`${bank.amount.toLocaleString('vi-VN')} đ`} copyKey="amount" />
        <InfoRow label="Nội dung" value={bank.content} copyKey="content" />
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-amber-800 mb-1">⚠️ Lưu ý quan trọng</p>
        <ul className="text-amber-700 space-y-1 text-xs">
          <li>• Nhập <strong>đúng nội dung</strong> chuyển khoản bên trên để hệ thống tự xác nhận</li>
          <li>• VIP được kích hoạt <strong>tự động trong vài giây</strong> sau khi tiền về</li>
          <li>• Nếu sau 5 phút chưa kích hoạt, liên hệ Admin qua Fanpage</li>
        </ul>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-3 rounded-xl bg-indigo-50 px-3 py-3 text-center">
        <FiRefreshCw size={16} className="text-indigo-500 animate-spin" />
        <span className="text-indigo-700 text-sm font-medium">Hệ thống đang tự động kiểm tra thanh toán{dots}</span>
      </div>
    </div>
  );
}

// ── Success Screen ─────────────────────────────────────────────────────────────
function SuccessScreen({ packageName, vipExpires }: { packageName?: string; vipExpires?: string }) {
  const router = useRouter();
  const { updateUser, setTokens, refreshToken } = useAuthStore();

  useEffect(() => {
    // Force refresh user data + update JWT token in sessionStorage
    getCurrentUser()
      .then((response) => {
        if (response?.success && response?.data?.user) {
          updateUser(response.data.user);
          if ((response.data as any).token) {
            setTokens((response.data as any).token, refreshToken || '');
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-200">
        <FaCheckCircle size={48} className="text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-gray-900">Thanh toán thành công! 🎉</h2>
        <p className="text-gray-500 mt-2">Tài khoản của bạn đã được nâng cấp</p>
        {packageName && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-amber-800 font-bold text-sm">
            <FaCrown className="text-yellow-500" size={14} />
            {packageName}
          </div>
        )}
        {vipExpires && (
          <p className="text-sm text-gray-400 mt-2">
            Hết hạn: {new Date(vipExpires).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => router.push('/hoi-dap')}
          className="py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm"
        >
          Hỏi đáp cố vấn →
        </button>
        <button
          onClick={() => router.push('/exam-room')}
          className="py-3 px-4 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
        >
          Vào phòng thi →
        </button>
      </div>
    </div>
  );
}

// ── Main Checkout ──────────────────────────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user, setUser, setTokens, refreshToken: storedRefreshToken } = useAuthStore();

  const [allPackages, setAllPackages] = useState<DbPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<DbPackage | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'qr' | 'success'>('select');
  const [qrData, setQrData] = useState<any>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const urlPackageId = searchParams?.get('package_id');
  const urlMethod = searchParams?.get('method');
  const urlCoupon = searchParams?.get('coupon');

  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(urlCoupon || null);
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<{ discount_amount: number; final_amount: number } | null>(null);
  const [couponMismatchError, setCouponMismatchError] = useState('');
  const [useCoins, setUseCoins] = useState(false);
  const [promotion, setPromotion] = useState<PromotionBanner | null>(null);
  const [authChecked, setAuthChecked] = useState(() => typeof window !== 'undefined');
  const [hasStoredToken, setHasStoredToken] = useState(() => Boolean(getStoredCheckoutToken()));
  const canUseCheckout = isAuthenticated || hasStoredToken;
  const userAllowedSubjectsKey = JSON.stringify(user?.vip_allowed_subjects || []);

  useEffect(() => {
    setHasStoredToken(Boolean(getStoredCheckoutToken()));
    setAuthChecked(true);
  }, []);

  // Re-validate coupon whenever package or coupon code changes
  useEffect(() => {
    if (!appliedCouponCode || !selectedPkg) return;
    const subjectQuery = selectedSubjectCode ? `&selected_subject_code=${encodeURIComponent(selectedSubjectCode)}` : '';
    axios.get(`/coupons/validate?code=${encodeURIComponent(appliedCouponCode)}&package_id=${selectedPkg.id}${subjectQuery}`)
      .then(res => {
        if (res.data.success) {
          setAppliedCouponInfo({
            discount_amount: res.data.data.discount_amount,
            final_amount: res.data.data.final_amount,
          });
          setCouponMismatchError('');
        } else {
          setAppliedCouponInfo(null);
          setCouponMismatchError(res.data.message || 'Mã không áp dụng cho gói này');
        }
      })
      .catch((err: any) => {
        setAppliedCouponInfo(null);
        setCouponMismatchError(err.response?.data?.message || 'Mã không hợp lệ');
      });
  }, [appliedCouponCode, selectedPkg, selectedSubjectCode]);

  useEffect(() => {
    if (!selectedPkg || !packageRequiresSubjectChoice(selectedPkg)) {
      setSelectedSubjectCode('');
      return;
    }
    const subjects = getPackageSubjects(selectedPkg).filter(code => code !== '*');
    if (!subjects.includes(selectedSubjectCode)) {
      const firstAvailable = subjects.find(subject => !canAccessSubject(user, subject)) || subjects[0] || '';
      setSelectedSubjectCode(firstAvailable);
    }
  }, [selectedPkg, selectedSubjectCode, user]);

  useEffect(() => {
    axios.get('/coupons/promotion?placement=checkout')
      .then(res => setPromotion(res.data.data || null))
      .catch(() => setPromotion(null));
  }, []);

  useEffect(() => {
    if (!canUseCheckout) {
      if (getStoredCheckoutToken()) setHasStoredToken(true);
      return;
    }
    getCurrentUser()
      .then((response) => {
        if (response?.success && response?.data?.user) {
          const nextToken = (response.data as any).token;
          if (nextToken) {
            const refreshToken = storedRefreshToken || (typeof window !== 'undefined' ? sessionStorage.getItem('refreshToken') || '' : '');
            setTokens(nextToken, refreshToken);
          }
          setUser(response.data.user);
        }
      })
      .catch(() => {});
  }, [canUseCheckout, setTokens, setUser, storedRefreshToken]);

  useEffect(() => {
    if (!authChecked) return;
    if (!canUseCheckout) {
      if (getStoredCheckoutToken()) {
        setHasStoredToken(true);
        return;
      }
      router.push('/login?redirect=/checkout');
      return;
    }
    axios.get('/vip/packages')
      .then(res => {
        const pkgs: DbPackage[] = (res.data.data || []).filter((pkg: DbPackage) => Number(pkg.price) > 0);

        const filteredPkgs = pkgs
          .filter(pkg => !packageFullyCoveredByUser(user, pkg))
          .sort((a, b) => getPackageStartingPrice(a) - getPackageStartingPrice(b));

        setAllPackages(filteredPkgs);
        if (urlPackageId) {
          const found = filteredPkgs.find(p => p.id === parseInt(urlPackageId));
          const fallback = filteredPkgs[0] || null;
          setSelectedPkg(found || fallback);
          if (!found) {
            setError('Tài khoản của bạn đã có gói này hoặc gói cao hơn.');
            if (!fallback) router.push('/vip');
          } else {
            setError('');
          }
        } else if (filteredPkgs.length > 0) {
          setSelectedPkg(filteredPkgs[0]);
        } else {
          // Tài khoản đã có gói cao nhất → redirect về trang VIP
          router.push('/vip');
        }
      })
      .catch(() => setAllPackages([]))
      .finally(() => setPkgLoading(false));
    if (urlMethod) setSelectedMethod(urlMethod);
  }, [authChecked, canUseCheckout, urlPackageId, urlMethod, router, user?.is_vip, user?.subscription_tier, user?.vip_expires_at, user?.vip_package_id, userAllowedSubjectsKey]);

  const userCoins = Math.max(0, Number(user?.coins || 0));
  const baseAmount = selectedPkg ? getSubjectPrice(selectedPkg, selectedSubjectCode) : 0;
  const baseOriginalAmount = selectedPkg ? getSubjectOriginalPrice(selectedPkg, selectedSubjectCode) : null;
  const subtotalAfterCoupon = selectedPkg ? Number(appliedCouponInfo?.final_amount ?? baseAmount) : 0;
  const maxCoinUse = selectedPkg
    ? Math.min(userCoins, Math.floor((subtotalAfterCoupon * MAX_COIN_DISCOUNT_RATIO) / COIN_VALUE_VND))
    : 0;
  const coinDiscountAmount = useCoins ? maxCoinUse * COIN_VALUE_VND : 0;
  const payableAmount = Math.max(0, subtotalAfterCoupon - coinDiscountAmount);
  const hasDiscount = selectedPkg ? payableAmount < baseAmount : false;

  useEffect(() => {
    if (useCoins && maxCoinUse <= 0) {
      setUseCoins(false);
    }
  }, [useCoins, maxCoinUse]);

  const refreshAuthUser = async () => {
    try {
      const response = await getCurrentUser();
      if (response?.success && response?.data?.user) {
        const nextToken = (response.data as any).token;
        if (nextToken) {
          const refreshToken = storedRefreshToken || (typeof window !== 'undefined' ? sessionStorage.getItem('refreshToken') || '' : '');
          setTokens(nextToken, refreshToken);
        }
        setUser(response.data.user);
      }
    } catch (_) {}
  };

  const handleProceed = async () => {
    if (!selectedPkg) { setError('Vui lòng chọn một gói.'); return; }
    if (couponMismatchError) { setError(couponMismatchError); return; }
    if (packageRequiresSubjectChoice(selectedPkg) && !selectedSubjectCode) {
      setError('Vui lòng chọn môn học cho gói này.');
      return;
    }
    if (selectedEntitlementCovered(user, selectedPkg, selectedSubjectCode)) {
      setError('Tài khoản đã có quyền cho gói/môn này.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/payments/create', {
        package_id: selectedPkg.id,
        payment_method: selectedMethod,
        coupon_code: appliedCouponCode,
        selected_subject_code: selectedSubjectCode || undefined,
        use_coins: useCoins,
        coins_to_use: useCoins ? maxCoinUse : 0,
        idempotency_key: [
          selectedPkg.id,
          selectedSubjectCode || 'all',
          selectedMethod,
          appliedCouponCode || 'no-coupon',
          useCoins ? maxCoinUse : 0,
        ].join(':'),
      });
      if (res.data.success) {
        if (res.data.appliedCoupon) {
          setAppliedCouponInfo(res.data.appliedCoupon);
        }
        if (res.data.status === 'completed' || res.data.payment_method === 'coupon_free') {
          await refreshAuthUser();
          setSuccessData(res.data.data || {
            package_name: selectedPkg.name,
            amount: 0,
          });
          setStep('success');
        } else if (res.data.payment_method === 'bank_transfer') {
          setQrData({ orderId: res.data.orderId, bank: res.data.bank });
          setStep('qr');
        } else if (res.data.payUrl) {
          window.location.href = res.data.payUrl;
        }
      } else {
        setError('Không tạo được thanh toán. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaid = async (data: any) => {
    await refreshAuthUser();
    setSuccessData(data);
    setStep('success');
  };

  if (!isAuthenticated || !user) return null;

  // ── SUCCESS ──
  if (step === 'success') {
    return <SuccessScreen packageName={successData?.package_name} vipExpires={successData?.vip_expires_at} />;
  }

  // ── QR SCREEN ──
  if (step === 'qr' && qrData) {
    return (
      <div>
        <button
          onClick={() => setStep('select')}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-700 text-sm mb-6 transition-colors"
        >
          <FiArrowLeft size={14} /> Quay lại chọn gói
        </button>
        <BankTransferScreen
          orderId={qrData.orderId}
          bank={qrData.bank}
          onPaid={handlePaid}
        />
      </div>
    );
  }

  const currentTierCoversSelectedPkg = selectedPkg ? selectedEntitlementCovered(user, selectedPkg, selectedSubjectCode) : false;
  const needsSubjectChoice = packageRequiresSubjectChoice(selectedPkg);
  const selectedSubjectMissing = needsSubjectChoice && !selectedSubjectCode;
  const selectedUi = selectedPkg ? derivePackageUI(selectedPkg) : null;
  const promotionTheme = promotion ? getPromotionTheme(promotion.theme) : null;

  // ── SELECT SCREEN ──
  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push('/vip');
          }
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <FiArrowLeft size={15} />
        Quay về
      </button>

      {/* Hero */}
      <div className={`flex flex-col gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 ${selectedUi ? selectedUi.summaryCard : 'border-gray-200'}`}>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
            <FaCrown size={13} className="text-amber-500" />
            Nâng cấp CSCA PRO
          </div>
          <h1 className="mt-3 text-2xl font-black text-gray-950 sm:text-3xl">Chọn gói và thanh toán</h1>
          <p className="mt-1 break-words text-sm text-gray-500">
            Tài khoản <span className="font-semibold text-gray-700">{user.email}</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
          {[
            { icon: <FaShieldAlt size={15} />, text: 'Bảo mật' },
            { icon: <FaBolt size={15} />, text: 'Kích hoạt' },
            { icon: <FaGift size={15} />, text: '7 ngày' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-gray-600 shadow-sm">
              <span className={`mx-auto mb-1 flex w-fit ${selectedUi?.accentIcon || 'text-indigo-500'}`}>{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {promotion && promotionTheme && (
        <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${promotionTheme.shell}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${promotionTheme.badge}`}>
                  <FaGift size={12} />
                  {promotion.badge_text || 'Ưu đãi MOLY'}
                </span>
                {promotion.coupon_code && (
                  <span className="rounded-lg bg-white px-3 py-1 font-mono text-xs font-black text-gray-900 ring-1 ring-gray-200">
                    {promotion.coupon_code}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
                <h2 className="text-xl font-black leading-tight sm:text-2xl">{promotion.title}</h2>
                {promotion.ends_at && (
                  <p className="text-xs font-semibold opacity-70">
                    Kết thúc {new Date(promotion.ends_at).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed opacity-75">{promotion.content}</p>
            </div>
            {promotion.coupon_code && (
              <button
                type="button"
                onClick={() => {
                  setAppliedCouponCode(promotion.coupon_code);
                  setCouponMismatchError('');
                }}
                className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black shadow-sm transition-colors ${promotionTheme.button}`}
              >
                {appliedCouponCode === promotion.coupon_code ? 'Đã áp dụng' : (promotion.cta_text || 'Dùng mã ngay')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="space-y-8">
          <div className="space-y-6">
      {/* Step 1: Package */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white ${selectedUi?.stepBg || 'bg-gray-900'}`}>1</div>
          <h2 className="text-lg font-black text-gray-900">Chọn gói phù hợp</h2>
        </div>
        {pkgLoading ? (
          <div className="flex justify-center py-10">
            <FiLoader size={28} className="animate-spin text-indigo-500" />
          </div>
        ) : allPackages.length === 0 ? (
          <div className="text-center py-10 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200">
            <div className="text-4xl mb-3">👑</div>
            <h3 className="font-black text-gray-900 mb-1">Bạn đã có gói cao nhất!</h3>
            <p className="text-sm text-gray-500 mb-4">Tài khoản của bạn đã được nâng cấp. Không cần mua thêm.</p>
            <button
              onClick={() => router.push('/profile')}
              className="px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200 text-sm"
            >
              Xem thông tin tài khoản
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {allPackages.map(pkg => {
              const ui = derivePackageUI(pkg);
              const selected = selectedPkg?.id === pkg.id;
              const displayPrice = selected && selectedSubjectCode ? getSubjectPrice(pkg, selectedSubjectCode) : getPackageStartingPrice(pkg);
              const displayOriginal = selected && selectedSubjectCode ? getSubjectOriginalPrice(pkg, selectedSubjectCode) : getPackageStartingOriginalPrice(pkg);
              const hasSalePrice = !!displayOriginal && displayOriginal > displayPrice;
              const salePercent = hasSalePrice ? Math.round((1 - displayPrice / Number(displayOriginal)) * 100) : 0;
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 sm:p-5
                    ${selected ? ui.selectedCard : `border-gray-200 bg-white hover:shadow-sm ${ui.cardHover}`}`}
                >
                  <div className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${selected ? ui.selectedStripe : 'bg-transparent'}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-gray-950">{pkg.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${ui.pill}`}>
                          {ui.tier === 'premium' ? 'Premium' : 'VIP'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{pkg.duration_days} ngày sử dụng</p>
                    </div>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all ${selected ? ui.selectedCheck : 'border-gray-300 bg-white'}`}>
                      {selected && <FiCheck size={14} className="text-white" />}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <span className="text-3xl font-black leading-none text-gray-950 sm:text-4xl">
                      {pkg.requires_subject_choice && !selectedSubjectCode && <span className="mr-1 text-sm text-gray-500">Từ</span>}
                      {displayPrice.toLocaleString('vi-VN')}<span className="ml-1 text-sm text-gray-500">đ</span>
                    </span>
                    {hasSalePrice && (
                      <>
                        <span className="text-sm font-bold text-gray-400 line-through">{Number(displayOriginal).toLocaleString('vi-VN')}đ</span>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-600 ring-1 ring-rose-100">-{salePercent}%</span>
                      </>
                    )}
                  </div>
                  {pkg.price_note && <p className="mt-2 text-xs font-bold leading-snug text-gray-500">{pkg.price_note}</p>}

                  <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    {(pkg.features || []).slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <FiCheck size={14} className={`mt-0.5 shrink-0 ${ui.featureIcon}`} />
                        <span className="text-sm leading-relaxed text-gray-600">{f}</span>
                      </li>
                    ))}
                    {(pkg.features || []).length > 4 && (
                      <li className="text-xs font-semibold text-gray-400">+{pkg.features.length - 4} tính năng khác...</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedPkg && needsSubjectChoice && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white ${selectedUi?.stepBg || 'bg-gray-900'}`}>2</div>
            <h2 className="text-lg font-black text-gray-900">Chọn môn học</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {getPackageSubjects(selectedPkg).filter(code => code !== '*').map(subject => {
              const selected = selectedSubjectCode === subject;
              const covered = canAccessSubject(user, subject);
              const price = getSubjectPrice(selectedPkg, subject);
              const original = getSubjectOriginalPrice(selectedPkg, subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => !covered && setSelectedSubjectCode(subject)}
                  disabled={covered}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    selected
                      ? selectedUi?.subjectSelected || 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-100'
                      : covered
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'
                        : `border-gray-200 bg-white ${selectedUi?.subjectHover || 'hover:border-indigo-200 hover:bg-indigo-50/40'}`
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-gray-950">{SUBJECT_OPTIONS[subject]?.label || subject}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {covered ? 'Đã có quyền' : 'Mở đúng môn này'}
                      </p>
                    </div>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? selectedUi?.selectedCheck || 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'}`}>
                      {selected && <FiCheck size={13} className="text-white" />}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <span className="text-xl font-black text-gray-950">{price.toLocaleString('vi-VN')}đ</span>
                    {original && original > price && (
                      <span className="text-xs font-bold text-gray-400 line-through">{original.toLocaleString('vi-VN')}đ</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Payment method */}
        <div>
          <div className="flex items-center gap-2 mb-4">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white ${selectedUi?.stepBg || 'bg-gray-900'}`}>{needsSubjectChoice ? 3 : 2}</div>
          <h2 className="text-lg font-black text-gray-900">Phương thức thanh toán</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {PAYMENT_METHODS.map(method => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`relative flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 sm:gap-4 sm:p-5
              ${selectedMethod === method.id ? `${method.selectedBg} shadow-lg` : `${method.border} ${method.bg} ${method.hoverBg} hover:shadow-md`}`}
            >
              {method.recommended && (
                <div className={`absolute -top-2 right-4 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ${selectedUi?.stepBg || 'bg-gray-900'}`}>
                  Khuyên dùng
                </div>
              )}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-50 shadow-sm ring-1 ring-gray-100">
                {method.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-black text-lg ${selectedMethod === method.id ? method.color : 'text-gray-800'}`}>{method.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${method.badgeColor}`}>{method.badge}</span>
                </div>
                {method.sub && <p className="text-xs text-gray-500 mt-0.5">{method.sub}</p>}
              </div>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${selectedMethod === method.id ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'}`}>
                {selectedMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Coins */}
      {selectedPkg && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black text-white ${selectedUi?.stepBg || 'bg-gray-900'}`}>{needsSubjectChoice ? 4 : 3}</div>
            <h2 className="text-lg font-black text-gray-900">Dùng xu giảm nhẹ đơn hàng</h2>
          </div>
          <button
            type="button"
            onClick={() => maxCoinUse > 0 && setUseCoins(v => !v)}
            disabled={maxCoinUse <= 0}
            className={`w-full rounded-2xl border p-4 text-left transition-all sm:p-5 ${
              useCoins && maxCoinUse > 0
                ? 'border-amber-400 bg-amber-50 shadow-sm ring-2 ring-amber-100'
                : maxCoinUse > 0
                  ? 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50'
                  : 'border-gray-200 bg-gray-50 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-gray-900">Dùng xu như ưu đãi phụ</p>
                <p className="mt-1 text-xs text-gray-500">
                  Bạn có {userCoins.toLocaleString('vi-VN')} xu. 1 xu = {COIN_VALUE_VND.toLocaleString('vi-VN')}đ, tối đa 20% đơn hàng; phần còn lại vẫn thanh toán để mở gói/khóa.
                </p>
                {maxCoinUse > 0 ? (
                  <p className="mt-2 text-sm font-bold text-amber-700">
                    Có thể dùng {maxCoinUse.toLocaleString('vi-VN')} xu, giảm {coinDiscountAmount.toLocaleString('vi-VN')}đ
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-gray-500">Chưa đủ điều kiện dùng xu cho đơn này</p>
                )}
              </div>
              <div className={`h-6 w-11 rounded-full p-0.5 transition-colors ${useCoins && maxCoinUse > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${useCoins && maxCoinUse > 0 ? 'translate-x-5' : ''}`} />
              </div>
            </div>
          </button>
        </div>
      )}

          </div>

          <div className="space-y-4 border-t border-gray-100 pt-6">
      {/* Order summary */}
      {selectedPkg && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <FaLock size={14} className={selectedUi?.accentIcon || 'text-gray-900'} />
            <h3 className="text-sm font-black uppercase tracking-wide text-gray-900">Xác nhận đơn hàng</h3>
          </div>

          <div className={`rounded-xl p-4 ${selectedUi?.summaryInner || 'bg-gray-50 ring-1 ring-gray-100'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${derivePackageUI(selectedPkg).color}`}>
                  <FaCrown size={17} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-950 sm:text-base">{selectedPkg.name}</p>
                  <p className="text-xs font-semibold text-gray-500">{selectedPkg.duration_days} ngày sử dụng</p>
                  {selectedSubjectCode && (
                    <p className={`mt-0.5 text-xs font-bold ${selectedUi?.accentText || 'text-indigo-600'}`}>
                      {SUBJECT_OPTIONS[selectedSubjectCode]?.label || selectedSubjectCode}
                    </p>
                  )}
                </div>
              </div>
              {baseOriginalAmount && baseOriginalAmount > baseAmount && (
                <span className="shrink-0 text-sm font-bold text-gray-400 line-through">{baseOriginalAmount.toLocaleString('vi-VN')}đ</span>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Tạm tính</span>
              <span className="font-bold text-gray-900">{baseAmount.toLocaleString('vi-VN')}đ</span>
            </div>
            {appliedCouponInfo && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Mã giảm giá</span>
                <span className="font-bold text-emerald-600">-{appliedCouponInfo.discount_amount.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            {useCoins && maxCoinUse > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Dùng xu</span>
                <span className="font-bold text-amber-600">
                  -{coinDiscountAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            )}
          </div>

          {appliedCouponCode && appliedCouponInfo && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                {appliedCouponCode}
              </span>
              <span className="text-xs font-semibold text-emerald-700">đã được áp dụng</span>
            </div>
          )}

          <div className="flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
            <span className="text-sm font-bold text-gray-500">Thanh toán</span>
            <span className={`text-3xl font-black leading-none ${selectedUi?.totalText || 'text-gray-950'}`}>
              {payableAmount.toLocaleString('vi-VN')}<span className="ml-1 text-sm text-gray-500">đ</span>
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <button
              onClick={handleProceed}
              disabled={loading || currentTierCoversSelectedPkg || selectedSubjectMissing}
              className={`flex w-full flex-wrap items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-black text-white shadow-lg transition-all sm:gap-3
                ${loading || currentTierCoversSelectedPkg || selectedSubjectMissing ? 'cursor-not-allowed bg-gray-300 shadow-none' : `${selectedUi?.payButton || 'bg-gray-950 hover:bg-gray-800 hover:shadow-gray-200'} active:scale-[0.99]`}`}
            >
              {loading ? (
                <><FiLoader size={20} className="animate-spin" /> Đang khởi tạo...</>
              ) : currentTierCoversSelectedPkg ? (
                'Gói này đã được kích hoạt'
              ) : selectedSubjectMissing ? (
                'Chọn môn học để tiếp tục'
              ) : (
                <>
                  <span>{payableAmount <= 0 ? 'Kích hoạt gói' : 'Tiến hành thanh toán'}</span>
                  <FaArrowRight size={18} />
                </>
              )}
            </button>
            <button onClick={() => router.push('/vip')} className="flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:text-gray-800">
              <FiArrowLeft size={16} /> Quay lại bảng giá
            </button>
          </div>
        </div>
      )}

      {couponMismatchError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          ⚠️ {couponMismatchError} — Vui lòng chọn lại gói hoặc gỡ mã giảm giá.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!selectedPkg && (
        <button
          onClick={handleProceed}
          disabled
          className="flex w-full items-center justify-center rounded-xl bg-gray-300 px-5 py-4 text-base font-black text-white"
        >
          Chọn gói để tiếp tục
        </button>
      )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-3 py-6 pt-20 sm:px-4 sm:py-10 sm:pt-28">
      <div className="w-full max-w-7xl mx-auto">
        <Suspense fallback={
          <div className="flex justify-center items-center py-24">
            <FiLoader size={40} className="animate-spin text-indigo-600" />
          </div>
        }>
          <CheckoutContent />
        </Suspense>
      </div>
    </div>
  );
}
