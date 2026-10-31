'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiClock, FiAward, FiHome, FiRotateCw, FiRefreshCw, FiMessageCircle, FiBarChart2, FiBookOpen, FiCpu, FiPrinter, FiZap, FiArrowLeft, FiFlag, FiFileText, FiX, FiStar, FiEye } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import examApi, { QuestionReportType } from '@/lib/api/exams';
import { authFetch } from '@/lib/utils/authFetch';
import AIChatbot from '@/components/ai/AIChatbot';
import AIExamAnalysis from '@/components/ai/AIExamAnalysis';
import { PremiumGate } from '@/components/common/PremiumGate';
import { useAuthStore } from '@/lib/store/authStore';
import { canUseAI } from '@/lib/utils/permissions';
import RichMathText from '@/components/common/RichMathText';
import AIFormattedText from '@/components/ai/AIFormattedText';
import { createWeakTopicPractice, createWrongQuestionPractice, saveBookmark } from '@/lib/api/insights';
import AiAnalyzingOverlay from '@/components/common/AiAnalyzingOverlay';
import BilingualMathText from '@/components/exam/result/BilingualMathText';
import QuestionExplanationBlock from '@/components/exam/result/QuestionExplanationBlock';
import ReviewAIButtons from '@/components/exam/result/ReviewAIButtons';
import ReviewAIHost, { type ReviewAIHostHandle } from '@/components/exam/result/ReviewAIHost';
import PdfComparisonDocument from '@/components/exam/result/PdfComparisonDocument';
import type { ReviewAIMode } from '@/components/exam/result/types';
import { getOptionToneClass, getQuestionReviewStatus, getReviewCardClass } from '@/components/exam/result/utils';
import InkResultBackground, {
  InkScoreMark,
  inkResultButtonPanel,
  inkResultMuted,
  inkResultPanel,
  inkResultScore,
  inkResultSoftPanel,
  inkResultTitle,
} from '@/components/layout/InkResultBackground';
import { QUESTION_REPORT_TYPES } from '@/lib/questionReports';
import {
  isLanguageSelectionAllowed,
  normalizeExamLanguageMode,
  normalizeExplanationLanguageMode,
} from '@/lib/exam/languageMode';

interface AnswerOption {
  key: string;
  text: string;
  text_cn?: string | null;
  text_en?: string | null;
  is_correct: boolean;
}
interface QuestionResult {
  id?: number;
  question_id?: number;
  question_number: number;
  sub_question_number?: number;
  question_text: string;
  question_text_cn?: string;
  question_text_en?: string;
  question_type?: string;
  passage_text?: string;
  selected_answer_key: string | null;
  selected_answer_text: string;
  selected_answer_text_cn?: string | null;
  selected_answer_text_en?: string | null;
  correct_answer_key: string;
  correct_answer_text: string;
  correct_answer_text_cn?: string | null;
  correct_answer_text_en?: string | null;
  is_correct: boolean | null;
  points: number;
  score_awarded?: number | string | null;
  max_score?: number | string | null;
  grading_status?: string | null;
  grading_feedback?: string | null;
  explanation?: string;
  explanation_cn?: string;
  explanation_en?: string;
  explanation_image_url?: string;
  options: AnswerOption[];
  difficulty?: string;
  topic_name?: string;
  question_category?: string;
}

interface ExamResult {
  id: number;
  exam_id: number;
  exam_title: string;
  language_mode?: string;
  explanation_language_mode?: string;
  title_cn?: string;
  subject_name: string;
  total_score: number;
  total_possible_score?: number | string;
  score_scale_10?: number;
  score_scale_100?: number;
  total_correct: number;
  total_incorrect?: number;
  total_unanswered?: number;
  score_percentage?: number | string;
  total_pending_grading?: number;
  submit_time: string;
  total_questions: number;
  answers: QuestionResult[];
  allow_download?: boolean;
  is_room_exam?: boolean;
  has_solution_file?: boolean;
  review_locked?: boolean;
  exam_end_time?: string | null;
}

const MISTAKE_NOTEBOOK_STORAGE_KEY = 'moly:mistake_notebook';

type SmartQuestionFilter = 'all' | 'incorrect' | 'unanswered' | 'correct' | 'saved';

interface MistakeNotebookEntry {
  key: string;
  questionId?: number;
  examId: number;
  attemptId?: number;
  examTitle: string;
  subjectName?: string;
  questionNumber: number;
  subQuestionNumber?: number;
  questionText: string;
  selectedAnswerKey: string | null;
  correctAnswerKey: string;
  topicName?: string;
  difficulty?: string;
  savedAt: string;
}

function getMistakeQuestionKey(question: QuestionResult, index: number, examId?: number): string {
  const qId = question.question_id || question.id;
  if (qId) return `q-${qId}`;
  return `exam-${examId || 0}-n-${question.question_number || index + 1}-sub-${question.sub_question_number || 0}`;
}

function readMistakeNotebookFromStorage(): MistakeNotebookEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MISTAKE_NOTEBOOK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any): MistakeNotebookEntry | null => {
        if (!item) return null;
        if (typeof item === 'string' || typeof item === 'number') {
          const strKey = typeof item === 'number' ? `q-${item}` : String(item);
          return {
            key: strKey,
            questionId: typeof item === 'number' ? item : undefined,
            examId: 0,
            examTitle: '',
            questionNumber: 0,
            questionText: '',
            selectedAnswerKey: null,
            correctAnswerKey: '',
            savedAt: new Date().toISOString(),
          };
        }
        if (typeof item === 'object') {
          const qId = Number(item.questionId ?? item.question_id ?? item.id) || undefined;
          const key = item.key || (qId ? `q-${qId}` : '');
          if (!key) return null;
          return {
            key: String(key),
            questionId: qId,
            examId: Number(item.examId ?? item.exam_id) || 0,
            attemptId: Number(item.attemptId ?? item.attempt_id) || undefined,
            examTitle: String(item.examTitle ?? item.exam_title ?? ''),
            subjectName: item.subjectName ?? item.subject_name ?? undefined,
            questionNumber: Number(item.questionNumber ?? item.question_number) || 0,
            subQuestionNumber: Number(item.subQuestionNumber ?? item.sub_question_number) || undefined,
            questionText: String(item.questionText ?? item.question_text ?? ''),
            selectedAnswerKey: item.selectedAnswerKey ?? item.selected_answer_key ?? null,
            correctAnswerKey: String(item.correctAnswerKey ?? item.correct_answer_key ?? ''),
            topicName: item.topicName ?? item.topic_name ?? undefined,
            difficulty: item.difficulty ?? undefined,
            savedAt: String(item.savedAt ?? new Date().toISOString()),
          };
        }
        return null;
      })
      .filter((entry): entry is MistakeNotebookEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeMistakeNotebookToStorage(entries: MistakeNotebookEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MISTAKE_NOTEBOOK_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to write mistake notebook to localStorage:', err);
  }
}

function ExamResultContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = parseInt(params.id as string);
  const attemptId = searchParams.get('attemptId');
  const isTopicPracticeSource = searchParams.get('source') === 'topic-practice';
  const topicPracticeId = searchParams.get('topicId');
  const topicPracticeSubject = searchParams.get('subject');
  const topicPracticeHref = topicPracticeId
    ? `/luyen-chu-de/chu-de/${topicPracticeId}${topicPracticeSubject ? `?subject=${encodeURIComponent(topicPracticeSubject)}` : ''}`
    : '/luyen-chu-de';
  const user = useAuthStore((s) => s.user);
  const hasAIAccess = canUseAI(user);

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'result' | 'review' | 'chat'>('result');
  const reviewAIHostRef = useRef<ReviewAIHostHandle>(null);
  const chatAnchorRef = useRef<HTMLDivElement>(null);
  const [showGradeModal, setShowGradeModal] = useState<QuestionResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [savedWrongQuestions, setSavedWrongQuestions] = useState<Set<number>>(new Set());
  const [reportedQuestionIds, setReportedQuestionIds] = useState<Set<number>>(new Set());
  const [reportQuestion, setReportQuestion] = useState<QuestionResult | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [openingSolution, setOpeningSolution] = useState(false);
  const [solutionViewerOpen, setSolutionViewerOpen] = useState(false);
  const [comparisonUrls, setComparisonUrls] = useState<{ paper: string; solution: string } | null>(null);
  const [questionFilter, setQuestionFilter] = useState<SmartQuestionFilter>('all');
  const [retryMistakeMode, setRetryMistakeMode] = useState(false);
  const [retryAnswers, setRetryAnswers] = useState<Record<string, string>>({});
  const [revealedRetryKeys, setRevealedRetryKeys] = useState<Set<string>>(new Set());
  const [notebookEntries, setNotebookEntries] = useState<MistakeNotebookEntry[]>([]);
  const reviewSectionAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const entries = readMistakeNotebookFromStorage();
    setNotebookEntries(entries);
    const savedIds = entries
      .map((item) => item.questionId)
      .filter((id): id is number => typeof id === 'number' && id > 0);
    if (savedIds.length > 0) {
      setSavedWrongQuestions((prev) => {
        const next = new Set(prev);
        savedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, []);

  const notebookKeySet = useMemo(() => {
    const keys = new Set<string>();
    notebookEntries.forEach((entry) => {
      if (entry.key) keys.add(entry.key);
      if (entry.questionId) keys.add(`q-${entry.questionId}`);
    });
    savedWrongQuestions.forEach((qId) => keys.add(`q-${qId}`));
    return keys;
  }, [notebookEntries, savedWrongQuestions]);

  const isQuestionInMistakeNotebook = useCallback(
    (question: QuestionResult, index: number) => {
      const qKey = getMistakeQuestionKey(question, index, result?.exam_id || examId);
      const qId = question.question_id || question.id;
      return notebookKeySet.has(qKey) || Boolean(qId && notebookKeySet.has(`q-${qId}`));
    },
    [notebookKeySet, result?.exam_id, examId]
  );

  const openChatTab = useCallback(() => {
    setActiveTab('chat');
    window.setTimeout(() => {
      chatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, []);

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    } else {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (hasAIAccess && result?.id && !result.is_room_exam && !result.review_locked && !aiAnalysis && !aiLoading) {
      loadAIAnalysis(result.id);
    }
  }, [hasAIAccess, result?.id, result?.is_room_exam, result?.review_locked]);

  useEffect(() => {
    if (!result?.review_locked) return;
    const timer = window.setInterval(() => fetchResult(), 30000);
    return () => window.clearInterval(timer);
  }, [result?.review_locked]);

  useEffect(() => () => {
    if (comparisonUrls) {
      URL.revokeObjectURL(comparisonUrls.paper);
      URL.revokeObjectURL(comparisonUrls.solution);
    }
  }, [comparisonUrls]);

  // Cảnh báo thoát khi AI đang phân tích
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!aiLoaded && aiLoading) {
        e.preventDefault();
        e.returnValue = 'AI đang phân tích bài thi. Nếu thoát, bạn sẽ mất kết quả phân tích!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [aiLoaded, aiLoading]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      const data = await examApi.getAttemptDetail(Number(attemptId));
      setResult(data);
      if (hasAIAccess && data.id && !data.is_room_exam && !data.review_locked) {
        loadAIAnalysis(data.id);
      }
    } catch (error: any) {
      console.error('Error fetching result:', error);
      if (error?.response?.status === 401) {
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAIAnalysis = async (attemptId: number) => {
    if (!hasAIAccess) return;
    // Không load lại nếu đã có analysis rồi
    if (aiAnalysis && aiAnalysis.attempt?.id === attemptId) return;
    try {
      setAiLoading(true);
      const res = await authFetch(`/api/ai/exam-result/${attemptId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data);
        setPreviousAttempt(data.previousAttempt || null);
        setAiLoaded(true);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateWrongPractice = async () => {
    if (!result) return;
    try {
      setActionLoading('wrong');
      const practiceSet = await createWrongQuestionPractice(20, { examId: result.exam_id });
      router.push(`/practice-sets/${practiceSet.id}`);
    } catch (error) {
      console.error('Create wrong practice error:', error);
      alert('Không thể tạo bộ luyện câu sai lúc này.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateWeakTopicPractice = async () => {
    try {
      setActionLoading('weak-topic');
      const practiceSet = await createWeakTopicPractice(undefined, 20);
      router.push(`/practice-sets/${practiceSet.id}`);
    } catch (error) {
      console.error('Create weak topic practice error:', error);
      const message = (error as any)?.response?.data?.message || 'Không thể tạo bộ luyện chủ đề yếu lúc này.';
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const openSolutionComparison = async () => {
    if (!result) return;

    try {
      setOpeningSolution(true);
      const [paper, solution] = await Promise.all([
        examApi.getExamPaper(result.exam_id, !result.is_room_exam, result.id),
        examApi.getExamSolution(result.exam_id, result.id),
      ]);
      setComparisonUrls({
        paper: URL.createObjectURL(paper),
        solution: URL.createObjectURL(solution),
      });
      setSolutionViewerOpen(true);
    } catch (error: any) {
      console.error('Open PDF comparison error:', error);
      alert('Không thể tải đề và lời giải lúc này. Vui lòng thử lại sau.');
    } finally {
      setOpeningSolution(false);
    }
  };

  const closeSolutionComparison = () => {
    setSolutionViewerOpen(false);
    setComparisonUrls(null);
  };

  const handleToggleMistakeNotebook = async (question: QuestionResult, index: number) => {
    const qKey = getMistakeQuestionKey(question, index, result?.exam_id || examId);
    const questionId = question.question_id || question.id;
    const currentlySaved = isQuestionInMistakeNotebook(question, index);

    if (currentlySaved) {
      setNotebookEntries((prev) => {
        const next = prev.filter(
          (entry) => entry.key !== qKey && !(questionId && entry.questionId === questionId)
        );
        writeMistakeNotebookToStorage(next);
        return next;
      });
      if (questionId) {
        setSavedWrongQuestions((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      }
      return;
    }

    const newEntry: MistakeNotebookEntry = {
      key: qKey,
      questionId,
      examId: result?.exam_id || examId,
      attemptId: result?.id,
      examTitle: result?.exam_title || 'Đề thi',
      subjectName: result?.subject_name,
      questionNumber: question.question_number || index + 1,
      subQuestionNumber: question.sub_question_number,
      questionText: question.question_text || '',
      selectedAnswerKey: question.selected_answer_key,
      correctAnswerKey: question.correct_answer_key,
      topicName: question.topic_name || question.question_category,
      difficulty: question.difficulty,
      savedAt: new Date().toISOString(),
    };

    setNotebookEntries((prev) => {
      const filtered = prev.filter(
        (entry) => entry.key !== qKey && !(questionId && entry.questionId === questionId)
      );
      const next = [newEntry, ...filtered];
      writeMistakeNotebookToStorage(next);
      return next;
    });

    if (questionId) {
      setSavedWrongQuestions((prev) => new Set(prev).add(questionId));
      try {
        await saveBookmark({
          entity_type: 'question',
          entity_id: questionId,
          title: `Câu ${question.sub_question_number || question.question_number || index + 1} - ${result?.exam_title || 'Đề thi'}`,
          metadata: {
            attemptId: result?.id,
            examId: result?.exam_id,
            selectedAnswer: question.selected_answer_key,
            correctAnswer: question.correct_answer_key,
            topic: question.topic_name || question.question_category || null,
          },
        });
      } catch (error) {
        // Lưu localStorage đã thành công nên chỉ log nhẹ nếu API bookmark gặp lỗi
        console.warn('Sync bookmark API warning:', error);
      }
    }
  };

  const handleSaveAllMistakesToNotebook = () => {
    if (!result?.answers?.length) return;
    const currentEntries = [...notebookEntries];
    const existingKeys = new Set(currentEntries.map((e) => e.key));
    const addedIds: number[] = [];

    result.answers.forEach((q, idx) => {
      const status = getQuestionReviewStatus(q);
      if (status !== 'incorrect' && status !== 'unanswered') return;
      const qKey = getMistakeQuestionKey(q, idx, result.exam_id || examId);
      const questionId = q.question_id || q.id;
      if (existingKeys.has(qKey) || (questionId && existingKeys.has(`q-${questionId}`))) return;

      existingKeys.add(qKey);
      if (questionId) addedIds.push(questionId);
      currentEntries.unshift({
        key: qKey,
        questionId,
        examId: result.exam_id || examId,
        attemptId: result.id,
        examTitle: result.exam_title || 'Đề thi',
        subjectName: result.subject_name,
        questionNumber: q.question_number || idx + 1,
        subQuestionNumber: q.sub_question_number,
        questionText: q.question_text || '',
        selectedAnswerKey: q.selected_answer_key,
        correctAnswerKey: q.correct_answer_key,
        topicName: q.topic_name || q.question_category,
        difficulty: q.difficulty,
        savedAt: new Date().toISOString(),
      });
    });

    setNotebookEntries(currentEntries);
    writeMistakeNotebookToStorage(currentEntries);
    if (addedIds.length > 0) {
      setSavedWrongQuestions((prev) => {
        const next = new Set(prev);
        addedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleRetryMistakeMode = () => {
    setRetryMistakeMode((prev) => {
      const next = !prev;
      if (next) {
        setRetryAnswers({});
        setRevealedRetryKeys(new Set());
        if (questionFilter === 'correct') {
          setQuestionFilter('all');
        }
      }
      return next;
    });
  };

  const handleStartQuickRetryMistakes = () => {
    setActiveTab('review');
    setRetryMistakeMode(true);
    setRetryAnswers({});
    setRevealedRetryKeys(new Set());
    if (questionFilter === 'correct') {
      setQuestionFilter('all');
    }
    window.setTimeout(() => {
      reviewSectionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSelectRetryOption = (qKey: string, optionKey: string) => {
    setRetryAnswers((prev) => ({
      ...prev,
      [qKey]: optionKey,
    }));
  };

  const handleResetSingleRetryQuestion = (qKey: string) => {
    setRetryAnswers((prev) => {
      const next = { ...prev };
      delete next[qKey];
      return next;
    });
    setRevealedRetryKeys((prev) => {
      const next = new Set(prev);
      next.delete(qKey);
      return next;
    });
  };

  const openReviewAI = useCallback((question: QuestionResult, mode: ReviewAIMode) => {
    reviewAIHostRef.current?.open(question, mode);
  }, []);

  const handleSubmitQuestionReport = async (question: QuestionResult, reportType: QuestionReportType, description: string) => {
    const questionId = question.question_id || question.id;
    if (!questionId || !result?.exam_id) {
      alert('Không đủ dữ liệu câu hỏi để báo lỗi.');
      return;
    }

    try {
      setReportSubmitting(true);
      await examApi.submitQuestionReport({
        question_id: questionId,
        exam_id: result.exam_id,
        report_type: reportType,
        description: description.trim() || undefined,
      });
      setReportedQuestionIds(prev => new Set(prev).add(questionId));
      setReportQuestion(null);
    } catch (error: any) {
      const message = error?.response?.status === 409
        ? 'Bạn đã báo lỗi câu này rồi.'
        : error?.response?.data?.message || 'Không thể gửi báo lỗi lúc này.';
      if (error?.response?.status === 409) {
        setReportedQuestionIds(prev => new Set(prev).add(questionId));
        setReportQuestion(null);
      }
      alert(message);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <InkResultBackground className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ead9bd] border-t-[#d52a1e]" />
          <p className={inkResultMuted}>Đang tải kết quả...</p>
        </div>
      </InkResultBackground>
    );
  }

  if (!result) {
    return (
      <InkResultBackground className="flex items-center justify-center">
        <div className={`rounded-3xl p-8 text-center ${inkResultPanel}`}>
          <p className={`mb-4 font-bold ${inkResultTitle}`}>Không tìm thấy kết quả bài thi</p>
          <button onClick={() => router.back()}
            className="px-6 py-2 bg-[#d52a1e] text-white rounded-lg hover:bg-[#b91f16]">
            Quay lại
          </button>
        </div>
      </InkResultBackground>
    );
  }

  if (result.review_locked) {
    const storedScore = Number(result.score_scale_100 ?? result.score_percentage);
    const possibleScore = Number(result.total_possible_score) || 0;
    const score = Number.isFinite(storedScore)
      ? Math.max(0, Math.min(100, storedScore))
      : possibleScore > 0
        ? Math.max(0, Math.min(100, (Number(result.total_score) || 0) / possibleScore * 100))
        : 0;

    return (
      <InkResultBackground>
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-4 py-8 sm:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-[#dfc8a5] bg-[#fffaf2]/80 px-4 py-2 text-sm font-bold text-[#6f563f] shadow-sm backdrop-blur hover:border-[#c99a50] hover:text-[#b9231a]"
          >
            <FiArrowLeft size={18} /> Quay lại
          </button>

          <section className={`relative overflow-hidden rounded-[32px] ${inkResultPanel}`}>
            <div className="h-2 bg-gradient-to-r from-[#7d1712] via-[#d52a1e] to-[#c99722]" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border-[32px] border-[#d52a1e]/[0.06]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full border-[38px] border-[#c99722]/[0.07]" />

            <div className="relative p-6 sm:p-9 lg:p-11">
              <div className="flex items-start gap-4 border-b border-[#ead9bd] pb-6">
                <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-sm bg-[#c91e16] text-xs font-black leading-none text-white shadow-[0_5px_0_rgba(151,30,23,0.14)]">
                  <span className="[writing-mode:vertical-rl]">考试成绩</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#b77b1f]">Kết quả phòng thi</p>
                  <h1 className={`mt-2 text-2xl font-black leading-tight sm:text-3xl ${inkResultTitle}`}>{result.exam_title}</h1>
                  <p className={`mt-2 text-sm font-semibold ${inkResultMuted}`}>{result.subject_name || 'CSCA'} · Bài đã được ghi nhận</p>
                </div>
              </div>

              <div className="grid gap-7 py-7 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                <div className="text-center md:border-r md:border-[#ead9bd] md:pr-8">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9d8a77]">Điểm của bạn</p>
                  <InkScoreMark value={score.toFixed(1)} />
                  <p className="text-lg font-black text-[#b9231a]">/100 điểm</p>
                  <div className="mx-auto mt-4 h-1.5 max-w-[220px] overflow-hidden rounded-full bg-[#eadfce]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#c99722] to-[#d52a1e]" style={{ width: `${score}%` }} />
                  </div>
                </div>

                <div className="rounded-3xl border border-[#e5cc9f] bg-[#fff7e9]/80 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d52a1e] text-white shadow-md shadow-red-900/10">
                      <FiClock size={18} />
                    </div>
                    <div>
                      <h2 className="font-black text-[#4f3521]">Đã nộp bài thành công</h2>
                      <p className="mt-1 text-sm font-medium leading-6 text-[#7d6957]">
                        Điểm đã được lưu. Đề, đáp án và phần giải thích sẽ mở sau khi phòng thi kết thúc để đảm bảo công bằng.
                      </p>
                    </div>
                  </div>
                  {result.exam_end_time && (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#d8b87f] bg-white/60 px-4 py-3 text-sm text-[#6f563f]">
                      <span className="font-black">Mở xem chi tiết:</span>{' '}
                      {new Date(result.exam_end_time).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 border-t border-[#ead9bd] pt-6 sm:grid-cols-3">
                <button type="button" onClick={() => router.push('/exam-room')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#d5b477] bg-[#fff8ec] px-4 py-3 text-sm font-black text-[#6f563f] transition hover:border-[#c99722] hover:text-[#b9231a]">
                  <FiAward size={17} /> Sảnh phòng thi
                </button>
                <button type="button" onClick={() => router.push('/lich-su?type=room')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#d5b477] bg-[#fff8ec] px-4 py-3 text-sm font-black text-[#6f563f] transition hover:border-[#c99722] hover:text-[#b9231a]">
                  <FiClock size={17} /> Lịch sử thi
                </button>
                <button type="button" onClick={() => router.push('/')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#bd2118] to-[#d52a1e] px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-900/15 transition hover:from-[#a91d16] hover:to-[#c3261c]">
                  <FiHome size={17} /> Về trang chủ
                </button>
              </div>
            </div>
          </section>
        </main>
      </InkResultBackground>
    );
  }

  const answers = result.answers ?? [];
  const baseLanguageMode = normalizeExamLanguageMode(result.language_mode || 'zh', 'zh');
  const baseExplanationMode = normalizeExplanationLanguageMode(result.explanation_language_mode || 'vi');
  const storedExamLang = typeof window !== 'undefined' ? localStorage.getItem('csca_selected_exam_lang') : null;
  const storedExplanationLang = typeof window !== 'undefined' ? localStorage.getItem('csca_selected_explanation_lang') : null;
  const languageMode = isLanguageSelectionAllowed(storedExamLang, baseLanguageMode, 'zh') && storedExamLang
    ? storedExamLang
    : baseLanguageMode;
  const explanationLanguageMode = isLanguageSelectionAllowed(storedExplanationLang, baseExplanationMode, 'vi') && storedExplanationLang
    ? storedExplanationLang
    : baseExplanationMode;
  const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
  const totalIncorrect = result.total_incorrect ?? answers.filter(a => a.selected_answer_key && a.is_correct === false).length;
  const totalUnanswered = result.total_unanswered ?? answers.filter(a => !a.selected_answer_key).length;
  const totalPending = Number(result.total_pending_grading) || 0;
  const total = result.total_questions || answers.length || 1;
  const rawScore = Number(result.total_score) || 0;
  const fallbackPossibleScore = answers.reduce((sum, answer) => sum + (Number(answer.points) || 0), 0) || total;
  const possibleScore = Number(result.total_possible_score) || fallbackPossibleScore;
  const storedPercentage = Number(result.score_percentage);
  const score100 = Number.isFinite(storedPercentage)
    ? Math.max(0, Math.min(100, storedPercentage))
    : Number.isFinite(Number(result.score_scale_100))
      ? Number(result.score_scale_100)
      : possibleScore > 0
        ? Math.max(0, Math.min(100, (rawScore / possibleScore) * 100))
        : (totalCorrect / total) * 100;
  const score10 = Number.isFinite(Number(result.score_scale_10))
    ? Number(result.score_scale_10)
    : score100 / 10;
  const accuracy = Math.round(score100);

  const gradeLabel = accuracy >= 85 ? 'Xuất sắc!' : accuracy >= 60 ? 'Đạt yêu cầu' : accuracy >= 40 ? 'Cần cố gắng' : 'Chưa đạt';
  const gradeChineseLabel = accuracy >= 85 ? '成绩优异' : accuracy >= 60 ? '顺利通过' : accuracy >= 40 ? '继续努力' : '再接再厉';

  // Pie chart data
  const pieData = [
    { name: 'Đúng', value: totalCorrect, color: '#22c55e' },
    { name: 'Sai', value: totalIncorrect, color: '#ef4444' },
    { name: 'Bỏ qua', value: totalUnanswered, color: '#9ca3af' },
    { name: 'Chờ chấm', value: totalPending, color: '#f59e0b' },
  ].filter(d => d.value > 0);
  const topicBreakdown = Object.values(
    answers.reduce<Record<string, { name: string; total: number; incorrect: number; correct: number }>>((acc, answer) => {
      const name = answer.topic_name || answer.question_category || answer.difficulty || 'Chưa phân loại';
      if (!acc[name]) acc[name] = { name, total: 0, incorrect: 0, correct: 0 };
      acc[name].total += 1;
      if (answer.is_correct) acc[name].correct += 1;
      else acc[name].incorrect += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.incorrect - a.incorrect);

  const indexedAnswers = answers.map((q, originalIndex) => ({
    q,
    originalIndex,
    status: getQuestionReviewStatus(q),
    qKey: getMistakeQuestionKey(q, originalIndex, result.exam_id || examId),
    isSavedInNotebook: isQuestionInMistakeNotebook(q, originalIndex),
  }));

  const filterCounts = {
    all: indexedAnswers.length,
    incorrect: indexedAnswers.filter((item) => item.status === 'incorrect').length,
    unanswered: indexedAnswers.filter((item) => item.status === 'unanswered').length,
    correct: indexedAnswers.filter((item) => item.status === 'correct').length,
    saved: indexedAnswers.filter((item) => item.isSavedInNotebook).length,
  };
  const notCorrectCount = filterCounts.incorrect + filterCounts.unanswered;

  const filteredReviewItems = indexedAnswers.filter((item) => {
    if (retryMistakeMode) {
      if (questionFilter === 'incorrect') return item.status === 'incorrect';
      if (questionFilter === 'unanswered') return item.status === 'unanswered';
      if (questionFilter === 'saved') return item.isSavedInNotebook;
      return item.status === 'incorrect' || item.status === 'unanswered';
    }
    if (questionFilter === 'incorrect') return item.status === 'incorrect';
    if (questionFilter === 'unanswered') return item.status === 'unanswered';
    if (questionFilter === 'correct') return item.status === 'correct';
    if (questionFilter === 'saved') return item.isSavedInNotebook;
    return true;
  });

  const retryAttemptedCount = filteredReviewItems.filter(
    (item) => Boolean(retryAnswers[item.qKey]) || revealedRetryKeys.has(item.qKey)
  ).length;
  const retryCorrectCount = filteredReviewItems.filter((item) => {
    const picked = retryAnswers[item.qKey];
    if (!picked) return false;
    const matchedOpt = (item.q.options ?? []).find((o) => o.key === picked);
    return Boolean(matchedOpt?.is_correct || picked === item.q.correct_answer_key);
  }).length;

  return (
    <InkResultBackground>
      <AiAnalyzingOverlay open={!result.is_room_exam && aiLoading && !aiAnalysis} mode="exam" compactAfterMs={2600} />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
      <div className="sticky top-0 z-[60] flex items-center gap-3 border-b border-[#d9bd8c]/80 bg-[#fffaf2]/92 px-4 py-3 backdrop-blur-md no-print dark:border-gray-800 dark:bg-gray-900/95">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#6f563f] transition-colors hover:bg-[#f7e8d3] hover:text-[#b9231a] dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-rose-400"
        >
          <FiArrowLeft size={18} /> Quay lại
        </button>
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#c91e16] text-[10px] font-black text-white shadow-sm">榜</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b77b1f]">考试结果</p>
            <p className="text-xs font-black text-[#4f3521] dark:text-slate-100">Kết quả bài thi</p>
          </div>
        </div>
        <div className="flex-1" />
        {result?.allow_download && (
          <a
            href={`/exam/${result.exam_id}/print`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#fffaf2]/75 border border-[#ead9bd]/80 text-[#6f563f] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 rounded-lg hover:bg-[#fff8ec] dark:hover:bg-gray-750 text-xs font-medium shadow-sm no-print"
          >
            <FiPrinter size={14} /> Tải đề PDF
          </a>
        )}
        {result.has_solution_file && (
          <button
            type="button"
            onClick={openSolutionComparison}
            disabled={openingSolution}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-bold shadow-sm no-print disabled:cursor-not-allowed disabled:opacity-60"
          >
            {openingSolution ? <FiRefreshCw className="animate-spin" size={14} /> : <FiBookOpen size={14} />}
            {openingSolution ? 'Đang tải...' : 'So sánh đề & lời giải'}
          </button>
        )}
      </div>
      <main className="container mx-auto max-w-[1360px] px-4 py-6">

        {/* Tab Navigation */}
        <div className="mb-6 flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-2xl border-2 border-[#d6b477] bg-[#fff7e8] p-1.5 shadow-[0_12px_34px_rgba(129,77,33,0.22)] no-print dark:border-[#d6b477] dark:bg-[#fff7e8]">
          {[
            { key: 'result', label: '📊 Kết quả', icon: FiBarChart2 },
            { key: 'review', label: '📝 Xem lại bài', icon: FiPrinter },
            ...(!result.is_room_exam ? [{ key: 'chat', label: '🤖 Hỏi AI', icon: FiMessageCircle }] : []),
          ].map(tab => (
            <button key={tab.key}
              onClick={() => {
                if (tab.key === 'chat') openChatTab();
                else setActiveTab(tab.key as any);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-[#b9231a] to-[#d52a1e] text-white shadow-lg shadow-red-900/15'
                  : 'text-[#563822] hover:bg-[#f2dfc2] hover:text-[#a91d16] dark:text-[#563822] dark:hover:bg-[#f2dfc2] dark:hover:text-[#a91d16]'
              }`}>
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {result.has_solution_file && (
          <section className="relative mb-6 overflow-hidden rounded-3xl border-2 border-[#d6b477] bg-gradient-to-br from-[#fff0df] via-[#fffaf2] to-[#f7ead1] p-5 shadow-[0_18px_45px_rgba(129,77,33,0.15)] dark:border-amber-700/50 dark:from-amber-950/45 dark:via-slate-950 dark:to-red-950/30 dark:shadow-none sm:p-7">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border-[20px] border-[#d52a1e]/[0.06]" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a91d16] to-[#d52a1e] text-white shadow-lg shadow-red-900/20 sm:h-16 sm:w-16">
                  <FiBookOpen size={30} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b77b1f] dark:text-amber-300">参考答案 · Đã có lời giải</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-[#4f3521] dark:text-white sm:text-3xl">Đối chiếu đề và lời giải PDF</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={openSolutionComparison}
                disabled={openingSolution}
                className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b9231a] to-[#d52a1e] px-6 py-4 text-base font-black text-white shadow-lg shadow-red-900/20 transition hover:from-[#a51e17] hover:to-[#c4261c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {openingSolution ? <FiRefreshCw className="animate-spin" size={20} /> : <FiFileText size={20} />}
                {openingSolution ? 'Đang tải hai file...' : 'Xem lời giải ngay'}
              </button>
            </div>
          </section>
        )}

        {/* ── TAB: KẾT QUẢ + AI PHÂN TÍCH ── */}
        {activeTab === 'result' && (
          <div className="space-y-5">

            {/* Top Section: Score + Pie + Guidance */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.08fr_0.92fr_1fr]">

              {/* Left: Score Card */}
              <div className={`relative overflow-hidden rounded-[28px] border-2 border-[#d6b477] p-6 transition-all hover:shadow-[0_28px_80px_rgba(129,77,33,0.20)] ${inkResultPanel}`}>
                <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full border-[24px] border-[#d52a1e]/[0.05]" />
                <div className="pointer-events-none absolute left-5 top-5 h-5 w-5 border-l-2 border-t-2 border-[#c99722]/60" />
                <div className="pointer-events-none absolute bottom-5 right-5 h-5 w-5 border-b-2 border-r-2 border-[#c99722]/60" />
                <div className="relative mb-4 text-center">
                  <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-[#d8b87f] bg-[#fff7e9]/85 px-3 py-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#c91e16] text-[9px] font-black text-white">考</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9a681c]">考试成绩 · Kết quả</span>
                  </div>
                  <p className={`mx-auto line-clamp-2 max-w-sm text-sm font-black leading-5 ${inkResultTitle}`}>{result.exam_title}</p>
                  <InkScoreMark value={score100.toFixed(1)} />
                  <p className={`text-lg font-black sm:text-xl ${inkResultScore}`}>/100 điểm</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full bg-[#d52a1e] px-3 py-1.5 text-xs font-black text-white shadow-sm">{gradeChineseLabel}</span>
                    <span className="rounded-full border border-[#d8b87f] bg-[#fff7e9] px-3 py-1.5 text-xs font-black text-[#9a681c]">{gradeLabel}</span>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ead9bd]/80 bg-[#f7efe4]/75 px-4 py-2 text-sm font-black text-[#6f563f]">
                    <span>Thang 10</span>
                    <span className={inkResultScore}>{score10.toFixed(2)}/10</span>
                  </div>
                </div>
                <div className="mb-3 h-3 w-full overflow-hidden rounded-full border border-[#ddc498]/70 bg-[#e8ddd1]/85">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c99722] via-[#dc6e2c] to-[#d52a1e] transition-all duration-700"
                    style={{ width: `${accuracy}%` }} />
                </div>
                <p className={`text-center text-sm font-bold ${inkResultMuted}`}>
                  Hoàn thành <span className={inkResultScore}>{accuracy}%</span> tổng điểm
                </p>
                <div className={`mt-4 flex items-center justify-center gap-2 text-xs ${inkResultMuted}`}>
                  <FiClock size={12} />
                  <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Đúng', value: totalCorrect, tone: 'bg-[#f3f7ea]/80 text-[#53752e] border-[#cfdbb9]' },
                    { label: 'Sai', value: totalIncorrect, tone: 'bg-[#fff0eb]/80 text-[#b9231a] border-[#efc3b8]' },
                    { label: 'Bỏ qua', value: totalUnanswered, tone: 'bg-[#f4eee5]/80 text-[#786653] border-[#dfd0bd]' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-2xl border px-3 py-2 text-center ${item.tone}`}>
                      <p className="text-lg font-black leading-none">{item.value}</p>
                      <p className="mt-1 text-[11px] font-bold">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#ead9bd]/85 bg-[#fff8ec]/78 px-4 py-3">
                  <p className={`text-xs font-black uppercase tracking-wide ${inkResultScore}`}>Gợi ý nhanh</p>
                  <p className={`mt-1 text-xs font-medium leading-5 ${inkResultTitle}`}>
                    {totalIncorrect > 0
                      ? result.is_room_exam
                        ? `Ưu tiên đối chiếu lại ${totalIncorrect} câu sai với đề PDF và đáp án.`
                        : `Ưu tiên xem lại ${totalIncorrect} câu sai trước, rồi hỏi AI giải thích từng lỗi.`
                      : totalUnanswered > 0
                        ? `Bạn còn ${totalUnanswered} câu bỏ qua, nên luyện cách suy luận nhanh.`
                        : 'Bài này khá ổn, hãy củng cố dấu hiệu nhận biết để giữ phong độ.'}
                  </p>
                </div>
              </div>

              {/* Middle: Pie Chart */}
              <div className={`flex flex-col items-center justify-start rounded-[28px] p-6 transition-all hover:shadow-[0_20px_60px_rgba(129,77,33,0.14)] ${inkResultSoftPanel}`}>
                <div className="mb-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b77b1f]">答题概览</p>
                  <p className={`mt-1 text-xs font-bold uppercase tracking-wider ${inkResultMuted}`}>Phân bố đáp án</p>
                </div>
                <div className="relative" style={{ width: '160px', height: '160px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [`${value} câu`, name]}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className={`text-2xl font-black ${inkResultTitle}`}>{total}</p>
                    <p className={`text-xs ${inkResultMuted}`}>câu</p>
                  </div>
                </div>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className={`text-xs ${inkResultMuted}`}>{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 w-full space-y-3">
                  {[
                    { label: 'Đúng', value: totalCorrect, color: 'bg-emerald-500' },
                    { label: 'Sai', value: totalIncorrect, color: 'bg-rose-500' },
                    { label: 'Bỏ qua', value: totalUnanswered, color: 'bg-slate-400' },
                  ].map((item) => {
                    const percent = Math.round((item.value / total) * 100);
                    return (
                      <div key={item.label}>
                          <div className={`mb-1 flex items-center justify-between text-xs font-bold ${inkResultMuted}`}>
                          <span>{item.label}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#e8ddd1]/85">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Guidance Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className={`text-xs font-bold uppercase tracking-wider ${inkResultMuted}`}>Bước tiếp theo</p>
                  <span className="text-xs font-black tracking-[0.18em] text-[#b77b1f]">下一步</span>
                </div>

                <button
                  onClick={() => setActiveTab('review')}
                  className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 hover:border-[#c99722] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9f1d16] to-[#d52a1e] shadow-md shadow-red-900/15 transition-transform duration-200 group-hover:scale-105">
                      <FiBookOpen className="text-white" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#4f3521] transition-colors group-hover:text-[#b9231a] dark:text-white">Xem lại bài</p>
                      <p className={`mt-0.5 truncate text-xs ${inkResultMuted}`}>Kiểm tra đáp án và giải thích từng câu</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>

                {!result.is_room_exam && <button
                  onClick={openChatTab}
                  className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 hover:border-[#c99722] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#665347] to-[#92745d] shadow-md shadow-stone-900/10 transition-transform duration-200 group-hover:scale-105">
                      <FiCpu className="text-white" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#4f3521] transition-colors group-hover:text-[#b9231a] dark:text-white">Hỏi AI</p>
                      <p className={`mt-0.5 truncate text-xs ${inkResultMuted}`}>Nhờ AI giải thích và gợi ý cách làm</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>}

                {result.is_room_exam && <button
                  onClick={() => router.push('/lich-su?type=room')}
                  className="group w-full rounded-2xl border border-[#d5b477] bg-gradient-to-r from-[#fff4df]/95 to-[#fffaf2]/90 p-4 text-left shadow-[0_10px_28px_rgba(154,104,28,0.10)] transition-all duration-200 hover:border-[#c99722] hover:shadow-md dark:border-amber-800/60 dark:from-amber-950/35 dark:to-slate-900"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b77b1f] to-[#d5a03b] text-white shadow-md shadow-amber-900/15 transition-transform duration-200 group-hover:scale-105">
                      <FiClock size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#6f451b] transition-colors group-hover:text-[#b9231a] dark:text-amber-100">Lịch sử thi của tôi</p>
                      <p className="mt-0.5 truncate text-xs text-[#9a7956] dark:text-amber-200/70">Tìm lại các kỳ thi đã tham gia</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>}

                <button
                  onClick={() => router.push(result.is_room_exam ? '/exam-room' : isTopicPracticeSource ? topicPracticeHref : '/')}
                  className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 hover:border-[#c99722] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#56734a] to-[#789264] shadow-md shadow-green-900/15 transition-transform duration-200 group-hover:scale-105">
                      {result.is_room_exam ? <FiAward className="text-white" size={16} /> : <FiCheckCircle className="text-white" size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#4f3521] transition-colors group-hover:text-[#b9231a] dark:text-white">{result.is_room_exam ? 'Về sảnh phòng thi' : isTopicPracticeSource ? 'Về chủ đề' : 'Làm bài mới'}</p>
                      <p className={`mt-0.5 truncate text-xs ${inkResultMuted}`}>{result.is_room_exam ? 'Xem lịch thi và bảng xếp hạng' : isTopicPracticeSource ? 'Chọn đề khác trong cùng chủ đề' : 'Tiếp tục luyện tập với đề khác'}</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>

                {!result.is_room_exam && <button
                  onClick={handleCreateWrongPractice}
                  disabled={actionLoading === 'wrong'}
                  className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 hover:border-[#c99722] hover:shadow-md disabled:opacity-60 ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#c7522f] to-[#d97943] shadow-md shadow-orange-900/15 transition-transform duration-200 group-hover:scale-105">
                      <FiRotateCw className="text-white" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#4f3521] transition-colors group-hover:text-[#b9231a] dark:text-white">Luyện lại 20 câu sai</p>
                      <p className={`mt-0.5 truncate text-xs ${inkResultMuted}`}>Tạo bộ luyện từ các câu thường sai</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>}

                {!result.is_room_exam && <button
                  onClick={handleCreateWeakTopicPractice}
                  disabled={actionLoading === 'weak-topic'}
                  className={`group w-full rounded-2xl p-4 text-left transition-all duration-200 hover:border-[#c99722] hover:shadow-md disabled:opacity-60 ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b77b1f] to-[#d5a03b] shadow-md shadow-amber-900/15 transition-transform duration-200 group-hover:scale-105">
                      <FiBarChart2 className="text-white" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#4f3521] transition-colors group-hover:text-[#b9231a] dark:text-white">Luyện chủ đề yếu</p>
                      <p className={`mt-0.5 truncate text-xs ${inkResultMuted}`}>Tập trung vào nhóm kiến thức sai nhiều</p>
                    </div>
                    <span className="text-sm font-bold text-[#c99722] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </button>}

                {/* Quick Links */}
                <div className="border-t border-[#ead9bd]/70 pt-2">
                  <button
                    onClick={() => router.push(result.is_room_exam ? '/' : '/lich-su')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#7d6957] transition hover:bg-[#f7e8d3] hover:text-[#b9231a] dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-rose-400"
                  >
                    {result.is_room_exam ? <><FiHome size={14} /> Về trang chủ</> : <><FiClock size={14} /> Xem lịch sử làm bài</>}
                  </button>
                </div>
              </div>
            </div>

            {/* 📓 Sổ Tay Câu Sai & Ôn Tập Thông Minh — Quick Banner on Result Tab */}
            {answers.length > 0 && (
              <div className="relative overflow-hidden rounded-[26px] border-2 border-[#d6b477] bg-gradient-to-br from-[#fffaf2] via-[#fff5e4] to-[#f9ebd2] p-5 shadow-[0_14px_38px_rgba(129,77,33,0.12)] dark:border-amber-700/50 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#d8b87f] bg-[#fff7e9] px-3 py-1 text-xs font-black text-[#9a681c] dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-300">
                      <span>📓 Sổ Tay Câu Sai &amp; Ôn Tập Thông Minh</span>
                      <span className="text-[#c99722]">· Mistake Notebook</span>
                    </div>
                    <h2 className="text-lg font-black text-[#4f3521] dark:text-white sm:text-xl">
                      {notCorrectCount > 0
                        ? `Bạn có ${notCorrectCount} câu chưa đúng (${filterCounts.incorrect} câu sai, ${filterCounts.unanswered} câu bỏ trống)`
                        : 'Tuyệt vời! Bạn đã làm đúng toàn bộ các câu hỏi trong đề này'}
                    </h2>
                    <p className="text-xs font-medium text-[#7d6957] dark:text-slate-300">
                      Lưu các câu dễ nhầm vào Sổ tay cá nhân hoặc bật chế độ ẩn đáp án để tự kiểm tra lại ngay trên trang kết quả.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {notCorrectCount > 0 && (
                      <button
                        type="button"
                        onClick={handleStartQuickRetryMistakes}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#b9231a] to-[#d52a1e] px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-900/20 transition hover:from-[#a31d15] hover:to-[#c1241a] sm:text-sm"
                      >
                        <FiZap size={16} />
                        ⚡ Ôn tập lại ngay {notCorrectCount} câu chưa đúng
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('review');
                        setRetryMistakeMode(false);
                        setQuestionFilter('saved');
                        window.setTimeout(() => {
                          reviewSectionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#d5b477] bg-[#fffaf2] px-4 py-3 text-xs font-black text-[#6f451b] transition hover:border-[#c99722] hover:bg-[#fff3de] dark:border-amber-700/60 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700 sm:text-sm"
                    >
                      <FiStar size={15} className="text-amber-500" />
                      ⭐ Đã lưu vào Sổ tay câu sai ({filterCounts.saved})
                    </button>
                  </div>
                </div>

                {/* Quick Filter Pills */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#ead9bd]/80 pt-3.5 dark:border-slate-800">
                  {[
                    { key: 'all' as SmartQuestionFilter, label: `Tất cả (${filterCounts.all})` },
                    { key: 'incorrect' as SmartQuestionFilter, label: `❌ Câu làm sai (${filterCounts.incorrect})` },
                    { key: 'unanswered' as SmartQuestionFilter, label: `⚪ Câu bỏ trống (${filterCounts.unanswered})` },
                    { key: 'correct' as SmartQuestionFilter, label: `✅ Câu làm đúng (${filterCounts.correct})` },
                    { key: 'saved' as SmartQuestionFilter, label: `⭐ Đã lưu vào Sổ tay câu sai (${filterCounts.saved})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setQuestionFilter(tab.key);
                        if (tab.key === 'correct' || tab.key === 'all') {
                          setRetryMistakeMode(false);
                        }
                        setActiveTab('review');
                        window.setTimeout(() => {
                          reviewSectionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                      }}
                      className="rounded-xl border border-[#dfcba8] bg-white/85 px-3 py-1.5 text-xs font-bold text-[#5c432d] transition hover:border-[#b9231a] hover:text-[#b9231a] dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:border-amber-500 dark:hover:text-amber-300"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis — chỉ VIP/Pre */}
            {topicBreakdown.length > 0 && (
              <div className={`rounded-[24px] p-6 ${inkResultSoftPanel}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Thống kê theo chủ đề</p>
                    <h2 className="text-lg font-black text-gray-900">Nhóm kiến thức cần ưu tiên</h2>
                  </div>
                  <button
                    onClick={() => router.push('/lich-su/thong-ke')}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Xem chi tiết
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {topicBreakdown.slice(0, 6).map((topic) => {
                    const errorRate = Math.round((topic.incorrect / Math.max(topic.total, 1)) * 100);
                    return (
                      <div key={topic.name} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold text-gray-900">{topic.name}</p>
                          <span className="text-xs font-black text-red-600">{errorRate}% sai</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#fffaf2]/80">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${errorRate}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Sai {topic.incorrect}/{topic.total} câu</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!result.is_room_exam && (hasAIAccess ? (
              <AIExamAnalysis
                attemptId={result.id}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                onRefresh={() => loadAIAnalysis(result.id)}
                previousAttempt={previousAttempt}
                onAiLoaded={() => setAiLoaded(true)}
              />
            ) : (
              <PremiumGate type="ai">
                <div />
              </PremiumGate>
            ))}
          </div>
        )}

        {/* ── TAB: XEM LẠI BÀI ── */}
        {activeTab === 'review' && (
          <div ref={reviewSectionAnchorRef} className="scroll-mt-20 space-y-5">
            {answers.length === 0 ? (
              <div className={`rounded-2xl p-10 text-center ${inkResultMuted} ${inkResultSoftPanel}`}>
                <p className="text-lg">Không có dữ liệu câu hỏi chi tiết</p>
              </div>
            ) : (
              <>
                {/* 📓 Sổ Tay Câu Sai & Ôn Tập Thông Minh (Mistake Notebook) Control Panel */}
                <section className="rounded-[26px] border-2 border-[#d6b477] bg-gradient-to-br from-[#fffaf2] via-[#fff6e6] to-[#f8ead0] p-5 shadow-[0_14px_38px_rgba(129,77,33,0.12)] no-print dark:border-amber-700/50 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/25 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#d8b87f] bg-[#fff7e9] px-3 py-1 text-xs font-black text-[#9a681c] dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-300">
                        <span>📓 Sổ Tay Câu Sai &amp; Ôn Tập Thông Minh</span>
                        <span className="text-[#c99722]">· Mistake Notebook</span>
                      </div>
                      <h2 className="mt-2 text-lg font-black text-[#4f3521] dark:text-white sm:text-xl">
                        Bộ lọc câu hỏi thông minh &amp; Tự kiểm tra lại câu sai
                      </h2>
                      <p className="mt-0.5 text-xs font-medium text-[#7d6957] dark:text-slate-300">
                        Lọc nhanh theo trạng thái bài làm, lưu câu khó vào Sổ tay câu sai hoặc ẩn đáp án để tự làm lại ngay trên trang.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {notCorrectCount > 0 && (
                        <button
                          type="button"
                          onClick={handleToggleRetryMistakeMode}
                          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all sm:text-sm ${
                            retryMistakeMode
                              ? 'bg-gradient-to-r from-amber-600 to-red-600 text-white shadow-lg shadow-red-900/25 ring-2 ring-amber-300 dark:ring-amber-500/50'
                              : 'border-2 border-[#d52a1e] bg-white text-[#b9231a] hover:bg-[#fff0eb] dark:border-rose-500 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          <FiZap size={16} />
                          {retryMistakeMode
                            ? `⚡ Đang bật: Ôn tập lại các câu chưa đúng (Ẩn đáp án để tự làm lại)`
                            : `⚡ Ôn tập lại các câu chưa đúng (Ẩn đáp án để tự làm lại)`}
                        </button>
                      )}

                      {notCorrectCount > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveAllMistakesToNotebook}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-[#d5b477] bg-[#fffaf2] px-3.5 py-2.5 text-xs font-black text-[#6f451b] transition hover:border-[#c99722] hover:bg-[#fff2d9] dark:border-amber-700/60 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
                        >
                          <FiStar size={14} className="text-amber-500" />
                          ⭐ Lưu tất cả {notCorrectCount} câu chưa đúng vào Sổ tay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Smart Question Filter Tabs */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#ead9bd]/80 pt-4 dark:border-slate-800">
                    {[
                      { key: 'all' as SmartQuestionFilter, label: `Tất cả (${filterCounts.all})` },
                      { key: 'incorrect' as SmartQuestionFilter, label: `❌ Câu làm sai (${filterCounts.incorrect})` },
                      { key: 'unanswered' as SmartQuestionFilter, label: `⚪ Câu bỏ trống (${filterCounts.unanswered})` },
                      { key: 'correct' as SmartQuestionFilter, label: `✅ Câu làm đúng (${filterCounts.correct})` },
                      { key: 'saved' as SmartQuestionFilter, label: `⭐ Đã lưu vào Sổ tay câu sai (${filterCounts.saved})` },
                    ].map((tab) => {
                      const isActive = questionFilter === tab.key && !(retryMistakeMode && tab.key === 'all');
                      const isRetryAllWrongActive = retryMistakeMode && tab.key === 'all' && questionFilter === 'all';
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setQuestionFilter(tab.key);
                            if (tab.key === 'correct' || tab.key === 'all') {
                              setRetryMistakeMode(false);
                            }
                          }}
                          className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all sm:text-sm ${
                            isActive
                              ? 'bg-gradient-to-r from-[#b9231a] to-[#d52a1e] text-white shadow-md shadow-red-900/15'
                              : isRetryAllWrongActive
                                ? 'border border-amber-400 bg-amber-100/80 text-amber-900 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
                                : 'border border-[#dfcba8] bg-white/90 text-[#5c432d] hover:border-[#c99722] hover:bg-[#fff7e8] dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:border-amber-500'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Retry Mistake Mode Banner */}
                  {retryMistakeMode && (
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/80 to-rose-50/70 p-4 dark:border-amber-700/70 dark:from-amber-950/50 dark:via-slate-900 dark:to-rose-950/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
                          🔥 Tự Kiểm Tra Lại Các Câu Sai (Retry Mistake Mode)
                        </p>
                        <p className="text-xs font-medium text-amber-900/90 dark:text-slate-200 sm:text-sm">
                          Đáp án đúng và giải thích đã được ẩn. Hãy click trực tiếp vào đáp án <strong>A, B, C, D</strong> ở từng câu bên dưới để tự kiểm tra lại!
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <div className="rounded-xl border border-amber-300 bg-white/90 px-3 py-1.5 text-xs font-black text-amber-900 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200">
                          Đã làm lại: {retryAttemptedCount}/{filteredReviewItems.length} · Đúng: <span className="text-emerald-600 dark:text-emerald-400">{retryCorrectCount}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRetryAnswers({});
                            setRevealedRetryKeys(new Set());
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
                        >
                          <FiRotateCw size={13} /> Làm mới lượt thử
                        </button>
                        <button
                          type="button"
                          onClick={() => setRetryMistakeMode(false)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
                        >
                          Hiện tất cả đáp án
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {filteredReviewItems.length === 0 ? (
                  <div className={`rounded-2xl p-10 text-center ${inkResultSoftPanel}`}>
                    <p className={`text-base font-bold ${inkResultTitle}`}>
                      {questionFilter === 'saved'
                        ? 'Bạn chưa lưu câu hỏi nào vào Sổ tay câu sai trong đề này.'
                        : questionFilter === 'incorrect'
                          ? 'Tuyệt vời! Không có câu làm sai nào trong mục này.'
                          : questionFilter === 'unanswered'
                            ? 'Bạn không bỏ trống câu hỏi nào.'
                            : 'Không có câu hỏi nào khớp với bộ lọc hiện tại.'}
                    </p>
                    <p className={`mt-1 text-xs ${inkResultMuted}`}>
                      Hãy bấm nút &ldquo;⭐ Lưu vào Sổ Tay Câu Sai&rdquo; trên từng câu hỏi hoặc chuyển sang bộ lọc khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionFilter('all');
                        setRetryMistakeMode(false);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#d52a1e] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#b91f16]"
                    >
                      Xem tất cả ({filterCounts.all})
                    </button>
                  </div>
                ) : (
                  filteredReviewItems.map(({ q, originalIndex, status, qKey, isSavedInNotebook }, filteredIdx) => {
                    const isEssayQuestion = q.question_type === 'essay' || q.question_type === 'translation';
                    const questionId = q.question_id || q.id;
                    const isReported = Boolean(questionId && reportedQuestionIds.has(questionId));

                    const retryPickedKey = retryAnswers[qKey] || null;
                    const isManuallyRevealed = revealedRetryKeys.has(qKey);
                    const isRevealedInRetry = Boolean(retryPickedKey) || isManuallyRevealed;
                    const hideAnswersForRetry = retryMistakeMode && !isRevealedInRetry;

                    const retryPickedOption = retryPickedKey
                      ? (q.options ?? []).find((o) => o.key === retryPickedKey)
                      : undefined;
                    const isRetryCorrect = retryPickedKey
                      ? Boolean(retryPickedOption?.is_correct || retryPickedKey === q.correct_answer_key)
                      : false;

                    const borderCls = hideAnswersForRetry
                      ? 'bg-amber-50/40 border-amber-300 dark:bg-slate-900/90 dark:border-amber-700/60'
                      : retryMistakeMode && retryPickedKey
                        ? isRetryCorrect
                          ? 'bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/25 dark:border-emerald-800/70'
                          : 'bg-rose-50/80 border-rose-300 dark:bg-rose-950/25 dark:border-rose-800/70'
                        : getReviewCardClass(status);

                    const showPassage =
                      Boolean(q.passage_text) &&
                      (filteredIdx === 0 || filteredReviewItems[filteredIdx - 1]?.q.passage_text !== q.passage_text);

                    return (
                      <div key={qKey} className={`rounded-xl border-2 p-5 transition-all ${borderCls}`}>

                        {/* Passage */}
                        {showPassage && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 dark:bg-purple-950/25 dark:border-purple-900/60">
                            <p className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide dark:text-purple-200">Đoạn văn</p>
                            <p className="text-gray-800 leading-relaxed dark:text-gray-100">{q.passage_text}</p>
                          </div>
                        )}

                        {/* Question Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="flex-shrink-0 mt-0.5">
                            {hideAnswersForRetry ? (
                              <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-amber-500 bg-amber-100 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                ?
                              </div>
                            ) : retryMistakeMode && retryPickedKey ? (
                              isRetryCorrect ? (
                                <FiCheckCircle className="text-emerald-600 dark:text-emerald-400" size={22} />
                              ) : (
                                <FiXCircle className="text-rose-600 dark:text-rose-400" size={22} />
                              )
                            ) : (
                              <>
                                {status === 'correct' && <FiCheckCircle className="text-green-600" size={22} />}
                                {status === 'incorrect' && <FiXCircle className="text-red-600" size={22} />}
                                {status === 'unanswered' && <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300" />}
                              </>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
                                Câu {q.sub_question_number || q.question_number || originalIndex + 1}
                                {q.difficulty && (
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    q.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' :
                                    q.difficulty === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                                    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                  }`}>
                                    {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'hard' ? 'Khó' : 'TB'}
                                  </span>
                                )}
                              </span>
                              {!hideAnswersForRetry && status === 'incorrect' && q.selected_answer_key && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded dark:bg-red-950/40 dark:text-red-300">
                                  Bạn: {q.selected_answer_key}
                                </span>
                              )}
                              {hideAnswersForRetry && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold dark:bg-amber-950/60 dark:text-amber-300">
                                  🔥 Đang ẩn đáp án · Hãy chọn lại
                                </span>
                              )}
                              {(q.topic_name || q.question_category) && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded dark:bg-slate-800 dark:text-slate-300">
                                  {q.topic_name || q.question_category}
                                </span>
                              )}
                              <span className="ml-auto text-xs text-gray-400">{q.points} điểm</span>
                            </div>
                            <BilingualMathText
                              primary={q.question_text}
                              secondary={q.question_text_cn}
                              tertiary={q.question_text_en}
                              languageMode={languageMode}
                              className="exam-math-readable text-gray-900 font-medium leading-relaxed dark:text-gray-100"
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleMistakeNotebook(q, originalIndex)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                                  isSavedInNotebook
                                    ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200'
                                    : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                <FiStar size={13} className={isSavedInNotebook ? 'fill-amber-500 text-amber-500' : 'text-amber-500'} />
                                {isSavedInNotebook ? '⭐ Đã lưu vào Sổ Tay Câu Sai' : '⭐ Lưu vào Sổ Tay Câu Sai'}
                              </button>

                              <button
                                type="button"
                                onClick={() => setReportQuestion(q)}
                                disabled={!questionId || isReported}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                                  isReported
                                    ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                {isReported ? <FiCheckCircle size={13} /> : <FiFlag size={13} />}
                                {isReported ? 'Đã báo lỗi' : 'Báo lỗi'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-2 ml-8">
                          {(q.options ?? []).map((opt) => {
                            const isCorrect = opt.is_correct || opt.key === q.correct_answer_key;
                            const isOriginalUserPick = q.selected_answer_key === opt.key;
                            const isRetryUserPick = retryPickedKey === opt.key;

                            if (hideAnswersForRetry) {
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => handleSelectRetryOption(qKey, opt.key)}
                                  className="group flex w-full items-start gap-2.5 rounded-lg border-2 border-gray-200 bg-white p-3 text-left transition-all hover:border-amber-500 hover:bg-amber-50/70 dark:border-gray-700 dark:bg-gray-900/80 dark:hover:border-amber-500 dark:hover:bg-amber-950/30"
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-xs font-black text-gray-700 transition-colors group-hover:border-amber-500 group-hover:bg-amber-500 group-hover:text-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                                    {opt.key}
                                  </span>
                                  <div className="flex-1 pt-0.5">
                                    <BilingualMathText
                                      primary={opt.text}
                                      secondary={opt.text_cn}
                                      tertiary={opt.text_en}
                                      languageMode={languageMode}
                                      className="exam-math-readable text-sm text-gray-800 dark:text-gray-100"
                                      secondaryClassName="mt-1 text-xs text-gray-500 dark:text-gray-400"
                                    />
                                  </div>
                                  <span className="ml-auto self-center text-xs font-bold text-amber-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-400">
                                    Chọn {opt.key} →
                                  </span>
                                </button>
                              );
                            }

                            const effectiveUserPick = retryMistakeMode && retryPickedKey ? isRetryUserPick : isOriginalUserPick;
                            const tone = getOptionToneClass(isCorrect, effectiveUserPick);

                            return (
                              <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${tone.bg} ${tone.border}`}>
                                <span className={`font-bold text-sm shrink-0 ${tone.text}`}>{opt.key}.</span>
                                <div className="flex-1">
                                  <BilingualMathText
                                    primary={opt.text}
                                    secondary={opt.text_cn}
                                    tertiary={opt.text_en}
                                    languageMode={languageMode}
                                    className={`exam-math-readable text-sm ${tone.text}`}
                                    secondaryClassName={`mt-1 text-xs ${tone.secondary}`}
                                  />
                                </div>
                                <div className="ml-auto flex flex-wrap items-center gap-1.5 shrink-0">
                                  {isCorrect && (
                                    <span className="text-green-700 font-bold text-xs dark:text-green-300">✓ Đúng</span>
                                  )}
                                  {retryMistakeMode && isRetryUserPick && !isCorrect && (
                                    <span className="text-red-700 font-bold text-xs dark:text-red-300">✗ Bạn vừa chọn</span>
                                  )}
                                  {!retryMistakeMode && isOriginalUserPick && !isCorrect && (
                                    <span className="text-red-700 font-bold text-xs dark:text-red-300">✗ Bạn chọn</span>
                                  )}
                                  {retryMistakeMode && isOriginalUserPick && (
                                    <span className="rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                      Lần thi: {opt.key}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Retry Result Feedback Banner */}
                          {retryMistakeMode && retryPickedKey && (
                            <div
                              className={`mt-3 flex flex-col gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                                isRetryCorrect
                                  ? 'border-emerald-300 bg-emerald-100/80 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                                  : 'border-rose-300 bg-rose-100/80 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
                              }`}
                            >
                              <div className="text-xs font-bold sm:text-sm">
                                {isRetryCorrect ? (
                                  <span>
                                    🎉 Chính xác! Bạn đã chọn đúng đáp án <strong>{retryPickedKey}</strong> trong lần tự kiểm tra lại.
                                  </span>
                                ) : (
                                  <span>
                                    ❌ Chưa đúng! Bạn vừa chọn <strong>{retryPickedKey}</strong>, đáp án đúng là{' '}
                                    <strong>{q.correct_answer_key}</strong>. Xem kỹ giải thích chi tiết bên dưới nhé!
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleResetSingleRetryQuestion(qKey)}
                                className="inline-flex w-fit shrink-0 items-center gap-1 rounded-lg border border-current/25 bg-white/80 px-2.5 py-1 text-xs font-black transition hover:bg-white dark:bg-slate-900/70"
                              >
                                <FiRotateCw size={12} /> Chọn lại câu này
                              </button>
                            </div>
                          )}

                          {!hideAnswersForRetry && !q.selected_answer_key && (
                            <p className="text-sm text-gray-400 italic dark:text-gray-500">
                              Bạn đã bỏ qua · Đáp án đúng: <strong className="text-gray-600 dark:text-gray-300">{q.correct_answer_key}</strong>
                            </p>
                          )}
                        </div>

                        {/* Essay/Translation answer display */}
                        {isEssayQuestion && !hideAnswersForRetry && (
                          <div className="mt-4 ml-8 space-y-3">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 dark:bg-indigo-950/25 dark:border-indigo-900/60">
                              <p className="text-xs font-bold text-indigo-700 mb-1 dark:text-indigo-200">✍️ Câu trả lời của bạn</p>
                              <RichMathText value={q.selected_answer_text || 'Chưa trả lời'} className="text-sm text-gray-800 leading-relaxed dark:text-gray-100" />
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 dark:bg-green-950/25 dark:border-green-900/60">
                              <p className="text-xs font-bold text-green-700 mb-1 dark:text-green-200">✓ Đáp án mẫu</p>
                              <BilingualMathText
                                primary={q.correct_answer_text}
                                secondary={q.correct_answer_text_cn}
                                tertiary={q.correct_answer_text_en}
                                languageMode={languageMode}
                                className="text-sm text-gray-800 dark:text-gray-100"
                                secondaryClassName="mt-1 text-xs text-green-700 dark:text-green-300"
                              />
                            </div>
                          </div>
                        )}

                        {/* Explanation or Hidden Retry Prompt */}
                        {hideAnswersForRetry ? (
                          <div className="mt-4 sm:ml-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-200">
                            <span>
                              👆 Hãy bấm chọn một phương án <strong>A, B, C, D</strong> phía trên để kiểm tra đáp án và mở lời giải chi tiết.
                            </span>
                            <button
                              type="button"
                              onClick={() => setRevealedRetryKeys((prev) => new Set(prev).add(qKey))}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-600 dark:bg-slate-800 dark:text-amber-200"
                            >
                              <FiEye size={13} /> Xem đáp án &amp; lời giải
                            </button>
                          </div>
                        ) : (
                          <QuestionExplanationBlock question={q} languageMode={explanationLanguageMode} className="mt-4 sm:ml-8" />
                        )}

                        {/* AI buttons & Mistake Notebook action */}
                        {!result.is_room_exam && !isEssayQuestion && (
                          <div className="mt-3 ml-8 flex items-center gap-3 flex-wrap">
                            <ReviewAIButtons
                              status={status}
                              onOpen={(mode) => openReviewAI(q, mode)}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleMistakeNotebook(q, originalIndex)}
                              className={`text-sm font-medium flex items-center gap-1.5 transition-colors ${
                                isSavedInNotebook
                                  ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400'
                                  : 'text-red-600 hover:text-red-800 dark:text-rose-400 dark:hover:text-rose-300'
                              }`}
                            >
                              <FiBookOpen size={14} />
                              {isSavedInNotebook ? 'Đã lưu vào Sổ tay câu sai' : 'Lưu vào Sổ tay câu sai'}
                            </button>
                          </div>
                        )}

                        {/* Grade essay button */}
                        {isEssayQuestion && (
                          <div className="mt-3 ml-8">
                            <button
                              onClick={() => setShowGradeModal(q)}
                              className="text-sm text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1.5">
                              <FiCpu size={14} /> Chấm bài bằng AI
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB: CHATBOT AI ── */}
        {!result.is_room_exam && activeTab === 'chat' && (
          <div ref={chatAnchorRef} className={`scroll-mt-24 overflow-hidden rounded-2xl ${inkResultSoftPanel}`}>
            <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
          </div>
        )}
      </main>

      {!result.is_room_exam && <ReviewAIHost
        ref={reviewAIHostRef}
        attemptId={result.id}
        languageMode={languageMode}
        onOpenChat={openChatTab}
      />}

      {reportQuestion && (
        <QuestionReportModal
          question={reportQuestion}
          loading={reportSubmitting}
          onClose={() => setReportQuestion(null)}
          onSubmit={(reportType, description) => handleSubmitQuestionReport(reportQuestion, reportType, description)}
        />
      )}

      {/* Grade Essay Modal */}
      {showGradeModal && (
        <GradeEssayModal
          question={showGradeModal}
          attemptId={result.id}
          onClose={() => {
            setShowGradeModal(null);
            fetchResult();
          }}
        />
      )}

      {solutionViewerOpen && comparisonUrls && (
        <div className="fixed inset-0 z-[100] bg-white">
          <button type="button" onClick={closeSolutionComparison} aria-label="Đóng đối chiếu PDF" className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg transition hover:bg-slate-100">
            <FiX size={20} />
          </button>
          <div className="grid h-full grid-rows-2 gap-px bg-slate-200 lg:grid-cols-2 lg:grid-rows-1">
            <PdfComparisonDocument title="Đề thi PDF" url={comparisonUrls.paper} />
            <PdfComparisonDocument title="Lời giải PDF" url={comparisonUrls.solution} />
          </div>
        </div>
      )}
    </InkResultBackground>
  );
}

function QuestionReportModal({ question, loading, onClose, onSubmit }: {
  question: QuestionResult;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reportType: QuestionReportType, description: string) => void;
}) {
  const [reportType, setReportType] = useState<QuestionReportType>('wrong_answer');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Báo lỗi câu hỏi</p>
            <h3 className="mt-1 text-lg font-black text-gray-900 dark:text-white">
              Câu {question.sub_question_number || question.question_number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <FiXCircle size={18} />
          </button>
        </div>

        <div className="mb-4 max-h-28 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <RichMathText value={question.question_text} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUESTION_REPORT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setReportType(type.value)}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors ${
                reportType === type.value
                  ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200'
                  : 'border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50/60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-bold text-gray-700 dark:text-slate-200" htmlFor="question-report-description">
          Mô tả thêm
        </label>
        <textarea
          id="question-report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Ví dụ: đáp án đúng phải là B vì..."
          className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reportType, description)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Đang gửi...' : 'Gửi báo lỗi'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GradeEssayModal({ question, attemptId, onClose }: {
  question: QuestionResult; attemptId: number; onClose: () => void;
}) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGrade(); }, []);

  const loadGrade = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/ai/grade-essay', {
        method: 'POST',
        body: JSON.stringify({
          attemptId,
          questionId: question.question_id || question.id,
        }),
      });
      const data = await res.json();
      setResult(data.success ? data : null);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = result?.totalScore >= 8 ? 'text-green-600' : result?.totalScore >= 5 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={loading ? undefined : onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
              <FiCpu className="text-white" size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                {question.question_type === 'translation' ? 'Chấm bài dịch thuật' : 'Chấm bài tự luận'}
              </h3>
              <p className="text-xs text-gray-400">AI chấm điểm và gợi ý</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 text-xl">×</button>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-orange-200 border-t-orange-600" />
              <p className="text-gray-500 text-sm">AI đang chấm bài...</p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              {/* Score */}
              <div className="text-center">
                <p className={`text-5xl font-black ${scoreColor}`}>{result.totalScore}/10</p>
                <div className="w-full bg-gray-100 rounded-full h-3 mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${result.totalScore >= 8 ? 'bg-green-500' : result.totalScore >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${(result.totalScore / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* User Answer */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-700 mb-2">✍️ Câu trả lời của bạn</p>
                <RichMathText value={question.selected_answer_text || ''} className="text-sm text-gray-800 leading-relaxed" />
              </div>

              {/* Model Answer */}
              {result.modelAnswer && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-2">✓ Đáp án mẫu</p>
                  <RichMathText value={result.modelAnswer || ''} className="text-sm text-gray-800" />
                </div>
              )}

              {/* Grading Criteria */}
              {result.gradingCriteria?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tiêu chí chấm điểm</p>
                  <div className="space-y-2">
                    {result.gradingCriteria.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-700">{c.criterion}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{c.score}/{c.maxScore}</span>
                          {c.comment && <span className="text-xs text-gray-500">· {c.comment}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">❌ Lỗi sai</p>
                  <div className="space-y-2">
                    {result.errors.map((e: any, i: number) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-red-800 line-through">{e.original}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm font-semibold text-green-700">{e.correct}</span>
                        </div>
                        {e.reason && <p className="text-xs text-red-600">{e.reason}</p>}
                        {e.type && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                            {e.type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {result.feedback && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-purple-700 mb-2">💬 Nhận xét</p>
                  <AIFormattedText value={result.feedback} className="text-gray-700" />
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Gợi ý cải thiện</p>
                  <ul className="space-y-2">
                    {result.suggestions.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-500 shrink-0 mt-0.5">▸</span>
                        <AIFormattedText value={s} className="text-gray-700" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-gray-100 flex gap-3">
                <button onClick={loadGrade} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">
                  <FiZap size={14} /> Chấm lại
                </button>
                <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors">
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm mb-3">Không thể chấm bài lúc này.</p>
              <button onClick={loadGrade} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                Thử lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense fallback={
      <InkResultBackground className="flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-[#d52a1e]" />
          <p className={`mt-4 text-lg ${inkResultMuted}`}>Đang tải kết quả...</p>
        </div>
      </InkResultBackground>
    }>
      <ExamResultContent />
    </Suspense>
  );
}
