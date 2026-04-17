'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { 
  FiMonitor, FiUsers, FiClock, FiCalendar, 
  FiFileText, FiAward, FiSearch, FiFilter,
  FiPlayCircle, FiChevronRight, FiSettings
} from 'react-icons/fi';
import axiosInstance from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';

export default function ExamRoomPage() {
  const { user } = useAuthStore();
  const isExamAdmin = hasPermission(user, 'exams.manage');
  const [mounted, setMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [lobbyData, setLobbyData] = useState<{ live: any[]; upcoming: any[]; public: any[] }>({ live: [], upcoming: [], public: [] });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setMounted(true);
    
    // Update time every minute
    const interval = setInterval(() => setNow(Date.now()), 60000);
    
    // Fetch data
    const fetchLobby = async () => {
      try {
        const res = await axiosInstance.get('/exams/lobby');
        if (res.data?.success) {
          setLobbyData(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch exam lobby:", err);
      }
    };
    fetchLobby();
    
    return () => clearInterval(interval);
  }, []);

  const getTimeRemaining = (endTime: string) => {
    if (!endTime) return "N/A";
    const end = new Date(endTime).getTime();
    const diff = end - now;
    if (diff <= 0) return "Đã kết thúc";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  const formatUpcomingTime = (startTime: string) => {
    if (!startTime) return "N/A";
    const date = new Date(startTime);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.toLocaleDateString('vi-VN')}`;
  };

  const colors = ['bg-rose-500', 'bg-indigo-600', 'bg-emerald-500', 'bg-orange-500'];


  // We will conditionally render skeletons for the lists below when not mounted to prevent React hydration errors

  return (
    <div className="min-h-screen bg-[#f8fafc] relative flex flex-col">
      {/* Background Decorators */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-rose-200/40 to-orange-200/40 blur-[100px] rounded-full mix-blend-multiply pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-100/40 to-purple-200/40 blur-[100px] rounded-full mix-blend-multiply pointer-events-none" />
      
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-6 md:py-10 max-w-[1400px] relative z-10 space-y-12">
        
        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-rose-600 via-red-500 to-orange-500 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-2xl">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full shadow-sm text-xs font-bold uppercase tracking-widest border border-white/30 mb-5">
               <div className="w-2 h-2 rounded-full bg-green-400 animate-ping absolute" />
               <div className="w-2 h-2 rounded-full bg-green-400 relative" />
               SERVER ĐANG HOẠT ĐỘNG
             </div>
             
             <h1 className="text-4xl lg:text-6xl font-black tracking-tight mb-4 drop-shadow-md">
               Sảnh Thi Đấu <span className="text-orange-200">Trung Tâm</span>
             </h1>
             <p className="text-rose-100 text-lg leading-relaxed mb-8 max-w-xl">
               Nơi diễn ra các kỳ thi sát hạch thời gian thực. Đăng ký tham gia các kỳ thi sắp tới hoặc rèn luyện kỹ năng qua kho đề thi tự do.
             </p>
             
             <div className="flex flex-wrap gap-4">
               <button className="px-8 py-3.5 bg-white text-rose-600 font-bold rounded-2xl shadow-xl hover:bg-rose-50 hover:scale-105 transition-all duration-300">
                 Tìm kỳ thi ngay
               </button>
               <button className="px-8 py-3.5 bg-rose-700/50 backdrop-blur-md border border-rose-400/50 text-white font-bold rounded-2xl shadow-lg hover:bg-rose-700 transition-all duration-300">
                 Xem lịch thi đua
               </button>
             </div>
          </div>

          <div className="hidden lg:flex relative z-10 shrink-0 right-10">
            <div className="w-48 h-48 bg-gradient-to-tr from-orange-400 to-rose-400 rounded-full flex items-center justify-center border-4 border-white/20 shadow-[-20px_20px_40px_rgba(0,0,0,0.2)]">
               <FiMonitor className="text-7xl text-white drop-shadow-md" />
            </div>
            {/* Decorative orbit elements */}
            <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-white/80 backdrop-blur animate-bounce shadow-lg" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-4 right-4 w-12 h-12 rounded-xl bg-orange-200/90 backdrop-blur rotate-12 shadow-lg flex items-center justify-center">
              <span className="text-2xl">🏆</span>
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
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg uppercase tracking-wider">{exam.subject_name || exam.code || 'Môn học'}</span>
                    <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span> Live
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${colors[idx % colors.length]} text-white`}>HOT</span>
                </div>
                
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 group-hover:text-rose-600 transition-colors leading-tight">{exam.title}</h3>
                
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
                        href={`/admin/exams/${exam.id}/schedule`}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                        title="Quản lý lịch thi"
                      >
                        <FiSettings size={14} /> Lịch thi
                      </Link>
                    )}
                    <Link href={`/exam/${exam.id}`} className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-rose-600 hover:shadow-lg transition-all duration-300">
                      Vào Thi <FiChevronRight />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── UPCOMING EXAMS ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
               <FiCalendar className="text-xl" />
             </div>
             <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sắp Mở Đăng Ký</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lobbyData.upcoming.length === 0 && <p className="text-gray-500 col-span-full">Chưa có kỳ thi nào sắp mở.</p>}
            {lobbyData.upcoming.map(exam => (
              <div key={exam.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
                <span className="inline-block px-3 py-1 bg-orange-50 text-orange-600 border border-orange-200 text-xs font-bold rounded-lg uppercase tracking-wider mb-4 w-fit">{exam.subject_name || exam.code || 'Môn học'}</span>
                
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
                        <span className="text-gray-500 flex items-center gap-2"><FiUsers /> Đã thi</span>
                        <span className="font-semibold text-gray-900">{exam.registered || 0} người</span>
                      </div>
                    </div>
                    
                    <button className="w-full py-3 bg-white border-2 border-gray-200 text-gray-800 font-bold rounded-xl hover:border-gray-900 transition-colors">
                      Chi tiết
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── PUBLIC EXAM ARCHIVE ────────────────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
             <div className="flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                 <FiFileText className="text-xl" />
               </div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Kho Đề Thi Tự Do</h2>
             </div>
             
             {/* Filter Tabs */}
             <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl overflow-x-auto hide-scrollbar">
               {['all', 'toan', 'tiengtrung', 'vatly', 'hoahoc'].map((filter) => (
                 <button 
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                    activeFilter === filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                 >
                   {filter === 'all' ? 'Tất cả' : filter === 'toan' ? 'Toán' : filter === 'tiengtrung' ? 'Tiếng Trung' : filter === 'vatly' ? 'Vật Lý' : 'Hóa Học'}
                 </button>
               ))}
             </div>
          </div>
          
          <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
             {/* Search Bar for Table */}
             <div className="p-4 border-b border-gray-100 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                   <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input type="text" placeholder="Tìm kiếm tên đề thi..." className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <button className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
                  <FiFilter />
                </button>
             </div>
             
             {/* Dynamic Table */}
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[700px]">
                 <thead>
                   <tr className="bg-gray-50/50">
                     <th className="py-4 px-6 font-semibold text-gray-500 text-sm w-1/2">Tên Đề Thi</th>
                     <th className="py-4 px-6 font-semibold text-gray-500 text-sm">Môn Học</th>
                     <th className="py-4 px-6 font-semibold text-gray-500 text-sm">Thời Gian</th>
                     <th className="py-4 px-6 font-semibold text-gray-500 text-sm">Số Câu</th>
                     <th className="py-4 px-6 font-semibold text-gray-500 text-sm text-right">Thao Tác</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {!mounted ? (
                     <tr>
                        <td colSpan={5} className="py-8 px-6">
                           <div className="animate-pulse flex flex-col gap-4">
                              <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                              <div className="h-6 bg-slate-200 rounded w-1/4"></div>
                           </div>
                        </td>
                     </tr>
                   ) : lobbyData.public.filter(e => activeFilter === 'all' || e.subject_name?.toLowerCase().includes(activeFilter.toLowerCase())).map(exam => (
                      <tr key={exam.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-4 px-6 font-bold text-gray-900">{exam.title}</td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg">{exam.subject_name || exam.code || 'Môn học'}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600 font-medium">{exam.duration || 0} phút</td>
                        <td className="py-4 px-6 text-sm text-gray-600 font-medium">{exam.question_count || exam.total_questions || 0}</td>
                        <td className="py-4 px-6 text-right">
                          <Link href={`/exam/${exam.id}`} className="px-5 py-2 inline-block bg-white border border-gray-200 text-gray-800 text-sm font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:border-indigo-600 hover:text-indigo-600">
                            Làm bài
                          </Link>
                        </td>
                      </tr>
                   ))}
                   {lobbyData.public.length === 0 && (
                      <tr>
                        <td className="py-8 text-center text-gray-500" colSpan={5}>Chưa có đề thi tự do nào</td>
                      </tr>
                   )}
                   {/* Dummy empty rows for layout padding */}
                   {[1, 2, 3].map(i => (
                     <tr key={`empty-${i}`}>
                        <td className="py-8 border-t border-dashed border-gray-100" colSpan={5}></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
