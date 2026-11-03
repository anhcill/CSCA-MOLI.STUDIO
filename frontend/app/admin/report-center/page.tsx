'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
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
  FiHelpCircle,
  FiInbox,
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
  forum: { label: 'Vi phạm', icon: FiFlag, className: 'border-rose-200 bg-rose-50 text-rose-700' },
  question: { label: 'Lỗi đề', icon: FiFileText, className: 'border-amber-200 bg-amber-50 text-amber-700' },
  feedback: { label: 'Góp ý', icon: FiMessageSquare, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  qa: { label: 'Hỏi đáp', icon: FiHelpCircle, className: 'border-sky-200 bg-sky-50 text-sky-700' },
  contact: { label: 'Liên hệ', icon: FiMail, className: 'border-violet-200 bg-violet-50 text-violet-700' },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ xử lý', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  open: { label: 'Chờ xử lý', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  in_progress: { label: 'Đang xử lý', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  reviewing: { label: 'Đang xử lý', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  answered: { label: 'Đã phản hồi', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  resolved: { label: 'Đã xử lý', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  fixed: { label: 'Đã sửa', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ignored: { label: 'Đã bỏ qua', className: 'border-gray-200 bg-gray-100 text-gray-600' },
  dismissed: { label: 'Đã bỏ qua', className: 'border-gray-200 bg-gray-100 text-gray-600' },
  closed: { label: 'Đã đóng', className: 'border-slate-200 bg-slate-100 text-slate-600' },
  archived: { label: 'Đã lưu trữ', className: 'border-gray-200 bg-gray-50 text-gray-500' },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  critical: { label: 'Khẩn cấp', className: 'bg-red-600 text-white' },
  high: { label: 'Cao', className: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Trung bình', className: 'bg-yellow-100 text-yellow-700' },
  low: { label: 'Thấp', className: 'bg-gray-100 text-gray-600' },
};

const ACTION_META: Record<string, { label: string; buttonClass: string; icon: React.ElementType; prompt: string }> = {
  resolve: { label: 'Đánh dấu đã xử lý', buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700', icon: FiCheck, prompt: 'Ghi chú cách xử lý hoặc kết quả xác minh...' },
  dismiss: { label: 'Bỏ qua báo cáo', buttonClass: 'bg-gray-700 text-white hover:bg-gray-800', icon: FiXCircle, prompt: 'Nêu lý do báo cáo không hợp lệ...' },
  ignore: { label: 'Bỏ qua báo lỗi', buttonClass: 'bg-gray-700 text-white hover:bg-gray-800', icon: FiXCircle, prompt: 'Nêu lý do không cần xử lý...' },
  close: { label: 'Đóng yêu cầu', buttonClass: 'bg-slate-700 text-white hover:bg-slate-800', icon: FiCheckCircle, prompt: 'Ghi chú trước khi đóng yêu cầu...' },
  reopen: { label: 'Mở lại', buttonClass: 'bg-blue-600 text-white hover:bg-blue-700', icon: FiRotateCcw, prompt: 'Lý do cần mở lại yêu cầu...' },
  archive: { label: 'Lưu trữ', buttonClass: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50', icon: FiArchive, prompt: 'Ghi chú lưu trữ (không bắt buộc)...' },
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

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function StatusBadge({ status }: { status: ReportCenterStatus }) {
  const meta = STATUS_META[status] || { label: status.replace(/_/g, ' '), className: 'border-gray-200 bg-gray-50 text-gray-600' };
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

function sourceDeepLink(item: ReportCenterItem) {
  if (item.source === 'feedback') return '/admin/feedback';
  if (item.source === 'qa') return '/admin/qa';
  return item.reference_url || null;
}

export default function AdminReportCenterPage() {
  const router = useRouter();
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

  useEffect(() => {
    if (!user) return;
    if (!canView) router.replace('/admin');
  }, [canView, router, user]);

  useEffect(() => {
    const syncSource = () => {
      const value = new URLSearchParams(window.location.search).get('source');
      setSource(isSource(value) ? value : 'all');
      setPage(1);
    };
    syncSource();
    window.addEventListener('popstate', syncSource);
    return () => window.removeEventListener('popstate', syncSource);
  }, []);

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
  const metadataEntries = useMemo(
    () => Object.entries(selected?.metadata || {}).filter(([, value]) => value != null && value !== ''),
    [selected],
  );

  if (user && !canView) {
    return (
      <AdminLayout title="Trung tâm báo cáo" description="Quản lý yêu cầu và phản ánh từ người dùng">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-bold text-rose-700">
          Bạn chưa được cấp quyền xem báo cáo người dùng.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Trung tâm báo cáo" description="Một nơi để tiếp nhận, phân loại và xử lý mọi phản ánh từ người dùng">
      <div className="relative mx-auto max-w-[1500px] space-y-5">
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

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <button type="button" onClick={() => setTabsOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><ActiveIcon size={19} /></div>
              <div className="min-w-0"><p className="truncate text-sm font-black text-gray-900">{activeTab.label}</p><p className="truncate text-xs text-gray-500">{activeTab.description}</p></div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500"><span>{sourceCount(summary, source)} mục</span>{tabsOpen ? <FiChevronUp /> : <FiChevronDown />}</div>
          </button>
          {tabsOpen && (
            <div className="grid gap-2 border-t border-gray-100 bg-gray-50/70 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {SOURCE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = source === tab.key;
                return (
                  <button key={tab.key} type="button" onClick={() => changeSource(tab.key)} className={`rounded-xl border p-3 text-left transition ${active ? 'border-indigo-300 bg-white shadow-sm ring-2 ring-indigo-100' : 'border-transparent bg-transparent hover:border-gray-200 hover:bg-white'}`}>
                    <div className="flex items-center justify-between gap-2"><Icon className={active ? 'text-indigo-600' : 'text-gray-400'} size={17} /><span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{sourceCount(summary, tab.key)}</span></div>
                    <p className={`mt-2 text-xs font-black ${active ? 'text-indigo-800' : 'text-gray-700'}`}>{tab.shortLabel}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm tên, email, nội dung, mã báo cáo..." className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </div>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 outline-none focus:border-indigo-400">
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
            <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center"><FiAlertTriangle className="mx-auto mb-2 text-rose-500" size={28} /><p className="text-sm font-bold text-rose-700">{error}</p><button onClick={refresh} className="mt-3 text-xs font-black text-rose-700 underline">Thử tải lại</button></div>
          ) : loading ? (
            <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : items.length === 0 ? (
            <div className="px-6 py-20 text-center"><FiInbox className="mx-auto mb-3 text-gray-300" size={46} /><p className="font-black text-gray-700">Không có báo cáo phù hợp</p><p className="mt-1 text-sm text-gray-400">Thử đổi tab, trạng thái hoặc từ khóa tìm kiếm.</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-black uppercase tracking-wide text-gray-400"><th className="px-5 py-3">Nguồn</th><th className="px-5 py-3">Nội dung</th><th className="px-5 py-3">Người gửi / Đối tượng</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Tiếp nhận</th></tr></thead>
                  <tbody>{items.map((item) => (
                    <tr key={item.key || `${item.source}-${item.source_id}`} onClick={() => openDetail(item)} className="cursor-pointer border-b border-gray-50 transition hover:bg-indigo-50/30">
                      <td className="px-5 py-4 align-top"><SourceBadge source={item.source} />{item.priority && <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${PRIORITY_META[item.priority]?.className || 'bg-gray-100 text-gray-600'}`}>{PRIORITY_META[item.priority]?.label || item.priority}</div>}</td>
                      <td className="max-w-lg px-5 py-4 align-top"><p className="font-black text-gray-900">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.summary || 'Không có mô tả'}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">#{item.source_id} · {item.type?.replace(/_/g, ' ')}</p></td>
                      <td className="px-5 py-4 align-top"><p className="max-w-[180px] truncate text-xs font-bold text-gray-800">{item.reporter?.name || item.reporter?.email || 'Khách chưa xác định'}</p><p className="mt-1 max-w-[180px] truncate text-[11px] text-gray-400">{item.target?.label || item.reporter?.email || 'Không có đối tượng'}</p></td>
                      <td className="px-5 py-4 align-top"><StatusBadge status={item.status} />{item.assigned_to?.name && <p className="mt-2 max-w-[140px] truncate text-[10px] font-bold text-indigo-600">{item.assigned_to.name}</p>}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right align-top text-xs text-gray-400">{formatDate(item.created_at)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="divide-y divide-gray-100 lg:hidden">{items.map((item) => (
                <button key={item.key || `${item.source}-${item.source_id}`} onClick={() => openDetail(item)} className="block w-full p-4 text-left hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2"><SourceBadge source={item.source} /><StatusBadge status={item.status} /></div>
                  <p className="mt-3 font-black text-gray-900">{item.title}</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">{item.summary || 'Không có mô tả'}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-400"><span className="truncate">{item.reporter?.name || item.reporter?.email || 'Khách'}</span><span className="shrink-0">{formatDate(item.created_at)}</span></div>
                </button>
              ))}</div>
            </>
          )}

          {!loading && !error && pagination.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-gray-400">Hiển thị {items.length} / {pagination.total} mục · Trang {pagination.page}/{pagination.total_pages}</p>
              <div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.page <= 1} className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><FiChevronLeft /></button><button onClick={() => setPage((value) => Math.min(pagination.total_pages, value + 1))} disabled={pagination.page >= pagination.total_pages} className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><FiChevronRight /></button></div>
            </div>
          )}
        </section>

        {selected && (
          <>
            <button className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} aria-label="Đóng chi tiết" />
            <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
                <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><SourceBadge source={selected.source} /><StatusBadge status={selected.status} /></div><h2 className="text-lg font-black text-gray-900">{selected.title}</h2><p className="mt-1 text-xs text-gray-400">Mã {selected.source} #{selected.source_id}</p></div>
                <button onClick={() => setSelected(null)} className="rounded-xl bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"><FiX /></button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {detailLoading && <div className="mb-4 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700"><FiRefreshCw className="animate-spin" /> Đang tải đầy đủ chi tiết...</div>}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Nội dung tiếp nhận</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{selected.summary || 'Không có mô tả chi tiết.'}</p></div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-sky-600"><FiUser /> Người gửi</p><p className="mt-2 font-black text-gray-900">{selected.reporter?.name || 'Khách chưa xác định'}</p><p className="mt-1 break-all text-xs text-gray-500">{selected.reporter?.email || 'Không có email'}</p>{selected.reporter?.id && <p className="mt-2 text-[11px] font-bold text-sky-700">User ID #{selected.reporter.id}</p>}</div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-amber-600"><FiTarget /> Đối tượng</p><p className="mt-2 font-black text-gray-900">{selected.target?.label || 'Không có đối tượng cụ thể'}</p><p className="mt-1 text-xs text-gray-500">{selected.target?.type || selected.type || '—'}{selected.target?.id ? ` · #${selected.target.id}` : ''}</p></div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Thông tin xử lý</p><dl className="mt-3 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-gray-400">Tiếp nhận</dt><dd className="mt-1 font-bold text-gray-800">{formatDate(selected.created_at)}</dd></div><div><dt className="text-xs text-gray-400">Cập nhật</dt><dd className="mt-1 font-bold text-gray-800">{formatDate(selected.updated_at)}</dd></div><div><dt className="text-xs text-gray-400">Người phụ trách</dt><dd className="mt-1 font-bold text-gray-800">{selected.assigned_to?.name || 'Chưa phân công'}</dd></div><div><dt className="text-xs text-gray-400">Trạng thái gốc</dt><dd className="mt-1 font-bold text-gray-800">{selected.raw_status || selected.status}</dd></div></dl></div>

                {selected.reference_url && <a href={selected.reference_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 hover:bg-indigo-100"><span className="min-w-0 truncate">Mở trang người dùng gặp vấn đề</span><FiExternalLink className="shrink-0" /></a>}

                {metadataEntries.length > 0 && <div className="mt-4 rounded-2xl border border-gray-100 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Dữ liệu liên quan</p><div className="mt-3 divide-y divide-gray-100">{metadataEntries.map(([key, value]) => <div key={key} className="grid gap-1 py-2 text-xs sm:grid-cols-[150px_1fr]"><span className="font-bold text-gray-500">{key.replace(/_/g, ' ')}</span><pre className="whitespace-pre-wrap break-words font-sans text-gray-800">{displayValue(value)}</pre></div>)}</div></div>}

                {sourceDeepLink(selected) && <a href={sourceDeepLink(selected) || '#'} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-800"><FiExternalLink /> Mở màn hình chuyên sâu của nguồn này</a>}
              </div>

              <footer className="border-t border-gray-100 bg-white px-5 py-4">
                {canManage ? (
                  selectedAction ? (
                    <div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-black text-gray-900">{ACTION_META[selectedAction]?.label}</p><button onClick={() => { setSelectedAction(''); setActionNote(''); }} className="text-xs font-bold text-gray-400">Hủy</button></div><textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} placeholder={ACTION_META[selectedAction]?.prompt} className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white" /><button onClick={submitAction} disabled={actioning} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-50 ${ACTION_META[selectedAction]?.buttonClass}`}>{actioning ? <FiRefreshCw className="animate-spin" /> : <FiCheck />} Xác nhận thao tác</button></div>
                  ) : (
                    <div className="flex flex-wrap gap-2">{actionOptions(selected).map((action) => { const meta = ACTION_META[action]; const Icon = meta.icon; return <button key={action} onClick={() => setSelectedAction(action)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black ${meta.buttonClass}`}><Icon />{meta.label}</button>; })}</div>
                  )
                ) : <p className="rounded-xl bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-500">Bạn có quyền xem nhưng chưa được cấp quyền xử lý báo cáo.</p>}
              </footer>
            </aside>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
