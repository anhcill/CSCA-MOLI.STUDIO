"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { FaCheckCircle, FaStar, FaCrown, FaVideo } from 'react-icons/fa';
import { FiLoader, FiTag, FiPercent, FiX, FiAlertCircle, FiCheck } from 'react-icons/fi';
import axios from '@/lib/utils/axios';

interface VipPackage {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description: string;
  features: string[];
  is_active: boolean;
}

interface CouponResult {
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  package_name: string;
  valid_until: string | null;
}

interface Discount {
  code: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  package_id: number;
}

function deriveColor(pkg: VipPackage) {
  const isPremium = pkg.name.toLowerCase().includes('premium');
  if (isPremium) {
    return pkg.duration_days >= 300
      ? { gradient: 'from-amber-600 to-red-600', border: 'border-amber-300', tag: 'bg-amber-600 text-white', icon: 'text-amber-500' }
      : { gradient: 'from-amber-500 to-orange-600', border: 'border-amber-200', tag: 'bg-amber-100 text-amber-700', icon: 'text-amber-500' };
  }
  return pkg.duration_days >= 300
    ? { gradient: 'from-indigo-600 to-purple-700', border: 'border-indigo-300', tag: 'bg-indigo-600 text-white', icon: 'text-indigo-500' }
    : { gradient: 'from-indigo-500 to-purple-600', border: 'border-indigo-200', tag: 'bg-indigo-100 text-indigo-700', icon: 'text-indigo-500' };
}

