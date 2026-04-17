"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { FaCheckCircle, FaStar, FaCrown } from 'react-icons/fa';

const packages = [
  {
    id: 1,
    name: 'Gói Xem',
    duration: 30,
    price: 99000,
    originalPrice: 150000,
    popular: false,
    features: [
      'Xem tài liệu PDF',
      'Xem đề thi & kết quả',
      'Xem lời giải chi tiết',
      'Hỗ trợ qua group'
    ]
  },
  {
    id: 2,
    name: 'Gói Kiểm tra',
    duration: 180,
    price: 249000,
    originalPrice: 400000,
    popular: true,
    features: [
      'Mọi tính năng của gói Xem',
      'Làm bài thi thử không giới hạn',
      'Tài liệu độc quyền',
      'Chữa bài tự luận AI'
    ]
  },
  {
    id: 3,
    name: 'Gói Làm bài',
    duration: 365,
    price: 699000,
    originalPrice: 1000000,
    popular: false,
    features: [
      'Mọi tính năng gói Kiểm tra',
      'Cập nhật đề thi mới nhất',
      'Bảo lưu khoá học',
      'Cố vấn trực tiếp 1-1'
    ]
  }
];

export default function VipPricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);

  const handleCheckout = (pkg: any) => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/vip');
      return;
    }
    router.push(`/checkout?duration=${pkg.duration}&method=momo`);
  };

  const isVip = mounted && user?.is_vip;

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 pt-24 sm:px-6 lg:px-8 bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-base text-amber-600 font-semibold tracking-wide uppercase flex justify-center items-center gap-2">
            <FaCrown className="text-yellow-500" /> CSCA Pro
          </h2>
          <p className="mt-2 text-4xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Mở khoá sức mạnh tiềm ẩn của bạn
          </p>
          <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
            Gia tăng 300% khả năng đỗ học bổng với kho tàng đề thi và tài liệu Pro.
          </p>
          {isVip && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-full text-sm text-amber-800 font-semibold">
              <FaCrown className="text-yellow-500" size={14} />
              Bạn đã là thành viên PRO — cảm ơn bạn đã tin tưởng CSCA!
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white/80 backdrop-blur-md rounded-2xl shadow-xl w-full max-w-sm flex flex-col p-8 transition-transform duration-300 transform hover:-translate-y-2 border ${
                pkg.popular
                  ? 'border-2 border-indigo-400 shadow-indigo-100 ring-4 ring-indigo-50 scale-105'
                  : 'border-gray-100'
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex flex-row items-center gap-1 shadow-md">
                    <FaStar /> Phổ biến nhất
                  </span>
                </div>
              )}

              <div className="mb-8 mt-2">
                <h3 className="text-2xl font-bold text-gray-900 text-center mb-1">{pkg.name}</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  {pkg.duration === 30 && 'Thử nghiệm trong 1 tháng'}
                  {pkg.duration === 180 && 'Tối ưu chi phí'}
                  {pkg.duration === 365 && 'Toàn diện nhất'}
                </p>
                <div className="flex items-center justify-center baseline mt-4 text-gray-900">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {pkg.price.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-xl font-semibold text-gray-500 ml-1">VNĐ</span>
                </div>
                {pkg.originalPrice && (
                  <div className="text-center mt-2 flex items-center justify-center gap-2">
                    <span className="line-through text-gray-400 font-medium">
                      {pkg.originalPrice.toLocaleString('vi-VN')} đ
                    </span>
                    <span className="text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded text-sm">
                      Tiết kiệm {Math.round((1 - pkg.price / pkg.originalPrice) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {pkg.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <FaCheckCircle className="flex-shrink-0 h-5 w-5 text-indigo-500 mt-0.5" />
                    <span className="ml-3 text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(pkg)}
                disabled={loading}
                className={`w-full font-bold rounded-xl py-4 flex justify-center items-center transition-all shadow-md ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {isVip ? 'Gia hạn ngay' : 'Nâng cấp ngay'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
