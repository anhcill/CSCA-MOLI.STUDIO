'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import QuestionReportDrawer from '@/components/admin/QuestionReportDrawer';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { riskCenterApi, type QuestionReportDetail } from '@/lib/api/riskCenter';
import {
  reportCenterApi,
  type ReportCenterItem,
  type ReportCenterPagination,
  type ReportCenterStatus,
  type ReportCenterSummary,
  type ReportSource,
} from '@/lib/api/reportCenter';
import {
  FiActivity,
  FiAlertTriangle,
  FiArchive,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiFlag,
  FiHash,
  FiHelpCircle,
  FiInbox,
  FiLink,
  FiMail,
  FiMessageSquare,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiTarget,
  FiUser,
  FiX,
  FiXCircle,
} from 'react-icons/fi';

type SourceFilter = 'all' | ReportSource;
type DetailRecord = Record<string, any>;

const EMPTY_SUMMARY: ReportCenterSummary = {
  total: 0,
  pending: 0,
  in_progress: 0,
  resolved: 0,
  by_source: { forum: 0, question: 0, feedback: 0, qa: 0, contact: 0 },
  by_status: {},
};

const EMPTY_PAGINATION: ReportCenterPagination = {
  page: 1,
  limit: 20,
  total: 0,
  total_pages: 1,
};

const SOURCE_TABS: Array<{
  key: SourceFilter;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}> = [
  { key: 'all', label: 'Tất cả báo cáo', shortLabel: 'Tất cả', description: 'Toàn bộ yêu cầu từ người dùng', icon: FiInbox, accent: 'indigo' },
  { key: 'forum', label: 'Người dùng & tin nhắn', shortLabel: 'Vi phạm', description: 'Report tài khoản và hội thoại', icon: FiFlag, accent: 'rose' },
  { key: 'question', label: 'Báo lỗi đề thi', shortLabel: 'Lỗi đề', description: 'Sai đáp án, công thức, dữ kiện', icon: FiFileText, accent: 'amber' },
  { key: 'feedback', label: 'Góp ý & báo lỗi web', shortLabel: 'Góp ý', description: 'Trải nghiệm và đề xuất tính năng', icon: FiMessageSquare, accent: 'emerald' },
  { key: 'qa', label: 'Hỏi đáp học viên', shortLabel: 'Hỏi đáp', description: 'Các cuộc tư vấn học tập', icon: FiHelpCircle, accent: 'sky' },
  { key: 'contact', label: 'Liên hệ bên ngoài', shortLabel: 'Liên hệ', description: 'Khách chưa đăng nhập gửi form', icon: FiMail, accent: 'violet' },
];

