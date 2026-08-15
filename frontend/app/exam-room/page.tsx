'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { 
  FiMonitor, FiUsers, FiClock, FiCalendar, 
  FiAward,
  FiPlayCircle, FiChevronRight, FiSettings,
  FiArrowRight, FiCheckCircle, FiXCircle, FiPrinter
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import axiosInstance from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { ExamRegistration, OfficialExamLeaderboardEntry, officialExamApi } from '@/lib/api/officialExams';

interface LobbyExam {
  id: number;
  title: string;
  title_cn?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  [key: string]: any;
}

interface LobbyData {
  live: LobbyExam[];
  upcoming: LobbyExam[];
  public: LobbyExam[];
  latest_completed_mock: LobbyExam | null;
}

export default function ExamRoomPage() {
  const { user } = useAuthStore();
  const isExamAdmin = hasPermission(user, 'exams.manage');
  const [mounted, setMounted] = useState(false);
  const [lobbyData, setLobbyData] = useState<LobbyData>({ live: [], upcoming: [], public: [], latest_completed_mock: null });
  const [registrations, setRegistrations] = useState<Record<number, ExamRegistration | null>>({});
  const [registrationLoading, setRegistrationLoading] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [leaderboard, setLeaderboard] = useState<OfficialExamLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const upcomingExamsRef = useRef<HTMLElement>(null);
  const latestLeaderboardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    
    let cancelled = false;

    const fetchLobbyAndLeaderboard = async () => {
      try {
        const res = await axiosInstance.get('/exams/lobby');
        if (!res.data?.success || cancelled) return;

        const data: LobbyData = {
          live: res.data.data?.live || [],
          upcoming: res.data.data?.upcoming || [],
          public: res.data.data?.public || [],
          latest_completed_mock: res.data.data?.latest_completed_mock || null,
        };
        setLobbyData(data);

        if (!data.latest_completed_mock?.id) {
          setLeaderboard([]);
          setLeaderboardLoading(false);
          return;
        }

        setLeaderboardLoading(true);
        const result = await officialExamApi.getLeaderboard(data.latest_completed_mock.id);
        if (!cancelled) setLeaderboard(result.leaderboard || []);
      } catch (err) {
        console.error("Failed to fetch exam lobby leaderboard:", err);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };

    fetchLobbyAndLeaderboard();
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchLobbyAndLeaderboard();
    }, 30000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const officialExams = [...lobbyData.live, ...lobbyData.upcoming];
    if (officialExams.length === 0) return;

    let cancelled = false;
    Promise.all(
      officialExams.map(async (exam) => {
        try {
          const registration = await officialExamApi.getMyRegistration(exam.id);
          return [exam.id, registration] as const;
        } catch {
          return [exam.id, null] as const;
        }
      })
    ).then((items) => {
      if (cancelled) return;
      setRegistrations((prev) => ({
        ...prev,
        ...Object.fromEntries(items),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, lobbyData.live, lobbyData.upcoming]);

  const getTimeRemaining = (endTime?: string | null) => {
    if (!endTime) return "N/A";
    const end = new Date(endTime).getTime();
    const diff = end - now;
    if (diff <= 0) return "Đã kết thúc";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  const formatUpcomingTime = (startTime?: string | null) => {
    if (!startTime) return "N/A";
    const date = new Date(startTime);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.toLocaleDateString('vi-VN')}`;
  };

  const colors = ['bg-rose-500', 'bg-indigo-600', 'bg-emerald-500', 'bg-orange-500'];
  const MEDAL = ['🥇', '🥈', '🥉'];

  const scrollToUpcomingExams = () => {
    upcomingExamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToLatestLeaderboard = () => {
    latestLeaderboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const registrationLabel: Record<string, string> = {
    registered: 'Đã đăng ký',
    approved: 'Đã duyệt',
    checked_in: 'Đã check-in',
    completed: 'Đã hoàn tất',
    no_show: 'Vắng thi',
    cancelled: 'Đã hủy',
  };

  const registrationClass = (status?: string) => {
    if (status === 'approved' || status === 'checked_in') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'registered') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'cancelled' || status === 'no_show') return 'bg-gray-50 text-gray-500 border-gray-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const refreshRegistration = async (examId: number) => {
    const registration = await officialExamApi.getMyRegistration(examId);
    setRegistrations((prev) => ({ ...prev, [examId]: registration }));
  };

  const handleRegister = async (examId: number) => {
    if (!user?.id) {
      window.location.href = '/login';
      return;
    }
    try {
      setRegistrationLoading((prev) => ({ ...prev, [examId]: true }));
      const registration = await officialExamApi.register(examId);
      setRegistrations((prev) => ({ ...prev, [examId]: registration }));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể đăng ký kỳ thi lúc này.');
    } finally {
      setRegistrationLoading((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const handleCancelRegistration = async (examId: number) => {
    if (!confirm('Hủy đăng ký kỳ thi này?')) return;
    try {
      setRegistrationLoading((prev) => ({ ...prev, [examId]: true }));
      const registration = await officialExamApi.cancelRegistration(examId);
      setRegistrations((prev) => ({ ...prev, [examId]: registration }));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể hủy đăng ký lúc này.');
      await refreshRegistration(examId).catch(() => {});
    } finally {
      setRegistrationLoading((prev) => ({ ...prev, [examId]: false }));
    }
  };

  const renderRegistrationPanel = (exam: any, compact = false) => {
    const registration = registrations[exam.id];
    const loading = registrationLoading[exam.id];
    const status = registration?.status;
    const approved = status === 'approved' || status === 'checked_in';
    const startMs = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const hasStarted = !!startMs && now >= startMs;
    const canRegister = (!status || status === 'cancelled') && !hasStarted;
    const canCancel = (status === 'registered' || status === 'approved') && !hasStarted;

    return (
      <div className={`rounded-2xl border ${registrationClass(status)} ${compact ? 'p-3' : 'p-4'} space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide">
            {approved ? <FiCheckCircle size={14} /> : status === 'cancelled' ? <FiXCircle size={14} /> : <FiCalendar size={14} />}
            {status ? registrationLabel[status] || status : 'Chưa đăng ký'}
          </span>
          {approved && (
            <Link href={`/exam/${exam.id}/ticket`} className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-900">
              <FiPrinter size={13} /> Vé dự thi
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canRegister ? (
            <button
              type="button"
              onClick={() => handleRegister(exam.id)}
              disabled={loading}
              className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-black text-white hover:bg-rose-600 disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </button>
          ) : canCancel ? (
            <button
              type="button"
              onClick={() => handleCancelRegistration(exam.id)}
              disabled={loading}
              className="rounded-xl border border-current px-4 py-2 text-xs font-black hover:bg-white/70 disabled:opacity-60"
            >
              {loading ? 'Đang xử lý...' : 'Hủy đăng ký'}
            </button>
          ) : null}
          <Link
            href={`/exam-room/${exam.id}`}
            className="rounded-xl bg-white/80 px-4 py-2 text-xs font-black text-gray-800 hover:bg-white"
          >
            Chi tiết
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] relative flex flex-col">
      {/* Background Decorators */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-rose-200/40 to-orange-200/40 blur-[100px] rounded-full mix-blend-multiply pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-100/40 to-purple-200/40 blur-[100px] rounded-full mix-blend-multiply pointer-events-none" />
      
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 md:py-10 max-w-[1400px] relative z-10 space-y-12">
        
        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-rose-600 via-red-500 to-orange-500 rounded-3xl p-6 md:p-8 md:py-10 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-2xl">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full shadow-sm text-[10px] font-bold uppercase tracking-widest border border-white/30 mb-4">
               <div className="w-2 h-2 rounded-full bg-green-400 animate-ping absolute" />
               <div className="w-2 h-2 rounded-full bg-green-400 relative" />
               SERVER ĐANG HOẠT ĐỘNG
             </div>
             
             <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-2 drop-shadow-md">
               Sảnh Thi Đấu <span className="text-orange-200">Trung Tâm</span>
             </h1>
             <p className="text-rose-100 text-sm md:text-base leading-relaxed mb-6 max-w-xl">
               Nơi riêng dành cho kỳ thi theo lịch: đăng ký và vào thi đúng giờ. Đề luyện tập tự do không hiển thị lẫn tại đây.
             </p>
             
             <div className="flex flex-wrap gap-3">
               <button 
                 onClick={scrollToUpcomingExams}
                 className="px-6 py-2.5 bg-white text-rose-600 text-sm font-bold rounded-xl shadow-md hover:bg-rose-50 hover:scale-105 transition-all duration-300"
               >
                 Xem kỳ thi để đăng ký
               </button>
               <button
                 type="button"
                 onClick={scrollToLatestLeaderboard}
                 className="px-6 py-2.5 bg-rose-700/50 backdrop-blur-md border border-rose-400/50 text-white text-sm font-bold rounded-xl shadow-md hover:bg-rose-700 transition-all duration-300 flex items-center gap-2"
               >
                 <FiAward /> Xem kết quả kỳ thi gần nhất
               </button>
             </div>
          </div>

          <div className="hidden lg:flex relative z-10 shrink-0 right-4">
            <div className="w-36 h-36 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full flex items-center justify-center border-4 border-white/20 shadow-[-15px_15px_30px_rgba(0,0,0,0.15)]">
               <FiMonitor className="text-5xl text-white drop-shadow-md" />
            </div>
            {/* Decorative orbit elements */}
            <div className="absolute top-0 left-0 w-6 h-6 rounded-full bg-white/80 backdrop-blur animate-bounce shadow-md" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-2 right-2 w-10 h-10 rounded-xl bg-orange-200/90 backdrop-blur rotate-12 shadow-md flex items-center justify-center">
              <span className="text-xl">🏆</span>
            </div>
          </div>
        </div>

        {/* ── LIVE EXAMS ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600">
                 <FiPlayCircle className="text-xl animate-pulse" />
               </div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Đang Diễn Ra</h2>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lobbyData.live.length === 0 && <p className="text-gray-500 col-span-full">Chưa có kỳ thi nào đang diễn ra.</p>}
            {lobbyData.live.map((exam, idx) => (
              <div key={exam.id} className="group relative bg-white rounded-[2rem] border border-rose-100 p-6 sm:p-8 shadow-sm hover:shadow-2xl hover:shadow-rose-100/50 transition-all duration-400 focus-within:ring-2 focus-within:ring-rose-500 overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 ${colors[idx % colors.length]} text-white opacity-5 rounded-bl-full`} />
                
                {/* SSR Hydration Guard */}
                {!mounted ? (
                  <div className="absolute inset-0 bg-white z-10 flex flex-col p-6 sm:p-8 animate-pulse">
                     <div className="flex justify-between items-start mb-6 w-full">
                       <div className="w-24 h-6 bg-slate-200 rounded-lg"></div>
                       <div className="w-12 h-6 bg-slate-200 rounded-full"></div>
                     </div>
                     <div className="w-3/4 h-8 bg-slate-200 rounded-lg mb-6"></div>
                     <div className="mt-auto flex justify-between items-end">
                        <div className="w-1/2 h-8 bg-slate-200 rounded-lg"></div>
                        <div className="w-24 h-10 bg-slate-300 rounded-xl"></div>
                     </div>
                  </div>
                ) : null}
                
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg uppercase tracking-wider">{exam.subject_name || exam.code || 'Môn học'}</span>
                    <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span> Live
                    </span>
                    {exam.is_premium && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-gradient-to-r from-amber-200 to-orange-300 text-orange-800 text-[10px] font-black rounded-md shadow-sm">
                        <FaCrown size={8} /> VIP
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${colors[idx % colors.length]} text-white`}>HOT</span>
                </div>
                
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 group-hover:text-rose-600 transition-colors leading-tight">{exam.title}</h3>
                
                <div className="mb-5">
                  {renderRegistrationPanel(exam)}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-medium mb-1">Thí sinh</span>
                      <span className="flex items-center gap-1.5 font-bold text-gray-800"><FiUsers className="text-gray-400" /> {exam.participants?.toLocaleString() || 0}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 font-medium mb-1">Thời gian còn</span>
                      <span className="flex items-center gap-1.5 font-bold text-rose-600 tabular-nums"><FiClock /> {getTimeRemaining(exam.end_time)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isExamAdmin && (
                      <Link
                        href={`/admin/exams/${exam.id}/official`}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                        title="Quản trị phòng thi"
                      >
                        <FiSettings size={14} /> Quản trị
                      </Link>
                    )}
                    <Link href={`/exam-room/${exam.id}`} className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-rose-600 hover:shadow-lg transition-all duration-300">
                      Chi tiết phòng thi <FiChevronRight />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── UPCOMING EXAMS ────────────────────────────────────────── */}
          <section ref={upcomingExamsRef} className="scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
               <FiCalendar className="text-xl" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Kỳ Thi Sắp Tới</h2>
               <p className="mt-1 text-sm font-semibold text-gray-500">Các kỳ thi dưới đây đang mở đăng ký và được tự động duyệt.</p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lobbyData.upcoming.length === 0 && <p className="text-gray-500 col-span-full">Chưa có kỳ thi nào sắp mở.</p>}
            {lobbyData.upcoming.map(exam => (
              <div key={exam.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
                <span className="inline-flex items-center gap-2 mb-4 w-fit">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs font-bold rounded-lg uppercase tracking-wider">{exam.subject_name || exam.code || 'Môn học'}</span>
                  {exam.is_premium && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-gradient-to-r from-amber-200 to-orange-300 text-orange-800 text-[10px] font-black rounded-md shadow-sm">
                      <FaCrown size={8} /> VIP
                    </span>
                  )}
                </span>
                
                {!mounted ? (
                   <div className="flex-1 animate-pulse">
                     <div className="w-3/4 h-6 bg-slate-200 rounded-md mb-4"></div>
                     <div className="w-full h-20 bg-slate-100 rounded-2xl mb-4"></div>
                     <div className="w-full h-12 bg-slate-200 rounded-xl mt-auto"></div>
                   </div>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex-1">{exam.title}</h3>
                    
                    <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2"><FiClock /> Bắt đầu</span>
                        <span className="font-semibold text-gray-900">{formatUpcomingTime(exam.start_time)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2"><FiUsers /> Đã đăng ký</span>
                        <span className="font-semibold text-gray-900">{exam.registered || 0} người</span>
                      </div>
                    </div>
                    {renderRegistrationPanel(exam, true)}

                    <Link 
                      href={`/exam-room/${exam.id}`}
                      className="w-full py-3 bg-white border-2 border-gray-200 text-gray-800 font-bold rounded-xl hover:border-gray-900 transition-colors text-center block"
                    >
                      Chi tiết
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── LATEST COMPLETED MOCK EXAM LEADERBOARD ─────────────── */}
          <section ref={latestLeaderboardRef} className="scroll-mt-24">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-100 text-yellow-600">
                  <FiAward className="text-xl" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Bảng xếp hạng kỳ thi thử vừa kết thúc</h2>
                  <p className="text-sm font-semibold text-gray-500">
                    {lobbyData.latest_completed_mock
                      ? `${lobbyData.latest_completed_mock.title} · Chỉ tính kết quả của kỳ thi này.`
                      : 'Kết quả sẽ tự động cập nhật sau khi kỳ thi thử kết thúc.'}
                  </p>
                </div>
              </div>
              {lobbyData.latest_completed_mock && (
                <Link href={`/exam-room/${lobbyData.latest_completed_mock.id}`} className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors">
                  Xem chi tiết kỳ thi <FiArrowRight />
                </Link>
              )}
            </div>

            {leaderboardLoading ? (
              <div className="h-36 rounded-[2rem] border border-gray-100 bg-white shadow-sm animate-pulse" />
            ) : !lobbyData.latest_completed_mock ? (
              <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm font-semibold text-gray-500">
                Chưa có kỳ thi thử theo lịch nào đã kết thúc.
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-[2rem] border border-yellow-100 bg-yellow-50 px-6 py-10 text-center">
                <p className="font-black text-gray-900">Kỳ thi đã kết thúc, kết quả đang được cập nhật.</p>
                <p className="mt-1 text-sm font-semibold text-gray-500">Bảng này sẽ tự làm mới sau mỗi 30 giây.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              {/* Top 3 highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                {leaderboard.slice(0, 3).map((entry, idx) => (
                  <div key={entry.user_id} className={`flex items-center gap-4 p-5 sm:p-6 ${idx === 0 ? 'bg-gradient-to-br from-yellow-50 to-orange-50' : ''}`}>
                    <span className="text-2xl">{MEDAL[idx]}</span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                      {entry.avatar_url 
                        ? <img src={entry.avatar_url} alt={entry.full_name} className="w-full h-full object-cover" />
                        : entry.full_name?.charAt(0)?.toUpperCase() || '?'
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate text-sm">{entry.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{entry.room_name || 'Kỳ thi thử'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-black ${idx === 0 ? 'text-yellow-600' : 'text-gray-700'}`}>{Number(entry.total_score).toFixed(1)}</p>
                      <p className="text-xs text-gray-400">điểm</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rest */}
              {leaderboard.length > 3 && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {leaderboard.slice(3).map((entry) => (
                    <div key={entry.user_id} className="flex items-center gap-4 px-6 py-3">
                      <span className="text-sm font-black text-gray-400 w-6 text-center">#{entry.rank}</span>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {entry.avatar_url 
                          ? <img src={entry.avatar_url} alt={entry.full_name} className="w-full h-full object-cover" />
                          : entry.full_name?.charAt(0)?.toUpperCase() || '?'
                        }
                      </div>
                      <p className="flex-1 min-w-0 font-medium text-gray-800 truncate text-sm">{entry.full_name}</p>
                      <p className="text-sm font-bold text-gray-600">{Number(entry.total_score).toFixed(1)} điểm</p>
                    </div>
                  ))}
                </div>
              )}
              </div>
            )}
          </section>

      </main>
    </div>
  );
}
