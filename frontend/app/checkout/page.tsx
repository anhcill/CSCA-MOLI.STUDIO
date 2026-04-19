"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import {
  FaCrown, FaShieldAlt, FaBolt, FaGift,
  FaLock, FaArrowRight, FaStar, FaQuestionCircle, FaVideo
} from 'react-icons/fa';
import { FiArrowLeft, FiCheck, FiLoader } from 'react-icons/fi';

// Plan definitions — matches /vip page exactly
const PACKAGES = [
  {
    id: 'vip_3m',
    tier: 'vip',
    name: 'VIP 3 Tháng',
    duration_days: 90,
    price: 99000,
    priceDisplay: '99K',
    period: '/3 tháng',
    color: 'from-indigo-500 to-purple-600',
    badge: null,
    features: [
      'Mở khoá toàn bộ đề thi',
      'Xem lời giải chi tiết mọi câu',
      'Xem tài liệu PDF chất lượng cao',
      'Làm bài thi thử không giới hạn',
      'Theo dõi tiến độ học tập',
      'Giới hạn 2 thiết bị',
    ],
    popular: false,
  },
  {
    id: 'vip_1y',
    tier: 'vip',
    name: 'VIP 1 Năm',
    duration_days: 365,
    price: 249000,
    priceDisplay: '249K',
    period: '/năm',
    color: 'from-indigo-600 to-purple-700',
    badge: 'Phổ biến',
    saving: 'Tiết kiệm 45%',
    features: [
      'Tất cả tính năng VIP 3 Tháng',
      'Cập nhật đề thi mới nhất 2026',
      'Bảo lưu khoá học trọn đời',
      'Giới hạn 2 thiết bị',
    ],
    popular: true,
  },
  {
    id: 'pre_3m',
    tier: 'premium',
    name: 'Premium 3 Tháng',
    duration_days: 90,
    price: 249000,
    priceDisplay: '249K',
    period: '/3 tháng',
    color: 'from-amber-500 to-orange-600',
    badge: null,
    features: [
      'Tất cả tính năng VIP',
      'Video giải đề chính thức',
      'Đặt câu hỏi cho team cố vấn',
      'Được giải đề riêng từ cố vấn',
      'Mở khoá toàn bộ đề & tài liệu',
      'Giới hạn 3 thiết bị',
    ],
    popular: false,
  },
  {
    id: 'pre_1y',
    tier: 'premium',
    name: 'Premium 1 Năm',
    duration_days: 365,
    price: 699000,
    priceDisplay: '699K',
    period: '/năm',
    color: 'from-amber-600 to-red-600',
    badge: 'Best Value',
    saving: 'Tiết kiệm 42%',
    features: [
      'Tất cả tính năng Premium 3 Tháng',
      'Cập nhật video giải đề liên tục',
      'Hỗ trợ ưu tiên từ cố vấn',
      'Ưu tiên trả lời trong 24h',
      'Bảo lưu khoá học trọn đời',
      'Giới hạn 3 thiết bị',
    ],
    popular: false,
  },
];

