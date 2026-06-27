'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { riskCenterApi, RiskSummary, ExamRiskCase, PaymentRisk, QuestionReport, AdminNotification, AuditLogEntry, Pagination, ExamRiskDetail } from '@/lib/api/riskCenter';
import {
  FiAlertTriangle, FiShield, FiCreditCard, FiFileText, FiBell, FiList,
  FiRefreshCw, FiChevronLeft, FiChevronRight, FiEye, FiCheck, FiX,
  FiAlertOctagon, FiArrowUp, FiLock, FiUserX, FiCheckCircle, FiXCircle,
  FiClock, FiSearch, FiFilter, FiZap
} from 'react-icons/fi';
import { initSocket } from '@/lib/socket';

//  Helpers

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  reviewing: 'bg-blue-50 text-blue-700',
  resolved: 'bg-green-50 text-green-700',
  ignored: 'bg-gray-100 text-gray-500',
  escalated: 'bg-purple-50 text-purple-700',
  reverted: 'bg-amber-50 text-amber-700',
  fixed: 'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  failed: 'bg-red-50 text-red-700',
  completed: 'bg-green-50 text-green-700',
  suspicious: 'bg-orange-50 text-orange-700',
};

function Badge({ text, colorClass }: { text: string; colorClass?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colorClass || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {text}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  return `${Math.floor(diff / 86400)} ngày`;
}

function PaginationBar({ pagination, onPage }: { pagination: Pagination; onPage: (p: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <span className="text-xs text-gray-500">
        {pagination.total} kết quả - trang {pagination.currentPage}/{pagination.totalPages}
      </span>
      <div className="flex gap-1">
        <button onClick={() => onPage(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronLeft size={14} /></button>
        <button onClick={() => onPage(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronRight size={14} /></button>
      </div>
    </div>
  );
}

//  Action Modal

function ActionModal({ title, isOpen, onClose, onConfirm, loading, requireReason, children }: {
  title: string; isOpen: boolean; onClose: () => void; onConfirm: (reason: string) => void;
  loading?: boolean; requireReason?: boolean; children?: React.ReactNode;
}) {
  const [reason, setReason] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
        {children}
        {requireReason !== false && (
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Nhập lý do..." className="w-full mt-3 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
        )}
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Hủy</button>
          <button onClick={() => { onConfirm(reason); setReason(''); }} disabled={loading || (requireReason !== false && !reason.trim())}
            className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

//  Detail Drawer

function ExamRiskDrawer({ detail, onClose, onAction }: {
  detail: ExamRiskDetail | null; onClose: () => void;
  onAction: (id: number, action: string, body?: Record<string, unknown>) => Promise<void>;
}) {
  const [actionModal, setActionModal] = useState<{ action: string; title: string; requireReason?: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!detail) return null;

  const handleAction = async (reason: string) => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      await onAction(detail.id, actionModal.action, { reason, message: reason, note: reason, duration_hours: 24 });
      setActionModal(null);
      onClose();
    } catch { /* error handled upstream */ }
    setActionLoading(false);
  };

  const lightActions = [
    { action: 'note', label: 'Ghi note', icon: FiFileText },
    { action: 'resolve', label: 'Đã xử lý', icon: FiCheck },
    { action: 'ignore', label: 'Bỏ qua', icon: FiX },
    { action: 'escalate', label: 'Escalate', icon: FiArrowUp },
    { action: 'mark-clean', label: 'Sạch', icon: FiCheckCircle },
  ];

  const strongActions = [
    { action: 'warn-user', label: 'Cảnh báo user', icon: FiAlertTriangle },
    { action: 'lock-attempt', label: 'Khóa attempt', icon: FiLock },
    { action: 'force-submit', label: 'Ép nộp bài', icon: FiZap },
    { action: 'invalidate-attempt', label: 'Hủy kết quả', icon: FiXCircle },
    { action: 'restore-attempt', label: 'Khôi phục', icon: FiRefreshCw },
    { action: 'ban-exam-access', label: 'Cấm thi đề này', icon: FiShield },
    { action: 'suspend-user', label: 'Tạm khóa user', icon: FiClock },
    { action: 'ban-user', label: 'Ban vĩnh viễn', icon: FiUserX },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Case #{detail.id}</h2>
            <div className="flex gap-2 mt-1">
              <Badge text={detail.severity} colorClass={SEVERITY_COLORS[detail.severity]} />
              <Badge text={detail.status} colorClass={STATUS_COLORS[detail.status]} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"><FiX size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* User + Attempt Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">User</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{detail.user_name || 'N/A'}</p>
              <p className="text-xs text-gray-500 truncate">{detail.user_email}</p>
              {detail.user_is_banned && <Badge text="BANNED" colorClass="bg-red-100 text-red-700 border-red-200" />}
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Đề thi</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{detail.exam_title || 'N/A'}</p>
              <p className="text-xs text-gray-500">Attempt #{detail.attempt_id} - Score: {detail.total_score ?? ''}</p>
              {detail.is_locked && <Badge text="LOCKED" colorClass="bg-orange-100 text-orange-700 border-orange-200" />}
              {detail.is_invalidated && <Badge text="INVALIDATED" colorClass="bg-red-100 text-red-700 border-red-200" />}
            </div>
          </div>

          {/* Risk Score */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Risk Score</span>
              <span className="text-3xl font-black text-red-600">{detail.risk_score}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{detail.violation_count} vi phạm - {detail.summary}</p>
          </div>

          {/* Violation Types Breakdown */}
          {detail.violation_types && Object.keys(detail.violation_types).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Vi phạm theo loại</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(detail.violation_types).map(([type, count]) => (
                  <span key={type} className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-xs font-semibold">
                    {type}: {String(count)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {detail.violations.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Timeline ({detail.violations.length})</p>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {detail.violations.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${v.severity === 'critical' ? 'bg-red-500' : v.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1">{v.violation_type}</span>
                    <span className="text-[10px] text-gray-400">{timeAgo(v.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Note */}
          {detail.admin_note && (
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-1">Admin Notes</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-slate-800 p-3 rounded-xl max-h-32 overflow-y-auto">{detail.admin_note}</pre>
            </div>
          )}

          {/* Warnings */}
          {detail.userWarnings.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-1">Cảnh báo đã gửi ({detail.userWarnings.length})</p>
              {detail.userWarnings.slice(0, 5).map(w => (
                <div key={w.id} className="text-xs text-gray-600 dark:text-gray-400 py-1 border-b border-gray-50 dark:border-slate-800">
                  {w.message} <span className="text-gray-400"> {timeAgo(w.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div>
            <p className="text-xs font-bold uppercase text-gray-400 mb-2">Thao tác nhanh</p>
            <div className="flex flex-wrap gap-2">
              {lightActions.map(a => (
                <button key={a.action} onClick={() => setActionModal({ action: a.action, title: a.label })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors">
                  <a.icon size={12} /> {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-red-400 mb-2">Hành động mạnh</p>
            <div className="flex flex-wrap gap-2">
              {strongActions.map(a => (
                <button key={a.action} onClick={() => setActionModal({ action: a.action, title: a.label })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 transition-colors">
                  <a.icon size={12} /> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit History */}
          {detail.auditHistory.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Lịch sử xử lý</p>
              <div className="space-y-1.5">
                {detail.auditHistory.slice(0, 10).map(a => (
                  <div key={a.id} className="text-xs text-gray-600 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <span className="font-semibold">{a.admin_name}</span>  <span className="text-violet-600 font-semibold">{a.action}</span>
                    {a.reason && <span className="block text-gray-400 mt-0.5">{a.reason}</span>}
                    <span className="block text-gray-300 text-[10px] mt-0.5">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ActionModal title={actionModal?.title || ''} isOpen={!!actionModal} onClose={() => setActionModal(null)}
        onConfirm={handleAction} loading={actionLoading} />
    </>
  );
}

//  Tab Components

type TabId = 'exam' | 'payment' | 'question' | 'notification' | 'audit';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'exam', label: 'Gian lận thi', icon: FiShield },
  { id: 'payment', label: 'Thanh toán', icon: FiCreditCard },
  { id: 'question', label: 'Báo lỗi đề', icon: FiFileText },
  { id: 'notification', label: 'Thông báo', icon: FiBell },
  { id: 'audit', label: 'Audit Log', icon: FiList },
];

//  Main Page

export default function RiskCenterPage() {
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('exam');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab data
  const [examRisks, setExamRisks] = useState<ExamRiskCase[]>([]);
  const [examPagination, setExamPagination] = useState<Pagination>({ currentPage: 1, totalPages: 0, total: 0, limit: 20 });
  const [paymentRisks, setPaymentRisks] = useState<PaymentRisk[]>([]);
  const [paymentPagination, setPaymentPagination] = useState<Pagination>({ currentPage: 1, totalPages: 0, total: 0, limit: 20 });
  const [questionReports, setQuestionReports] = useState<QuestionReport[]>([]);
  const [questionPagination, setQuestionPagination] = useState<Pagination>({ currentPage: 1, totalPages: 0, total: 0, limit: 20 });
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notifPagination, setNotifPagination] = useState<Pagination>({ currentPage: 1, totalPages: 0, total: 0, limit: 20 });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState<Pagination>({ currentPage: 1, totalPages: 0, total: 0, limit: 20 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Drawer
  const [selectedCase, setSelectedCase] = useState<ExamRiskDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Socket.io realtime
  useEffect(() => {
    const socket = initSocket();
    socket?.emit('join_admin_risk_center');

    const handleNotification = () => {
      loadSummary();
      if (activeTab === 'notification') loadNotifications(1);
    };
    socket?.on('admin_notification', handleNotification);
    socket?.on('risk_case_update', handleNotification);

    return () => {
      socket?.off('admin_notification', handleNotification);
      socket?.off('risk_case_update', handleNotification);
      socket?.emit('leave_admin_risk_center');
    };
  }, [activeTab]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await riskCenterApi.getSummary();
      setSummary(data);
    } catch { /* ignore */ }
  }, []);

  const loadExamRisks = useCallback(async (page = 1) => {
    try {
      const params: Record<string, string | number> = { page };
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      const r = await riskCenterApi.getExamRisks(params);
      setExamRisks(r.data);
      setExamPagination(r.pagination);
    } catch { /* ignore */ }
  }, [statusFilter, severityFilter]);

  const loadPaymentRisks = useCallback(async (page = 1) => {
    try {
      const r = await riskCenterApi.getPaymentRisks({ page });
      setPaymentRisks(r.data);
      setPaymentPagination(r.pagination);
    } catch { /* ignore */ }
  }, []);

  const loadQuestionReports = useCallback(async (page = 1) => {
    try {
      const params: Record<string, string | number> = { page };
      if (statusFilter) params.status = statusFilter;
      const r = await riskCenterApi.getQuestionReports(params);
      setQuestionReports(r.data);
      setQuestionPagination(r.pagination);
    } catch { /* ignore */ }
  }, [statusFilter]);

  const loadNotifications = useCallback(async (page = 1) => {
    try {
      const r = await riskCenterApi.getNotifications({ page });
      setNotifications(r.data);
      setNotifPagination(r.pagination);
    } catch { /* ignore */ }
  }, []);

  const loadAuditLogs = useCallback(async (page = 1) => {
    try {
      const r = await riskCenterApi.getAuditLogs({ page });
      setAuditLogs(r.data);
      setAuditPagination(r.pagination);
    } catch { /* ignore */ }
  }, []);

  const loadTabData = useCallback(async () => {
    switch (activeTab) {
      case 'exam': return loadExamRisks(1);
      case 'payment': return loadPaymentRisks(1);
      case 'question': return loadQuestionReports(1);
      case 'notification': return loadNotifications(1);
      case 'audit': return loadAuditLogs(1);
    }
  }, [activeTab, loadExamRisks, loadPaymentRisks, loadQuestionReports, loadNotifications, loadAuditLogs]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadTabData()]);
      setLoading(false);
    })();
  }, [loadSummary, loadTabData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadTabData()]);
    setRefreshing(false);
  };

  const handleScan = async () => {
    setRefreshing(true);
    try {
      const result = await riskCenterApi.scanViolations();
      alert(`Đã quét: ${result.scanned} attempts - ${result.created} case mới, ${result.updated} cập nhật`);
      await Promise.all([loadSummary(), loadExamRisks(1)]);
    } catch { alert('Lỗi quét vi phạm'); }
    setRefreshing(false);
  };

  const openDrawer = async (id: number) => {
    setDrawerLoading(true);
    try {
      const detail = await riskCenterApi.getExamRiskDetail(id);
      setSelectedCase(detail);
    } catch { alert('Không thể tải chi tiết case'); }
    setDrawerLoading(false);
  };

  const handleExamAction = async (id: number, action: string, body?: Record<string, unknown>) => {
    await riskCenterApi.examRiskAction(id, action, body);
    await Promise.all([loadSummary(), loadExamRisks(examPagination.currentPage)]);
  };

  const handleMarkAllRead = async () => {
    await riskCenterApi.markAllRead();
    await Promise.all([loadSummary(), loadNotifications(1)]);
  };

  // Summary cards data
  const summaryCards = summary ? [
    { label: 'Critical Open', value: summary.criticalOpen, icon: FiAlertOctagon, color: 'from-red-500 to-rose-600', textColor: 'text-red-600' },
    { label: 'Payment Pending', value: summary.paymentPending, icon: FiCreditCard, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-600' },
    { label: 'Exam Reports', value: summary.examReports, icon: FiShield, color: 'from-blue-500 to-indigo-600', textColor: 'text-blue-600' },
    { label: 'Báo lỗi đề', value: summary.questionReports, icon: FiFileText, color: 'from-purple-500 to-violet-600', textColor: 'text-purple-600' },
    { label: 'Vi phạm hôm nay', value: summary.todayViolations, icon: FiAlertTriangle, color: 'from-orange-500 to-red-500', textColor: 'text-orange-600' },
    { label: 'Chưa đọc', value: summary.unreadNotifications, icon: FiBell, color: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-600' },
  ] : [];

  return (
    <AdminLayout title="Risk Center" description="Trung tâm quản lý rủi ro hệ thống">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {loading ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl animate-pulse border border-gray-100" />)
        ) : summaryCards.map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${card.color} text-white mb-2`}>
              <card.icon size={14} />
            </div>
            <p className={`text-2xl font-black ${card.textColor}`}>{card.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
          <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
        {activeTab === 'exam' && (
          <button onClick={handleScan} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            <FiZap size={13} /> Quét vi phạm
          </button>
        )}
        {activeTab === 'notification' && (
          <button onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl">
            <FiCheck size={13} /> Đánh dấu tất cả đã đọc
          </button>
        )}

        {/* Filters */}
        {(activeTab === 'exam' || activeTab === 'question') && (
          <div className="flex items-center gap-2 ml-auto">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}
              className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 outline-none">
              <option value="">Tất cả status</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
              <option value="escalated">Escalated</option>
            </select>
            {activeTab === 'exam' && (
              <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); }}
                className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 outline-none">
                <option value="">Tất cả severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStatusFilter(''); setSeverityFilter(''); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800'
            }`}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        {/* EXAM RISKS TAB */}
        {activeTab === 'exam' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Đề thi</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Score</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Vi phạm</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Severity</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Thời gian</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {examRisks.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400"><FiShield size={32} className="mx-auto mb-2 opacity-40" /><p>Không có case nào</p></td></tr>
                ) : examRisks.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 cursor-pointer" onClick={() => openDrawer(r.id)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white text-xs truncate max-w-[140px]">{r.user_name || 'N/A'}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{r.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{r.exam_title || 'N/A'}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">{r.risk_score}</td>
                    <td className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">{r.violation_count}</td>
                    <td className="px-4 py-3 text-center"><Badge text={r.severity} colorClass={SEVERITY_COLORS[r.severity]} /></td>
                    <td className="px-4 py-3 text-center"><Badge text={r.status} colorClass={STATUS_COLORS[r.status]} /></td>
                    <td className="px-4 py-3 text-right text-[10px] text-gray-400">{timeAgo(r.created_at)}</td>
                    <td className="px-4 py-3"><FiEye size={14} className="text-gray-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <PaginationBar pagination={examPagination} onPage={loadExamRisks} />
            </div>
          </div>
        )}

        {/* PAYMENT RISKS TAB */}
        {activeTab === 'payment' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Gói</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Số tiền</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Risk</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Mã GD</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {paymentRisks.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FiCreditCard size={32} className="mx-auto mb-2 opacity-40" /><p>Không có giao dịch rủi ro</p></td></tr>
                ) : paymentRisks.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white text-xs truncate max-w-[140px]">{t.user_name || 'N/A'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{t.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{t.package_display_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-gray-900 dark:text-white">{Number(t.amount).toLocaleString('vi-VN')} đ</td>
                    <td className="px-4 py-3 text-center"><Badge text={t.status} colorClass={STATUS_COLORS[t.status]} /></td>
                    <td className="px-4 py-3 text-center">{t.risk_flag ? <Badge text={t.risk_flag} colorClass={STATUS_COLORS[t.risk_flag]} /> : <span className="text-gray-300">N/A</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono truncate max-w-[100px]">{t.transaction_code || 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-[10px] text-gray-400">{timeAgo(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <PaginationBar pagination={paymentPagination} onPage={loadPaymentRisks} />
            </div>
          </div>
        )}

        {/* QUESTION REPORTS TAB */}
        {activeTab === 'question' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Đề / Câu</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Loại lỗi</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Mô tả</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Báo cáo</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Người báo</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {questionReports.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FiFileText size={32} className="mx-auto mb-2 opacity-40" /><p>Không có báo lỗi nào</p></td></tr>
                ) : questionReports.map(qr => (
                  <tr key={qr.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{qr.exam_title || 'N/A'}</p>
                      <p className="text-[10px] text-gray-400">Câu #{qr.question_number} {qr.question_is_hidden ? '(ẩn)' : ''}</p>
                    </td>
                    <td className="px-4 py-3"><Badge text={qr.report_type} colorClass={SEVERITY_COLORS[qr.severity]} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[160px]">{qr.description || 'N/A'}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-red-600">{qr.total_reports || 1}</td>
                    <td className="px-4 py-3 text-center"><Badge text={qr.status} colorClass={STATUS_COLORS[qr.status]} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[100px]">{qr.reporter_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-[10px] text-gray-400">{timeAgo(qr.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <PaginationBar pagination={questionPagination} onPage={loadQuestionReports} />
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notification' && (
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><FiBell size={32} className="mx-auto mb-2 opacity-40" /><p>Không có thông báo</p></div>
            ) : notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${!n.read_at ? 'bg-violet-50/30 dark:bg-violet-900/10' : ''}`}
                onClick={async () => { if (!n.read_at) { await riskCenterApi.markRead(n.id); loadSummary(); loadNotifications(notifPagination.currentPage); } }}>
                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!n.read_at ? 'bg-violet-500' : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge text={n.severity} colorClass={SEVERITY_COLORS[n.severity]} />
                    <span className="text-xs text-gray-400">{n.type}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
              </div>
            ))}
            <div className="px-4 pb-4 pt-2">
              <PaginationBar pagination={notifPagination} onPage={loadNotifications} />
            </div>
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {activeTab === 'audit' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Admin</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Entity</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Lý do</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-gray-400">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400"><FiList size={32} className="mx-auto mb-2 opacity-40" /><p>Chưa có log</p></td></tr>
                ) : auditLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{log.admin_name || 'System'}</p>
                      <p className="text-[10px] text-gray-400">{log.admin_email}</p>
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[11px] font-bold rounded-md">{log.action}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{log.entity_type} #{log.entity_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[200px]">{log.reason || 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-[10px] text-gray-400">{timeAgo(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <PaginationBar pagination={auditPagination} onPage={loadAuditLogs} />
            </div>
          </div>
        )}
      </div>

      {/* Exam Risk Drawer */}
      {selectedCase && (
        <ExamRiskDrawer detail={selectedCase} onClose={() => setSelectedCase(null)} onAction={handleExamAction} />
      )}

      {/* Loading overlay for drawer */}
      {drawerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
        </div>
      )}
    </AdminLayout>
  );
}
