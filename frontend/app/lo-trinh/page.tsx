'use client';

import Header from '@/components/layout/Header';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { AIInsights } from '@/components/ai/AIInsights';
import LearningActionsPanel from '@/components/insights/LearningActionsPanel';
import {
  getRecommendations,
  getStudyPlan,
  getTopicAnalysis,
  type ExamRecommendation,
  type StudyPlanData,
  type StudyPlanDay,
  type TopicAnalysisData,
} from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';
import { getExamSubjectCode, getSubjectMeta, normalizeContentSubject } from '@/lib/utils/subjectScope';
import Link from 'next/link';
import { FiBookOpen, FiCheckCircle, FiClock, FiLock, FiPlayCircle, FiRefreshCw, FiStar, FiTarget, FiUnlock, FiTrendingUp, FiZap } from 'react-icons/fi';
import { useState, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import axiosInstance from '@/lib/utils/axios';

export default function LoTrinhPage() {
  const { isAuthenticated } = useAuthStore();
  const searchParams = useSearchParams();
  const subjectParam = searchParams.get('subject');
  const normalizedSubject = normalizeContentSubject(subjectParam);
  const subjectMeta = getSubjectMeta(normalizedSubject);
  const subjectCode = normalizedSubject ? getExamSubjectCode(normalizedSubject) : undefined;
  const [mounted, setMounted] = useState(false);

  const [roadmapMilestones, setRoadmapMilestones] = useState<any[]>([]);
  const [roadmapStats, setRoadmapStats] = useState<any>(null);
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(null);
  const [topicData, setTopicData] = useState<TopicAnalysisData | null>(null);
  const [recommendations, setRecommendations] = useState<ExamRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) {
      loadRoadmapData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, subjectCode]);

  const loadRoadmapData = async (forcePlan = false) => {
    try {
      setLoading(true);
      const [roadmapRes, planRes, topicsRes, recRes] = await Promise.allSettled([
        axiosInstance.get('/users/roadmap', { params: subjectCode ? { subject: subjectCode } : undefined }),
        getStudyPlan(subjectCode, forcePlan),
        getTopicAnalysis(subjectCode),
        getRecommendations(),
      ]);

      if (roadmapRes.status === 'fulfilled' && roadmapRes.value.data?.success) {
        setRoadmapMilestones(roadmapRes.value.data.data.milestones || []);
        setRoadmapStats(roadmapRes.value.data.data.stats || null);
      }
      if (planRes.status === 'fulfilled') setStudyPlan(planRes.value);
      if (topicsRes.status === 'fulfilled') setTopicData(topicsRes.value);
      if (recRes.status === 'fulfilled') {
        setRecommendations(
          (recRes.value.recommendations || []).filter((item) => !subjectCode || item.subjectCode === subjectCode).slice(0, 3),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const IconMap: any = {
    FaFlagCheckered: FiUnlock,
    FaMountain: FiTarget,
    FaRunning: FiTarget,
    FaTrophy: FiStar,
    FiUnlock: FiUnlock,
    FiTarget: FiTarget,
    FiLock: FiLock,
    FiStar: FiStar
  };

  if (subjectParam) {
    return (
      <SubjectStudyShell
        title="Lộ Trình Học Cá Nhân"
        subjectSlug={subjectParam}
        activeSection="lo-trinh"
        searchPlaceholder="Tìm mốc lộ trình..."
      >
        {!mounted || loading ? (
          <div className="space-y-5 animate-pulse">
            <div className="h-32 rounded-2xl border border-slate-200 bg-white" />
            <div className="h-96 rounded-2xl border border-slate-200 bg-white" />
          </div>
        ) : !isAuthenticated ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <FiLock size={34} />
            </div>
            <h2 className="mb-3 text-xl font-black text-slate-900">Đăng nhập để xem Lộ Trình</h2>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
              AI sẽ phân tích kết quả theo môn và tạo lộ trình học tập cá nhân hóa.
            </p>
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-violet-600 px-8 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
            >
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {roadmapMilestones.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <FiTrendingUp />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Mốc tiến bộ</h2>
                    <p className="text-sm font-medium text-slate-500">Các chặng học tập được mở theo kết quả luyện đề.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {roadmapMilestones.map((ms, i) => {
                    const Icon = IconMap[ms.icon] || FiLock;
                    return (
                      <div key={ms.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                        <div className="mb-2 flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                            <Icon size={16} />
                          </span>
                          <div>
                            <span className="text-[11px] font-black uppercase text-violet-500">Chặng {i + 1}</span>
                            <h3 className="text-sm font-black text-slate-900">{ms.title}</h3>
                          </div>
                        </div>
                        <p className="text-xs font-medium leading-relaxed text-slate-500">{ms.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <RoadmapFocusPanel
              subjectLabel={subjectMeta?.label || 'môn này'}
              stats={roadmapStats}
              studyPlan={studyPlan}
              topicData={topicData}
              recommendations={recommendations}
              loading={loading}
              onRefresh={() => loadRoadmapData(true)}
            />
            <LearningActionsPanel subjectCode={subjectCode} />
            <AIInsights subjectCode={subjectCode} />
          </div>
        )}
      </SubjectStudyShell>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden">
      {/* Decorative gradient patches */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-200/40 to-pink-200/40 blur-[100px] rounded-full mix-blend-multiply pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-cyan-100/40 to-purple-200/40 blur-[120px] rounded-full mix-blend-multiply pointer-events-none -translate-x-1/2" />

      <Header />

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-[1400px] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 lg:col-start-3 space-y-8">
            
            {/* Hero Banner Roadmap */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 rounded-[2rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-[80px] pointer-events-none" />
              
              <div className="relative z-10 w-full">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full shadow-inner text-xs font-bold uppercase tracking-widest border border-white/20 mb-4">
                  <FiTrendingUp className="text-pink-400" /> Bản Đồ Học Tập
                </div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-3">
                  Lộ Trình Tinh Anh
                </h1>
                <p className="text-purple-100 text-lg leading-relaxed max-w-xl">
                  AI đang cá nhân hoá đường đi của bạn. Liên tục bứt phá các mốc điểm trong Đề Mô Phỏng để mở khoá Chặng tiếp theo.
                </p>
              </div>

              <div className="hidden md:flex relative z-10 shrink-0 w-32 h-32 bg-gradient-to-tr from-indigo-800 to-fuchsia-800 rounded-3xl items-center justify-center border-2 border-white/10 shadow-inner rotate-3 hover:rotate-0 transition-transform duration-300">
                 <span className="text-6xl drop-shadow-lg">🗺️</span>
               </div>
            </div>

            {/* Authentication Guard / Loading / Content */}
            {!mounted || loading ? (
              <div className="space-y-12 animate-pulse">
                <div className="h-40 bg-white/50 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm" />
                <div className="h-96 bg-white/50 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm" />
              </div>
            ) : !isAuthenticated ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 p-12 text-center max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-6 shadow-sm">
                  <span className="text-5xl">🔒</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
                  Ai đó chưa đăng nhập nhỉ?
                </h2>
                <p className="text-gray-500 mb-8 leading-relaxed max-w-sm mx-auto">
                  Trí tuệ nhân tạo Gemini cần biết tên bạn để xếp hạng và vẽ chính xác lộ trình cá nhân hoá riêng rẽ.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-900/20 transition-all duration-300"
                >
                  <FiUnlock /> Đăng nhập & Bắt đầu
                </Link>
              </div>
            ) : (
              <div className="space-y-12">
                
                {/* 1. Milestone Timeline UI */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-sm p-8 max-w-3xl mx-auto">
                  <h3 className="text-xl font-bold border-b border-gray-100 pb-4 mb-8 text-gray-800">
                    Sống sót chặng đường
                  </h3>
                  <div className="relative pl-6 md:pl-8 border-l-2 border-indigo-100 space-y-10">
                    
                    {roadmapMilestones.map((ms, i) => {
                      const isComplete = ms.status === 'completed';
                      const isCurrent = ms.status === 'current';
                      const isLocked = ms.status === 'locked';
                      const Icon = IconMap[ms.icon] || FiLock;
                      
                      return (
                        <div key={ms.id} className="relative group">
                          {/* Circle dot on line */}
                          <div className={`absolute -left-[35px] md:-left-[43px] w-8 h-8 md:w-10 md:h-10 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 transition-colors duration-300 ${isLocked ? 'bg-gray-200' : ms.color}`}>
                             <Icon size={14} className={isLocked ? 'text-gray-400' : 'text-white'} />
                             
                             {/* Ping effect for current stage */}
                             {isCurrent && (
                                <span className="absolute w-full h-full rounded-full bg-indigo-500 opacity-40 animate-ping" />
                             )}
                          </div>
                          
                          {/* Content Bubble */}
                          <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                            isCurrent 
                              ? 'bg-gradient-to-r from-indigo-50 to-white hover:shadow-lg border-indigo-200 -translate-y-1' 
                              : isComplete 
                                ? 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/10'
                                : 'bg-gray-50 border-transparent opacity-60 grayscale hover:grayscale-0'
                          }`}>
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${
                                isComplete ? 'bg-emerald-100 text-emerald-800' : isCurrent ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                Chặng {i + 1}
                              </span>
                              <h4 className={`text-lg font-bold ${isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                                {ms.title}
                              </h4>
                            </div>
                            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                              {ms.description}
                            </p>
                            
                            {isCurrent && (
                              <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all duration-300 active:scale-95">
                                Tiếp tục học
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Original AI Insights Dashboard */}
                <RoadmapFocusPanel
                  subjectLabel="tất cả môn"
                  stats={roadmapStats}
                  studyPlan={studyPlan}
                  topicData={topicData}
                  recommendations={recommendations}
                  loading={loading}
                  onRefresh={() => loadRoadmapData(true)}
                />
                <LearningActionsPanel subjectCode={subjectCode} />
                <AIInsights subjectCode={subjectCode} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function RoadmapFocusPanel({
  subjectLabel,
  stats,
  studyPlan,
  topicData,
  recommendations,
  loading,
  onRefresh,
}: {
  subjectLabel: string;
  stats: any;
  studyPlan: StudyPlanData | null;
  topicData: TopicAnalysisData | null;
  recommendations: ExamRecommendation[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const today = studyPlan?.days?.find((day) => day.isToday) || studyPlan?.days?.[0];
  const weakTopics = topicData?.weaknesses?.slice(0, 4) || [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <FiZap className="text-violet-600" /> Lộ trình cải thiện hằng ngày
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Tổng hợp riêng cho {subjectLabel}: tiến độ, việc hôm nay, chủ đề yếu và đề nên làm tiếp.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Tạo lại kế hoạch
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard icon={<FiCheckCircle />} label="Đề đã làm" value={stats?.attempts || 0} />
        <MetricCard icon={<FiTrendingUp />} label="Điểm TB" value={stats?.avgScore ? `${stats.avgScore}` : '--'} />
        <MetricCard
          icon={<FiClock />}
          label="7 ngày gần đây"
          value={stats?.weeklyChange ? `${stats.weeklyChange > 0 ? '+' : ''}${stats.weeklyChange}` : '--'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-violet-800">
            <FiTarget /> Hôm nay cần làm
          </div>
          {today ? (
            <div>
              <h3 className="font-black text-slate-900">{today.title}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{today.description}</p>
              <ul className="mt-3 space-y-2">
                {(today.tasks || []).slice(0, 4).map((task) => (
                  <li key={task} className="flex gap-2 text-sm font-medium text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {task}
                  </li>
                ))}
              </ul>
              {today.targetExam && (
                <Link
                  href={`/exam/${today.targetExam.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white"
                >
                  <FiPlayCircle /> Làm đề gợi ý
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">Làm ít nhất 1 đề để hệ thống tạo việc học hôm nay.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <FiBookOpen className="text-indigo-600" /> Kế hoạch 7 ngày
            </h3>
            {studyPlan && <span className="text-xs font-bold text-slate-400">{studyPlan.startsAt} - {studyPlan.endsAt}</span>}
          </div>
          {studyPlan?.days?.length ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {studyPlan.days.map((day) => <MiniStudyDay key={day.day} day={day} />)}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">Chưa có kế hoạch 7 ngày.</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
          <h3 className="mb-3 text-sm font-black text-amber-900">Chủ đề yếu cần ưu tiên</h3>
          {weakTopics.length ? (
            <div className="space-y-2">
              {weakTopics.map((topic) => (
                <div key={topic.topicId} className="rounded-xl bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-900">{topic.topicName}</span>
                    <span className="text-xs font-black text-rose-600">{Math.round(topic.errorRate)}% sai</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{topic.advice || 'Ôn lại lý thuyết và luyện thêm câu cùng chủ đề.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">Chưa đủ dữ liệu chủ đề yếu cho môn này.</p>
          )}
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <h3 className="mb-3 text-sm font-black text-indigo-900">Đề nên làm tiếp</h3>
          {recommendations.length ? (
            <div className="space-y-2">
              {recommendations.map((exam) => (
                <Link key={exam.examId} href={`/exam/${exam.examId}`} className="block rounded-xl bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-900">{exam.examTitle}</span>
                    <span className="text-xs font-black text-indigo-600">{exam.totalQuestions} câu</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{exam.reason?.text}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-500">Chưa có đề gợi ý riêng cho môn này.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">{icon}</div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
    </div>
  );
}

function MiniStudyDay({ day }: { day: StudyPlanDay }) {
  const tone = day.isToday
    ? 'border-violet-300 bg-violet-50 text-violet-800'
    : day.isPast
    ? 'border-slate-100 bg-slate-50 text-slate-400'
    : 'border-slate-100 bg-white text-slate-700';

  return (
    <div className={`min-h-[118px] rounded-xl border p-3 ${tone}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black">Ngày {day.day}</span>
        {day.isToday && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">Hôm nay</span>}
      </div>
      <p className="line-clamp-2 text-xs font-black leading-snug">{day.title}</p>
      <p className="mt-2 text-[11px] font-medium opacity-70">{day.estimatedMinutes} phút</p>
    </div>
  );
}
