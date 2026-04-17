'use client';

import Header from '@/components/layout/Header';
import { AIInsights } from '@/components/ai/AIInsights';
import { useAuthStore } from '@/lib/store/authStore';
import Link from 'next/link';
import { FiLock, FiStar, FiTarget, FiUnlock, FiTrendingUp } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import axiosInstance from '@/lib/utils/axios';

export default function LoTrinhPage() {
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [roadmapMilestones, setRoadmapMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) {
      axiosInstance.get('/users/roadmap')
        .then(res => {
          if (res.data?.success) {
            setRoadmapMilestones(res.data.data.milestones);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

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
                <div>
                  <AIInsights />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
