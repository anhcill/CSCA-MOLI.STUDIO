import api from '@/lib/utils/axios';

export type ReportSource = 'forum' | 'question' | 'feedback' | 'qa' | 'contact';

export type ReportCenterStatus =
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'ignored'
  | 'closed'
  | 'archived'
  | string;

export interface ReportCenterPerson {
  id?: number | null;
  name?: string | null;
  email?: string | null;
}

export interface ReportCenterTarget {
  type?: string | null;
  id?: number | string | null;
  label?: string | null;
}

export interface ReportCenterItem {
  key: string;
  source: ReportSource;
  source_id: number | string;
  type: string;
  status: ReportCenterStatus;
  raw_status?: string | null;
  priority?: string | null;
  title: string;
  summary?: string | null;
  reporter?: ReportCenterPerson | null;
  target?: ReportCenterTarget | null;
  reference_url?: string | null;
  assigned_to?: ReportCenterPerson | null;
  created_at: string;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  replies?: Array<Record<string, unknown>>;
  history?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ReportCenterSummary {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  by_source: Record<ReportSource, number>;
  by_status: Record<string, number>;
}

export interface ReportCenterPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ReportCenterListResponse {
  items: ReportCenterItem[];
  pagination: ReportCenterPagination;
}

export interface ReportCenterListParams {
  source?: ReportSource;
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

const EMPTY_SOURCE_COUNTS: Record<ReportSource, number> = {
  forum: 0,
  question: 0,
  feedback: 0,
  qa: 0,
  contact: 0,
};

function unwrap<T = unknown>(payload: any): T {
  return (payload?.data?.data ?? payload?.data ?? payload) as T;
}

function normalizeSummary(payload: any): ReportCenterSummary {
  const value = unwrap<any>(payload) || {};
  const bySource = value.by_source || value.bySource || value.sources || {};
  const byStatus = value.by_status || value.byStatus || value.statuses || {};

  return {
    total: Number(value.total || 0),
    pending: Number(value.pending ?? byStatus.pending ?? byStatus.open ?? 0),
    in_progress: Number(value.in_progress ?? value.inProgress ?? byStatus.in_progress ?? byStatus.reviewing ?? 0),
    resolved: Number(value.resolved ?? byStatus.resolved ?? byStatus.fixed ?? byStatus.closed ?? 0),
    by_source: {
      ...EMPTY_SOURCE_COUNTS,
      ...Object.fromEntries(Object.entries(bySource).map(([key, count]) => [key, Number(count || 0)])),
    },
    by_status: Object.fromEntries(
      Object.entries(byStatus).map(([key, count]) => [key, Number(count || 0)]),
    ),
  };
}

function normalizePagination(payload: any, itemCount: number): ReportCenterPagination {
  const value = payload?.pagination || payload?.data?.pagination || payload?.data?.data?.pagination || {};
  const page = Number(value.page ?? value.currentPage ?? 1);
  const limit = Number(value.limit ?? 20);
  const total = Number(value.total ?? itemCount);

  return {
    page,
    limit,
    total,
    total_pages: Number(value.total_pages ?? value.totalPages ?? Math.max(1, Math.ceil(total / limit))),
  };
}

export const reportCenterApi = {
  async getSummary(): Promise<ReportCenterSummary> {
    const response = await api.get('/admin/report-center/summary');
    return normalizeSummary(response);
  },

  async getItems(params: ReportCenterListParams = {}): Promise<ReportCenterListResponse> {
    const response = await api.get('/admin/report-center/items', { params });
    const value = unwrap<any>(response) || {};
    const items = (Array.isArray(value) ? value : value.items || []) as ReportCenterItem[];
    return { items, pagination: normalizePagination(response, items.length) };
  },

  async getItem(source: ReportSource, id: number | string): Promise<ReportCenterItem> {
    const response = await api.get(`/admin/report-center/items/${source}/${id}`);
    const value = unwrap<any>(response);
    return (value?.item || value) as ReportCenterItem;
  },

  async action(
    source: ReportSource,
    id: number | string,
    action: string,
    note?: string,
  ): Promise<unknown> {
    const response = await api.post(`/admin/report-center/items/${source}/${id}/action`, {
      action,
      note: note?.trim() || undefined,
    });
    return unwrap(response);
  },
};
