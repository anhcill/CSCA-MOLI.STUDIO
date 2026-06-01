'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiClock, FiAward, FiHome, FiRotateCw, FiMessageCircle, FiBarChart2, FiBookOpen, FiCpu, FiPrinter, FiZap, FiBook, FiArrowLeft } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import examApi from '@/lib/api/exams';
import { authFetch } from '@/lib/utils/authFetch';
import AIChatbot from '@/components/ai/AIChatbot';
import AIExamAnalysis from '@/components/ai/AIExamAnalysis';
import { PremiumGate } from '@/components/common/PremiumGate';
import { useAuthStore } from '@/lib/store/authStore';
import { canUseAI } from '@/lib/utils/permissions';
import RichMathText from '@/components/common/RichMathText';
import { createWeakTopicPractice, createWrongQuestionPractice, saveBookmark } from '@/lib/api/insights';
import AiAnalyzingOverlay from '@/components/common/AiAnalyzingOverlay';

interface AnswerOption {
  key: string;
  text: string;
  text_cn?: string | null;
  is_correct: boolean;
}

interface QuestionResult {
  id?: number;
  question_id?: number;
  question_number: number;
  sub_question_number?: number;
  question_text: string;
  question_text_cn?: string;
  question_type?: string;
  passage_text?: string;
  selected_answer_key: string | null;
  selected_answer_text: string;
  correct_answer_key: string;
  correct_answer_text: string;
  is_correct: boolean;
  points: number;
  explanation?: string;
  explanation_cn?: string;
  options: AnswerOption[];
  difficulty?: string;
  topic_name?: string;
  question_category?: string;
}

