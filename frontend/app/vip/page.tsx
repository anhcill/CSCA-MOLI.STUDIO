"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { getVipDisplay } from '@/lib/utils/permissions';
import { FaCheckCircle, FaStar, FaCrown, FaVideo } from 'react-icons/fa';
import { FiLoader, FiTag, FiPercent, FiX, FiAlertCircle, FiCheck } from 'react-icons/fi';
import axios from '@/lib/utils/axios';

interface VipPackage {
  id: number;
  name: string;
  tier: string;
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
  const isPre = pkg.tier === 'premium' || /pre/i.test(pkg.name);
  if (isPre) {
    return pkg.duration_days >= 300
      ? { gradient: 'from-amber-600 to-red-600', border: 'border-amber-300', tag: 'bg-amber-600 text-white', icon: 'text-amber-500', headerBg: 'bg-gradient-to-r from-amber-600 to-red-600' }
      : { gradient: 'from-amber-500 to-orange-600', border: 'border-amber-200', tag: 'bg-amber-100 text-amber-700', icon: 'text-amber-500', headerBg: 'bg-gradient-to-r from-amber-500 to-orange-600' };
  }
  if (pkg.tier === 'free' || /free|miễn phí/i.test(pkg.name)) {
    return pkg.duration_days >= 300
      ? { gradient: 'from-gray-500 to-slate-600', border: 'border-gray-300', tag: 'bg-gray-500 text-white', icon: 'text-gray-500', headerBg: 'bg-gradient-to-r from-gray-500 to-slate-600' }
      : { gradient: 'from-gray-400 to-slate-500', border: 'border-gray-200', tag: 'bg-gray-100 text-gray-700', icon: 'text-gray-400', headerBg: 'bg-gradient-to-r from-gray-400 to-slate-500' };
  }
  return pkg.duration_days >= 300
    ? { gradient: 'from-indigo-600 to-purple-700', border: 'border-indigo-300', tag: 'bg-indigo-600 text-white', icon: 'text-indigo-500', headerBg: 'bg-gradient-to-r from-indigo-600 to-purple-700' }
    : { gradient: 'from-indigo-500 to-purple-600', border: 'border-indigo-200', tag: 'bg-indigo-100 text-indigo-700', icon: 'text-indigo-500', headerBg: 'bg-gradient-to-r from-indigo-500 to-purple-600' };
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
  const [comparisonFeatures, setComparisonFeatures] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    axios.get('/vip/packages')
      .then(res => setPackages(res.data.data || []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));

    axios.get('/vip/comparison')
      .then(res => setComparisonFeatures(res.data.data || []))
      .catch(() => setComparisonFeatures([]));
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

