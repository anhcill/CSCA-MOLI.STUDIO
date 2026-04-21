import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';

const BASE = '/insights';

async function request<T>(fn: () => Promise<any>): Promise<T> {
  const response = await fn();
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Lỗi không xác định');
  }
  return response.data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubjectScore {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  exam_count: number;
  avg_score: number;
  avg_percentage: number;
  highest_score: number;
  latest_score: number;
}

export interface OverviewData {
  totalExams: number;
  completedExams: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalTimeMinutes: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  avgPercentage: number;
  rankPercentile: number;
  currentStreak: number;
  subjects: SubjectScore[];
}

export interface TopicAnalysis {
  topicId: number;
  topicName: string;
  topicNameCn?: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  errorRate: number;
  advice?: string;
  praise?: string;
}

export interface TopicAnalysisData {
  totalTopics: number;
  analyzedTopics: TopicAnalysis[];
  weaknesses: TopicAnalysis[];
  strengths: TopicAnalysis[];
}

export interface DifficultyBreakdown {
  difficulty: string;
  examCount: number;
  questionsAnswered: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeSeconds: number;
}

export interface DifficultyData {
  breakdown: DifficultyBreakdown[];
  weakestDifficulty: string | null;
  weakestAccuracy: number;
  suggestion: string;
}

export interface TrendChartPoint {
  date: string;
  score: number;
  subject: string;
  examTitle: string;
}

export interface SubjectTrend {
  subjectCode: string;
  subjectName: string;
  avgFirstHalf: number;
  avgSecondHalf: number;
  change: number;
  history: { score: number; date: string; examTitle: string }[];
}

export interface TrendData {
  hasEnoughData: boolean;
  message?: string;
  trend: 'improving' | 'stable' | 'declining' | null;
  change: number;
  avgFirstHalf: number;
  avgSecondHalf: number;
  subjectTrends: SubjectTrend[];
  chartData: TrendChartPoint[];
  suggestion: string;
  totalAttempts: number;
}

export interface SlowQuestion {
  questionId: number;
  questionText: string;
  category: string;
  difficulty: string;
  attemptCount: number;
  avgTimeSeconds: number;
  accuracy: number;
}

export interface RecentExamTime {
  examId: number;
  examTitle: string;
  subjectName: string;
  totalQuestions: number;
  examDurationMinutes: number;
  actualDurationSeconds: number;
  secondsPerQuestion: number;
  timeUsedPercent: number;
}

export interface TimeData {
  overallAvgSeconds: number;
  correctAvgSeconds: number;
  incorrectAvgSeconds: number;
  timeManagementRating: 'excellent' | 'good' | 'fair' | 'poor';
  suggestion: string;
  slowQuestions: SlowQuestion[];
  recentExamTimes: RecentExamTime[];
}

export interface ExamRecommendation {
  examId: number;
  examTitle: string;
  examCode: string;
  totalQuestions: number;
  duration: number;
  difficultyLevel: string;
  isPremium: boolean;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  reason: {
    type: string;
    text: string;
    topicId: number | null;
    topicName: string | null;
  };
  priority: number;
  bestScore: number | null;
}

export interface RecommendationsData {
  recommendations: ExamRecommendation[];
  weakTopics: {
    topicId: number;
    topicName: string;
    subjectCode: string;
    subjectName: string;
    errorPercentage: number;
  }[];
}

export interface StudyPlanDay {
  day: number;
  date: string;
  type: 'theory' | 'exam' | 'practice' | 'review';
  title: string;
  description: string;
  tasks: string[];
  focusTopics: string[];
  targetExam?: {
    id: number;
    title: string;
    code: string;
    subject_name: string;
  } | null;
  estimatedMinutes: number;
  isToday?: boolean;
  isPast?: boolean;
}

export interface StudyPlanData {
  planTitle: string;
  startsAt: string;
  endsAt: string;
  days: StudyPlanDay[];
}

export interface ExamHistoryItem {
  id: number;
  examId: number;
  examTitle: string;
  examCode: string;
  subjectName: string;
  subjectCode: string;
  score: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  totalQuestions: number;
  durationSeconds: number;
  difficultyLevel: string;
  submitTime: string;
}

export interface Suggestion {
  type: 'topic' | 'difficulty' | 'time' | 'trend';
  priority: 'high' | 'medium' | 'low';
  text: string;
}