interface ExamResult {
  id: number;
  exam_id: number;
  exam_title: string;
  title_cn?: string;
  subject_name: string;
  total_score: number;
  total_correct: number;
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
  const hasAIAccess = canUseAI(user);

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'result' | 'review' | 'chat'>('result');
  const [showExplanationModal, setShowExplanationModal] = useState<QuestionResult | null>(null);
  const [showTeachModal, setShowTeachModal] = useState<QuestionResult | null>(null);
  const [showGradeModal, setShowGradeModal] = useState<QuestionResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [savedWrongQuestions, setSavedWrongQuestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    }
  }, [attemptId]);

  useEffect(() => {
    if (result?.id && hasAIAccess && !aiAnalysis && !aiLoading) {
      loadAIAnalysis(result.id);
    }
  }, [result?.id, hasAIAccess]);

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
      if (data.id && hasAIAccess) {
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
    try {
      setActionLoading('wrong');
      const practiceSet = await createWrongQuestionPractice(20);
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
      alert('Không thể tạo bộ luyện chủ đề yếu lúc này.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600" />
          <p className="text-gray-500">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Không tìm thấy kết quả bài thi</p>
          <button onClick={() => router.back()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const answers = result.answers ?? [];
  const totalCorrect = result.total_correct ?? answers.filter(a => a.is_correct).length;
  const totalIncorrect = answers.filter(a => a.selected_answer_key && !a.is_correct).length;
  const totalUnanswered = answers.filter(a => !a.selected_answer_key).length;
  const total = answers.length || result.total_questions || 1;
  const accuracy = Math.round((totalCorrect / total) * 100);
  const score = Number(result.total_score) || 0;

  const gradeColor = accuracy >= 85 ? 'emerald' : accuracy >= 60 ? 'blue' : accuracy >= 40 ? 'amber' : 'red';
  const gradeLabel = accuracy >= 85 ? 'Xuất sắc!' : accuracy >= 60 ? 'Đạt yêu cầu' : accuracy >= 40 ? 'Cần cố gắng' : 'Chưa đạt';

  const getGradeColors = (color: string) => {
    if (color === 'emerald') return { text: 'text-emerald-600 dark:text-emerald-400', progress: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800' };
    if (color === 'blue') return { text: 'text-blue-600 dark:text-blue-400', progress: 'from-blue-400 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800' };
    if (color === 'amber') return { text: 'text-amber-600 dark:text-amber-400', progress: 'from-amber-400 to-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800' };
    return { text: 'text-rose-600 dark:text-rose-400', progress: 'from-rose-400 to-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800' };
  };

  const gradeColors = getGradeColors(gradeColor);

  // Pie chart data
  const pieData = [
    { name: 'Đúng', value: totalCorrect, color: '#22c55e' },
    { name: 'Sai', value: totalIncorrect, color: '#ef4444' },
    { name: 'Bỏ qua', value: totalUnanswered, color: '#9ca3af' },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <AiAnalyzingOverlay open={aiLoading && !aiAnalysis} mode="exam" compactAfterMs={2600} />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4; margin: 1.5cm; }
        }
      `}</style>
      {/* Minimal Header - chỉ nút quay lại */}
      <div className="sticky top-0 z-[60] bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3 no-print dark:bg-gray-900/95 dark:border-gray-800">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-purple-650 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium text-sm"
        >
          <FiArrowLeft size={18} /> Quay lại
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-655 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-medium shadow-sm no-print"
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
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-purple-50 hover:text-purple-650 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-purple-400'
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
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 transition-all hover:shadow-2xl">
                <div className="text-center mb-4">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{result.exam_title}</p>
                  <div className="relative inline-flex items-center justify-center my-2">
                    {/* Outer soft glowing circle */}
                    <div className={`absolute inset-0 rounded-full blur-xl opacity-20 bg-gradient-to-br ${gradeColors.progress}`} />
                    <span className={`relative text-6xl font-black bg-gradient-to-br ${gradeColors.progress} bg-clip-text text-transparent leading-none py-2 px-1`}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold">/ 10 điểm</p>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-850 rounded-full h-3 overflow-hidden mb-3">
                  <div className={`h-full bg-gradient-to-r ${gradeColors.progress} rounded-full transition-all duration-700`}
                    style={{ width: `${accuracy}%` }} />
                </div>
                <p className={`text-center text-sm font-bold ${gradeColors.text}`}>
                  {accuracy}% {gradeLabel}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <FiClock size={12} />
                  <span>{new Date(result.submit_time).toLocaleString('vi-VN')}</span>
                </div>
              </div>

              {/* Middle: Pie Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center transition-all hover:shadow-2xl">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Phân bố đáp án</p>
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
                    <p className="text-2xl font-black text-gray-800 dark:text-white">{total}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-505">câu</p>
                  </div>
                </div>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-gray-650 dark:text-gray-400">{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Guidance Cards */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Bạn muốn làm gì tiếp?</p>

                <button
                  onClick={() => setActiveTab('review')}
                  className="w-full bg-gradient-to-r from-blue-50/50 to-sky-50/30 dark:from-blue-950/10 dark:to-sky-950/5 border border-blue-105 dark:border-blue-900/30 rounded-2xl p-4 text-left hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200 group">
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
                  onClick={() => setActiveTab('chat')}
                  className="w-full bg-gradient-to-r from-purple-50/50 to-pink-50/30 dark:from-purple-950/10 dark:to-pink-950/5 border border-purple-105 dark:border-purple-900/30 rounded-2xl p-4 text-left hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-md transition-all duration-200 group">
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
                  className="w-full bg-gradient-to-r from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/10 dark:to-teal-950/5 border border-emerald-105 dark:border-emerald-900/30 rounded-2xl p-4 text-left hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200 group">
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
                  className="w-full bg-gradient-to-r from-red-50/50 to-rose-50/30 dark:from-red-950/10 dark:to-rose-950/5 border border-red-105 dark:border-red-900/30 rounded-2xl p-4 text-left hover:border-red-300 dark:hover:border-red-800 hover:shadow-md transition-all duration-200 group disabled:opacity-60">
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
                  className="w-full bg-gradient-to-r from-amber-50/50 to-yellow-50/30 dark:from-amber-950/10 dark:to-yellow-950/5 border border-amber-105 dark:border-amber-900/30 rounded-2xl p-4 text-left hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-md transition-all duration-200 group disabled:opacity-60">
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
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">Xem thêm</p>
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
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
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
                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${errorRate}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Sai {topic.incorrect}/{topic.total} câu</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <PremiumGate type="ai">
              <AIExamAnalysis
                attemptId={result.id}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                onRefresh={() => loadAIAnalysis(result.id)}
                previousAttempt={previousAttempt}
                onAiLoaded={() => setAiLoaded(true)}
              />
            </PremiumGate>
          </div>
        )}

        {/* ── TAB: XEM LẠI BÀI ── */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {answers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                <p className="text-lg">Không có dữ liệu câu hỏi chi tiết</p>
              </div>
            ) : (
              answers.map((q, index) => {
                const status = !q.selected_answer_key ? 'unanswered'
                  : q.is_correct ? 'correct' : 'incorrect';
                const borderCls = status === 'correct' ? 'bg-green-50 border-green-200'
                  : status === 'incorrect' ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200';

                return (
                  <div key={index} className={`rounded-xl border-2 p-5 transition-all ${borderCls}`}>

                    {/* Passage */}
                    {q.passage_text && index === 0 && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                        <p className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide">Đoạn văn</p>
                        <p className="text-gray-800 leading-relaxed">{q.passage_text}</p>
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
                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {q.difficulty === 'easy' ? 'Dễ' : q.difficulty === 'hard' ? 'Khó' : 'TB'}
                              </span>
                            )}
                          </span>
                          {status === 'incorrect' && q.selected_answer_key && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              Bạn: {q.selected_answer_key}
                            </span>
                          )}
                          {(q.topic_name || q.question_category) && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {q.topic_name || q.question_category}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-gray-400">{q.points} điểm</span>
                        </div>
                        <p className="text-gray-900 font-medium leading-relaxed">{q.question_text || q.question_text_cn}</p>
                        {q.question_text_cn && q.question_text_cn !== q.question_text && (
                          <p className="text-gray-500 text-sm mt-1">{q.question_text_cn}</p>
                        )}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2 ml-8">
                      {(q.options ?? []).map((opt) => {
                        const isCorrect = opt.is_correct;
                        const isUserPick = q.selected_answer_key === opt.key;
                        let bg = 'bg-white', border = 'border-gray-200', text = 'text-gray-700';
                        if (isCorrect) { bg = 'bg-green-100'; border = 'border-green-500'; text = 'text-green-900 font-semibold'; }
                        else if (isUserPick) { bg = 'bg-red-100'; border = 'border-red-500'; text = 'text-red-900 font-semibold'; }

                        return (
                          <div key={opt.key} className={`flex items-start gap-2 p-3 rounded-lg border-2 ${bg} ${border}`}>
                            <span className={`font-bold text-sm shrink-0 ${text}`}>{opt.key}.</span>
                            <div className="flex-1">
                              <span className={`text-sm ${text}`}>{opt.text}</span>
                              {opt.text_cn && (
                                <p className={`text-xs mt-0.5 ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{opt.text_cn}</p>
                              )}
                            </div>
                            {isCorrect && <span className="ml-auto text-green-700 font-bold text-xs shrink-0">✓ Đúng</span>}
                            {isUserPick && !isCorrect && <span className="ml-auto text-red-700 font-bold text-xs shrink-0">✗ Bạn chọn</span>}
                          </div>
                        );
                      })}

                      {!q.selected_answer_key && (
                        <p className="text-sm text-gray-400 italic">
                          Bạn đã bỏ qua · Đáp án đúng: <strong className="text-gray-600">{q.correct_answer_key}</strong>
                        </p>
                      )}
                    </div>

                    {/* Essay/Translation answer display */}
                    {(q.question_type === 'essay' || q.question_type === 'translation') && (
                      <div className="mt-4 ml-8 space-y-3">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-indigo-700 mb-1">✍️ Câu trả lời của bạn</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {q.selected_answer_text || 'Chưa trả lời'}
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-green-700 mb-1">✓ Đáp án mẫu</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.correct_answer_text}</p>
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {(q.explanation || q.explanation_cn) && (
                      <div className="mt-4 ml-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-1">💡 Giải thích:</p>
                        <RichMathText value={q.explanation || q.explanation_cn || ''} className="text-blue-800" />
                      </div>
                    )}

                    {/* AI buttons */}
                    {status === 'incorrect' && (
                      <div className="mt-3 ml-8 flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => setShowExplanationModal(q)}
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1.5">
                          <FiZap size={14} /> Hỏi AI giải thích thêm
                        </button>
                        <button
                          onClick={() => setShowTeachModal(q)}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5">
                          <FiBook size={14} /> Giảng lại lý thuyết
                        </button>
                        <button
                          onClick={() => handleSaveWrongQuestion(q)}
                          disabled={Boolean((q.question_id || q.id) && savedWrongQuestions.has((q.question_id || q.id)!))}
                          className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1.5 disabled:text-gray-400">
                          <FiBookOpen size={14} />
                          {(q.question_id || q.id) && savedWrongQuestions.has((q.question_id || q.id)!)
                            ? 'Đã lưu câu sai'
                            : 'Lưu câu sai'}
                        </button>
                      </div>
                    )}

                    {/* Grade essay button */}
                    {(q.question_type === 'essay' || q.question_type === 'translation') && (
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            <AIChatbot attemptId={result.id} examTitle={result.exam_title} />
          </div>
        )}
      </main>

      {/* AI Explanation Modal */}
      {showExplanationModal && (
        <ExplanationModal
          question={showExplanationModal}
          attemptId={result.id}
          onClose={() => setShowExplanationModal(null)}
        />
      )}

      {/* Teach Grammar Modal */}
      {showTeachModal && (
        <TeachGrammarModal
          question={showTeachModal}
          attemptId={result.id}
          onClose={() => setShowTeachModal(null)}
          onAskAI={() => {
            setShowTeachModal(null);
            setActiveTab('chat');
          }}
        />
      )}

      {/* Grade Essay Modal */}
      {showGradeModal && (
        <GradeEssayModal
          question={showGradeModal}
          attemptId={result.id}
          onClose={() => setShowGradeModal(null)}
        />
      )}
    </div>
  );
}

