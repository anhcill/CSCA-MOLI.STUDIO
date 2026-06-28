import axios from '../utils/axios';

//  Types

export interface RiskSummary {
  criticalOpen: number;
  paymentPending: number;
  examReports: number;
  questionReports: number;
  todayViolations: number;
  unreadNotifications: number;
}

export interface ExamRiskCase {
  id: number;
  attempt_id: number | null;
  user_id: number;
  exam_id: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'reviewing' | 'resolved' | 'ignored' | 'escalated' | 'reverted';
  risk_score: number;
  violation_count: number;
  violation_types: Record<string, number>;
  summary: string | null;
  admin_note: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
  last_violation_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  user_name?: string;
  user_email?: string;
  exam_title?: string;
  resolved_by_name?: string;
}

export interface ExamRiskDetail extends ExamRiskCase {
  avatar_url?: string;
  user_is_active?: boolean;
  user_is_banned?: boolean;
  exam_code?: string;
  attempt_status?: string;
  total_score?: number;
  is_locked?: boolean;
  is_invalidated?: boolean;
  attempt_start?: string;
  attempt_submit?: string;
  violations: ExamViolation[];
  auditHistory: AuditLogEntry[];
  examAccessBan: { id: number; created_at: string; reason: string } | null;
  userWarnings: { id: number; type: string; message: string; created_at: string }[];
}

export interface ExamViolation {
  id: number;
  violation_type: string;
  violation_count: number;
  severity: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PaymentRisk {
  id: number;
  user_id: number;
  amount: number;
  status: string;
  payment_method: string;
  transaction_code: string | null;
  created_at: string;
  risk_flag?: string;
  risk_note?: string;
  user_name?: string;
  user_email?: string;
  package_display_name?: string;
}

export interface QuestionReport {
  id: number;
  question_id: number;
  exam_id: number;
  reporter_id: number | null;
  report_type: string;
  description: string | null;
  status: string;
  severity: string;
  admin_note: string | null;
  created_at: string;
  question_number?: number;
  question_text?: string;
  question_is_hidden?: boolean;
  exam_title?: string;
  exam_code?: string;
  reporter_name?: string;
  reporter_email?: string;
  total_reports?: number;
}

export interface QuestionReportAnswer {
  id: number;
  answer_key: string;
  answer_text: string;
  answer_text_cn?: string | null;
  is_correct: boolean;
}

export interface RelatedQuestionReport {
  id: number;
  report_type: string;
  description: string | null;
  status: string;
  reporter_id: number | null;
  created_at: string;
}

export interface RegradeLog {
  id: number;
  old_answer: string | null;
  new_answer: string | null;
  affected_count: number;
  admin_name?: string;
  created_at: string;
}

export interface QuestionReportDetail extends QuestionReport {
  question_text_cn?: string | null;
  question_type?: string | null;
  correct_answer?: string | null;
  explanation?: string | null;
  explanation_cn?: string | null;
  question_image?: string | null;
  points?: number | null;
  exam_is_hidden?: boolean;
  resolved_by_name?: string | null;
  relatedReports: RelatedQuestionReport[];
  answers: QuestionReportAnswer[];
  auditHistory: AuditLogEntry[];
  regradeHistory: RegradeLog[];
}

export interface AdminNotification {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: number | null;
  read_at: string | null;
  created_at: string;
  user_name?: string;
}

export interface AuditLogEntry {
  id: number;
  admin_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  admin_name?: string;
  admin_email?: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
}

//  API

const BASE = '/admin/risk-center';

export const riskCenterApi = {
  // Summary
  getSummary: async (): Promise<RiskSummary> => {
    const r = await axios.get(`${BASE}/summary`);
    return r.data.data;
  },

  // Exam risks
  getExamRisks: async (params?: Record<string, string | number>): Promise<{ data: ExamRiskCase[]; pagination: Pagination }> => {
    const r = await axios.get(`${BASE}/exam-risks`, { params });
    return r.data;
  },
  getExamRiskDetail: async (id: number): Promise<ExamRiskDetail> => {
    const r = await axios.get(`${BASE}/exam-risks/${id}`);
    return r.data.data;
  },
  scanViolations: async (): Promise<{ created: number; updated: number; scanned: number }> => {
    const r = await axios.post(`${BASE}/exam-risks/scan`);
    return r.data.data;
  },
  examRiskAction: async (id: number, action: string, body?: Record<string, unknown>): Promise<unknown> => {
    const r = await axios.post(`${BASE}/exam-risks/${id}/${action}`, body || {});
    return r.data;
  },

  // Payment risks
  getPaymentRisks: async (params?: Record<string, string | number>): Promise<{ data: PaymentRisk[]; pagination: Pagination }> => {
    const r = await axios.get(`${BASE}/payment-risks`, { params });
    return r.data;
  },
  getPaymentRiskDetail: async (id: number): Promise<unknown> => {
    const r = await axios.get(`${BASE}/payment-risks/${id}`);
    return r.data.data;
  },
  paymentRiskAction: async (id: number, action: string, body?: Record<string, unknown>): Promise<unknown> => {
    const r = await axios.post(`${BASE}/payment-risks/${id}/${action}`, body || {});
    return r.data;
  },

  // Question reports
  getQuestionReports: async (params?: Record<string, string | number>): Promise<{ data: QuestionReport[]; pagination: Pagination }> => {
    const r = await axios.get(`${BASE}/question-reports`, { params });
    return r.data;
  },
  getQuestionReportDetail: async (id: number): Promise<QuestionReportDetail> => {
    const r = await axios.get(`${BASE}/question-reports/${id}`);
    return r.data.data;
  },
  questionReportAction: async (id: number, action: string, body?: Record<string, unknown>): Promise<unknown> => {
    const r = await axios.post(`${BASE}/question-reports/${id}/${action}`, body || {});
    return r.data;
  },

  // Notifications
  getNotifications: async (params?: Record<string, string | number>): Promise<{ data: AdminNotification[]; pagination: Pagination }> => {
    const r = await axios.get(`${BASE}/notifications`, { params });
    return r.data;
  },
  getUnreadCount: async (): Promise<number> => {
    const r = await axios.get(`${BASE}/notifications/unread-count`);
    return r.data.count;
  },
  markRead: async (id: number): Promise<void> => {
    await axios.post(`${BASE}/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await axios.post(`${BASE}/notifications/read-all`);
  },

  // Audit logs
  getAuditLogs: async (params?: Record<string, string | number>): Promise<{ data: AuditLogEntry[]; pagination: Pagination }> => {
    const r = await axios.get(`${BASE}/audit-logs`, { params });
    return r.data;
  },
};
