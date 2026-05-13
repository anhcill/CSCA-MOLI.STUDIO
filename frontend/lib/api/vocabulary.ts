import axios from '@/lib/utils/axios';
import type {
  AdminVocabularyReviewStats,
  MiniTestQuestion,
  MiniTestResult,
  VocabularyReviewCard,
  VocabularyReviewDashboard,
} from '@/lib/types/vocabulary';

export interface VocabularyReviewFilters {
  subject?: string;
  topic?: string;
  search?: string;
  limit?: number;
}

const compactParams = (filters: VocabularyReviewFilters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));

export const vocabularyReviewApi = {
  getDashboard: async (filters?: VocabularyReviewFilters): Promise<VocabularyReviewDashboard> => {
    const response = await axios.get('/vocabulary/review/dashboard', { params: compactParams(filters) });
    return response.data.data;
  },

  getQueue: async (filters?: VocabularyReviewFilters): Promise<VocabularyReviewCard[]> => {
    const response = await axios.get('/vocabulary/review/queue', { params: compactParams(filters) });
    return response.data.data || [];
  },

  recordReview: async (vocabularyId: number, quality: number) => {
    const response = await axios.post(`/vocabulary/review/${vocabularyId}`, { quality });
    return response.data.data;
  },

  getMiniTest: async (filters?: VocabularyReviewFilters): Promise<MiniTestQuestion[]> => {
    const response = await axios.get('/vocabulary/mini-test', { params: compactParams(filters) });
    return response.data.data || [];
  },

  submitMiniTest: async (
    answers: Array<{ vocabulary_id: number; answer: string }>,
  ): Promise<MiniTestResult> => {
    const response = await axios.post('/vocabulary/mini-test/submit', { answers });
    return response.data.data;
  },
};

export const vocabularyAdminApi = {
  getReviewStats: async (): Promise<AdminVocabularyReviewStats> => {
    const response = await axios.get('/vocabulary/admin/review-stats');
    return response.data.data;
  },
};

