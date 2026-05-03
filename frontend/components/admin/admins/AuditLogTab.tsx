'use client';

import { useEffect, useState } from 'react';
import { adminControlApi, AdminActivity, AdminActivityFilters, AdminUser } from '@/lib/api/admin';
import {
  FiSearch, FiFilter, FiChevronLeft, FiChevronRight,
  FiClock, FiUser, FiGlobe, FiX
} from 'react-icons/fi';

const ACTION_LABELS: Record<string, string> = {
  login: 'Đăng nhập', logout: 'Đăng xuất', register: 'Đăng ký',
  google_login: 'Đăng nhập Google', exam_start: 'Bắt đầu thi',
  exam_submit: 'Nộp bài thi', 'admin.change_user_status': 'Đổi trạng thái user',
  'admin.delete_user': 'Xóa user', 'admin.update_role': 'Cập nhật vai trò',
  'admin.create_exam': 'Tạo đề thi', 'admin.delete_exam': 'Xóa đề thi',
  'admin.update_exam': 'Sửa đề thi', 'admin.create_material': 'Tạo tài liệu',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-100 text-blue-700 border-blue-200',
  logout: 'bg-gray-100 text-gray-600 border-gray-200',
  'admin.change_user_status': 'bg-orange-100 text-orange-700 border-orange-200',
  'admin.delete_user': 'bg-red-100 text-red-700 border-red-200',
  'admin.update_role': 'bg-purple-100 text-purple-700 border-purple-200',
  'admin.create_exam': 'bg-green-100 text-green-700 border-green-200',
  'admin.delete_exam': 'bg-red-100 text-red-700 border-red-200',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700',
  user_admin: 'bg-blue-100 text-blue-700',
  exam_admin: 'bg-purple-100 text-purple-700',
  content_admin: 'bg-green-100 text-green-700',
  forum_admin: 'bg-orange-100 text-orange-700',
  roadmap_admin: 'bg-cyan-100 text-cyan-700',
};

interface Props {
  focusAdmin?: AdminUser | null;
  onClearFocus?: () => void;
}

export default function AuditLogTab({ focusAdmin, onClearFocus }: Props) {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalActivities: 0, limit: 30 });
  const [filters, setFilters] = useState<AdminActivityFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (focusAdmin) {
      setFilters(prev => ({ ...prev, adminId: focusAdmin.id }));
    }
  }, [focusAdmin]);

  useEffect(() => { loadActivities(1); }, [filters]);

  const loadActivities = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminControlApi.getAllAdminActivities({
        ...filters,
        page,
        limit: 30,
      });
      setActivities(data.activities || []);
      setPagination(data.pagination);
    } catch { setActivities([]); }
    finally { setLoading(false); }
  };

  const applyFilters = () => {
    const newFilters: AdminActivityFilters = {};
    if (focusAdmin) newFilters.adminId = focusAdmin.id;
    if (actionFilter) newFilters.action = actionFilter;
    if (startDate) newFilters.startDate = startDate;
    if (endDate) newFilters.endDate = endDate;
    setFilters(newFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setActionFilter('');
    setStartDate('');
    setEndDate('');
    setFilters(focusAdmin ? { adminId: focusAdmin.id } : {});
    if (onClearFocus) onClearFocus();
    setShowFilters(false);
  };

  const hasActiveFilters = actionFilter || startDate || endDate || focusAdmin;

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {focusAdmin && (
          <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm">
            <FiUser size={14} className="text-violet-600" />
            <span className="text-violet-700 font-medium">Đang xem: {focusAdmin.full_name}</span>
            <button onClick={() => { if (onClearFocus) onClearFocus(); setFilters({}); }}
              className="p-0.5 hover:bg-violet-200 rounded text-violet-500"><FiX size={14} /></button>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors ${
              hasActiveFilters ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <FiFilter size={14} /> Bộ lọc {hasActiveFilters && '·'}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="px-3 py-2.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Loại thao tác</label>
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                <option value="">Tất cả</option>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Từ ngày</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Đến ngày</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowFilters(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-xl">Đóng</button>
            <button onClick={applyFilters} className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700">
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <FiClock size={15} className="text-violet-600" /> Nhật ký thao tác
          </h3>
          <span className="text-xs text-gray-400">{pagination.totalActivities} hoạt động</span>
        </div>

        <div className="divide-y divide-gray-50">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-5 bg-gray-100 rounded-lg animate-pulse w-3/4 mb-2" />
                <div className="h-4 bg-gray-50 rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : activities.length === 0 ? (
            <div className="px-5 py-16 text-center text-gray-400">
              <FiClock size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Chưa có hoạt động nào</p>
            </div>
          ) : activities.map(activity => {
            const actionColor = ACTION_COLORS[activity.action] || 'bg-gray-100 text-gray-600 border-gray-200';
            const actionLabel = ACTION_LABELS[activity.action] || activity.action;
            return (
              <div key={activity.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5">
                    {activity.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{activity.user_name}</span>
                      {(activity.admin_roles || []).slice(0, 2).map(role => (
                        <span key={role} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}`}>
                          {role.replace('_admin', '').replace('super_', 'S.')}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${actionColor}`}>
                        {actionLabel}
                      </span>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <span className="text-xs text-gray-500 truncate max-w-[300px]">
                          {String(
                            activity.metadata.examTitle ||
                            activity.metadata.details ||
                            (activity.metadata.targetUserId ? `User #${activity.metadata.targetUserId}` : '') ||
                            JSON.stringify(activity.metadata).slice(0, 60)
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FiClock size={11} /> {new Date(activity.created_at).toLocaleString('vi-VN')}
                      </span>
                      {activity.ip_address && (
                        <span className="flex items-center gap-1">
                          <FiGlobe size={11} /> {activity.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Trang {pagination.currentPage}/{pagination.totalPages} · {pagination.totalActivities} mục
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => loadActivities(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 transition-colors">
                <FiChevronLeft size={14} />
              </button>
              <button onClick={() => loadActivities(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 transition-colors">
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
