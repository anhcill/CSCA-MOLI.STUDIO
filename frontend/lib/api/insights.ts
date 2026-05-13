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

// ─── HISTORY STATISTICS ─────────────────────────────────────────────────────────

export interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface SubjectStat {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  attemptCount: number;
  avgScore: number;
  maxScore: number;
  avgPercentage: number;
  totalCorrect: number;
  totalIncorrect: number;
  passRate: number;
  avgDurationSeconds: number;
  recentScores: number[];
  progress: number;
}

export interface DifficultyStat {
  difficulty: string;
  attemptCount: number;
  avgPercentage: number;
  maxPercentage: number;
  passRate: number;
  avgDurationSeconds: number;
}

export interface MonthlyTrend {
  month: string;
  monthLabel: string;
  attemptCount: number;
  avgScore: number;
  avgPercentage: number;
  maxScore: number;
  totalCorrect: number;
  totalIncorrect: number;
  passRate: number;
}

export interface TimeStats {
  avgDurationSeconds: number;
  maxDurationSeconds: number;
  minDurationSeconds: number;
  avgSecondsPerQuestion: number;
  avgTimeUsedPercent: number;
  correctAvgSeconds: number;
  incorrectAvgSeconds: number;
}

export interface PassFailStats {
  passCount: number;
  failCount: number;
  totalCount: number;
  passRate: number;
  excellentRate: number;
}

export interface RecentAttempt {
  id: number;
  examId: number;
  examTitle: string;
  score: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  totalQuestions: number;
  durationSeconds: number;
  percentage: number;
  difficultyLevel: string;
  subjectName: string;
  subjectCode: string;
  submitTime: string;
}

export interface ImprovementStats {
  firstHalfAvg: number;
  secondHalfAvg: number;
  improvement: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface HistoryOverview {
  totalAttempts: number;
  uniqueExams: number;
  activeDays: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  avgPercentage: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  avgDurationSeconds: number;
  totalDurationSeconds: number;
}

export interface HistoryStatsData {
  overview: HistoryOverview;
  scoreDistribution: ScoreDistribution[];
  subjects: SubjectStat[];
  difficulties: DifficultyStat[];
  monthlyTrend: MonthlyTrend[];
  timeStats: TimeStats;
  passFail: PassFailStats;
  recentAttempts: RecentAttempt[];
  improvement: ImprovementStats;
}

export async function getHistoryStats(subject?: string): Promise<HistoryStatsData> {
  const res = await axios.get(`${BASE}/history-stats`, {
    params: subject ? { subject } : undefined,
  });
  return res.data.data;
}

export interface WeakTopicAction {
  topic_id: number;
  topic_name: string;
  topic_name_cn?: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  error_percentage: number;
}

export interface NextLessonItem {
  topicId: number;
  topicName: string;
  subjectCode: string;
  subjectName: string;
  errorPercentage: number;
  materials: Array<{
    id: number;
    title: string;
    description?: string;
    category: string;
    subject: string;
    topic?: string;
    file_type?: string;
    is_premium?: boolean;
  }>;
  vocabulary: Array<{
    subject: string;
    topic: string;
    word_count: number;
  }>;
}

export interface LearningActionSummary {
  wrongQuestionCount: number;
  weakTopics: WeakTopicAction[];
  bookmarkCount: number;
  noteCount: number;
  nextLessons: NextLessonItem[];
}

export interface PracticeSetSummary {
  id: number;
  user_id: number;
  set_type: 'wrong_questions' | 'weak_topic';
  title: string;
  description?: string;
  subject_id?: number;
  source_topic_id?: number;
  question_ids: number[];
  status: string;
  created_at: string;
}

export interface PracticeQuestion {
  id: number;
  exam_id: number;
  question_number: number;
  question_text: string;
  question_text_cn?: string;
  question_type: string;
  question_category?: string;
  points: number;
  difficulty?: string;
  image_url?: string;
  explanation?: string;
  exam_title: string;
  subject_name: string;
  subject_code: string;
  answers: Array<{
    id: number;
    answer_key: string;
    answer_text: string;
    answer_text_cn?: string;
    is_correct: boolean;
  }>;
  note?: string;
  is_bookmarked: boolean;
}

export interface PracticeSetDetail extends PracticeSetSummary {
  questions: PracticeQuestion[];
}

export interface UserBookmark {
  id: number;
  entity_type: 'question' | 'material' | 'vocabulary' | 'exam';
  entity_id: number;
  title?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export async function getLearningActionSummary(): Promise<LearningActionSummary> {
  const res = await axios.get(`${BASE}/actions/summary`);
  return res.data.data;
}

export async function createWrongQuestionPractice(limit = 20): Promise<PracticeSetSummary> {
  const res = await axios.post(`${BASE}/actions/practice/wrong`, { limit });
  return res.data.data;
}

export async function createWeakTopicPractice(topicId?: number, limit = 20): Promise<PracticeSetSummary> {
  const res = await axios.post(`${BASE}/actions/practice/weak-topic`, { topic_id: topicId, limit });
  return res.data.data;
}

export async function getPracticeSet(id: number | string): Promise<PracticeSetDetail> {
  const res = await axios.get(`${BASE}/actions/practice/${id}`);
  return res.data.data;
}

export async function saveBookmark(payload: {
  entity_type: UserBookmark['entity_type'];
  entity_id: number;
  title?: string;
  metadata?: Record<string, any>;
}): Promise<UserBookmark> {
  const res = await axios.post(`${BASE}/actions/bookmarks`, payload);
  return res.data.data;
}

export async function deleteBookmark(type: UserBookmark['entity_type'], id: number): Promise<void> {
  await axios.delete(`${BASE}/actions/bookmarks/${type}/${id}`);
}

export async function saveQuestionNote(questionId: number, note: string, sourceAttemptId?: number) {
  const res = await axios.put(`${BASE}/actions/questions/${questionId}/note`, {
    note,
    source_attempt_id: sourceAttemptId,
  });
  return res.data.data;
}
