'use client';

import { useEffect, useState } from 'react';
import { adminControlApi } from '@/lib/api/admin';
import { FiUsers, FiActivity, FiTrendingUp, FiShield } from 'react-icons/fi';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  user_admin: 'User Admin',
  exam_admin: 'Exam Admin',
  content_admin: 'Content Admin',
  forum_admin: 'Forum Admin',
  roadmap_admin: 'Roadmap Admin',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#ef4444',
  user_admin: '#3b82f6',
  exam_admin: '#8b5cf6',
  content_admin: '#22c55e',
  forum_admin: '#f97316',
  roadmap_admin: '#06b6d4',
};

interface StatsData {
  overview: { totalAdmins: number; activeAdminsToday: number; totalActionsThisMonth: number };
  topAdmins: { id: number; full_name: string; email: string; action_count: number; last_active_at: string | null; admin_roles: string[] }[];
  roleDistribution: { code: string; name: string; count: number }[];
  activityByDay: { date: string; count: number }[];
}

export default function AdminStatsTab() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await adminControlApi.getAdminStats();
      setStats(data);
    } catch { setStats(null); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-gray-200 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white rounded-2xl border border-gray-200 animate-pulse" />
          <div className="h-72 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-16 text-gray-400">Không thể tải thống kê</div>;
  }

  const maxDayCount = Math.max(...(stats.activityByDay.map(d => d.count)), 1);
  const maxRoleCount = Math.max(...(stats.roleDistribution.map(r => r.count)), 1);

  const overviewCards = [
    { label: 'Tổng Admin', value: stats.overview.totalAdmins, icon: FiUsers, gradient: 'from-violet-500 to-fuchsia-500' },
    { label: 'Hoạt động hôm nay', value: stats.overview.activeAdminsToday, icon: FiActivity, gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Thao tác (30 ngày)', value: stats.overview.totalActionsThisMonth, icon: FiTrendingUp, gradient: 'from-emerald-500 to-green-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {overviewCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white mb-3`}>
                <Icon size={18} />
              </div>
              <p className="text-sm text-gray-500 font-medium">{card.label}</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{card.value.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Admin */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiTrendingUp size={16} className="text-violet-600" /> Top Admin hoạt động (30 ngày)
          </h3>
          {stats.topAdmins.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {stats.topAdmins.map((admin, idx) => (
                <div key={admin.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                    idx === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' :
                    idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                    'bg-gradient-to-br from-gray-400 to-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{admin.full_name}</p>
                      {(admin.admin_roles || []).slice(0, 1).map(role => (
                        <span key={role} className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ backgroundColor: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role] }}>
                          {ROLE_LABELS[role] || role}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-violet-600">{admin.action_count}</p>
                    <p className="text-[10px] text-gray-400">thao tác</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiShield size={16} className="text-violet-600" /> Phân bố vai trò
          </h3>
          {stats.roleDistribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-4">
              {stats.roleDistribution.map(role => {
                const pct = maxRoleCount > 0 ? (role.count / maxRoleCount) * 100 : 0;
                const color = ROLE_COLORS[role.code] || '#6b7280';
                return (
                  <div key={role.code}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{ROLE_LABELS[role.code] || role.name}</span>
                      <span className="text-sm font-bold" style={{ color }}>{role.count}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Chart (7 days) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FiActivity size={16} className="text-violet-600" /> Hoạt động 7 ngày gần đây
        </h3>
        {stats.activityByDay.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {stats.activityByDay.map(day => {
              const pct = maxDayCount > 0 ? (day.count / maxDayCount) * 100 : 0;
              const dateStr = new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-violet-600">{day.count}</span>
                  <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden" style={{ height: '120px' }}>
                    <div className="w-full bg-gradient-to-t from-violet-500 to-fuchsia-400 rounded-t-lg transition-all duration-700"
                      style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{dateStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
