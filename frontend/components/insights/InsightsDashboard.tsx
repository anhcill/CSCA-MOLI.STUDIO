'use client';

import { useState, useEffect } from 'react';
import {
  FiTrendingUp, FiTrendingDown, FiMinus,
  FiTarget, FiAward, FiClock, FiBookOpen,
  FiBarChart2, FiAlertCircle, FiCheckCircle, FiZap,
  FiChevronRight, FiRefreshCw, FiTrendingUp as FiUp,
  FiGrid, FiStar, FiActivity
} from 'react-icons/fi';
import {
  getOverview,
  getTopicAnalysis,
  getTrendAnalysis,
  getDifficultyAnalysis,
  getTimeAnalysis,
  getFullAnalysis,
  getStudyPlan,
  getRecommendations,
  getExamHistory,
  getExamTypeAnalysis,
  getWeekdayAnalysis,
  getHardestExams,
  type OverviewData,
  type TopicAnalysisData,
  type TrendData,
  type DifficultyData,
  type TimeData,
  type StudyPlanData,
  type ExamHistoryItem,
  type Suggestion,
  type ExamTypeAnalysis,
  type WeekdayAnalysis,
  type HardestExamsData,
  type DifficultyBreakdown,
} from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';

interface LoadingState {
  overview: boolean;
  topics: boolean;
  trend: boolean;
  difficulty: boolean;
  time: boolean;
  studyPlan: boolean;
  history: boolean;
  examType: boolean;
  weekday: boolean;
  hardest: boolean;
}