// ─── NEW: Exam Type Analysis ─────────────────────────────────────────────────────

export interface ExamTypeStats {
  attemptCount: number;
  uniqueUsers: number;
  avgPercentage: number;
  maxPercentage: number;
  avgScore: number;
  passRate: number;
  avgDurationSeconds: number;
}

export interface ExamTypeAnalysis {
  phongThi: ExamTypeStats | null;
  tuDo: ExamTypeStats | null;
  comparison: {
    phongThiVsTuDo: number;
    betterType: string;
    text: string;
  } | null;
  hasEnoughData: boolean;
}

// ─── NEW: Weekday Heatmap ─────────────────────────────────────────────────────

export interface WeekdayData {
  weekday: string;
  label: string;
  daysActive: number;
  totalAttempts: number;
  avgPercentage: number;
  avgDurationMinutes: number;
  intensityDays: number;
  intensityAttempts: number;
}

export interface WeekdayAnalysis {
  heatmap: WeekdayData[];
  mostActiveDay: string | null;
  leastActiveDay: string | null;
  totalDaysStudied: number;
  tip: string;
  hasEnoughData: boolean;
}

// ─── NEW: Hardest Exams ────────────────────────────────────────────────────────

export interface HardestExam {
  examId: number;
  title: string;
  difficultyLevel: string;
  subjectName: string;
  subjectCode: string;
  totalQuestions: number;
  userAttempts: number;
  userAvgPercentage: number;
  userBestPercentage: number;
  userAvgScore: number;
  userPassRate: number;
  overallAvgPercentage: number;
  overallPassRate: number;
}

export interface HardestExamsData {
  hardestExams: HardestExam[];
  hasEnoughData: boolean;
}

export interface FullAnalysisData {
  overview: OverviewData;
  topics: TopicAnalysisData;
  difficulty: DifficultyData;
  trend: TrendData;
  timeManagement: TimeData;
  recommendations: RecommendationsData;
  suggestions: Suggestion[];
  generatedAt: string;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function getOverview(): Promise<OverviewData> {
  const res = await axios.get(`${BASE}/overview`);
  return res.data.data;
}

export async function getTopicAnalysis(subject?: string): Promise<TopicAnalysisData> {
  const res = await axios.get(`${BASE}/topics`, { params: subject ? { subject } : undefined });
  return res.data.data;
}

export async function getDifficultyAnalysis(): Promise<DifficultyData> {
  const res = await axios.get(`${BASE}/difficulty`);
  return res.data.data;
}

export async function getTrendAnalysis(limit = 10): Promise<TrendData> {
  const res = await axios.get(`${BASE}/trend`, { params: { limit } });
  return res.data.data;
}

export async function getTimeAnalysis(): Promise<TimeData> {
  const res = await axios.get(`${BASE}/time`);
  return res.data.data;
}

export async function getRecommendations(): Promise<RecommendationsData> {
  const res = await axios.get(`${BASE}/recommendations`);
  return res.data.data;
}

export async function getStudyPlan(subject?: string, force = false): Promise<StudyPlanData & { cached?: boolean }> {
  const res = await axios.get(`${BASE}/study-plan`, {
    params: { subject, force: force ? '1' : undefined },
  });
  return res.data.data;
}

export async function getFullAnalysis(): Promise<{ hasEnoughData: boolean; message?: string; data?: FullAnalysisData }> {
  const res = await axios.get(`${BASE}/full`);
  return res.data;
}

export async function getExamHistory(limit = 20): Promise<ExamHistoryItem[]> {
  const res = await axios.get(`${BASE}/history`, { params: { limit } });
  return res.data.data;
}

export async function getExamTypeAnalysis(): Promise<ExamTypeAnalysis> {
  const res = await axios.get(`${BASE}/exam-type`);
  return res.data.data;
}

export async function getWeekdayAnalysis(): Promise<WeekdayAnalysis> {
  const res = await axios.get(`${BASE}/weekday`);
  return res.data.data;
}

export async function getHardestExams(): Promise<HardestExamsData> {
  const res = await axios.get(`${BASE}/hardest-exams`);
  return res.data.data;
}

export async function markInsightRead(id: number): Promise<void> {
  await axios.put(`${BASE}/read/${id}`);
}
