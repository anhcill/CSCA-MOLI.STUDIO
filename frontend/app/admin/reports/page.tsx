'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import {
  FiFlag, FiCheckCircle, FiXCircle, FiUser, FiAlertTriangle,
  FiChevronLeft, FiChevronRight, FiEye, FiTrash2, FiCheck,
  FiMessageSquare, FiClock
} from 'react-icons/fi';

interface Report {
  id: number;
  reporter_id: number;
  reported_user_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter_username: string;
  reporter_full_name: string;
  reporter_avatar: string | null;
  reporter_avatar_url: string | null;
  reported_username: string;
  reported_full_name: string;
  reported_avatar: string | null;
  reported_avatar_url: string | null;
  reported_role: string;
  is_vip: boolean;
  subscription_tier: string | null;
  user_pending_count: number;
}

interface ReportStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
}

const LIMIT = 15;

export default function AdminReportsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, pending: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending');
  const [selectedReports, setSelectedReports] = useState<number[]>([]);
  const [actioning, setActioning] = useState(false);
  const [detailModal, setDetailModal] = useState<Report | null>(null);

  useEffect(() => {
    if (!hasPermission(user, 'forum.manage')) {
      router.push('/');
      return;
    }
    loadReports(1);
  }, [statusFilter]);

  const loadReports = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await axios.get('/admin/forum/reports', {
        params: { status: statusFilter, page: pageNum, limit: LIMIT }
      });
      const data = res.data;
      setReports(data.data?.reports || []);
      setStats(data.data?.stats || {});
      setTotalPages(data.data?.pagination?.totalPages || 1);
      setPage(pageNum);
      setSelectedReports([]);
    } catch (err) {
      console.error('Load reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: number, action: 'resolve' | 'dismiss') => {
    try {
      setActioning(true);
      await axios.put(`/admin/forum/reports/${reportId}`, { action });
      loadReports(page);
    } catch (err) {
      console.error('Resolve error:', err);
    } finally {
      setActioning(false);
    }
  };

  const handleBulkAction = async (action: 'resolve' | 'dismiss') => {
    if (selectedReports.length === 0) return;
    try {
      setActioning(true);
      await axios.post('/admin/forum/reports/bulk', { report_ids: selectedReports, action });
      loadReports(page);
    } catch (err) {
      console.error('Bulk action error:', err);
    } finally {
      setActioning(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedReports(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReports.length === reports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(reports.map(r => r.id));
    }
  };

  const getAvatar = (avatar: string | null, avatarUrl: string | null, name: string) => {
    return avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700">Admin</span>;
    if (role === 'moderator') return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">Mod</span>;
    return null;
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}gi`;
    if (diff < 3600) return `${Math.floor(diff / 60)}p`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}ngày`;
  };

  return (
    <AdminLayout title="Quản lý Report" description="Xử lý báo cáo vi phạm từ người dùng về hành vi không phù hợp">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FiFlag className="text-red-500" /> Quản lý Report
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Xử lý báo cáo vi phạm từ người dùng về hành vi không phù hợp
            </p>
          </div>
          <div className="flex gap-3">
            {[
              { key: 'pending', label: 'Chờ xử lý', count: stats.pending, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { key: 'resolved', label: 'Đã xử lý', count: stats.resolved, color: 'bg-green-50 text-green-700 border-green-200' },
              { key: 'dismissed', label: 'Đã bỏ qua', count: stats.dismissed, color: 'bg-gray-50 text-gray-600 border-gray-200' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key as typeof statusFilter); setSelectedReports([]); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${tab.color} ${
                  statusFilter === tab.key ? 'ring-2 ring-offset-1 ring-current' : ''
                }`}
              >
                {tab.label} <span className="ml-1">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Tổng reports', value: stats.total, icon: FiFlag, color: 'text-gray-600', bg: 'bg-gray-50' },
            { label: 'Chờ xử lý', value: stats.pending, icon: FiClock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Đã xử lý', value: stats.resolved, icon: FiCheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Đã bỏ qua', value: stats.dismissed, icon: FiXCircle, color: 'text-gray-500', bg: 'bg-gray-50' },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`${card.bg} rounded-2xl p-4 border border-gray-100`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={card.color} />
                  <span className="text-xs font-semibold text-gray-500">{card.label}</span>
                </div>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* Bulk Action Bar */}
        {selectedReports.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700">
              Đã chọn {selectedReports.length} report
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('resolve')}
                disabled={actioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <FiCheck /> Xử lý
              </button>
              <button
                onClick={() => handleBulkAction('dismiss')}
                disabled={actioning}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-500 text-white text-sm font-bold hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                <FiXCircle /> Bỏ qua
              </button>
            </div>
          </div>
        )}

        {/* Reports List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FiFlag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Không có report nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                checked={selectedReports.length === reports.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded accent-violet-600"
              />
              <span className="text-xs font-semibold text-gray-500">Chọn tất cả</span>
            </div>

            {reports.map(report => (
              <div
                key={report.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md ${
                  selectedReports.includes(report.id) ? 'border-violet-300 shadow-violet-100 shadow-md' : 'border-gray-100'
                }`}
              >
                <div className="flex gap-4">
                  {/* Checkbox */}
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={() => toggleSelect(report.id)}
                      className="w-4 h-4 rounded accent-violet-600 mt-0.5"
                    />
                  </div>

                  {/* Reporter */}
                  <div className="flex flex-col items-center gap-1.5">
                    <img
                      src={getAvatar(report.reporter_avatar, report.reporter_avatar_url, report.reporter_full_name)}
                      alt={report.reporter_full_name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                    />
                    <span className="text-[10px] text-gray-400 font-semibold text-center max-w-[56px] truncate">
                      {report.reporter_full_name}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center pt-1">
                    <FiMessageSquare size={12} className="text-gray-300 rotate-90" />
                    <div className="h-4 w-px bg-gray-200 my-0.5" />
                    <FiMessageSquare size={12} className="text-gray-300 -rotate-90" />
                  </div>

                  {/* Reported User */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <img
                        src={getAvatar(report.reported_avatar, report.reported_avatar_url, report.reported_full_name)}
                        alt={report.reported_full_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-red-100"
                      />
                      {report.user_pending_count >= 3 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px] font-black">{report.user_pending_count}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-semibold text-gray-700 text-center max-w-[56px] truncate">
                        {report.reported_full_name}
                      </span>
                      {getRoleBadge(report.reported_role)}
                      {report.is_vip && <span className="text-[9px] font-bold text-orange-500">VIP</span>}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-1.5 line-clamp-2">
                      {report.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <FiClock size={10} />
                        {formatTime(report.created_at)}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <FiUser size={10} /> ID: {report.reported_user_id}
                      </span>
                      {report.user_pending_count >= 3 && (
                        <span className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                          <FiAlertTriangle size={10} />
                          Cảnh báo: {report.user_pending_count} reports
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {statusFilter === 'pending' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(report.id, 'resolve')}
                        disabled={actioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <FiCheckCircle size={12} /> Xử lý
                      </button>
                      <button
                        onClick={() => handleResolve(report.id, 'dismiss')}
                        disabled={actioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <FiXCircle size={12} /> Bỏ qua
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => loadReports(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <FiChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-gray-600 px-4">
              Trang {page} / {totalPages}
            </span>
            <button
              onClick={() => loadReports(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
