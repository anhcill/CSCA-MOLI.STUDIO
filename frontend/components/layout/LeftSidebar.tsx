'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';
import { BsCheckCircle, BsController, BsTrophy } from 'react-icons/bs';

export default function LeftSidebar() {
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const displayName = user?.full_name || (user as any)?.display_name || user?.username || 'User';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const menuItems = [
    { icon: '📚', label: 'Cấu trúc đề', href: '/cau-truc-de', color: 'from-blue-500 to-blue-600' },
    { icon: '📖', label: 'Lý Thuyết', href: '/ly-thuyet', color: 'from-green-500 to-green-600' },
    { icon: '🔮', label: 'Tư Vấn', href: '/tu-vang', color: 'from-purple-500 to-purple-600' },
    { icon: '📝', label: 'Đề mô phỏng', href: '/de-mo-phong', color: 'from-orange-500 to-orange-600' },
    { icon: '📈', label: 'Tự luận nâng cao', href: '/tu-luan-nang-cao', color: 'from-red-500 to-red-600' },
    { icon: '📅', label: 'Lịch sử làm bài', href: '/lich-su', color: 'from-indigo-500 to-indigo-600' },
    { icon: '👤', label: 'Lộ trình học cá nhân', href: '/lo-trinh', color: 'from-pink-500 to-pink-600' },
    { icon: '⚙️', label: 'Tài khoản', href: '/profile', color: 'from-gray-500 to-gray-600' },
  ];

  return (
    <aside className="w-full space-y-6 sticky top-20 h-fit">
      {/* Profile Card */}
      {mounted && isAuthenticated && user ? (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
        {/* Gradient Header */}
        <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
          <div className="absolute inset-0 bg-black opacity-10"></div>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6 -mt-14 text-center">
          {/* Avatar with ring */}
          <div className="relative inline-block mb-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-75 blur"></div>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="relative w-28 h-28 rounded-full border-4 border-white shadow-xl object-cover"
              />
            ) : (
              <div className="relative w-28 h-28 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <span className="text-5xl font-bold text-white">
                  {displayInitial}
                </span>
              </div>
            )}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-3 border-white rounded-full"></div>
          </div>

          {/* User Info */}
          <p className="text-sm text-blue-600 font-medium mb-1">@{user.username}</p>
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {displayName}
          </h3>
          <p className="text-sm text-gray-400 mb-4">CSCA{user.id.toString().padStart(10, '0')}</p>
          <span className="inline-block px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-sm font-semibold rounded-full border border-blue-200">
            Số số số
          </span>
        </div>
      </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">👤</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Chào mừng!</h3>
            <p className="text-sm text-gray-600 mb-4">Đăng nhập để sử dụng đầy đủ tính năng</p>
            <Link href="/login" className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg">
              Đăng nhập
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {mounted && isAuthenticated && user && (
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl text-center hover:shadow-lg hover:scale-105 transition-all cursor-pointer border border-blue-200">
          <BsCheckCircle className="mx-auto mb-2 text-blue-600" size={24} />
          <p className="text-xs text-gray-600 font-medium leading-tight">Kiểm Tra<br/>Định Kỳ</p>
          <p className="text-2xl font-bold text-blue-700 mt-2">0</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center hover:shadow-lg hover:scale-105 transition-all cursor-pointer border border-purple-200">
          <BsController className="mx-auto mb-2 text-purple-600" size={24} />
          <p className="text-xs text-gray-600 font-medium">Minigame</p>
          <p className="text-2xl font-bold text-purple-700 mt-2">0</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl text-center hover:shadow-lg hover:scale-105 transition-all cursor-pointer border border-yellow-200">
          <BsTrophy className="mx-auto mb-2 text-yellow-600" size={24} />
          <p className="text-xs text-gray-600 font-medium">BXH</p>
          <p className="text-2xl font-bold text-yellow-700 mt-2">-</p>
        </div>
      </div>
      )}

      {/* Menu Items */}
      <nav className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 overflow-hidden">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.href}
            className="flex items-center space-x-3 px-5 py-4 text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 transition-all border-b border-gray-100 last:border-0 group"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-medium group-hover:font-bold transition-all">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
