"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { FaCheckCircle, FaStar, FaCrown, FaVideo } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
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
    router.push(`/checkout?package_id=${pkg.id}`);
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
            {/* VIP Plans */}
            {vipPkgs.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <FaCrown className="text-indigo-500" size={18} />
                  Gói VIP — Mở khoá toàn bộ đề thi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  {vipPkgs.map(pkg => (
                    <PlanCard key={pkg.id} pkg={pkg} isVip={!!isVip} onCheckout={handleCheckout} />
                  ))}
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
                  {premiumPkgs.map(pkg => (
                    <PlanCard key={pkg.id} pkg={pkg} isVip={!!isVip} onCheckout={handleCheckout} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
                  ['Hỗ trợ ưu tiên', false, true],
                ].map(([feat, vipVal, preVal], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-3 font-medium text-gray-700">{feat as string}</td>
                    <td className="text-center px-4 py-3">
                      {vipVal ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
                    </td>
                    <td className="text-center px-4 py-3">
                      {preVal ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-gray-300 font-bold">—</span>}
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
  pkg: VipPackage;
  isVip: boolean;
  onCheckout: (p: VipPackage) => void;
}) {
  const colors = deriveColor(pkg);
  const isPremium = pkg.name.toLowerCase().includes('premium');

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg border-2 ${colors.border} overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
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
          <span className="text-4xl font-black">{pkg.price.toLocaleString('vi-VN')}</span>
          <span className="text-white/70 text-sm">đ</span>
        </div>
        {pkg.description && (
          <p className="text-white/70 text-xs mt-2">{pkg.description}</p>
        )}
      </div>

      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {(pkg.features || []).map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <FaCheckCircle size={16} className={`${colors.icon} mt-0.5 shrink-0`} />
              <span className="text-sm text-gray-700">{feat}</span>
            </li>
          ))}
        </ul>

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
