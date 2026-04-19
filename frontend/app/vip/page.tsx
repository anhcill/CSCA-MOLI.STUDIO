"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { FaCheckCircle, FaStar, FaCrown, FaVideo, FaQuestionCircle } from 'react-icons/fa';

const plans = [
  // ── VIP Plans ────────────────────────────────────────────────
  {
    id: 'vip_3m',
    tier: 'vip',
    name: 'VIP 3 Tháng',
    duration: 90,
    price: 99000,
    originalPrice: 150000,
    popular: false,
    color: 'from-indigo-500 to-purple-600',
    borderColor: 'border-indigo-200',
    tag: 'Tiết kiệm 34%',
    tagColor: 'bg-indigo-100 text-indigo-700',
    features: [
      'Mở khoá toàn bộ đề thi',
      'Xem lời giải chi tiết mọi câu',
      'Xem tài liệu PDF chất lượng cao',
      'Làm bài thi thử không giới hạn',
      'Theo dõi tiến độ học tập',
      'Giới hạn 2 thiết bị',
    ],
    extra: null,
  },
  {
    id: 'vip_1y',
    tier: 'vip',
    name: 'VIP 1 Năm',
    duration: 365,
    price: 249000,
    originalPrice: 450000,
    popular: true,
    color: 'from-indigo-600 to-purple-700',
    borderColor: 'border-indigo-300',
    tag: 'Tiết kiệm 45%',
    tagColor: 'bg-indigo-600 text-white',
    features: [
      'Tất cả tính năng VIP 3 Tháng',
      'Cập nhật đề thi mới nhất 2026',
      'Bảo lưu khoá học trọn đời',
      'Giới hạn 2 thiết bị',
    ],
    extra: null,
  },
  // ── Premium Plans ────────────────────────────────────────────
  {
    id: 'pre_3m',
    tier: 'premium',
    name: 'Premium 3 Tháng',
    duration: 90,
    price: 249000,
    originalPrice: 400000,
    popular: false,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-200',
    tag: 'Tiết kiệm 38%',
    tagColor: 'bg-amber-100 text-amber-700',
    features: [
      'Tất cả tính năng VIP',
      'Video giải đề chính thức',
      'Đặt câu hỏi cho team cố vấn',
      'Được giải đề riêng từ cố vấn',
      'Mở khoá toàn bộ đề & tài liệu',
      'Giới hạn 3 thiết bị',
    ],
    extra: { icon: FaVideo, text: 'Video giải đề + Team cố vấn' },
  },
  {
    id: 'pre_1y',
    tier: 'premium',
    name: 'Premium 1 Năm',
    duration: 365,
    price: 699000,
    originalPrice: 1200000,
    popular: false,
    color: 'from-amber-600 to-red-600',
    borderColor: 'border-amber-300',
    tag: 'Best Value',
    tagColor: 'bg-amber-600 text-white',
    features: [
      'Tất cả tính năng Premium 3 Tháng',
      'Cập nhật video giải đề liên tục',
      'Hỗ trợ ưu tiên từ cố vấn',
      'Ưu tiên trả lời trong 24h',
      'Bảo lưu khoá học trọn đời',
      'Giới hạn 3 thiết bị',
    ],
    extra: { icon: FaVideo, text: 'Video giải đề + Team cố vấn 1-1' },
  },
];

