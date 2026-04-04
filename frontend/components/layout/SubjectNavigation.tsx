'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BsJournalBookmark,
  BsLightbulb,
  BsStars,
  BsGraphUp,
} from 'react-icons/bs';
import ExamHistory from '../toan/ExamHistory';
import { AIInsights } from '../ai/AIInsights';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

interface SubjectNavigationProps {
  subject: string;
  subjectCode: string;
  colorScheme: {
    from: string;
    via?: string;
    to: string;
  };
  menuItems?: MenuItem[];
}

const getDefaultMenuItems = (subjectCode: string): MenuItem[] => [
  { icon: BsJournalBookmark, label: 'Cấu trúc đề', href: '/cau-truc-de' },
  { icon: BsLightbulb, label: 'Lý Thuyết', href: '/ly-thuyet' },
  { icon: BsStars, label: 'Từ vựng', href: `/tu-vung?subject=${subjectCode}` },
  { icon: BsGraphUp, label: 'Tự luận nâng cao', href: '/tu-luan-nang-cao' },
];

const subjectEmoji: Record<string, string> = {
  MATH: '🧮',
  PHYSICS: '⚛️',
  CHEMISTRY: '🧪',
  CHINESE: '🇨🇳',
};

export default function SubjectNavigation({
  subject,
  subjectCode,
  menuItems,
}: SubjectNavigationProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<'menu' | 'history' | 'stats'>('menu');
  const items = menuItems || getDefaultMenuItems(subjectCode);

  return (
    <aside className="w-full space-y-4 sticky top-20 h-fit">
      {/* Subject Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl text-2xl shrink-0">
          {subjectEmoji[subjectCode] || '📚'}
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{subject}</h2>
          <p className="text-xs text-gray-400">Luyện tập &amp; Kiểm tra</p>
        </div>
      </div>

      {/* Tab Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['menu', 'history', 'stats'] as const).map((tab) => {
            const labels = { menu: 'Chức năng', history: 'Lịch sử', stats: 'Thống kê' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === tab
                    ? 'text-gray-900 border-b-2 border-gray-900 bg-white'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-2">
          {/* Menu */}
          {activeTab === 'menu' && (
            <div className="space-y-0.5">
              {items.map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={index}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <Icon className="text-base shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="max-h-[500px] overflow-y-auto">
              <ExamHistory subjectCode={subjectCode} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="max-h-[600px] overflow-y-auto">
              <AIInsights />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
