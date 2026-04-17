'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiCalendar, FiClock, FiUsers, FiPlayCircle, FiBarChart2, FiLock } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import examApi, { Exam } from '@/lib/api/exams';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import { ProUpgradeModal } from '@/components/common/ProModal';

interface ExamListProps {
  subjectCode?: string;
  subjectSlug?: string;
}

export default function ExamList({ subjectCode = '', subjectSlug }: ExamListProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [vipModalExam, setVipModalExam] = useState<{ title: string; id: number } | null>(null);
  const isVip = isVipActive(user);

  useEffect(() => {
    loadExams();
  }, [subjectCode, subjectSlug]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await examApi.getExamsBySubject(subjectCode, subjectSlug);
      setExams(data);
    } catch (error: any) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam: Exam) => {
    // Premium exam + non-VIP user → show upgrade modal instead of navigating
    if (exam.is_premium && !isVip) {
      setVipModalExam({ title: exam.title, id: exam.id });
      return;
    }
    router.push(`/exam/${exam.id}`);
  };

  const handleMakeExam = (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    if (exam.is_premium && !isVip) {
      setVipModalExam({ title: exam.title, id: exam.id });
      return;
    }
    router.push(`/exam/${exam.id}`);
  };

  // Group exams by publish date
  const groupedExams = exams.reduce((acc, exam) => {
    const date = exam.publish_date ? new Date(exam.publish_date).toLocaleDateString('vi-VN') : 'Chưa công bố';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(exam);
    return acc;
  }, {} as Record<string, Exam[]>);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 p-16 text-center shadow-sm flex flex-col items-center justify-center">
        <div className="relative w-16 h-16">
           <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
           <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-6 text-gray-500 font-medium">Hệ thống đang đồng bộ dữ liệu đề thi...</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 p-16 text-center shadow-sm">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
           <FiCalendar size={32} />
        </div>
        <p className="text-gray-500 font-medium text-lg">Hệ thống đang cập nhật đề thi hạng mục này</p>
        <p className="text-gray-400 text-sm mt-1">Vui lòng quay lại sau nhé!</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {Object.entries(groupedExams).map(([date, dateExams]) => (
        <div key={date} className="space-y-5">
           <div className="flex items-center gap-4">
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
             <div className="flex items-center gap-2 text-indigo-400 bg-indigo-50/50 px-4 py-1.5 rounded-full border border-indigo-100/50">
                <FiCalendar size={14} /> <span className="font-bold text-sm tracking-wide uppercase">Cập nhật ngày {date}</span>
             </div>
             <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
          </div>

          <div className="grid gap-4">
            {dateExams.map((exam) => {
               // We determine color style by difficulty
               let diffColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
               let diffText = 'Dễ';
               let diffDot = 'bg-emerald-500';
               if (exam.difficulty_level === 'medium') {
                  diffColor = 'text-amber-600 bg-amber-50 border-amber-200';
                  diffText = 'Trung bình';
                  diffDot = 'bg-amber-500';
               } else if (exam.difficulty_level === 'hard') {
                  diffColor = 'text-rose-600 bg-rose-50 border-rose-200';
                  diffText = 'Khó';
                  diffDot = 'bg-rose-500';
               }

               return (
                <div
                  key={exam.id}
                  className={`relative group bg-white/70 backdrop-blur-md rounded-2xl border p-5 sm:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${
                    exam.is_premium && !isVip ? 'border-amber-200/70 hover:shadow-amber-500/10' : 'border-gray-100 hover:shadow-indigo-500/10'
                  }`}
                  onClick={() => handleExamClick(exam)}
                >
                  {/* Left indicator bar on hover */}
                  <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity ${
                    exam.is_premium && !isVip ? 'bg-gradient-to-b from-amber-500 to-orange-500' : 'bg-gradient-to-b from-indigo-500 to-purple-600'
                  }`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className={`text-lg font-bold group-hover:transition-colors truncate ${exam.is_premium && !isVip ? 'text-amber-800 group-hover:text-amber-700' : 'text-gray-900 group-hover:text-indigo-700'}`}>
                        {exam.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${diffColor}`}>
                         <span className={`w-1.5 h-1.5 rounded-full ${diffDot}`}></span> {diffText}
                      </span>
                      {exam.is_premium && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-200 to-orange-400 text-orange-900 text-xs font-bold rounded-md shadow-sm">
                           <FaCrown /> PRO
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-5 text-sm text-gray-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <FiClock className="text-gray-400" />
                        <span>{exam.duration} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FiUsers className="text-gray-400" />
                        <span>{exam.total_questions} câu</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* User Stats / Results */}
                    {exam.user_attempt_count > 0 && (
                      <div className="hidden md:flex flex-col items-end mr-2">
                        <span className="text-xs text-gray-400 font-medium mb-1">Kết quả tốt nhất</span>
                        <div className="flex items-center gap-2">
                           <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 shrink-0">
                             Làm {exam.user_attempt_count} lần
                           </span>
                           <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 flex items-center gap-1 shrink-0">
                             <FiBarChart2 /> {exam.user_best_score} đ
                           </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={(e) => handleMakeExam(exam, e)}
                      className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition-all shadow-sm group-hover:shadow-md w-full sm:w-auto ${
                        exam.is_premium && !isVip
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                          : exam.user_attempt_count > 0
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white group-hover:scale-105'
                      }`}
                    >
                      {exam.is_premium && !isVip ? (
                        <><FiLock size={18} className="text-amber-600" /> <span>Khóa PRO</span></>
                      ) : (
                        <><FiPlayCircle size={18} className={exam.user_attempt_count > 0 ? 'text-gray-500' : 'text-indigo-100'} /> <span>{exam.user_attempt_count > 0 ? 'Làm lại' : 'Làm bài'}</span></>
                      )}
                    </button>
                  </div>
                </div>
               );
            })}
          </div>
        </div>
      ))}
      {vipModalExam && (
        <ProUpgradeModal
          isOpen={true}
          onClose={() => setVipModalExam(null)}
          title={`Đề "${vipModalExam.title}" chỉ dành cho VIP`}
        />
      )}
    </div>
  );
}
