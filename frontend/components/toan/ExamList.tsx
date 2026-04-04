'use client';

import { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiUsers, FiChevronRight } from 'react-icons/fi';
import examApi, { Exam } from '@/lib/api/exams';

interface ExamListProps {
  subjectCode: string;
}

export default function ExamList({ subjectCode }: ExamListProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExams();
  }, [subjectCode]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const data = await examApi.getExamsBySubject(subjectCode);
      setExams(data);
    } catch (error: any) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-gray-700"></div>
        <p className="mt-4 text-gray-400 text-sm">Đang tải...</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
        <p className="text-gray-400 text-sm">Chưa có đề thi nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedExams).map(([date, dateExams]) => (
        <div key={date} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Date Header */}
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2 text-gray-500">
              <FiCalendar size={14} />
              <span className="font-medium text-sm">Ngày {date}</span>
            </div>
          </div>

          {/* Exam List */}
          <div className="divide-y divide-gray-50">
            {dateExams.map((exam) => (
              <div
                key={exam.id}
                className="px-5 py-4 hover:bg-gray-50/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-gray-800 truncate">
                        {exam.title}
                      </h3>
                      {exam.user_attempt_count > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100 shrink-0">
                          Đã làm {exam.user_attempt_count} lần
                        </span>
                      )}
                      {exam.user_best_score > 0 && (
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-600 text-xs font-medium rounded-full border border-sky-100 shrink-0">
                          {exam.user_best_score} điểm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <FiClock size={12} />
                        <span>{exam.duration} phút</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiUsers size={12} />
                        <span>{exam.total_questions} câu</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${exam.difficulty_level === 'easy'
                          ? 'bg-emerald-50 text-emerald-600'
                          : exam.difficulty_level === 'medium'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-500'
                        }`}>
                        {exam.difficulty_level === 'easy' ? 'Dễ' : exam.difficulty_level === 'medium' ? 'TB' : 'Khó'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.href = `/exam/${exam.id}`}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    <span>{exam.user_attempt_count > 0 ? 'Làm lại' : 'Làm bài'}</span>
                    <FiChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