const PAYMENT_METHODS = [
  {
    id: 'momo',
    name: 'Ví MoMo',
    icon: (
      <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="32" fill="#A50064"/>
        <circle cx="32" cy="32" r="24" fill="white" fillOpacity=".15"/>
        <path d="M32 16C23.16 16 16 23.16 16 32s7.16 16 16 16 16-7.16 16-16S40.84 16 32 16zm6.4 20.8c-.6 1.4-1.8 3.2-3.2 4.3-1.1.8-2.7 1.1-4.8.2-1.5-.6-3-1.4-4-2-1.6-1-2.8-1.7-3.4-2.4s-1.4-1.5-1.4-1.5-.1-.2 0-.4l1-1c1.5-1.2 3.4-2.2 5.4-2.8 2-.6 4.6 0 6 .8 1 .4 1.6 1 2 1.6.4.6.6 1.2.6 1.8 0 1.4-.6 3.2-1.6 4.8-.2.2-.4.6-.6.8l-.2.4-.2.4c0 .2 0 .4.2.4.6.6 1.4.8 2 .8.8.2 2 .6 3 1 1 .4 1.8.4 2.2.6.4.2.6.2.8.2.2 0 .4 0 .6-.2l.2-.2s.2-.2.4-.2c.2 0 .6.2.8.4.8 1.2 1.8 2.6 3 3.6 1.2 1 2 1.4 2.4 1.8.4.4.6.4.6.4s.2 0 .6-.6c.4-.6 1-1.4 1.6-2 .6-.6 1.4-1.4 2.2-2.2.8-.8 1.6-1.6 2.2-2 .6-.4 1-.8 1.4-1 .4-.2.6-.4.6-.4.2 0 .4.2.6.4.2.2.4.6.4 1 .2 1.2-.2 3-.8 4.4z" fill="white"/>
      </svg>
    ),
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    hoverBg: 'hover:border-pink-400 hover:bg-pink-100',
    selectedBg: 'bg-pink-50 border-pink-400',
    color: 'text-pink-700',
    badge: 'Khuyên dùng',
    badgeColor: 'bg-pink-500 text-white',
  },
  {
    id: 'vnpay',
    name: 'VNPay',
    sub: 'ATM / Internet Banking',
    icon: (
      <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" rx="14" fill="#004B9B"/>
        <rect x="16" y="48" width="48" height="8" rx="2" fill="white" fillOpacity=".9"/>
        <rect x="16" y="36" width="48" height="8" rx="2" fill="white" fillOpacity=".7"/>
        <rect x="16" y="24" width="48" height="8" rx="2" fill="white" fillOpacity=".5"/>
        <text x="40" y="22" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">VNPay</text>
      </svg>
    ),
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBg: 'hover:border-blue-400 hover:bg-blue-100',
    selectedBg: 'bg-blue-50 border-blue-400',
    color: 'text-blue-700',
    badge: 'Hơn 40 ngân hàng',
    badgeColor: 'bg-blue-600 text-white',
  },
];

const FEATURES_BANNER = [
  { icon: <FaShieldAlt size={20} />, text: 'Thanh toán bảo mật 100%' },
  { icon: <FaBolt size={20} />, text: 'Kích hoạt tức thì sau thanh toán' },
  { icon: <FaGift size={20} />, text: 'Hoàn tiền trong 7 ngày' },
];