export default function VipPricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);

  const handleCheckout = (pkg: typeof plans[0]) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/vip');
      return;
    }
    router.push(`/checkout?plan=${pkg.id}&duration=${pkg.duration}&method=momo`);
  };

  const isVip = mounted && user?.is_vip;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 py-16 px-4 pt-24 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-amber-100 border border-amber-200 rounded-full text-amber-800 text-sm font-bold mb-4">
            <FaCrown className="text-yellow-500" size={14} />
            CSCA PRO
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
            Nâng cấp tài khoản
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> PRO</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Mở khoá toàn bộ đề thi, video giải đề chính thức và đội ngũ cố vấn hỗ trợ riêng
          </p>
          {isVip && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-full text-sm text-amber-800 font-semibold">
              <FaCrown className="text-yellow-500" size={14} />
              Bạn đã là thành viên PRO — cảm ơn bạn đã tin tưởng CSCA!
            </div>
          )}
        </div>

        {/* Tier selector: VIP vs Premium */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1 bg-white rounded-2xl p-1 shadow-md border border-gray-100">
            {[
              { key: 'vip', label: 'VIP', desc: 'Mở khoá đề thi', icon: FaCrown, color: 'from-indigo-500 to-purple-600' },
              { key: 'premium', label: 'Premium', desc: 'Đề thi + Video + Cố vấn', icon: FaStar, color: 'from-amber-500 to-orange-600' },
            ].map((tab) => (
              <div key={tab.key} className="relative">
                <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl opacity-10`} />
                <div className="relative px-6 py-3 text-center">
                  <div className={`font-black text-sm text-gray-900 flex items-center gap-1.5 justify-center`}>
                    <tab.icon size={14} className={tab.key === 'vip' ? 'text-indigo-500' : 'text-amber-500'} />
                    {tab.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 hidden sm:block">{tab.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VIP Plans */}
        <div className="mb-6">
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            <FaCrown className="text-indigo-500" size={18} />
            Gói VIP — Mở khoá toàn bộ đề thi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.filter(p => p.tier === 'vip').map((pkg) => (
              <PlanCard key={pkg.id} pkg={pkg} isVip={!!isVip} onCheckout={handleCheckout} />
            ))}
          </div>
        </div>

        {/* Premium Plans */}
        <div>
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            <FaStar className="text-amber-500" size={18} />
            Gói Premium — Đề thi + Video giải đề + Team cố vấn
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.filter(p => p.tier === 'premium').map((pkg) => (
              <PlanCard key={pkg.id} pkg={pkg} isVip={!!isVip} onCheckout={handleCheckout} />
            ))}
          </div>
        </div>

        {/* Feature comparison */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-xl font-black text-gray-900 text-center mb-6">So sánh tính năng</h3>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 font-bold text-gray-700">Tính năng</th>
                  <th className="text-center px-4 py-3 font-bold text-indigo-600">VIP</th>
                  <th className="text-center px-4 py-3 font-bold text-amber-600">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Mở khoá toàn bộ đề thi', true, true],
                  ['Xem lời giải chi tiết', true, true],
                  ['Xem tài liệu PDF', true, true],
                  ['Làm bài thi không giới hạn', true, true],
                  ['Video giải đề chính thức', false, true],
                  ['Đặt câu hỏi cho team cố vấn', false, true],
                  ['Được giải đề riêng từ cố vấn', false, true],
                  ['Giới hạn thiết bị', '2 thiết bị', '3 thiết bị'],
                  ['Hỗ trợ ưu tiên', false, true],
                ].map(([feat, vipVal, preVal], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-3 font-medium text-gray-700">{feat as string}</td>
                    <td className="text-center px-4 py-3">
                      {typeof vipVal === 'boolean' ? (
                        vipVal ? <span className="text-emerald-500 font-bold">✓</span>
                                : <span className="text-gray-300 font-bold">—</span>
                      ) : (
                        <span className="text-gray-600 text-xs font-semibold">{vipVal as string}</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3">
                      {typeof preVal === 'boolean' ? (
                        preVal ? <span className="text-emerald-500 font-bold">✓</span>
                                : <span className="text-gray-300 font-bold">—</span>
                      ) : (
                        <span className="text-gray-600 text-xs font-semibold">{preVal as string}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ pkg, isVip, onCheckout }: {
  pkg: typeof plans[0];
  isVip: boolean;
  onCheckout: (p: typeof plans[0]) => void;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg border-2 ${pkg.borderColor} overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
      {pkg.popular && (
        <div className="absolute top-4 right-4">
          <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm ${pkg.tagColor}`}>
            {pkg.tag}
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`bg-gradient-to-r ${pkg.color} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">{pkg.name}</h3>
            <p className="text-white/70 text-sm mt-1">{pkg.duration === 90 ? '3 tháng sử dụng' : '1 năm sử dụng'}</p>
          </div>
          {pkg.extra && (
            <div className="bg-white/20 rounded-xl p-2 text-center">
              <pkg.extra.icon size={20} className="mx-auto text-white" />
              <span className="text-[9px] font-bold text-white/80 block mt-0.5">Cố vấn</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-black">{pkg.price.toLocaleString('vi-VN')}</span>
          <span className="text-white/70 text-sm">đ</span>
        </div>
        {pkg.originalPrice > pkg.price && (
          <div className="flex items-center gap-2 mt-1">
            <span className="line-through text-white/50 text-sm">{pkg.originalPrice.toLocaleString('vi-VN')}đ</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pkg.tagColor}`}>{pkg.tag}</span>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {pkg.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <FaCheckCircle size={16} className={pkg.tier === 'vip' ? 'text-indigo-500 mt-0.5 shrink-0' : 'text-amber-500 mt-0.5 shrink-0'} />
              <span className="text-sm text-gray-700">{feat}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => onCheckout(pkg)}
          disabled={loading}
          className={`w-full py-3.5 rounded-xl font-black text-sm transition-all shadow-md
            ${pkg.tier === 'vip'
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isVip ? 'Gia hạn ngay' : 'Nâng cấp ngay'}
        </button>
      </div>
    </div>
  );
}