export default function InsightsDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<LoadingState>({
    overview: true, topics: true, trend: true,
    difficulty: true, time: true, studyPlan: true, history: true,
    examType: true, weekday: true, hardest: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughData, setHasEnoughData] = useState(true);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [topics, setTopics] = useState<TopicAnalysisData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyData | null>(null);
  const [timeMgmt, setTimeMgmt] = useState<TimeData | null>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(null);
  const [history, setHistory] = useState<ExamHistoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [examType, setExamType] = useState<ExamTypeAnalysis | null>(null);
  const [weekday, setWeekday] = useState<WeekdayAnalysis | null>(null);
  const [hardest, setHardest] = useState<HardestExamsData | null>(null);

  const isLoading = Object.values(loading).some(Boolean);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setError(null);
    setLoading({
      overview: true, topics: true, trend: true,
      difficulty: true, time: true, studyPlan: true, history: true,
      examType: true, weekday: true, hardest: true,
    });

    const loaders = [
      { key: 'overview', fn: getOverview, setter: setOverview },
      { key: 'topics', fn: getTopicAnalysis, setter: setTopics },
      { key: 'trend', fn: () => getTrendAnalysis(15), setter: setTrend },
      { key: 'difficulty', fn: getDifficultyAnalysis, setter: setDifficulty },
      { key: 'time', fn: getTimeAnalysis, setter: setTimeMgmt },
      { key: 'studyPlan', fn: () => getStudyPlan(undefined, false), setter: setStudyPlan },
      { key: 'history', fn: () => getExamHistory(10), setter: setHistory },
      { key: 'examType', fn: getExamTypeAnalysis, setter: setExamType as any },
      { key: 'weekday', fn: getWeekdayAnalysis, setter: setWeekday as any },
      { key: 'hardest', fn: getHardestExams, setter: setHardest as any },
    ];

    await Promise.allSettled(
      loaders.map(async ({ key, fn, setter }) => {
        try {
          const data = await fn();
          setter(data as any);
        } catch (err: any) {
          console.error(`Error loading ${key}:`, err);
          if (key === 'overview') {
            setError(err?.response?.data?.message || err?.message);
          }
        } finally {
          setLoading((prev) => ({ ...prev, [key]: false }));
        }
      }),
    );

    // Load full analysis for suggestions
    try {
      const full = await getFullAnalysis();
      if (!full.hasEnoughData) {
        setHasEnoughData(false);
      } else if (full.data) {
        setSuggestions(full.data.suggestions || []);
      }
    } catch { /* non-critical */ }
  };

  const handleRefreshPlan = async () => {
    setLoading((prev) => ({ ...prev, studyPlan: true }));
    try {
      const data = await getStudyPlan(undefined, true);
      setStudyPlan(data as StudyPlanData);
    } finally {
      setLoading((prev) => ({ ...prev, studyPlan: false }));
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <FiAlertCircle className="text-5xl text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Không thể tải dữ liệu</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={loadAllData}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <FiRefreshCw size={16} /> Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FiBarChart2 /> Phân tích học tập
              </h1>
              <p className="text-indigo-100 mt-1">
                Xin chào {user?.full_name || user?.username}! Đây là báo cáo phân tích cá nhân của bạn.
              </p>
            </div>
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FiRefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

        {!hasEnoughData && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
            <FiAlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-amber-800">Cần thêm dữ liệu để phân tích</h3>
              <p className="text-sm text-amber-700 mt-1">
                Bạn cần hoàn thành ít nhất <strong>1 đề thi</strong> để xem phân tích chi tiết. Hãy làm bài thi và quay lại đây nhé!
              </p>
            </div>
          </div>
        )}

        {/* ─── ROW 1: Overview Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            loading={loading.overview}
            icon={<FiTarget className="text-indigo-500" />}
            label="Điểm trung bình"
            value={overview?.avgPercentage ? `${Math.round(overview.avgPercentage)}%` : '--'}
            sub={`${overview?.completedExams || 0} đề đã làm`}
            color="indigo"
          />
          <StatCard
            loading={loading.overview}
            icon={<FiAward className="text-emerald-500" />}
            label="Điểm cao nhất"
            value={overview?.highestScore ? `${Math.round(overview.highestScore)} điểm` : '--'}
            sub={`Top ${overview?.rankPercentile || 0}% học viên`}
            color="emerald"
          />
          <StatCard
            loading={loading.overview}
            icon={<FiBookOpen className="text-amber-500" />}
            label="Câu hỏi đã làm"
            value={overview ? `${(overview.totalCorrect + overview.totalIncorrect).toLocaleString()} câu` : '--'}
            sub={`${overview?.totalCorrect || 0} đúng · ${overview?.totalIncorrect || 0} sai`}
            color="amber"
          />
          <StatCard
            loading={loading.overview}
            icon={<FiClock className="text-rose-500" />}
            label="Thời gian học"
            value={overview?.totalTimeMinutes ? formatTime(overview.totalTimeMinutes) : '--'}
            sub={`Streak: ${overview?.currentStreak || 0} ngày`}
            color="rose"
          />
        </div>

        {/* ─── ROW 2: Left - Trend Chart | Right - Difficulty ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Trend Chart - 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <FiTrendingUp size={18} /> Xu hướng điểm số
              </h2>
              {trend && (
                <span className={`text-sm font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                  trend.trend === 'improving' ? 'bg-emerald-50 text-emerald-700' :
                  trend.trend === 'declining' ? 'bg-rose-50 text-rose-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {trend.trend === 'improving' ? <FiTrendingUp size={14} /> :
                   trend.trend === 'declining' ? <FiTrendingDown size={14} /> :
                   <FiMinus size={14} />}
                  {trend.trend === 'improving' ? 'Đang tiến bộ' :
                   trend.trend === 'declining' ? 'Cần cải thiện' : 'Ổn định'}
                </span>
              )}
            </div>

            {loading.trend ? (
              <TrendChartSkeleton />
            ) : trend && trend.hasEnoughData && trend.chartData.length >= 2 ? (
              <TrendChart data={trend.chartData} trend={trend.trend} change={trend.change} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FiBarChart2 size={40} className="mb-2 opacity-50" />
                <p className="text-sm">{trend?.message || 'Cần ít nhất 2 đề để xem biểu đồ'}</p>
              </div>
            )}
          </div>

          {/* Difficulty Breakdown - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <FiTarget size={18} /> Phân tích theo độ khó
            </h2>
            {loading.difficulty ? (
              <DifficultySkeleton />
            ) : difficulty && difficulty.breakdown.length > 0 ? (
              <DifficultyChart data={difficulty.breakdown} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Chưa có đủ dữ liệu phân tích theo độ khó
              </p>
            )}

            {difficulty && difficulty.breakdown.length > 0 && (
              <p className="text-sm text-gray-600 mt-4 italic">
                💡 {difficulty.suggestion}
              </p>
            )}
          </div>
        </div>

        {/* ─── ROW 3: Left - Topic Analysis | Right - Suggestions ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Topics - 3 cols */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <FiBookOpen size={18} /> Phân tích theo chủ đề
              </h2>
              <span className="text-xs text-gray-400">
                {topics?.analyzedTopics?.length || 0} chủ đề
              </span>
            </div>

            {loading.topics ? (
              <TopicSkeleton />
            ) : topics && topics.analyzedTopics.length > 0 ? (
              <TopicChart
                weaknesses={topics.weaknesses}
                strengths={topics.strengths}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FiBookOpen size={40} className="mb-2 opacity-50" />
                <p className="text-sm">Chưa có dữ liệu theo chủ đề. Hãy làm thêm đề thi nhé!</p>
              </div>
            )}
          </div>

          {/* Suggestions - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <FiZap size={18} className="text-amber-500" /> Gợi ý cho bạn
            </h2>
            {loading.overview ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-3">
                {suggestions.slice(0, 5).map((s, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border-l-4 flex items-start gap-2.5 ${
                      s.priority === 'high' ? 'bg-rose-50 border-rose-400' :
                      s.priority === 'medium' ? 'bg-amber-50 border-amber-400' :
                      'bg-blue-50 border-blue-400'
                    }`}
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${
                      s.priority === 'high' ? 'text-rose-500' :
                      s.priority === 'medium' ? 'text-amber-500' :
                      'text-blue-500'
                    }`}>
                      {s.priority === 'high' ? <FiAlertCircle size={15} /> : <FiCheckCircle size={15} />}
                    </span>
                    <p className={`text-sm leading-relaxed ${
                      s.priority === 'high' ? 'text-rose-800' :
                      s.priority === 'medium' ? 'text-amber-800' :
                      'text-blue-800'
                    }`}>{s.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FiZap size={40} className="mb-2 opacity-50" />
                <p className="text-sm text-center">Làm thêm đề để nhận gợi ý cá nhân hóa</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── ROW 4: Study Plan ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <FiBookOpen size={18} className="text-indigo-500" />
              Kế hoạch học tập 7 ngày
            </h2>
            {studyPlan && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {studyPlan.startsAt} → {studyPlan.endsAt}
                </span>
                <button
                  onClick={handleRefreshPlan}
                  disabled={loading.studyPlan}
                  className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50"
                >
                  <FiRefreshCw size={12} className={loading.studyPlan ? 'animate-spin' : ''} />
                  Tạo mới
                </button>
              </div>
            )}
          </div>

          {loading.studyPlan ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : studyPlan && studyPlan.days.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {studyPlan.days.map((day) => (
                <StudyDayCard key={day.day} day={day} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FiBookOpen size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có kế hoạch. Kế hoạch sẽ được tạo tự động sau khi bạn làm bài thi.</p>
            </div>
          )}
        </div>

        {/* ─── ROW 5: Exam History ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <FiClock size={18} /> Lịch sử thi gần đây
            </h2>
          </div>

          {loading.history ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-3 font-medium">Đề thi</th>
                    <th className="pb-3 font-medium">Môn</th>
                    <th className="pb-3 font-medium text-center">Điểm</th>
                    <th className="pb-3 font-medium text-center">Đúng/Sai</th>
                    <th className="pb-3 font-medium text-center">Thời gian</th>
                    <th className="pb-3 font-medium text-right">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-medium text-gray-900">{h.examTitle}</td>
                      <td className="py-3 text-gray-600">{h.subjectName}</td>
                      <td className="py-3 text-center">
                        <span className={`font-bold ${
                          h.score >= 80 ? 'text-emerald-600' :
                          h.score >= 60 ? 'text-amber-600' :
                          'text-rose-600'
                        }`}>
                          {Math.round(h.score)} đ
                        </span>
                      </td>
                      <td className="py-3 text-center text-gray-600">
                        <span className="text-emerald-600">{h.totalCorrect}✓</span>
                        {' / '}
                        <span className="text-rose-600">{h.totalIncorrect}✗</span>
                        {h.totalUnanswered > 0 && (
                          <span className="text-gray-400 ml-1">{h.totalUnanswered}–</span>
                        )}
                      </td>
                      <td className="py-3 text-center text-gray-500">
                        {formatTime(Math.round(h.durationSeconds / 60))}
                      </td>
                      <td className="py-3 text-right text-gray-400 text-xs">
                        {formatDate(h.submitTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FiClock size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có lịch sử thi</p>
            </div>
          )}
        </div>

        {/* ─── ROW 6: Exam Type Analysis (Phòng thi vs Tự do) ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <FiGrid size={18} className="text-purple-500" /> Phân tích theo loại đề
            </h2>
          </div>

          {loading.examType ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : examType && examType.hasEnoughData ? (
            <div className="space-y-4">
              {/* Comparison banner */}
              {examType.comparison && (
                <div className={`p-4 rounded-xl text-sm font-medium ${
                  examType.comparison.betterType === 'phong_thi'
                    ? 'bg-indigo-50 border border-indigo-200 text-indigo-800'
                    : examType.comparison.betterType === 'tu_do'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-gray-50 border border-gray-200 text-gray-700'
                }`}>
                  {examType.comparison.text}
                </div>
              )}

              {/* Two cards: Phòng thi vs Tự do */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phòng thi */}
                {examType.phongThi ? (
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">🏢</span>
                      <div>
                        <h3 className="font-bold text-indigo-900">Đề phòng thi</h3>
                        <p className="text-xs text-indigo-600">{examType.phongThi.attemptCount} lượt thi</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-indigo-500 mb-1">Điểm TB</p>
                        <p className="text-xl font-black text-indigo-900">{Math.round(examType.phongThi.avgPercentage)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-500 mb-1">Tỷ lệ đỗ</p>
                        <p className={`text-xl font-black ${examType.phongThi.passRate >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {examType.phongThi.passRate > 0 ? `${Math.round(examType.phongThi.passRate)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-500 mb-1">Điểm cao nhất</p>
                        <p className="text-lg font-bold text-indigo-800">{Math.round(examType.phongThi.maxPercentage)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-500 mb-1">TB thời gian</p>
                        <p className="text-lg font-bold text-indigo-800">{formatTime(Math.round(examType.phongThi.avgDurationSeconds / 60))}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    Chưa có dữ liệu đề phòng thi
                  </div>
                )}

                {/* Tự do */}
                {examType.tuDo ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-8 h-8 bg-amber-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">📝</span>
                      <div>
                        <h3 className="font-bold text-amber-900">Đề tự do</h3>
                        <p className="text-xs text-amber-600">{examType.tuDo.attemptCount} lượt thi</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-amber-500 mb-1">Điểm TB</p>
                        <p className="text-xl font-black text-amber-900">{Math.round(examType.tuDo.avgPercentage)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-500 mb-1">Tỷ lệ đỗ</p>
                        <p className={`text-xl font-black ${examType.tuDo.passRate >= 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {examType.tuDo.passRate > 0 ? `${Math.round(examType.tuDo.passRate)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-500 mb-1">Điểm cao nhất</p>
                        <p className="text-lg font-bold text-amber-800">{Math.round(examType.tuDo.maxPercentage)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-500 mb-1">TB thời gian</p>
                        <p className="text-lg font-bold text-amber-800">{formatTime(Math.round(examType.tuDo.avgDurationSeconds / 60))}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    Chưa có dữ liệu đề tự do
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FiGrid size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có đủ dữ liệu để phân tích theo loại đề</p>
            </div>
          )}
        </div>

        {/* ─── ROW 7: Weekday Heatmap ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <FiActivity size={18} className="text-emerald-500" /> Thói quen học tập theo ngày
            </h2>
            {weekday && weekday.hasEnoughData && weekday.tip && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                💡 {weekday.tip}
              </span>
            )}
          </div>

          {loading.weekday ? (
            <div className="grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : weekday && weekday.hasEnoughData ? (
            <div className="space-y-3">
              {/* Heatmap grid */}
              <div className="grid grid-cols-7 gap-2">
                {weekday.heatmap.map((day) => {
                  const intensity = day.intensityDays || day.intensityAttempts;
                  const bgColor = intensity >= 80 ? 'bg-emerald-500'
                    : intensity >= 60 ? 'bg-emerald-300'
                    : intensity >= 30 ? 'bg-emerald-100'
                    : intensity > 0 ? 'bg-emerald-50'
                    : 'bg-gray-50';
                  const textColor = intensity >= 60 ? 'text-white' : 'text-gray-700';
                  return (
                    <div key={day.weekday} className={`${bgColor} rounded-xl p-3 flex flex-col items-center gap-1`}>
                      <span className="text-xs font-bold text-gray-500">{day.label}</span>
                      <span className={`text-lg font-black ${textColor}`}>
                        {day.totalAttempts > 0 ? day.totalAttempts : '-'}
                      </span>
                      <span className="text-xs text-gray-400">{day.avgPercentage > 0 ? `${Math.round(day.avgPercentage)}%` : ''}</span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 justify-end">
                <span className="text-xs text-gray-400">Ít:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gray-50 rounded border border-gray-100" />
                  <div className="w-4 h-4 bg-emerald-50 rounded border border-emerald-100" />
                  <div className="w-4 h-4 bg-emerald-100 rounded border border-emerald-200" />
                  <div className="w-4 h-4 bg-emerald-300 rounded border border-emerald-300" />
                  <div className="w-4 h-4 bg-emerald-500 rounded border border-emerald-500" />
                </div>
                <span className="text-xs text-gray-400">Nhiều:</span>
              </div>
              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                <span>📅 {weekday.totalDaysStudied} ngày có hoạt động (90 ngày qua)</span>
                {weekday.mostActiveDay && (
                  <span className="text-emerald-600 font-medium">
                    ⭐ Năng suất nhất: {weekday.heatmap.find(d => d.weekday === weekday.mostActiveDay)?.label}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FiActivity size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Cần làm thêm đề để xem thói quen học tập theo ngày</p>
            </div>
          )}
        </div>

        {/* ─── ROW 8: Hardest Exams ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <FiStar size={18} className="text-rose-500" /> Top đề thi khó nhất
            </h2>
          </div>

          {loading.hardest ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : hardest && hardest.hasEnoughData && hardest.hardestExams.length > 0 ? (
            <div className="space-y-3">
              {hardest.hardestExams.map((exam, idx) => {
                const difficultyMap: Record<string, { label: string; cls: string }> = {
                  easy: { label: 'Dễ', cls: 'bg-emerald-100 text-emerald-700' },
                  medium: { label: 'TB', cls: 'bg-amber-100 text-amber-700' },
                  hard: { label: 'Khó', cls: 'bg-rose-100 text-rose-700' },
                };
                const diff = difficultyMap[exam.difficultyLevel] || difficultyMap.medium;
                const scoreColor = exam.userAvgPercentage >= 60 ? 'text-emerald-600' : exam.userAvgPercentage >= 40 ? 'text-amber-600' : 'text-rose-600';
                return (
                  <div key={exam.examId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-rose-200 transition-colors">
                    {/* Rank */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                      idx === 0 ? 'bg-rose-500 text-white' : idx === 1 ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{exam.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{exam.subjectName}</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${diff.cls}`}>{diff.label}</span>
                        <span>{exam.userAttempts} lần thi</span>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Điểm TB của bạn</p>
                        <p className={`text-lg font-black ${scoreColor}`}>{Math.round(exam.userAvgPercentage)}%</p>
                      </div>
                      {exam.overallPassRate > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Tỷ lệ đỗ chung</p>
                          <p className="text-sm font-bold text-gray-500">{Math.round(exam.overallPassRate)}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FiStar size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có đủ dữ liệu để xếp hạng độ khó</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  loading, icon, label, value, sub, color
}: {
  loading: boolean;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const bgMap = {
    indigo: 'bg-indigo-50 border-indigo-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
    rose: 'bg-rose-50 border-rose-100',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
        <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3" />
        <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
        <div className="h-8 bg-gray-200 rounded w-16 mb-1" />
        <div className="h-3 bg-gray-200 rounded w-28" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${bgMap[color]} p-5`}>
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3">
        {icon}
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function TrendChart({
  data, trend, change
}: {
  data: { date: string; score: number; subject: string; examTitle: string }[];
  trend: string | null;
  change: number;
}) {
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  return (
    <div>
      {/* Mini summary */}
      {change !== 0 && (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="text-gray-500">So với trung bình trước:</span>
          <span className={`font-bold ${change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {change > 0 ? '+' : ''}{Math.round(change)} điểm
          </span>
        </div>
      )}

      {/* SVG line chart */}
      <div className="relative h-44">
        <svg viewBox={`0 0 ${data.length * 80 + 40} 180`} className="w-full h-full">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 20 + i * 35;
            return (
              <line
                key={i}
                x1="40"
                y1={y}
                x2={data.length * 80 + 30}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
            );
          })}

          {/* Line path */}
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinejoin="round"
            points={data.map((d, i) => {
              const x = 50 + i * 80;
              const y = 150 - ((d.score - min) / range) * 120;
              return `${x},${y}`;
            }).join(' ')}
          />

          {/* Dots */}
          {data.map((d, i) => {
            const x = 50 + i * 80;
            const y = 150 - ((d.score - min) / range) * 120;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="5" fill="#6366f1" />
                <circle cx={x} cy={y} r="8" fill="#6366f1" opacity="0.2" />
                {/* Score label */}
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#4f46e5"
                >
                  {Math.round(d.score)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 px-2">
          {data.map((d, i) => (
            <span key={i} className="text-xs text-gray-400 text-center" style={{ width: '60px' }}>
              {i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)
                ? formatDate(d.date)
                : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DifficultyChart({ data }: { data: DifficultyBreakdown[] }) {
  const difficultyLabels: Record<string, string> = {
    easy: 'Dễ', medium: 'Trung bình', hard: 'Khó',
  };
  const difficultyColors: Record<string, string> = {
    easy: '#22c55e',
    medium: '#f59e0b',
    hard: '#ef4444',
  };

  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.difficulty} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 capitalize">
              {difficultyLabels[d.difficulty] || d.difficulty}
            </span>
            <span className="font-bold text-gray-900">{d.accuracy}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${d.accuracy}%`,
                backgroundColor: difficultyColors[d.difficulty] || '#6366f1',
              }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {d.questionsAnswered} câu · {d.correctCount} đúng · TB {d.avgTimeSeconds}s/câu
          </p>
        </div>
      ))}
    </div>
  );
}

function TopicChart({
  weaknesses, strengths
}: {
  weaknesses: TopicAnalysisData['weaknesses'];
  strengths: TopicAnalysisData['strengths'];
}) {
  const getAccuracyColor = (acc: number) => {
    if (acc >= 80) return 'emerald';
    if (acc >= 60) return 'amber';
    return 'rose';
  };

  const colorMap = { rose: 'bg-rose-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500' };
  const labelMap = { rose: 'text-rose-600', amber: 'text-amber-600', emerald: 'text-emerald-600' };

  const all = [
    ...weaknesses.slice(0, 5).map((w) => ({ ...w, type: 'weak' as const })),
    ...strengths.slice(0, 3).map((s) => ({ ...s, type: 'strong' as const })),
  ].slice(0, 7);

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <FiBookOpen size={40} className="mb-2 opacity-50" />
        <p className="text-sm">Chưa có đủ dữ liệu theo chủ đề</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {all.map((item, idx) => {
        const color = getAccuracyColor(item.accuracy);
        return (
          <div key={idx} className="flex items-center gap-3">
            <div className={`w-2 h-10 rounded-full flex-shrink-0 ${colorMap[color]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800 truncate">
                  {item.topicName}
                  <span className="text-xs text-gray-400 ml-1">· {item.subjectName}</span>
                </span>
                <span className={`font-bold text-sm flex-shrink-0 ml-2 ${labelMap[color]}`}>
                  {item.accuracy}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-full rounded-full ${colorMap[color]}`}
                  style={{ width: `${item.accuracy}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudyDayCard({ day }: { day: StudyPlanData['days'][0] }) {
  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
    theory: { label: 'Lý thuyết', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    exam: { label: 'Luyện đề', color: 'text-amber-600', bg: 'bg-amber-50' },
    practice: { label: 'Luyện tập', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    review: { label: 'Tổng kết', color: 'text-purple-600', bg: 'bg-purple-50' },
  };

  const config = typeConfig[day.type] || typeConfig.practice;
  const dayLabel = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(day.date).getDay()];

  return (
    <div className={`rounded-xl p-3 border transition-all ${
      day.isToday
        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
        : day.isPast
        ? 'bg-gray-50 border-gray-100 opacity-60'
        : 'bg-white border-gray-100 hover:border-indigo-200'
    }`}>
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-bold text-gray-400">{dayLabel}</span>
          <span className="block text-xs font-bold text-gray-900">Ngày {day.day}</span>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${config.color} ${config.bg}`}>
          {config.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-gray-800 leading-tight mb-2 line-clamp-2">
        {day.title}
      </p>

      {/* Tasks count */}
      <p className="text-xs text-gray-400">{day.tasks.length} nhiệm vụ</p>

      {/* Focus topics */}
      {day.focusTopics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {day.focusTopics.slice(0, 2).map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 truncate max-w-full">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Today indicator */}
      {day.isToday && (
        <div className="mt-2 text-center">
          <span className="text-xs font-bold text-indigo-600">Hôm nay</span>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function TrendChartSkeleton() {
  return <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />;
}

function DifficultySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-2.5 bg-gray-200 rounded-full" style={{ width: `${50 + i * 15}%` }} />
        </div>
      ))}
    </div>
  );
}

function TopicSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-2 h-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
            <div className="h-1.5 bg-gray-200 rounded-full animate-pulse" style={{ width: `${40 + i * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Utility helpers ───────────────────────────────────────────────────────────

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}p`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}p` : `${h}h`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