function PackageCard({ pkg, selected, onSelect }: { pkg: typeof PACKAGES[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`group relative w-full text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${selected
          ? `border-transparent shadow-xl scale-[1.02] ring-4 ring-indigo-200`
          : `border-gray-200 hover:border-gray-300 hover:shadow-lg bg-white`
        }`}
    >
      {pkg.popular && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />
      )}

      <div className={`relative p-5 pb-4 ${pkg.popular ? `bg-gradient-to-r ${pkg.color} text-white` : 'bg-gray-50'}`}>
        {pkg.badge && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2">
            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg ${pkg.popular ? 'bg-white text-indigo-700' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'}`}>
              {pkg.badge}
            </span>
          </div>
        )}

        <div className="flex items-start justify-between pt-2">
          <div>
            <h3 className={`font-black text-xl ${pkg.popular ? 'text-white' : 'text-gray-900'}`}>
              {pkg.name}
            </h3>
            <p className={`text-xs mt-0.5 ${pkg.popular ? 'text-white/70' : 'text-gray-500'}`}>
              {pkg.duration_days === 90 ? '3 tháng sử dụng' : '1 năm sử dụng'}
            </p>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            selected ? 'bg-white border-white' : `border-transparent ${pkg.popular ? 'border-white/30' : ''}`
          }`}>
            {selected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke={pkg.popular ? pkg.color.split(' ')[1] : '#4F46E5'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className={`text-4xl font-black ${selected ? 'text-white' : 'text-gray-900'}`}>
            {pkg.priceDisplay}
          </span>
          <span className={`text-sm ${pkg.popular ? 'text-white/70' : 'text-gray-500'}`}>đ{` `}{pkg.period}</span>
        </div>
        {pkg.saving && (
          <div className={`mt-1 text-xs font-bold px-2 py-0.5 rounded-md w-max ${pkg.popular ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            {pkg.saving}
          </div>
        )}
      </div>

      <div className="relative p-5 bg-white">
        <ul className="space-y-2.5">
          {pkg.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                pkg.popular ? 'bg-indigo-100' : 'bg-gray-100'
              }`}>
                <FiCheck size={11} className={pkg.popular ? 'text-indigo-600' : 'text-gray-500'} />
              </div>
              <span className={`text-sm ${pkg.popular ? 'text-gray-700' : 'text-gray-600'}`}>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {!selected && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 group-hover:h-1.5 transition-all" />
      )}
    </button>
  );
}

function PaymentMethodCard({
  method, selected, onSelect
}: { method: typeof PAYMENT_METHODS[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`relative w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left
        ${selected
          ? `${method.selectedBg} shadow-lg`
          : `${method.border} ${method.bg} ${method.hoverBg} hover:shadow-md`
        }`}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm bg-white">
        {method.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-black text-lg ${selected ? method.color : 'text-gray-800'}`}>
            {method.name}
          </p>
          {method.badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${method.badgeColor}`}>
              {method.badge}
            </span>
          )}
        </div>
        {method.sub && (
          <p className="text-xs text-gray-500 mt-0.5">{method.sub}</p>
        )}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
        selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
      }`}>
        {selected && (
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
        )}
      </div>
    </button>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [selectedPkg, setSelectedPkg] = useState<typeof PACKAGES[0] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('momo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const urlPlan = searchParams?.get('plan');
  const urlDuration = searchParams?.get('duration');
  const urlMethod = searchParams?.get('method');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/checkout');
      return;
    }
    // Match by plan ID first, then fallback to duration
    if (urlPlan) {
      const found = PACKAGES.find(p => p.id === urlPlan);
      if (found) setSelectedPkg(found);
    } else if (urlDuration) {
      const found = PACKAGES.find(p => p.duration_days === parseInt(urlDuration));
      if (found) setSelectedPkg(found);
    }
    if (urlMethod) setSelectedMethod(urlMethod);
  }, [isAuthenticated, urlPlan, urlDuration, urlMethod, router]);

  const handleProceed = async () => {
    if (!selectedPkg) { setError('Vui lòng chọn một gói VIP.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/payments/create', {
        duration_days: selectedPkg.duration_days,
        payment_method: selectedMethod,
        tier: selectedPkg.tier,
      });
      if (res.data.success && res.data.payUrl) {
        window.location.href = res.data.payUrl;
      } else {
        setError('Không tạo được link thanh toán. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi kết nối cổng thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || !user) return null;

  const method = PAYMENT_METHODS.find(m => m.id === selectedMethod);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 rounded-full text-amber-800 text-sm font-bold shadow-sm">
          <FaCrown size={14} className="text-amber-500" />
          Thanh toán nâng cấp CSCA PRO
        </div>
        <h1 className="text-3xl font-black text-gray-900">
          Mở khóa toàn bộ
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> tính năng PRO</span>
        </h1>
        <p className="text-gray-500 text-sm">
          Thanh toán với tài khoản
          <span className="font-semibold text-gray-700 ml-1">{user.email}</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          {FEATURES_BANNER.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className="text-indigo-500">{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {[{ n: 1, label: 'Chọn gói' }, { n: 2, label: 'Thanh toán' }, { n: 3, label: 'Hoàn tất' }].map((step, i, arr) => (
          <div key={step.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all
                ${i === 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'}`}>
                {step.n}
              </div>
              <span className={`text-sm font-semibold hidden sm:block ${i === 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < arr.length - 1 && (
              <div className="w-12 sm:w-16 h-0.5 bg-gray-200 mx-3" />
            )}
          </div>
        ))}
      </div>

      {/* Package selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black">1</div>
          <h2 className="text-lg font-black text-gray-900">Chọn gói phù hợp với bạn</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PACKAGES.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selectedPkg?.id === pkg.id}
              onSelect={() => setSelectedPkg(pkg)}
            />
          ))}
        </div>
        {!selectedPkg && (
          <p className="text-center text-sm text-gray-400 mt-3">
            Nhấn vào gói bạn muốn để chọn
          </p>
        )}
      </div>

      {/* Payment method */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black">2</div>
          <h2 className="text-lg font-black text-gray-900">Chọn phương thức thanh toán</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PAYMENT_METHODS.map(method => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              selected={selectedMethod === method.id}
              onSelect={() => setSelectedMethod(method.id)}
            />
          ))}
        </div>
      </div>

      {/* Order summary */}
      {selectedPkg && (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white space-y-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <FaLock size={14} className="text-amber-400" />
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Xác nhận đơn hàng</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedPkg.color} flex items-center justify-center`}>
                <FaCrown size={20} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-base">{selectedPkg.name}</p>
                <p className="text-xs text-gray-400">{selectedPkg.duration_days === 90 ? '3 tháng sử dụng' : '1 năm sử dụng'}</p>
              </div>
            </div>
            <span className="text-2xl font-black">{selectedPkg.priceDisplay}<span className="text-sm text-gray-400">đ</span></span>
          </div>
          <div className="border-t border-white/10" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Phương thức</span>
              <span className="text-white font-medium">{method?.name}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Tính năng</span>
              <span className="text-white font-medium">{selectedPkg.features.length} quyền lợi</span>
            </div>
          </div>
          <div className="border-t border-white/10" />
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-medium">Thành tiền</span>
            <div className="text-right">
              <span className="text-3xl font-black text-white">{selectedPkg.price.toLocaleString('vi-VN')}</span>
              <span className="text-gray-400 text-sm ml-0.5">đ</span>
            </div>
          </div>
          {selectedPkg.saving && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-2 text-center">
              <span className="text-emerald-400 text-sm font-bold">{selectedPkg.saving}</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-5 py-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3">
        <button
          onClick={handleProceed}
          disabled={!selectedPkg || loading}
          className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-black text-lg shadow-2xl transition-all
            ${!selectedPkg || loading
              ? 'bg-gray-300 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-200 active:scale-[0.99]'
            }`}
        >
          {loading ? (
            <><FiLoader size={20} className="animate-spin" /> Đang khởi tạo thanh toán...</>
          ) : selectedPkg ? (
            <>Thanh toán {selectedPkg.priceDisplay}đ<FaArrowRight size={18} /></>
          ) : (
            'Chọn gói VIP để tiếp tục'
          )}
        </button>
        <button
          onClick={() => router.push('/vip')}
          className="w-full flex items-center justify-center gap-2 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          <FiArrowLeft size={16} />
          Quay lại bảng giá
        </button>
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { icon: <FaShieldAlt size={16} className="text-emerald-500" />, label: 'Bảo mật SSL' },
          { icon: <FaBolt size={16} className="text-amber-500" />, label: 'Kích hoạt tức thì' },
          { icon: <FaGift size={16} className="text-pink-500" />, label: 'Hoàn tiền 7 ngày' },
        ].map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 text-center p-3 bg-gray-50 rounded-xl">
            {t.icon}
            <span className="text-xs font-medium text-gray-500">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-400 pt-2 border-t border-gray-100">
        Dang su dung che do test MoMo/VNPay sandbox — thanh toan thuc te se hoat dong khi len production
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50 py-12 px-4 pt-28">
      <div className="w-full max-w-3xl mx-auto">
        <div className="bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-gray-100">
          <div className="h-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
          <div className="p-8 sm:p-10">
            <Suspense fallback={
              <div className="flex justify-center items-center py-24">
                <FiLoader size={40} className="animate-spin text-indigo-600" />
              </div>
            }>
              <CheckoutContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
