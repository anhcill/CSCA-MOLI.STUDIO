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
  subjectSlug?: string; // URL slug: 'toan', 'vat-ly', 'hoa-hoc', 'tieng-trung-xh', 'tieng-trung-tn'
  colorScheme: {
    from: string;
    via?: string;
    to: string;
  };
  menuItems?: MenuItem[];
  emoji?: string;
}

const getDefaultMenuItems = (subjectCode: string, subjectSlug?: string): MenuItem[] => {
  const base = `/tu-vung${subjectSlug ? `?subject=${subjectSlug}` : ''}`;
  return [
    { icon: BsJournalBookmark, label: 'Cấu trúc đề', href: '/cau-truc-de' },
    { icon: BsLightbulb, label: 'Lý Thuyết', href: '/ly-thuyet' },
    { icon: BsStars, label: 'Từ vựng', href: base },
    { icon: BsGraphUp, label: 'Tự luận nâng cao', href: '/tu-luan-nang-cao' },
  ];
};

export default function SubjectNavigation({
  subject,
  subjectCode,
  subjectSlug,
  colorScheme,
  menuItems,
  emoji = '📚'
}: SubjectNavigationProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<'menu' | 'history' | 'stats'>('menu');
  const items = menuItems || getDefaultMenuItems(subjectCode, subjectSlug);

  // Cấu trúc đề & Lý thuyết dùng subject query param
  const buildSubjectHref = (href: string) => {
    if (!subjectSlug) return href;
    if (href === '/cau-truc-de') return `/cau-truc-de?subject=${subjectSlug}`;
    if (href === '/ly-thuyet') return `/ly-thuyet?subject=${subjectSlug}`;
    return href;
  };

  return (
    <aside className="w-full space-y-6 sticky top-24 h-fit">
      
      {/* Tab Controls (Floating Pills) */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-sm p-1.5 flex gap-1 relative z-20">
        {(['menu', 'history', 'stats'] as const).map((tab) => {
          const labels = { menu: 'Kho tài liệu', history: 'Lịch sử thi', stats: 'Phân tích AI' };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold transition-all duration-300 rounded-xl relative ${
                  isActive
                  ? 'text-gray-900 shadow-sm bg-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
                }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab Content Cards */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-4">
          {/* Menu */}
          {activeTab === 'menu' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {items.map((item, index) => {
                const Icon = item.icon;
                const href = buildSubjectHref(item.href);
                const isActive = pathname === href;
                return (
                  <Link
                    key={index}
                    href={href}
                    className={`group flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 ${
                        isActive
                      ? `bg-gradient-to-r ${colorScheme.from} ${colorScheme.via || ''} ${colorScheme.to} text-white shadow-md hover:shadow-lg`
                        : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-100'
                      }`}
                  >
                    <div className={`${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200'} w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0`}>
                       <Icon className={`text-lg ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                    </div>
                    <span className="font-bold">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="max-h-[500px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-300 pr-1 custom-scrollbar">
              <ExamHistory subjectCode={subjectCode} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="max-h-[600px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AIInsights />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
