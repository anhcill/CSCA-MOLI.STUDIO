'use client';

import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminListTab from '@/components/admin/admins/AdminListTab';
import AuditLogTab from '@/components/admin/admins/AuditLogTab';
import AdminStatsTab from '@/components/admin/admins/AdminStatsTab';
import { AdminUser } from '@/lib/api/admin';
import { FiUsers, FiClock, FiBarChart2 } from 'react-icons/fi';

const TABS = [
  { key: 'list', label: 'Danh sách Admin', icon: FiUsers },
  { key: 'audit', label: 'Nhật ký Thao tác', icon: FiClock },
  { key: 'stats', label: 'Thống kê', icon: FiBarChart2 },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AdminControlPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [focusAdmin, setFocusAdmin] = useState<AdminUser | null>(null);

  const handleViewLog = (admin: AdminUser) => {
    setFocusAdmin(admin);
    setActiveTab('audit');
  };

  return (
    <AdminLayout title="Kiểm soát Admin" description="Quản lý và giám sát toàn bộ admin trong hệ thống">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-6 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && <AdminListTab onViewLog={handleViewLog} />}
      {activeTab === 'audit' && (
        <AuditLogTab
          focusAdmin={focusAdmin}
          onClearFocus={() => setFocusAdmin(null)}
        />
      )}
      {activeTab === 'stats' && <AdminStatsTab />}
    </AdminLayout>
  );
}
