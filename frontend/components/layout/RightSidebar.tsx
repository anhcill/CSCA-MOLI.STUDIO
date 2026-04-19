'use client';

import { FiFileText, FiBook, FiTarget, FiTrendingUp, FiLayers, FiCalendar, FiUser, FiSettings, FiVideo } from 'react-icons/fi';

export default function RightSidebar() {
  const menuItems = [
    { icon: FiLayers, label: 'Cấu trúc đề', href: '/cau-truc-de', color: 'text-blue-600' },
    { icon: FiBook, label: 'Lý Thuyết', href: '/ly-thuyet', color: 'text-green-600' },
    { icon: FiTarget, label: 'Từ vựng', href: '/tu-vung', color: 'text-purple-600' },
    { icon: FiFileText, label: 'Đề mô phỏng', href: '/de-mo-phong', color: 'text-orange-600' },
    { icon: FiVideo, label: 'Giải đề chi tiết', href: '/giai-de-chi-tiet', color: 'text-red-600' },
    { icon: FiCalendar, label: 'Lịch sử làm bài', href: '/lich-su', color: 'text-indigo-600' },
    { icon: FiUser, label: 'Lộ trình học cá nhân', href: '/lo-trinh', color: 'text-pink-600' },
    { icon: FiSettings, label: 'Tài khoản', href: '/profile', color: 'text-gray-600' },
  ];

  return (
    <aside className="w-full space-y-4">
      {/* Quick Menu Card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 sticky top-20">
        <nav className="space-y-1">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all hover:bg-gray-50 group`}
            >
              <item.icon size={20} className={`flex-shrink-0 ${item.color} group-hover:scale-110 transition-transform`} />
              <span className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                {item.label}
              </span>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
