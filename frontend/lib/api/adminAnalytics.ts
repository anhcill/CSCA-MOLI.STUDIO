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

const compact = (filters: AdminAnalyticsFilters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));

export const adminAnalyticsApi = {
  getAnalytics: async (filters?: AdminAnalyticsFilters): Promise<AdminAnalyticsData> => {
    const response = await axios.get('/admin/analytics', { params: compact(filters) });
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