// ─── AI Explanation Modal ──────────────────────────────────────────────────────
function ExplanationModal({ question, attemptId, onClose }: { question: QuestionResult; attemptId: number; onClose: () => void }) {
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExplanation();
  }, []);

  const loadExplanation = async () => {
    try {
      const res = await authFetch('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: `Câu ${question.sub_question_number || question.question_number} sai. Giải thích tại sao đáp án "${question.selected_answer_key}. ${question.selected_answer_text}" sai và "${question.correct_answer_key}. ${question.correct_answer_text}" đúng? Hãy giải thích chi tiết kiến thức liên quan và mẹo ghi nhớ.`,
          attemptId,
        }),
      });
      const data = await res.json();
      setExplanation(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print" onClick={loading ? undefined : onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header — ẩn nút X khi đang loading */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-900">
            Phân tích câu {question.question_number || question.sub_question_number}
          </h3>
          {!loading && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-gray-400 text-xl">×</span>
            </button>
          )}
        </div>
        <div className="p-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-bold text-purple-700 mb-1">Câu hỏi</p>
            <p className="text-sm text-gray-800">{question.question_text || question.question_text_cn}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-bold text-red-600 mb-1">✗ Đáp án của bạn</p>
              <p className="text-red-800 font-semibold text-sm">
                {question.selected_answer_key || '?'}. {question.selected_answer_text || ''}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-bold text-green-600 mb-1">✓ Đáp án đúng</p>
              <p className="text-green-800 font-semibold text-sm">
                {question.correct_answer_key || '?'}. {question.correct_answer_text || ''}
              </p>
            </div>
          </div>

          {loading ? (
            <QuestionAnalysisLoading />
          ) : explanation?.success ? (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                  🤖 AI phân tích
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {explanation.answer}
                </p>
              </div>
              {(question.explanation || question.explanation_cn) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 mb-2">📖 Giải thích có sẵn</p>
                  <RichMathText value={question.explanation || question.explanation_cn || ''} className="text-blue-800" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm mb-2">
                {explanation?.message || 'Không thể phân tích câu này'}
              </p>
              <p className="text-xs text-gray-400">
                Thử vào tab "🤖 Hỏi AI" để hỏi chi tiết hơn
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
          {!loading && (
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors">
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionAnalysisLoading() {
  const steps = ['Đọc câu hỏi', 'Đối chiếu đáp án', 'Soạn giải thích'];
  return (
    <div className="py-8">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-purple-200 border-t-purple-600" />
      </div>
      <p className="text-center text-sm font-semibold text-gray-700">
        AI đang phân tích câu này<span className="inline-flex w-6 justify-start"><span className="animate-pulse">...</span></span>
      </p>
      <div className="mx-auto mt-5 max-w-sm space-y-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-purple-600 shadow-sm">
              {index + 1}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-purple-100">
              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: `${35 + index * 25}%`, animation: 'pulse 1.4s ease-in-out infinite' }}
              />
            </div>
            <span className="w-24 text-xs font-bold text-purple-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Grade Essay Modal ──────────────────────────────────────────────────────────────
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
          questionText: question.question_text,
          questionTextCn: question.question_text_cn,
          userAnswer: question.selected_answer_text,
          correctAnswer: question.correct_answer_text,
          questionType: question.question_type,
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
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{question.selected_answer_text}</p>
              </div>

              {/* Model Answer */}
              {result.modelAnswer && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-2">✓ Đáp án mẫu</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.modelAnswer}</p>
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
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.feedback}</p>
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
                        {s}
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

// ─── Teach Grammar Modal (Mini-lesson) ──────────────────────────────────────────
function TeachGrammarModal({ question, attemptId, onClose, onAskAI }: {
  question: QuestionResult; attemptId: number; onClose: () => void; onAskAI: () => void;
}) {
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLesson(); }, []);

  const loadLesson = async () => {
    try {
      const res = await authFetch('/api/ai/teach-grammar', {
        method: 'POST',
        body: JSON.stringify({
          question: question.question_text || question.question_text_cn || '',
          topic: '',
          wrongAnswer: `${question.selected_answer_key}. ${question.selected_answer_text}`,
          correctAnswer: `${question.correct_answer_key}. ${question.correct_answer_text}`,
        }),
      });
      const data = await res.json();
      setLesson(data.success ? data : null);
    } catch {
      setLesson(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={loading ? undefined : onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <FiBook className="text-white" size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Giảng lại lý thuyết</h3>
              <p className="text-xs text-gray-400">Bài học về câu {question.question_number || question.sub_question_number}</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 text-xl">×</button>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-200 border-t-indigo-600" />
              <p className="text-gray-500 text-sm">AI đang soạn bài giảng...</p>
            </div>
          ) : lesson ? (
            <div className="space-y-5">
              {/* Title */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h4 className="font-bold text-indigo-900 text-lg mb-1">{lesson.title}</h4>
                <p className="text-xs text-indigo-600">
                  Câu hỏi gốc: {question.question_text || question.question_text_cn}
                </p>
              </div>

              {/* Grammar Rule */}
              {lesson.grammarRule && (
                <div>
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📚 Ngữ pháp</h5>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-xl p-4">
                    {lesson.grammarRule}
                  </p>
                </div>
              )}

              {/* Examples */}
              {lesson.examples?.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💬 Ví dụ minh hoạ</h5>
                  <div className="space-y-3">
                    {lesson.examples.map((ex: any, i: number) => (
                      <div key={i} className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-base font-semibold text-green-900 mb-1">{ex.chinese}</p>
                        {ex.pinyin && <p className="text-xs text-green-600 italic mb-2">{ex.pinyin}</p>}
                        <p className="text-sm text-green-800 mb-1">{ex.vietnamese}</p>
                        {ex.usage && <p className="text-xs text-green-500">→ {ex.usage}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memory Tips */}
              {lesson.memoryTips?.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💡 Mẹo ghi nhớ</h5>
                  <ul className="space-y-2">
                    {lesson.memoryTips.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                        <span className="text-amber-500 shrink-0 mt-0.5">✦</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Common Mistakes */}
              {lesson.commonMistakes?.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">⚠️ Lưu ý thường sai</h5>
                  <ul className="space-y-2">
                    {lesson.commonMistakes.map((m: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                        <span className="text-red-500 shrink-0 mt-0.5">!</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Topics */}
              {lesson.relatedTopics?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {lesson.relatedTopics.map((t: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 border border-gray-200 text-gray-600 text-xs rounded-full font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-gray-100 flex gap-3">
                <button
                  onClick={onAskAI}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
                  <FiMessageCircle size={14} /> Hỏi AI thêm
                </button>
                <button
                  onClick={loadLesson}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">
                  <FiZap size={14} /> Soạn lại
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm mb-3">Không thể tải bài giảng lúc này.</p>
              <button onClick={loadLesson} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600" />
          <p className="mt-4 text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    }>
      <ExamResultContent />
    </Suspense>
  );
}