const SOURCE_META: Record<ReportSource, { label: string; icon: React.ElementType; className: string }> = {
  forum: { label: 'Vi phạm', icon: FiFlag, className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200' },
  question: { label: 'Lỗi đề', icon: FiFileText, className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200' },
  feedback: { label: 'Góp ý', icon: FiMessageSquare, className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200' },
  qa: { label: 'Hỏi đáp', icon: FiHelpCircle, className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-200' },
  contact: { label: 'Liên hệ', icon: FiMail, className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-200' },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ xử lý', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200' },
  open: { label: 'Chờ xử lý', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200' },
  in_progress: { label: 'Đang xử lý', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-200' },
  reviewing: { label: 'Đang xử lý', className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-200' },
  answered: { label: 'Đã phản hồi', className: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-200' },
  resolved: { label: 'Đã xử lý', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200' },
  fixed: { label: 'Đã sửa', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200' },
  ignored: { label: 'Đã bỏ qua', className: 'border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  dismissed: { label: 'Đã bỏ qua', className: 'border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  closed: { label: 'Đã đóng', className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  archived: { label: 'Đã lưu trữ', className: 'border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  critical: { label: 'Khẩn cấp', className: 'bg-red-600 text-white' },
  high: { label: 'Cao', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200' },
  medium: { label: 'Trung bình', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-200' },
  low: { label: 'Thấp', className: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300' },
};

const ACTION_META: Record<string, { label: string; buttonClass: string; icon: React.ElementType; prompt: string }> = {
  resolve: { label: 'Đánh dấu đã xử lý', buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700', icon: FiCheck, prompt: 'Ghi chú cách xử lý hoặc kết quả xác minh...' },
  dismiss: { label: 'Bỏ qua báo cáo', buttonClass: 'bg-gray-700 text-white hover:bg-gray-800', icon: FiXCircle, prompt: 'Nêu lý do báo cáo không hợp lệ...' },
  ignore: { label: 'Bỏ qua báo lỗi', buttonClass: 'bg-gray-700 text-white hover:bg-gray-800', icon: FiXCircle, prompt: 'Nêu lý do không cần xử lý...' },
  close: { label: 'Đóng yêu cầu', buttonClass: 'bg-slate-700 text-white hover:bg-slate-800', icon: FiCheckCircle, prompt: 'Ghi chú trước khi đóng yêu cầu...' },
  reopen: { label: 'Mở lại', buttonClass: 'bg-blue-600 text-white hover:bg-blue-700', icon: FiRotateCcw, prompt: 'Lý do cần mở lại yêu cầu...' },
  archive: { label: 'Lưu trữ', buttonClass: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700', icon: FiArchive, prompt: 'Ghi chú lưu trữ (không bắt buộc)...' },
};

function isSource(value: string | null): value is ReportSource {
  return value === 'forum' || value === 'question' || value === 'feedback' || value === 'qa' || value === 'contact';
}

function sourceCount(summary: ReportCenterSummary, source: SourceFilter) {
  return source === 'all' ? summary.total : summary.by_source[source] || 0;
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa có thời gian';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: ReportCenterStatus }) {
  const meta = STATUS_META[status] || { label: status.replace(/_/g, ' '), className: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300' };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.className}`}>{meta.label}</span>;
}

function SourceBadge({ source }: { source: ReportSource }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.className}`}><Icon size={12} />{meta.label}</span>;
}

function actionOptions(item: ReportCenterItem) {
  const closed = ['resolved', 'fixed', 'ignored', 'dismissed', 'closed', 'archived'].includes(item.status);
  if (item.status === 'archived') return ['reopen'];
  if (closed) return ['reopen', 'archive'];
  if (item.source === 'forum') return ['resolve', 'dismiss', 'archive'];
  if (item.source === 'question') return ['resolve', 'ignore', 'archive'];
  return ['resolve', 'close', 'archive'];
}

function sourceDeepLink(item: ReportCenterItem, canOpenLegacyTickets: boolean) {
  if (item.source === 'forum' || item.source === 'question') return null;
  if (item.source === 'feedback') return canOpenLegacyTickets ? '/admin/feedback' : null;
  if (item.source === 'qa') return canOpenLegacyTickets ? '/admin/qa' : null;
  return item.reference_url || null;
}

function itemDetail(item: ReportCenterItem): DetailRecord {
  const value = item.metadata?.detail;
  return value && typeof value === 'object' ? value as DetailRecord : {};
}

function DetailLabel({ icon: Icon, children, color = 'text-slate-400' }: {
  icon: React.ElementType;
  children: React.ReactNode;
  color?: string;
}) {
  return <p className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] ${color}`}><Icon size={12} />{children}</p>;
}

function ForumDetail({ item }: { item: ReportCenterItem }) {
  const detail = itemDetail(item);
  const evidence = detail.evidence && typeof detail.evidence === 'object' ? detail.evidence : {};
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><section className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] p-4"><DetailLabel icon={FiUser} color="text-sky-300">Người báo cáo</DetailLabel><p className="mt-3 font-black text-white">{detail.reporter_name || item.reporter?.name || 'Không xác định'}</p><p className="mt-1 break-all text-xs text-slate-300">{detail.reporter_email || item.reporter?.email}</p><p className="mt-2 text-xs font-bold text-sky-300">User ID #{detail.reporter_id || item.reporter?.id || '?'}</p></section><section className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] p-4"><DetailLabel icon={FiTarget} color="text-rose-300">Người bị báo cáo</DetailLabel><p className="mt-3 font-black text-white">{detail.reported_name || item.target?.label || 'Không xác định'}</p><p className="mt-1 break-all text-xs text-slate-300">{detail.reported_email || 'Không có email'}</p><p className="mt-2 text-xs font-bold text-rose-300">User ID #{detail.reported_user_id || item.target?.id || '?'}</p></section></div><section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4"><DetailLabel icon={FiMessageSquare} color="text-amber-300">Lý do báo cáo</DetailLabel><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{detail.reason || item.summary}</p></section>{(item.type === 'message' || evidence.content) && <section><DetailLabel icon={FiMessageSquare}>Bằng chứng tin nhắn</DetailLabel><div className="mt-2 rounded-2xl border border-slate-700 bg-[#030817] p-4"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{evidence.content || 'Không còn nội dung tin nhắn.'}</p><div className="mt-3 flex flex-wrap gap-3 border-t border-slate-800 pt-3 text-[11px] font-bold text-slate-500"><span>Message #{evidence.messageId || item.target?.id || '?'}</span><span>Sender #{evidence.senderId || '?'}</span><span>{evidence.wasDeleted ? 'Tin nhắn đã bị xóa' : 'Tin nhắn còn tồn tại'}</span></div></div></section>}</div>;
}

function TicketDetail({ item }: { item: ReportCenterItem }) {
  const detail = itemDetail(item);
  const replies = Array.isArray(detail.replies) ? detail.replies : [];
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><section className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] p-4"><DetailLabel icon={FiUser} color="text-sky-300">Người gửi</DetailLabel><p className="mt-3 font-black text-white">{detail.reporter_name || item.reporter?.name || 'Học viên'}</p><p className="mt-1 break-all text-xs text-slate-300">{detail.reporter_email || item.reporter?.email}</p></section><section className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.08] p-4"><DetailLabel icon={FiHash} color="text-indigo-300">Phân loại</DetailLabel><p className="mt-3 font-black text-white">{detail.category || item.type}</p><p className="mt-1 text-xs text-slate-400">Ticket #{detail.id || item.source_id} · {replies.length} phản hồi</p></section></div><section className="rounded-2xl border border-slate-700 bg-[#030817] p-4"><DetailLabel icon={FiMessageSquare}>Nội dung ban đầu</DetailLabel><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{detail.content || item.summary || '(Chỉ có ảnh đính kèm)'}</p>{detail.image_url && <img src={detail.image_url} alt="Ảnh đính kèm" className="mt-4 max-h-80 rounded-xl border border-slate-700 object-contain" />}{detail.reference_url && <a href={detail.reference_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-indigo-300 hover:text-indigo-200"><FiLink /> Mở trang phát sinh</a>}</section>{replies.length > 0 && <section><DetailLabel icon={FiMessageSquare}>Lịch sử trao đổi</DetailLabel><div className="mt-2 space-y-3">{replies.map((reply: DetailRecord) => <div key={reply.id} className={`flex ${reply.is_admin_reply ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 ${reply.is_admin_reply ? 'rounded-br-md bg-indigo-500 text-white' : 'rounded-bl-md border border-slate-700 bg-slate-900 text-slate-100'}`}><p className="text-[10px] font-black uppercase tracking-wide opacity-70">{reply.is_admin_reply ? 'Admin' : reply.sender_name || 'Người dùng'}</p>{reply.content && <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{reply.content}</p>}{reply.image_url && <img src={reply.image_url} alt="Đính kèm" className="mt-2 max-h-56 rounded-xl" />}<p className="mt-2 text-[10px] opacity-60">{formatDate(reply.created_at)}</p></div></div>)}</div></section>}</div>;
}

function ContactDetail({ item }: { item: ReportCenterItem }) {
  const detail = itemDetail(item);
  return <div className="space-y-4"><section className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.08] p-4"><DetailLabel icon={FiMail} color="text-violet-300">Thông tin liên hệ</DetailLabel><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase text-slate-500">Họ tên</p><p className="mt-1 font-black text-white">{detail.name || item.reporter?.name}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Email</p><p className="mt-1 break-all font-bold text-sky-300">{detail.email || item.reporter?.email}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Điện thoại</p><p className="mt-1 font-bold text-white">{detail.phone || 'Không cung cấp'}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Trạng thái email</p><p className="mt-1 font-bold text-white">{detail.email_status || item.metadata?.emailStatus || 'Không rõ'}</p></div></div></section><section className="rounded-2xl border border-slate-700 bg-[#030817] p-4"><DetailLabel icon={FiMessageSquare}>Nội dung liên hệ</DetailLabel><h3 className="mt-3 text-base font-black text-white">{detail.subject || item.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{detail.message || item.summary}</p></section>{detail.email_error && <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4"><DetailLabel icon={FiAlertTriangle} color="text-rose-300">Lỗi gửi email</DetailLabel><p className="mt-2 break-words text-xs leading-6 text-rose-100">{detail.email_error}</p></section>}</div>;
}

function SourceDetail({ item }: { item: ReportCenterItem }) {
  if (item.source === 'forum') return <ForumDetail item={item} />;
  if (item.source === 'feedback' || item.source === 'qa') return <TicketDetail item={item} />;
  return <ContactDetail item={item} />;
}

function AdminReportCenterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [source, setSource] = useState<SourceFilter>('all');
  const [tabsOpen, setTabsOpen] = useState(true);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<ReportCenterSummary>(EMPTY_SUMMARY);
  const [items, setItems] = useState<ReportCenterItem[]>([]);
  const [pagination, setPagination] = useState<ReportCenterPagination>(EMPTY_PAGINATION);
  const [selected, setSelected] = useState<ReportCenterItem | null>(null);
  const [selectedQuestionReport, setSelectedQuestionReport] = useState<QuestionReportDetail | null>(null);
  const [questionDetailLoading, setQuestionDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actioning, setActioning] = useState(false);

  const canView = hasPermission(user, 'reports.view');
  const canManage = hasPermission(user, 'reports.manage');
  const canManageRiskCenter = hasPermission(user, 'risk_center.manage');
  const canOpenExamAdmin = hasPermission(user, 'exams.manage');
  const canOpenLegacyTickets = hasPermission(user, 'reports.manage');

  useEffect(() => {
    if (!user) return;
    if (!canView) router.replace('/admin');
  }, [canView, router, user]);

  useEffect(() => {
    const value = searchParams.get('source');
    setSource(isSource(value) ? value : 'all');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadSummary = useCallback(async () => {
    const next = await reportCenterApi.getSummary();
    setSummary(next);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await reportCenterApi.getItems({
        source: source === 'all' ? undefined : source,
        status: status || undefined,
        search: search || undefined,
        page,
        limit: 20,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (loadError: any) {
      setItems([]);
      setError(loadError.response?.data?.message || 'Không tải được danh sách báo cáo.');
    } finally {
      setLoading(false);
    }
  }, [page, search, source, status]);

  useEffect(() => {
    if (!canView) return;
    loadSummary().catch(() => setSummary(EMPTY_SUMMARY));
  }, [canView, loadSummary]);

  useEffect(() => {
    if (!canView) return;
    loadItems();
  }, [canView, loadItems]);

  const changeSource = (next: SourceFilter) => {
    setSource(next);
    setPage(1);
    const url = next === 'all' ? '/admin/report-center' : `/admin/report-center?source=${next}`;
    router.replace(url, { scroll: false });
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadSummary(), loadItems()]);
    setRefreshing(false);
  };

  const openDetail = async (item: ReportCenterItem) => {
    if (item.source === 'question') {
      setSelected(null);
      setSelectedQuestionReport(null);
      setQuestionDetailLoading(true);
      try {
        const detail = await riskCenterApi.getQuestionReportDetail(Number(item.source_id));
        setSelectedQuestionReport(detail);
      } catch (detailError: any) {
        setToast(detailError.response?.data?.message || 'Không tải được chi tiết báo lỗi đề.');
      } finally {
        setQuestionDetailLoading(false);
      }
      return;
    }

    setSelected(item);
    setSelectedAction('');
    setActionNote('');
    setDetailLoading(true);
    try {
      const detail = await reportCenterApi.getItem(item.source, item.source_id);
      setSelected({ ...item, ...detail });
    } catch (detailError: any) {
      setToast(detailError.response?.data?.message || 'Không tải được chi tiết báo cáo.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleQuestionAction = async (id: number, action: string, body?: Record<string, unknown>) => {
    if (canManageRiskCenter) {
      await riskCenterApi.questionReportAction(id, action, body);
    } else {
      if (!canManage || !['resolve', 'ignore'].includes(action)) {
        throw new Error('Bạn không có quyền thực hiện thao tác này.');
      }
      await reportCenterApi.action('question', id, action, String(body?.reason || ''));
    }
    await Promise.all([loadSummary(), loadItems()]);
  };

  const submitAction = async () => {
    if (!selected || !selectedAction) return;
    setActioning(true);
    try {
      await reportCenterApi.action(selected.source, selected.source_id, selectedAction, actionNote);
      setToast('Đã cập nhật báo cáo.');
      setSelected(null);
      setSelectedAction('');
      setActionNote('');
      await Promise.all([loadSummary(), loadItems()]);
    } catch (actionError: any) {
      setToast(actionError.response?.data?.message || 'Không thể xử lý báo cáo này.');
    } finally {
      setActioning(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeTab = SOURCE_TABS.find((tab) => tab.key === source) || SOURCE_TABS[0];
  const ActiveIcon = activeTab.icon;
  const selectedDetail = selected ? itemDetail(selected) : {};

  if (user && !canView) {
    return (
      <AdminLayout title="Trung tâm báo cáo" description="Quản lý yêu cầu và phản ánh từ người dùng">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          Bạn chưa được cấp quyền xem báo cáo người dùng.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Trung tâm báo cáo" description="Một nơi để tiếp nhận, phân loại và xử lý mọi phản ánh từ người dùng">
      <div className="relative mx-auto min-w-0 max-w-[1500px] space-y-5 overflow-x-hidden">
        {toast && <div className="fixed right-4 top-4 z-[80] rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">{toast}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl shadow-slate-900/10">
          <div className="grid gap-6 px-5 py-6 md:grid-cols-[1fr_auto] md:items-end md:px-7">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-100">
                <FiActivity /> User Operations
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Hộp thư xử lý tập trung</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Theo dõi báo cáo vi phạm, lỗi đề thi, góp ý, hỏi đáp và liên hệ ngoài hệ thống mà không phải chuyển qua nhiều trang admin.</p>
            </div>
            <button onClick={refresh} disabled={refreshing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 disabled:opacity-50">
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Làm mới dữ liệu
            </button>
          </div>
          <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[
              { label: 'Tổng tiếp nhận', value: summary.total, icon: FiInbox },
              { label: 'Chờ xử lý', value: summary.pending, icon: FiClock },
              { label: 'Đang xử lý', value: summary.in_progress, icon: FiActivity },
              { label: 'Đã hoàn tất', value: summary.resolved, icon: FiCheckCircle },
            ].map((card) => {
              const Icon = card.icon;
              return <div key={card.label} className="border-r border-white/10 px-4 py-4 last:border-r-0"><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Icon />{card.label}</div><p className="mt-1 text-2xl font-black">{card.value}</p></div>;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={() => setTabsOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><ActiveIcon size={19} /></div>
              <div className="min-w-0"><p className="truncate text-sm font-black text-gray-900 dark:text-slate-100">{activeTab.label}</p><p className="truncate text-xs text-gray-500 dark:text-slate-400">{activeTab.description}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400"><span>{sourceCount(summary, source)} mục</span>{tabsOpen ? <FiChevronUp /> : <FiChevronDown />}</div>
          </button>
          {tabsOpen && (
            <div className="grid gap-2 border-t border-gray-100 bg-gray-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {SOURCE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = source === tab.key;
                return (
                  <button key={tab.key} type="button" onClick={() => changeSource(tab.key)} className={`min-w-0 rounded-xl border p-3 text-left transition ${active ? 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100 dark:border-indigo-400/60 dark:bg-indigo-500/15 dark:ring-indigo-500/20' : 'border-transparent bg-transparent hover:border-gray-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center justify-between gap-2"><Icon className={active ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-slate-500'} size={17} /><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300'}`}>{sourceCount(summary, tab.key)}</span></div>
                    <p className={`mt-2 truncate text-xs font-black ${active ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-700 dark:text-slate-300'}`}>{tab.shortLabel}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm tên, email, nội dung, mã báo cáo..." className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-950 dark:focus:ring-indigo-500/20" />
            </div>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:w-auto">
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã xử lý</option>
              <option value="ignored">Đã bỏ qua</option>
              <option value="closed">Đã đóng</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </div>

          {error ? (
            <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/30 dark:bg-rose-500/10"><FiAlertTriangle className="mx-auto mb-2 text-rose-500 dark:text-rose-300" size={28} /><p className="text-sm font-bold text-rose-700 dark:text-rose-200">{error}</p><button onClick={refresh} className="mt-3 text-xs font-black text-rose-700 underline dark:text-rose-300">Thử tải lại</button></div>
          ) : loading ? (
            <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />)}</div>
          ) : items.length === 0 ? (
            <div className="px-6 py-20 text-center"><FiInbox className="mx-auto mb-3 text-gray-300 dark:text-slate-600" size={46} /><p className="font-black text-gray-700 dark:text-slate-200">Không có báo cáo phù hợp</p><p className="mt-1 text-sm text-gray-400 dark:text-slate-500">Thử đổi tab, trạng thái hoặc từ khóa tìm kiếm.</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-black uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-500"><th className="px-5 py-3">Nguồn</th><th className="px-5 py-3">Nội dung</th><th className="px-5 py-3">Người gửi / Đối tượng</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Tiếp nhận</th></tr></thead>
                  <tbody>{items.map((item) => (
                    <tr key={item.key || `${item.source}-${item.source_id}`} onClick={() => openDetail(item)} className="cursor-pointer border-b border-gray-50 transition hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:bg-indigo-500/5">
                      <td className="px-5 py-4 align-top"><SourceBadge source={item.source} />{item.priority && <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${PRIORITY_META[item.priority]?.className || 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>{PRIORITY_META[item.priority]?.label || item.priority}</div>}</td>
                      <td className="max-w-lg px-5 py-4 align-top"><p className="font-black text-gray-900 dark:text-slate-100">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-slate-400">{item.summary || 'Không có mô tả'}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">#{item.source_id} · {item.type?.replace(/_/g, ' ')}</p></td>
                      <td className="px-5 py-4 align-top"><p className="max-w-[180px] truncate text-xs font-bold text-gray-800 dark:text-slate-200">{item.reporter?.name || item.reporter?.email || 'Khách chưa xác định'}</p><p className="mt-1 max-w-[180px] truncate text-[11px] text-gray-400 dark:text-slate-500">{item.target?.label || item.reporter?.email || 'Không có đối tượng'}</p></td>
                      <td className="px-5 py-4 align-top"><StatusBadge status={item.status} />{item.assigned_to?.name && <p className="mt-2 max-w-[140px] truncate text-[10px] font-bold text-indigo-600 dark:text-indigo-300">{item.assigned_to.name}</p>}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right align-top text-xs text-gray-400 dark:text-slate-500">{formatDate(item.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-slate-800 lg:hidden">{items.map((item) => (
                <button key={item.key || `${item.source}-${item.source_id}`} onClick={() => openDetail(item)} className="block min-w-0 w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/70">
                  <div className="flex items-center justify-between gap-2"><SourceBadge source={item.source} /><StatusBadge status={item.status} /></div>
                  <p className="mt-3 break-words font-black text-gray-900 dark:text-slate-100">{item.title}</p><p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-gray-500 dark:text-slate-400">{item.summary || 'Không có mô tả'}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400 dark:text-slate-500"><span className="min-w-0 truncate">{item.reporter?.name || item.reporter?.email || 'Khách'}</span><span className="shrink-0">{formatDate(item.created_at)}</span></div>
                </button>
              ))}</div>
            </>
          )}

          {!loading && !error && pagination.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500">Hiển thị {items.length} / {pagination.total} mục · Trang {pagination.page}/{pagination.total_pages}</p>
              <div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.page <= 1} className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><FiChevronLeft /></button><button onClick={() => setPage((value) => Math.min(pagination.total_pages, value + 1))} disabled={pagination.page >= pagination.total_pages} className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><FiChevronRight /></button></div>
            </div>
          )}
        </section>

        {selected && (
          <>
            <button className="fixed inset-0 z-40 cursor-default bg-slate-950/75 backdrop-blur-sm" onClick={() => setSelected(null)} aria-label="Đóng chi tiết" />
            <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-5xl flex-col overflow-x-hidden border-l border-slate-700 bg-[#081226] text-slate-100 shadow-2xl shadow-black/60">
              <header className="relative overflow-hidden border-b border-slate-700/80 bg-[#0d172b] px-5 py-5 sm:px-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_32%)]" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2"><SourceBadge source={selected.source} /><StatusBadge status={selected.status} />{selected.priority && <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${PRIORITY_META[selected.priority]?.className || 'bg-slate-700 text-slate-200'}`}>{PRIORITY_META[selected.priority]?.label || selected.priority}</span>}</div>
                    <h2 className="text-xl font-black tracking-tight text-white">{selected.source === 'question' ? `Báo lỗi #${selected.source_id}` : selected.title}</h2>
                    <p className="mt-1 truncate text-sm font-bold text-slate-300">{selected.source === 'question' ? `${selectedDetail.exam_title || selected.title} · Câu ${selectedDetail.question_number || selected.metadata?.questionNumber || '?'}` : selected.summary || `Mã ${selected.source} #${selected.source_id}`}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500"><span>Tiếp nhận {formatDate(selected.created_at)}</span><span>Cập nhật {formatDate(selected.updated_at)}</span><span>{selected.assigned_to?.name ? `Phụ trách: ${selected.assigned_to.name}` : 'Chưa phân công'}</span></div>
                  </div>
                  <button onClick={() => setSelected(null)} className="relative rounded-xl border border-slate-700 bg-slate-900/70 p-2.5 text-slate-400 transition hover:border-slate-500 hover:text-white"><FiX /></button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {detailLoading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm font-bold text-indigo-300"><FiRefreshCw className="animate-spin" size={24} /><span>Đang tải đầy đủ dữ liệu xử lý...</span></div> : <SourceDetail item={selected} />}
                {!detailLoading && sourceDeepLink(selected, canOpenLegacyTickets) && <a href={sourceDeepLink(selected, canOpenLegacyTickets) || '#'} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-300 transition hover:bg-indigo-500/20"><FiExternalLink /> Mở màn hình trao đổi chuyên sâu</a>}
              </div>

              <footer className="border-t border-slate-700/80 bg-[#0d172b] px-4 py-4 sm:px-6">
                {canManage ? (
                  selectedAction ? (
                    <div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-black text-white">{ACTION_META[selectedAction]?.label}</p><button onClick={() => { setSelectedAction(''); setActionNote(''); }} className="text-xs font-bold text-slate-400 hover:text-white">Hủy</button></div><textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} placeholder={ACTION_META[selectedAction]?.prompt} className="w-full resize-none rounded-xl border border-slate-700 bg-[#030817] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-400" /><button onClick={submitAction} disabled={actioning} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50 ${ACTION_META[selectedAction]?.buttonClass}`}>{actioning ? <FiRefreshCw className="animate-spin" /> : <FiCheck />} Xác nhận thao tác</button></div>
                  ) : (
                    <div className="flex flex-wrap gap-2">{actionOptions(selected).map((action) => { const meta = ACTION_META[action]; const Icon = meta.icon; return <button key={action} onClick={() => setSelectedAction(action)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black ${meta.buttonClass}`}><Icon />{meta.label}</button>; })}</div>
                  )
                ) : <p className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-xs font-bold text-slate-400">Bạn có quyền xem nhưng chưa được cấp quyền xử lý báo cáo.</p>}
              </footer>
            </aside>
          </>
        )}

        {questionDetailLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-400/20 bg-slate-900 px-5 py-4 text-sm font-black text-indigo-200 shadow-2xl">
              <FiRefreshCw className="animate-spin" size={20} /> Đang tải đầy đủ báo lỗi đề...
            </div>
          </div>
        )}

        {selectedQuestionReport && (
          <QuestionReportDrawer
            detail={selectedQuestionReport}
            onClose={() => setSelectedQuestionReport(null)}
            onAction={handleQuestionAction}
            canResolve={canManage}
            canModerateExam={canManageRiskCenter}
            canOpenExam={canOpenExamAdmin}
          />
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminReportCenterPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
      <AdminReportCenterContent />
    </Suspense>
  );
}
