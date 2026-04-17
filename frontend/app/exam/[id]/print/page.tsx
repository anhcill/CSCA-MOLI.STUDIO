'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';

interface ExamQuestion {
  id: number;
  content: string;
  type: string;
  points: number;
  answers: { id: number; content: string; answer_key: boolean }[];
}

interface ExamData {
  id: number;
  title: string;
  subject: string;
  description?: string;
  duration_minutes: number;
  total_points: number;
  allow_download: boolean;
  questions: ExamQuestion[];
}

function ExamPrintContent({ examId }: { examId: string }) {
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuthStore();
  const searchParams = useSearchParams();
  const showAnswers = searchParams.get('answers') === '1';

  useEffect(() => {
    if (!isAuthenticated) { setError('Vui lòng đăng nhập để xem tài liệu.'); setLoading(false); return; }
    axios.get(`/exams/${examId}`)
      .then(r => {
        const data = r.data?.data || r.data;
        if (!data?.allow_download) { setError('Đề thi này không cho phép tải xuống.'); setLoading(false); return; }
        setExam(data);
        setLoading(false);
      })
      .catch(() => { setError('Không thể tải đề thi.'); setLoading(false); });
  }, [examId, isAuthenticated]);

  useEffect(() => {
    if (!loading && exam) setTimeout(() => window.print(), 600);
  }, [loading, exam]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-3" />
        <p className="text-gray-500">Đang tải đề thi...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{error}</h2>
        <button onClick={() => window.history.back()} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg">← Quay lại</button>
      </div>
    </div>
  );

  if (!exam) return null;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; color: #000; }
          .question-block { page-break-inside: avoid; }
        }
        @page { size: A4; margin: 15mm 12mm; }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Screen bar */}
      <div className="no-print bg-purple-700 text-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold">Xem trước đề thi — {exam.questions?.length || 0} câu hỏi</span>
        <div className="flex gap-3">
          <button onClick={() => window.history.back()} className="px-4 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition">← Quay lại</button>
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-white text-purple-700 font-bold text-sm rounded-lg hover:bg-purple-50 transition">🖨️ In / Lưu PDF</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">CSCA — Ôn thi học bổng Trung Quốc</p>
          <h1 className="text-2xl font-black text-gray-900">{exam.title}</h1>
          <div className="flex items-center justify-center gap-6 mt-2 text-sm text-gray-600">
            <span>Môn: <strong>{exam.subject}</strong></span>
            <span>Thời gian: <strong>{exam.duration_minutes} phút</strong></span>
            <span>Tổng điểm: <strong>{exam.total_points}</strong></span>
          </div>
          {exam.description && <p className="mt-2 text-sm text-gray-500 italic">{exam.description}</p>}
        </div>

        {/* Họ tên box */}
        <div className="flex gap-8 mb-6 text-sm">
          <div className="flex-1 border-b border-gray-400 pb-1">Họ và tên: ___________________________</div>
          <div className="w-48 border-b border-gray-400 pb-1">Điểm: ____________</div>
        </div>

        {/* Questions */}
        {(exam.questions || []).map((q, qi) => (
          <div key={q.id} className="question-block mb-5">
            <p className="font-semibold text-gray-900 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs rounded-full mr-2 font-bold">{qi + 1}</span>
              {q.content}
              <span className="text-xs text-gray-400 ml-2">({q.points} điểm)</span>
            </p>
            {q.answers && q.answers.length > 0 && (
              <div className="ml-8 grid grid-cols-2 gap-1">
                {q.answers.map((a, ai) => {
                  const letter = String.fromCharCode(65 + ai);
                  const isCorrect = a.answer_key && showAnswers;
                  return (
                    <div key={a.id} className={`flex items-start gap-2 text-sm py-1 px-2 rounded ${isCorrect ? 'bg-green-50 border border-green-300' : ''}`}>
                      <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-gray-500'}`}>{letter}.</span>
                      <span className={isCorrect ? 'text-green-700 font-medium' : 'text-gray-700'}>{a.content}</span>
                      {isCorrect && <span className="text-green-500 ml-auto">✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div className="mt-8 border-t pt-3 text-center text-xs text-gray-400 no-print">
          CSCA · csca.vn — Tài liệu nội bộ
        </div>
      </div>
    </>
  );
}

export default function ExamPrintPage() {
  const params = useParams();
  const examId = params?.id as string;

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
      </div>
    }>
      <ExamPrintContent examId={examId} />
    </Suspense>
  );
}
