import axios from '@/lib/utils/axios';

export interface AdminAnalyticsFilters {
  from?: string;
  to?: string;
  granularity?: 'day' | 'month';
}

export interface RevenuePoint {
  period: string;
  revenue: number;
  transactions: number;
}

export interface CompletionStats {
  overview: {
    totalAttempts: number;
    completedAttempts: number;
    uniqueUsers: number;
    completionRate: number;
  };
  bySubject: Array<{
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    totalAttempts: number;
    completedAttempts: number;
    completionRate: number;
  }>;
}

export interface ScoreDistribution {
  subjectCode: string;
  subjectName: string;
  buckets: Record<'0-39' | '40-59' | '60-79' | '80-100', number>;
}

export interface TopWrongQuestion {
  questionId: number;
  questionNumber: number;
  questionText: string;
  difficulty?: string;
  examId: number;
  examTitle: string;
  subjectName: string;
  answeredCount: number;
  wrongCount: number;
  wrongRate: number;
}

export interface ExamReportSummary {
  examId: number;
  examTitle: string;
  subjectName: string;
  totalQuestions: number;
  totalAttempts: number;
  completedAttempts: number;
  participants: number;
  completionRate: number;
  avgPercentage: number;
  maxPercentage: number;
  minPercentage: number;
}

export interface AdminAnalyticsData {
  revenue: RevenuePoint[];
  completion: CompletionStats;
  scoreDistribution: ScoreDistribution[];
  topWrongQuestions: TopWrongQuestion[];
  examReports: ExamReportSummary[];
}

export interface AdminPerformanceRow {
  adminId: number;
  adminName: string;
  email: string;
  adminRoles: string[];
  examsCreated: number;
  publishedExams: number;
  draftExams: number;
  archivedExams: number;
  softDeletedExams: number;
  deleteRequests: number;
  questionsCreated: number;
  totalAttempts: number;
  completedAttempts: number;
  uniqueStudents: number;
  completionRate: number;
  avgPercentage: number;
  createActions: number;
  updateActions: number;
  deleteActions: number;
  impactScore: number;
}

export interface AdminPerformanceData {
  overview: {
    adminsCount: number;
    examsCreated: number;
    publishedExams: number;
    draftExams: number;
    archivedExams: number;
    softDeletedExams: number;
    deleteRequests: number;
    unattributedExams: number;
    questionsCreated: number;
    completedAttempts: number;
  };
  leaderboard: AdminPerformanceRow[];
  timeline: Array<{
    period: string;
    examsCreated: number;
    publishedExams: number;
    softDeletedExams: number;
    deleteRequests: number;
  }>;
  recentActivity: Array<{
    id: number;
    adminId: number;
    adminName: string;
    action: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    createdAt: string;
  }>;
  deletionRequests: Array<{
    examId: number;
    title: string;
    status: string;
    deletionStatus: string;
    deletedAt?: string | null;
    deleteReason?: string | null;
    deleteRequestedAt?: string | null;
    deleteRequestReason?: string | null;
    requestedByName?: string | null;
    deletedByName?: string | null;
  }>;
  topExams: Array<{
    examId: number;
    examTitle: string;
    subjectName: string;
    adminName: string;
    totalAttempts: number;
    completedAttempts: number;
    uniqueStudents: number;
    avgPercentage: number;
  }>;
}

const compact = (filters: AdminAnalyticsFilters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));

export const adminAnalyticsApi = {
  getAnalytics: async (filters?: AdminAnalyticsFilters): Promise<AdminAnalyticsData> => {
    const response = await axios.get('/admin/analytics', { params: compact(filters) });
    return response.data.data;
  },

  getAdminPerformance: async (filters?: AdminAnalyticsFilters): Promise<AdminPerformanceData> => {
    const response = await axios.get('/admin/analytics/admin-performance', { params: compact(filters) });
    return response.data.data;
  },

  downloadExport: async (
    dataset: 'users' | 'attempts' | 'results' | 'transactions',
    filters?: AdminAnalyticsFilters,
  ) => {
    const response = await axios.get(`/admin/analytics/export/${dataset}`, {
      params: compact(filters),
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `${dataset}.csv`;
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