export default function VipPricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [packages, setPackages] = useState<VipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<VipPackage | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    axios.get('/vip/packages')
      .then(res => setPackages(res.data.data || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCheckout = (pkg: VipPackage) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/vip');
      return;
    }
    const params = new URLSearchParams({ package_id: String(pkg.id) });
    if (appliedDiscount && appliedDiscount.package_id === pkg.id) {
      params.set('coupon', appliedDiscount.code);
    }
    router.push(`/checkout?${params.toString()}`);
  };

  const handleApplyCoupon = async (pkg: VipPackage) => {
    if (!couponInput.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await axios.get(`/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&package_id=${pkg.id}`);
      if (res.data.success) {
        const data = res.data.data;
        const d: Discount = {
          code: data.code,
          discount_amount: data.discount_amount,
          original_amount: data.original_amount,
          final_amount: data.final_amount,
          package_id: pkg.id,
        };
        setAppliedDiscount(d);
        setCouponResult(data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Mã giảm giá không hợp lệ';
      setCouponError(msg);
      setCouponResult(null);
      setAppliedDiscount(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setCouponResult(null);
    setAppliedDiscount(null);
    setCouponError('');
  };

  const isVip = mounted && user?.is_vip;
  const vipPkgs = packages.filter(p => !p.name.toLowerCase().includes('premium'));
  const premiumPkgs = packages.filter(p => p.name.toLowerCase().includes('premium'));

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
              Bạn đang là thành viên PRO — cảm ơn bạn đã tin tưởng CSCA!
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <FiLoader size={40} className="animate-spin text-indigo-600" />
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <FaCrown size={40} className="mx-auto mb-4 opacity-30" />
            <p>Chưa có gói VIP nào được cấu hình. Admin vui lòng thêm gói trong bảng điều khiển.</p>
          </div>
        ) : (
          <>
            {/* ── Coupon input ─────────────────────────────────────── */}
            <div className="max-w-xl mx-auto mb-10">
              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FiTag size={16} className="text-violet-600" />
                  <span className="text-sm font-bold text-violet-700">Bạn có mã giảm giá?</span>
                </div>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <FiCheck size={16} className="text-emerald-600 shrink-0" />
                      <span className="text-sm font-bold text-emerald-700">
                        Giảm {appliedDiscount.discount_amount.toLocaleString('vi-VN')}đ
                      </span>
                      <span className="text-xs text-emerald-600 font-mono">{appliedDiscount.code}</span>
                    </div>
                    <button onClick={handleRemoveCoupon}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold">
                      <FiX size={12} /> Gỡ bỏ
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && packages[0] && handleApplyCoupon(packages[0])}
                      placeholder="Nhập mã giảm giá (VD: SUMMER25)"
                      className="flex-1 px-4 py-2.5 border border-violet-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                    <button
                      onClick={() => packages[0] && handleApplyCoupon(packages[0])}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                      {couponLoading ? <FiLoader size={15} className="animate-spin" /> : 'Áp dụng'}
                    </button>
                  </div>
                )}
                {couponError && (
                  <div className="mt-2 flex items-center gap-1.5 text-red-600 text-xs font-medium">
                    <FiAlertCircle size={13} />
                    {couponError}
                  </div>
                )}
                {couponResult && !appliedDiscount && (
                  <div className="mt-2 flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <FiCheck size={13} />
                    Mã hợp lệ! Giảm {couponResult.discount_amount.toLocaleString('vi-VN')}đ — bấm "Nâng cấp ngay" để thanh toán với giá {couponResult.final_amount?.toLocaleString('vi-VN')}đ
                  </div>
                )}
              </div>
            </div>

            {/* VIP Plans */}
            {vipPkgs.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <FaCrown className="text-indigo-500" size={18} />
                  Gói VIP — Mở khoá toàn bộ đề thi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  {vipPkgs.map(pkg => {
                    const discount = appliedDiscount?.package_id === pkg.id ? appliedDiscount : null;
                    return (
                      <PlanCard
                        key={pkg.id} pkg={pkg} isVip={!!isVip}
                        onCheckout={handleCheckout}
                        discount={discount}
                        onApplyCoupon={handleApplyCoupon}
                        selectedPkg={selectedPkg}
                        onSelectPkg={setSelectedPkg}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Premium Plans */}
            {premiumPkgs.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <FaStar className="text-amber-500" size={18} />
                  Gói Premium — Đề thi + Video giải đề + Team cố vấn
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  {premiumPkgs.map(pkg => {
                    const discount = appliedDiscount?.package_id === pkg.id ? appliedDiscount : null;
                    return (
                      <PlanCard
                        key={pkg.id} pkg={pkg} isVip={!!isVip}
                        onCheckout={handleCheckout}
                        discount={discount}
                        onApplyCoupon={handleApplyCoupon}
                        selectedPkg={selectedPkg}
                        onSelectPkg={setSelectedPkg}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Feature comparison */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-xl font-black text-gray-900 text-center mb-6">So sánh tính năng</h3>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 font-bold text-gray-700">Tính năng</th>
                  <th className="text-center px-4 py-3 font-bold text-indigo-600">
                    {packages.find(p => !p.name.toLowerCase().includes('premium') && p.is_active)?.name || 'VIP'}
                  </th>
                  <th className="text-center px-4 py-3 font-bold text-amber-600">
                    {packages.find(p => p.name.toLowerCase().includes('premium') && p.is_active)?.name || 'Premium'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const allFeatures = Array.from(new Set(packages.flatMap(p => p.features || [])));
                  if (allFeatures.length === 0) {
                    return (
                      <tr>
                        <td colSpan={3} className="px-6 py-6 text-center text-gray-400 text-sm">Không có dữ liệu tính năng</td>
                      </tr>
                    );
                  }
                  return allFeatures.map((feat, i) => {
                    const vipPackages = packages.filter(p => !p.name.toLowerCase().includes('premium') && p.is_active);
                    const prePackages = packages.filter(p => p.name.toLowerCase().includes('premium') && p.is_active);
                    const vipHas = vipPackages.some(p => (p.features || []).includes(feat));
                    const preHas = prePackages.some(p => (p.features || []).includes(feat));
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-6 py-3 font-medium text-gray-700">{feat}</td>
                        <td className="text-center px-4 py-3">
                          {vipHas ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                        </td>
                        <td className="text-center px-4 py-3">
                          {preHas ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ pkg, isVip, onCheckout, discount, onApplyCoupon, selectedPkg, onSelectPkg }: {
  pkg: VipPackage;
  isVip: boolean;
  onCheckout: (p: VipPackage) => void;
  discount?: Discount | null;
  onApplyCoupon?: (p: VipPackage) => void;
  selectedPkg?: VipPackage | null;
  onSelectPkg?: (p: VipPackage | null) => void;
}) {
  const colors = deriveColor(pkg);
  const isPremium = pkg.name.toLowerCase().includes('premium');
  const [localCoupon, setLocalCoupon] = useState('');
  const [localCouponLoading, setLocalCouponLoading] = useState(false);
  const [localCouponError, setLocalCouponError] = useState('');

  const handleLocalApply = async () => {
    if (!onApplyCoupon || !localCoupon.trim()) return;
    setLocalCouponLoading(true);
    setLocalCouponError('');
    try {
      const res = await axios.get(`/coupons/validate?code=${encodeURIComponent(localCoupon.trim())}&package_id=${pkg.id}`);
      if (res.data.success) {
        onApplyCoupon(pkg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Mã không hợp lệ';
      setLocalCouponError(msg);
    } finally {
      setLocalCouponLoading(false);
    }
  };

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg border-2 ${colors.border} overflow-hidden transition-all duration-300 hover:shadow-xl active:scale-[0.99] sm:hover:-translate-y-1`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">{pkg.name}</h3>
            <p className="text-white/70 text-sm mt-1">{pkg.duration_days} ngày sử dụng</p>
          </div>
          {isPremium && (
            <div className="bg-white/20 rounded-xl p-2 text-center">
              <FaVideo size={20} className="mx-auto text-white" />
              <span className="text-[9px] font-bold text-white/80 block mt-0.5">Cố vấn</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-baseline gap-1">
          {discount ? (
            <>
              <span className="text-2xl font-black line-through text-white/50">
                {pkg.price.toLocaleString('vi-VN')}
              </span>
              <span className="text-4xl font-black">
                {discount.final_amount.toLocaleString('vi-VN')}
              </span>
              <span className="text-white/70 text-sm">đ</span>
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold text-white">
                -{discount.discount_amount.toLocaleString('vi-VN')}đ
              </span>
            </>
          ) : (
            <>
              <span className="text-4xl font-black">{pkg.price.toLocaleString('vi-VN')}</span>
              <span className="text-white/70 text-sm">đ</span>
            </>
          )}
        </div>
        {pkg.description && (
          <p className="text-white/70 text-xs mt-2">{pkg.description}</p>
        )}
      </div>

      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-4">
          {(pkg.features || []).map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <FaCheckCircle size={16} className={`${colors.icon} mt-0.5 shrink-0`} />
              <span className="text-sm text-gray-700">{feat}</span>
            </li>
          ))}
        </ul>

        {/* Per-card coupon input */}
        <div className="mb-4">
          {discount ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <FiCheck size={12} />
                Mã {discount.code} — Giảm {discount.discount_amount.toLocaleString('vi-VN')}đ
              </div>
              <button onClick={() => onApplyCoupon && onApplyCoupon(pkg)}
                className="text-red-500 hover:text-red-700 font-semibold">✕</button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={localCoupon}
                onChange={e => { setLocalCoupon(e.target.value.toUpperCase()); setLocalCouponError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLocalApply()}
                placeholder="Mã giảm giá"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono uppercase tracking-wider focus:ring-1 focus:ring-violet-500 outline-none" />
              <button
                onClick={handleLocalApply}
                disabled={localCouponLoading || !localCoupon.trim()}
                className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors">
                {localCouponLoading ? '...' : 'OK'}
              </button>
            </div>
          )}
          {localCouponError && (
            <p className="mt-1 text-xs text-red-500">{localCouponError}</p>
          )}
        </div>

        <button
          onClick={() => onCheckout(pkg)}
          className={`w-full py-3.5 rounded-xl font-black text-sm transition-all shadow-md text-white
            ${isPremium
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
              : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
        >
          {isVip ? 'Gia hạn ngay' : 'Nâng cấp ngay'}
        </button>
      </div>
    </div>
  );
}