  const handleApplyCoupon = async (pkg?: VipPackage) => {
    const targetPkg = pkg || selectedPkg;
    if (!couponInput.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }
    if (!targetPkg) {
      setCouponError('Vui lòng chọn một gói trước');
      return;
    }
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await axios.get(`/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&package_id=${targetPkg.id}`);
      if (res.data.success) {
        const data = res.data.data;
        const d: Discount = {
          code: data.code,
          discount_amount: data.discount_amount,
          original_amount: data.original_amount,
          final_amount: data.final_amount,
          package_id: targetPkg.id,
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

  // Lọc gói theo tier
  const freePkgs = packages.filter(p => !p.name.toLowerCase().includes('vip') && !p.name.toLowerCase().includes('pre') && p.price === 0);
  const vipPkgs = packages.filter(p => (p.tier === 'vip' || /vip/i.test(p.name)) && !/pre/i.test(p.name));
  const premiumPkgs = packages.filter(p => p.tier === 'premium' || /pre/i.test(p.name));

  const { isVip, tier: userTier } = mounted && user ? getVipDisplay(user) : { isVip: false, tier: 'basic' as const };

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
            Mở khoá đề thi cao cấp, phân tích bài thi bằng AI, video giải đề chi tiết và hỏi đáp 1-1 với giảng viên
          </p>
          {isVip && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-full text-sm text-amber-800 font-semibold">
              <FaCrown className="text-yellow-500" size={14} />
              Bạn đang là {userTier === 'premium' ? 'thành viên Pre' : userTier === 'vip' ? 'thành viên VIP' : 'thành viên PRO'} — cảm ơn bạn đã tin tưởng CSCA!
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
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      placeholder="Nhập mã giảm giá (VD: SUMMER25)"
                      className="flex-1 px-4 py-2.5 border border-violet-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:ring-2 focus:ring-violet-500 outline-none bg-white" />
                    <button
                      onClick={() => handleApplyCoupon()}
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

            {/* VIP + Premium Plans — all side by side in one row */}
            {(vipPkgs.length > 0 || premiumPkgs.length > 0) && (
              <div className="mb-10">
                {/* Section header */}
                <div className="flex items-center justify-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-300 rounded-lg flex items-center justify-center">
                      <span className="text-white text-[10px] font-black">F</span>
                    </div>
                    <span className="text-base font-black text-gray-700">Miễn phí</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300" />
                  <div className="flex items-center gap-2">
                    <FaCrown className="text-indigo-500" size={18} />
                    <span className="text-base font-black text-gray-700">VIP</span>
                    <span className="text-xs text-gray-400 font-medium">— Đề thi cao cấp + AI</span>
                  </div>
                  <div className="w-px h-5 bg-gray-300" />
                  <div className="flex items-center gap-2">
                    <FaStar className="text-amber-500" size={18} />
                    <span className="text-base font-black text-gray-700">Pre</span>
                    <span className="text-xs text-gray-400 font-medium">— Đề thi + Video giải đề + Hỏi đáp giảng viên</span>
                  </div>
                </div>

                {/* Combined grid: Free + VIP + Pre all equal width */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                  {/* Free — left */}
                  <div className="flex flex-col">
                    {freePkgs.length > 0 ? (
                      freePkgs.map(pkg => (
                        <PlanCard
                          key={pkg.id} pkg={pkg} isVip={!!isVip}
                          onCheckout={handleCheckout}
                          discount={null}
                          onApplyCoupon={handleApplyCoupon}
                          selectedPkg={selectedPkg}
                          onSelectPkg={setSelectedPkg}
                        />
                      ))
                    ) : (
                      /* Hardcoded Free card when no free package in DB */
                      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-400 to-slate-500 p-4 text-white">
                          <h3 className="text-lg font-black">Miễn phí</h3>
                          <p className="text-white/70 text-xs mt-0.5">Dùng thử không giới hạn</p>
                          <div className="mt-3 flex items-baseline gap-1">
                            <span className="text-3xl font-black">0</span>
                            <span className="text-white/70 text-xs">đ</span>
                          </div>
                        </div>
                        <div className="p-4">
                          <ul className="space-y-2 mb-3">
                            {[
                              'Đề thi cơ bản miễn phí',
                              'Xem kết quả sau thi',
                              'Theo dõi lịch sử thi',
                            ].map((feat, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <FaCheckCircle size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="text-sm text-gray-700">{feat}</span>
                              </li>
                            ))}
                            {[...Array(5)].map((_, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="text-gray-300 font-bold mt-0.5 shrink-0">—</span>
                                <span className="text-sm text-gray-300">{['', 'Đề thi cao cấp (VIP/Pre)', 'Phân tích bài thi bằng AI', 'Video giải đề chi tiết', 'Hỏi đáp 1-1 giảng viên'][i + 3]}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="py-3.5 rounded-xl text-center text-sm font-semibold text-gray-400 bg-gray-50 border border-dashed border-gray-200">
                            Miễn phí — không cần đăng ký
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* VIP — middle */}
                  <div className="flex flex-col">
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
                  {/* Premium — right */}
                  <div className="flex flex-col">
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
              </div>
            )}
          </>
        )}

        {/* Feature comparison */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-xl font-black text-gray-900 text-center mb-6">So sánh tính năng</h3>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 font-bold text-gray-600">Tính năng</th>
                  <th className="text-center px-3 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-6 h-6 bg-gray-300 rounded-lg flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">F</span>
                      </div>
                      <span className="font-bold text-gray-500 text-xs">Miễn phí</span>
                    </div>
                  </th>
                  <th className="text-center px-3 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <FaCrown className="text-indigo-500" size={18} />
                      <span className="font-bold text-indigo-600 text-xs">VIP</span>
                    </div>
                  </th>
                  <th className="text-center px-3 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <FaStar className="text-amber-500" size={18} />
                      <span className="font-bold text-amber-600 text-xs">Pre</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Static comparison rows */}
                {([
                  { feat: 'Đề thi cơ bản', free: true, vip: true, pre: true },
                  { feat: 'Đề thi cao cấp (VIP/Pre)', free: false, vip: true, pre: true },
                  { feat: 'Phân tích bài thi bằng AI', free: false, vip: true, pre: true },
                  { feat: 'Gợi ý đề thi phù hợp (AI)', free: false, vip: true, pre: true },
                  { feat: 'Phân tích tiến bộ (AI)', free: false, vip: true, pre: true },
                  { feat: 'Video giải đề chi tiết', free: false, vip: false, pre: true },
                  { feat: 'Hỏi đáp 1-1 với giảng viên', free: false, vip: false, pre: true },
                  { feat: 'Theo dõi lịch sử thi', free: true, vip: true, pre: true },
                  { feat: 'Bảng xếp hạng', free: true, vip: true, pre: true },
                  { feat: 'Hỗ trợ ưu tiên', free: false, vip: false, pre: true },
                ] as { feat: string; free: boolean; vip: boolean; pre: boolean }[]).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-5 py-3 font-medium text-gray-700">{row.feat}</td>
                    <td className="text-center px-3 py-3">
                      {row.free ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center px-3 py-3">
                      {row.vip ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center px-3 py-3">
                      {row.pre ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                  </tr>
                ))}

                {/* Dynamic features from DB if any */}
                {comparisonFeatures.length > 0 && comparisonFeatures.map((feat) => (
                  <tr key={`db-${feat.id}`} className="bg-white">
                    <td className="px-5 py-3 font-medium text-gray-700">{feat.feature_name}</td>
                    <td className="text-center px-3 py-3">
                      {feat.basic_has ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center px-3 py-3">
                      {feat.vip_has ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center px-3 py-3">
                      {feat.premium_has ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                  </tr>
                ))}
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
  const isPre = pkg.tier === 'premium' || /pre/i.test(pkg.name);
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

  const isSelected = selectedPkg?.id === pkg.id;
  const isUnselected = selectedPkg && !isSelected;

  return (
    <div
      onClick={() => onSelectPkg && onSelectPkg(pkg)}
      className={`relative flex flex-col bg-white rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-300 cursor-pointer
        ${isSelected ? 'border-violet-600 shadow-violet-300 ring-4 ring-violet-600/30 scale-105 z-10' : colors.border}
        ${isUnselected ? 'opacity-50 grayscale-[40%] scale-95 hover:opacity-80 hover:scale-[0.98]' : 'hover:shadow-xl'}
      `}
    >
      {isSelected && (
        <div className="absolute top-0 right-0 bg-violet-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black shadow-md flex items-center gap-1 z-20 animate-in slide-in-from-top-2">
          <FiCheck size={10} /> ĐÃ CHỌN
        </div>
      )}
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} p-4 text-white pt-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">{pkg.name}</h3>
            <p className="text-white/70 text-xs mt-0.5">{pkg.duration_days} ngày</p>
          </div>
          {isPre && !isSelected && (
            <div className="bg-white/20 rounded-xl p-1.5 text-center">
              <FaVideo size={16} className="mx-auto text-white" />
              <span className="text-[8px] font-bold text-white/80 block mt-0.5">Cố vấn</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          {discount ? (
            <>
              <span className="text-lg font-black line-through text-white/50">
                {pkg.price.toLocaleString('vi-VN')}
              </span>
              <span className="text-3xl font-black">
                {discount.final_amount.toLocaleString('vi-VN')}
              </span>
              <span className="text-white/70 text-xs">đ</span>
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-lg text-[10px] font-bold text-white">
                -{discount.discount_amount.toLocaleString('vi-VN')}đ
              </span>
            </>
          ) : (
            <>
              <span className="text-3xl font-black">{pkg.price.toLocaleString('vi-VN')}</span>
              <span className="text-white/70 text-xs">đ</span>
            </>
          )}
        </div>
        {pkg.description && (
          <p className="text-white/70 text-[10px] mt-1.5 line-clamp-2">{pkg.description}</p>
        )}
      </div>

      {/* Features */}
      <div className="p-4 flex flex-col flex-1">
        <ul className="space-y-2 mb-3 flex-1">
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
              <button onClick={(e) => { e.stopPropagation(); onApplyCoupon && onApplyCoupon(pkg); }}
                className="text-red-500 hover:text-red-700 font-semibold">✕</button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={localCoupon}
                onClick={(e) => e.stopPropagation()}
                onChange={e => { setLocalCoupon(e.target.value.toUpperCase()); setLocalCouponError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLocalApply()}
                placeholder="Mã giảm giá"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono uppercase tracking-wider focus:ring-1 focus:ring-violet-500 outline-none" />
              <button
                onClick={(e) => { e.stopPropagation(); handleLocalApply(); }}
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
          onClick={(e) => { e.stopPropagation(); onCheckout(pkg); }}
          className={`w-full mt-auto py-3.5 rounded-xl font-black text-sm transition-all shadow-md text-white
            ${isPre
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
              : pkg.tier === 'free' || /free|miễn phí/i.test(pkg.name)
              ? 'bg-gradient-to-r from-gray-400 to-slate-500 hover:from-gray-500 hover:to-slate-600'
              : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
        >
          {pkg.tier === 'free' || /free|miễn phí/i.test(pkg.name) ? 'Miễn phí'
            : !isVip ? 'Nâng cấp ngay'
            : isPre ? 'Nâng cấp lên Pre'
            : 'Gia hạn ngay'}
        </button>
      </div>
    </div>
  );
}
