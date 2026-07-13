'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiClock, FiAward, FiHome, FiRotateCw, FiMessageCircle, FiBarChart2, FiBookOpen, FiCpu, FiPrinter, FiZap, FiArrowLeft, FiFlag } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import examApi, { QuestionReportType } from '@/lib/api/exams';
import { authFetch } from '@/lib/utils/authFetch';
import AIChatbot from '@/components/ai/AIChatbot';
import AIExamAnalysis from '@/components/ai/AIExamAnalysis';
import AICoinUnlock from '@/components/ai/AICoinUnlock';
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

const AI_ANALYSIS_COST = 50;

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
}

function ExamResultContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = parseInt(params.id as string);
  const attemptId = searchParams.get('attemptId');
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const hasAIAccess = canUseAI(user);
  const currentCoins = Math.max(0, Number(user?.coins ?? 0));

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
    if (result?.id && !aiAnalysis && !aiLoading) {
      loadAIAnalysis(result.id);
    }
  }, [result?.id]);

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
      if (data.id) {
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

  const loadAIAnalysis = async (attemptId: number, useCoins = false) => {
    // Không load lại nếu đã có analysis rồi
    if (!useCoins && aiAnalysis && aiAnalysis.attempt?.id === attemptId) return;
    if (useCoins && currentCoins < AI_ANALYSIS_COST) return;
    try {
      setAiLoading(true);
      const url = useCoins ? `/api/ai/exam-result/${attemptId}?useCoins=true` : `/api/ai/exam-result/${attemptId}`;
      const res = await authFetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data);
        setPreviousAttempt(data.previousAttempt || null);
        setAiLoaded(true);
        if (data.coin_charged) {
          const nextCoins = Number.isFinite(Number(data.coin_balance))
            ? Math.max(0, Number(data.coin_balance))
            : Math.max(0, currentCoins - AI_ANALYSIS_COST);
          updateUser({ coins: nextCoins });
        }
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

  const handleSaveWrongQuestion = async (question: QuestionResult) => {
    const questionId = question.question_id || question.id;
    if (!questionId) return;

    try {
      await saveBookmark({
        entity_type: 'question',
        entity_id: questionId,
        title: `Câu ${question.question_number} - ${result?.exam_title || 'Đề thi'}`,
        metadata: {
          attemptId: result?.id,
          examId: result?.exam_id,
          selectedAnswer: question.selected_answer_key,
          correctAnswer: question.correct_answer_key,
          topic: question.topic_name || question.question_category || null,
        },
      });
      setSavedWrongQuestions((prev) => new Set(prev).add(questionId));
    } catch (error) {
      console.error('Save wrong question error:', error);
      alert('Không thể lưu câu này lúc này.');
    }
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

  const answers = result.answers ?? [];
  const languageMode = result.language_mode || 'zh';
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

  return (
    <InkResultBackground>
      <AiAnalyzingOverlay open={aiLoading && !aiAnalysis} mode="exam" compactAfterMs={2600} />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
      {/* Minimal Header - chỉ nút quay lại */}
      <div className="sticky top-0 z-[60] bg-[#fffaf2]/90 backdrop-blur-md border-b border-[#ead9bd]/80 px-4 py-3 flex items-center gap-3 no-print dark:bg-gray-900/95 dark:border-gray-800">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-purple-650 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium text-sm"
        >
          <FiArrowLeft size={18} /> Quay lại
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#fffaf2]/75 border border-[#ead9bd]/80 text-[#6f563f] dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 rounded-lg hover:bg-[#fff8ec] dark:hover:bg-gray-750 text-xs font-medium shadow-sm no-print"
        >
          <FiPrinter size={14} /> Xuất PDF
        </button>
      </div>
      <main className="container mx-auto px-4 py-6 max-w-[1360px]">

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 no-print">
          {[
            { key: 'result', label: '📊 Kết quả', icon: FiBarChart2 },
            { key: 'review', label: '📝 Xem lại bài', icon: FiPrinter },
            { key: 'chat', label: '🤖 Hỏi AI', icon: FiMessageCircle },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => {
                if (tab.key === 'chat') openChatTab();
                else setActiveTab(tab.key as any);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#fffaf2]/75 text-[#6f563f] border border-[#ead9bd]/80 hover:bg-[#fff8ec] hover:text-[#d52a1e] dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-purple-400'
              }`}>
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: KẾT QUẢ + AI PHÂN TÍCH ── */}
        {activeTab === 'result' && (
          <div className="space-y-5">

            {/* Top Section: Score + Pie + Guidance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Left: Score Card */}
              <div className={`rounded-[28px] p-6 transition-all hover:shadow-[0_28px_80px_rgba(129,77,33,0.18)] ${inkResultPanel}`}>
                <div className="text-center mb-4">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${inkResultMuted}`}>{result.exam_title}</p>
                  <InkScoreMark value={score100.toFixed(1)} />
                  <p className={`text-lg font-black sm:text-xl ${inkResultScore}`}>/100 điểm</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#ead9bd]/80 bg-[#f7efe4]/75 px-4 py-2 text-sm font-black text-[#6f563f]">
                    <span>Thang 10</span>
                    <span className={inkResultScore}>{score10.toFixed(2)}/10</span>
                  </div>
                </div>
                <div className="w-full bg-[#e8ddd1]/85 rounded-full h-3 overflow-hidden mb-3">
                  <div className="h-full bg-[#d52a1e] rounded-full transition-all duration-700"
                    style={{ width: `${accuracy}%` }} />
                </div>
                <p className={`text-center text-sm font-bold ${inkResultScore}`}>
                  {accuracy}% {gradeLabel}
                </p>
                <div className={`mt-4 flex items-center justify-center gap-2 text-xs ${inkResultMuted}`}>
                  <FiClock size={12} />
                  <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Đúng', value: totalCorrect, tone: 'bg-emerald-50/70 text-emerald-700 border-emerald-200/70' },
                    { label: 'Sai', value: totalIncorrect, tone: 'bg-rose-50/72 text-rose-700 border-rose-200/70' },
                    { label: 'Bỏ qua', value: totalUnanswered, tone: 'bg-stone-100/70 text-stone-700 border-stone-200/75' },
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
                      ? `Ưu tiên xem lại ${totalIncorrect} câu sai trước, rồi hỏi AI giải thích từng lỗi.`
                      : totalUnanswered > 0
                        ? `Bạn còn ${totalUnanswered} câu bỏ qua, nên luyện cách suy luận nhanh.`
                        : 'Bài này khá ổn, hãy củng cố dấu hiệu nhận biết để giữ phong độ.'}
                  </p>
                </div>
              </div>

              {/* Middle: Pie Chart */}
              <div className={`rounded-[28px] p-6 flex flex-col items-center justify-start transition-all hover:shadow-[0_20px_60px_rgba(129,77,33,0.14)] ${inkResultSoftPanel}`}>
                <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${inkResultMuted}`}>Phân bố đáp án</p>
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
                <p className={`text-xs font-bold uppercase tracking-wider px-1 ${inkResultMuted}`}>Bạn muốn làm gì tiếp?</p>

                <button
                  onClick={() => setActiveTab('review')}
                  className={`w-full rounded-2xl p-4 text-left transition-all duration-200 group hover:border-[#d9b784] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-sky-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-205">
                      <FiBookOpen className="text-white" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-950 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Xem lại bài</p>
                      <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Kiểm tra đáp án, đọc giải thích từng câu</p>
                    </div>
                    <span className="text-blue-400 dark:text-blue-505 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </div>
                </button>

                <button
                  onClick={openChatTab}
                  className={`w-full rounded-2xl p-4 text-left transition-all duration-200 group hover:border-[#d9b784] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform duration-205">
                      <FiCpu className="text-white" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Hỏi AI</p>
                      <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Nhờ AI giải thích, hỏi mẹo làm bài</p>
                    </div>
                    <span className="text-purple-400 dark:text-purple-505 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/')}
                  className={`w-full rounded-2xl p-4 text-left transition-all duration-200 group hover:border-[#d9b784] hover:shadow-md ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-205">
                      <FiCheckCircle className="text-white" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Làm bài mới</p>
                      <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Tiếp tục luyện tập với đề khác</p>
                    </div>
                    <span className="text-emerald-400 dark:text-emerald-505 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </div>
                </button>

                <button
                  onClick={handleCreateWrongPractice}
                  disabled={actionLoading === 'wrong'}
                  className={`w-full rounded-2xl p-4 text-left transition-all duration-200 group hover:border-[#d9b784] hover:shadow-md disabled:opacity-60 ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform duration-205">
                      <FiRotateCw className="text-white" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Luyện lại 20 câu sai</p>
                      <p className="text-xs text-gray-400 dark:text-gray-505 mt-0.5 truncate">Tạo bộ luyện từ các câu bạn hay sai gần đây</p>
                    </div>
                    <span className="text-red-400 dark:text-red-505 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </div>
                </button>

                <button
                  onClick={handleCreateWeakTopicPractice}
                  disabled={actionLoading === 'weak-topic'}
                  className={`w-full rounded-2xl p-4 text-left transition-all duration-200 group hover:border-[#d9b784] hover:shadow-md disabled:opacity-60 ${inkResultButtonPanel}`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-605 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform duration-205">
                      <FiBarChart2 className="text-white" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-955 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Luyện chủ đề yếu</p>
                      <p className="text-xs text-gray-400 dark:text-gray-550 mt-0.5 truncate">Tập trung vào nhóm kiến thức sai nhiều</p>
                    </div>
                    <span className="text-amber-400 dark:text-amber-505 text-sm font-bold group-hover:translate-x-1 transition-transform duration-200">→</span>
                  </div>
                </button>

                {/* Quick Links */}
                <div className="pt-2 border-t border-[#ead9bd]/70">
                  <p className={`text-xs font-bold uppercase tracking-wide mb-2 px-1 ${inkResultMuted}`}>Xem thêm</p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => router.push('/lich-su')}
                      className="text-xs text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400 text-left">
                      📋 Lịch sử làm bài
                    </button>
                    <button
                      onClick={() => router.push('/lich-su/thong-ke')}
                      className="text-xs text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:text-gray-400 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400 text-left">
                      📊 Thống kê chi tiết
                    </button>
                  </div>
                </div>
              </div>
            </div>

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

            {hasAIAccess || aiAnalysis || aiLoading ? (
              <AIExamAnalysis
                attemptId={result.id}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                onRefresh={() => loadAIAnalysis(result.id, !hasAIAccess)}
                previousAttempt={previousAttempt}
                onAiLoaded={() => setAiLoaded(true)}
              />
            ) : (
              <AICoinUnlock
                coins={currentCoins}
                loading={aiLoading}
                onUseCoins={() => loadAIAnalysis(result.id, true)}
                title="Phân tích bài thi bằng AI"
              />
            )}
          </div>
        )}

        {/* ── TAB: XEM LẠI BÀI ── */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {answers.length === 0 ? (
                                    <div className={`rounded-2xl p-10 text-center ${inkResultMuted} ${inkResultSoftPanel}`}>
                <p className="text-lg">Không có dữ liệu câu hỏi chi tiết</p>
              </div>
            ) : (
              answers.map((q, index) => {
                const status = getQuestionReviewStatus(q);
                const borderCls = getReviewCardClass(status);
                const isEssayQuestion = q.question_type === 'essay' || q.question_type === 'translation';
                const questionId = q.question_id || q.id;
                const isReported = Boolean(questionId && reportedQuestionIds.has(questionId));

                return (
                  <div key={index} className={`rounded-xl border-2 p-5 transition-all ${borderCls}`}>

                    {/* Passage */}
                    {q.passage_text && index === 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 dark:bg-purple-950/25 dark:border-purple-900/60">
                        <p className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide dark:text-purple-200">Đoạn văn</p>
                        <p className="text-gray-800 leading-relaxed dark:text-gray-100">{q.passage_text}</p>
                      </div>
                    )}

                    {/* Question Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {status === 'correct' && <FiCheckCircle className="text-green-600" size={22} />}
                        {status === 'incorrect' && <FiXCircle className="text-red-600" size={22} />}
                        {status === 'unanswered' && <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Câu {q.sub_question_number || q.question_number || index + 1}
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
                          {status === 'incorrect' && q.selected_answer_key && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded dark:bg-red-950/40 dark:text-red-300">
                              Bạn: {q.selected_answer_key}
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
                          className="text-gray-900 font-medium leading-relaxed dark:text-gray-100"
                        />
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setReportQuestion(q)}
                            disabled={!questionId || isReported}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                              isReported
                                ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50'
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
                        const isCorrect = opt.is_correct;
                        const isUserPick = q.selected_answer_key === opt.key;
                        const tone = getOptionToneClass(isCorrect, isUserPick);

                        return (
                          <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${tone.bg} ${tone.border}`}>
                            <span className={`font-bold text-sm shrink-0 ${tone.text}`}>{opt.key}.</span>
                            <div className="flex-1">
                              <BilingualMathText
                                primary={opt.text}
                                secondary={opt.text_cn}
                                tertiary={opt.text_en}
                                languageMode={languageMode}
                                className={`text-sm ${tone.text}`}
                                secondaryClassName={`mt-1 text-xs ${tone.secondary}`}
                              />
                            </div>
                            {isCorrect && <span className="ml-auto text-green-700 font-bold text-xs shrink-0 dark:text-green-300">✓ Đúng</span>}
                            {isUserPick && !isCorrect && <span className="ml-auto text-red-700 font-bold text-xs shrink-0 dark:text-red-300">✗ Bạn chọn</span>}
                          </div>
                        );
                      })}

                      {!q.selected_answer_key && (
                        <p className="text-sm text-gray-400 italic dark:text-gray-500">
                          Bạn đã bỏ qua · Đáp án đúng: <strong className="text-gray-600 dark:text-gray-300">{q.correct_answer_key}</strong>
                        </p>
                      )}
                    </div>

                    {/* Essay/Translation answer display */}
                    {isEssayQuestion && (
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

                    {/* Explanation */}
                    <QuestionExplanationBlock question={q} languageMode={languageMode} className="mt-4 sm:ml-8" />

                    {/* AI buttons */}
                    {!isEssayQuestion && (
                      <div className="mt-3 ml-8 flex items-center gap-3 flex-wrap">
                        <ReviewAIButtons
                          status={status}
                          onOpen={(mode) => openReviewAI(q, mode)}
                        />
                        {status === 'incorrect' && (
                          <button
                            onClick={() => handleSaveWrongQuestion(q)}
                            disabled={Boolean((q.question_id || q.id) && savedWrongQuestions.has((q.question_id || q.id)!))}
                            className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1.5 disabled:text-gray-400">
                            <FiBookOpen size={14} />
                            {(q.question_id || q.id) && savedWrongQuestions.has((q.question_id || q.id)!)
                              ? 'Đã lưu câu sai'
                              : 'Lưu câu sai'}
                          </button>
                        )}
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
          </div>
        )}

        {/* ── TAB: CHATBOT AI ── */}
        {activeTab === 'chat' && (
          <div ref={chatAnchorRef} className={`scroll-mt-24 overflow-hidden rounded-2xl ${inkResultSoftPanel}`}>
            <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
          </div>
        )}
      </main>

      <ReviewAIHost
        ref={reviewAIHostRef}
        attemptId={result.id}
        languageMode={languageMode}
        onOpenChat={openChatTab}
      />

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
