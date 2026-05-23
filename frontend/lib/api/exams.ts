import axios from '../utils/axios';

export interface Exam {
  id: number;
  code: string;
  title: string;
  title_cn?: string;
  description?: string;
  duration: number;
  total_questions: number;
  total_points: number;
  difficulty_level: string;
  status: string;
  subject_name: string;
  subject_code?: string;
  question_count: number;
  user_attempt_count: number;
  user_best_score: number;
  publish_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  max_participants?: number | null;
  is_premium?: boolean;
  solution_video_url?: string;
  solution_description?: string;
  shuffle_mode?: boolean;
  vip_tier?: string; // 'basic' | 'vip' | 'premium'
  // New: Stats
  pass_rate?: number;
  overall_difficulty?: string;
  user_last_score?: number;
  in_progress_attempt?: {
    id: number;
    attempt_number: number;
    start_time: string;
    answered_count: number;
  } | null;
}

export interface Question {
  id: number;
  question_number: number;
  question_text: string;
  question_text_cn?: string;
  question_text_en?: string;
  passage_text?: string;
  effective_passage_text?: string;
  image_url?: string;
  points: number;
  answers?: Answer[];
}

export interface Answer {
  id: number;
  answer_key: string;
  answer_text: string;
  answer_text_cn?: string;
  answer_text_en?: string;
  image_url?: string;
  is_correct?: boolean;
}

export interface ExamAttempt {
  id: number;
  exam_id: number;
  attempt_number: number;
  start_time: string;
  total_score?: number;
  total_correct?: number;
  total_incorrect?: number;
  status: string;
}

export interface SavedAnswer {
  question_id: number;
  selected_answer_id?: number | null;
  selected_answer_key?: string | null;
  essay_answer?: string | null;
}

export interface ExamStartOptions {
  restart?: boolean;
  practiceMode?: boolean;
  mode?: 'resume' | 'restart' | 'practice';
}

export interface PracticeFeedback {
  is_correct: boolean;
  correct_answer_key?: string;
  correct_answer_text?: string;
  correct_answer_text_cn?: string;
  explanation?: string;
  explanation_cn?: string;
}

export interface TopicStats {
  topic_name: string;
  topic_name_cn?: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  error_percentage: number;
}

// Map URL slug → DB subject code
export const SUBJECT_SLUG_TO_CODE: Record<string, string> = {
  toan: 'MATH',
  'vat-ly': 'PHYSICS',
  hoa: 'CHEMISTRY',
  'hoa-hoc': 'CHEMISTRY',
  'tiengtrung-xahoi': 'CHINESE_SOC',
  'tiengtrung-tunhien': 'CHINESE_SCI',
  'tieng-trung-xh': 'CHINESE_SOC',
  'tieng-trung-tn': 'CHINESE_SCI',
};

// Reverse map
export const SUBJECT_CODE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECT_SLUG_TO_CODE).map(([slug, code]) => [code, slug])
);

const examApi = {
  // Lấy danh sách đề thi theo môn
  async getExamsBySubject(subjectCode: string, subjectSlug?: string): Promise<Exam[]> {
    const response = await axios.get(`/subjects/${subjectCode}/exams`, {
      params: subjectSlug ? { subjectSlug } : undefined
    });
    return response.data.data;
  },

  // Lấy chi tiết đề thi
  async getExamDetail(examId: number, includeAnswers = false) {
    const response = await axios.get(`/exams/${examId}`, {
      params: { answers: includeAnswers }
    });
    return response.data.data;
  },

  // Bắt đầu làm bài
  async getExamPreflight(examId: number): Promise<Exam> {
    const response = await axios.get(`/exams/${examId}/preflight`);
    return response.data.data;
  },

  async startExam(examId: number, options: ExamStartOptions = {}): Promise<{
    exam: Exam;
    questions: Question[];
    attemptId: number;
    savedAnswers?: SavedAnswer[];
    isResume?: boolean;
    practiceMode?: boolean;
    timeLeftSeconds?: number | null;
  }> {
    const response = await axios.post(`/exams/${examId}/start`, options);
    return response.data.data;
  },

  // Lưu câu trả lời
  async saveAnswer(attemptId: number, questionId: number, answerKey: string, timeSpent: number, essayAnswer?: string, practiceMode = false): Promise<any & { feedback?: PracticeFeedback }> {
    const response = await axios.post(`/attempts/${attemptId}/answers`, {
      questionId,
      answerKey,
      timeSpent,
      essayAnswer,
      practiceMode,
    });
    return response.data.data;
  },

  // Nộp bài
  async submitExam(attemptId: number) {
    const response = await axios.post(`/attempts/${attemptId}/submit`);
    return response.data.data;
  },

  // Lấy lịch sử làm bài
  async getHistory(subjectCode?: string, limit = 10) {
    const response = await axios.get('/history', {
      params: { subjectCode, limit }
    });
    return response.data.data;
  },

  // Lấy thống kê theo topic
  async getTopicStats(subjectCode: string): Promise<TopicStats[]> {
    const response = await axios.get(`/subjects/${subjectCode}/stats`);
    return response.data.data;
  },

  // Lấy chi tiết kết quả
  async getAttemptDetail(attemptId: number) {
    const response = await axios.get(`/attempts/${attemptId}`);
    return response.data.data;
  },

  // Alias for getAttemptDetail
  async getAttemptDetails(attemptId: string) {
    return this.getAttemptDetail(parseInt(attemptId));
  }
};

export default examApi;
