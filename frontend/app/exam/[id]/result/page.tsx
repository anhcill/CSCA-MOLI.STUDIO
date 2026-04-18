'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiClock, FiAward, FiHome, FiRotateCw } from 'react-icons/fi';
import examApi from '@/lib/api/exams';

interface ExamResult {
  id: number;
  exam_title: string;
  subject_name: string;
  total_questions: number;
  total_score: number;
  total_correct: number;
  total_incorrect: number;
  total_unanswered: number;
  duration_seconds: number;
  submit_time: string;
  answers: Array<{
    question_number: number;
    question_text: string;
    selected_answer_text: string;
    correct_answer_text: string;
    is_correct: boolean;
    points: number;
  }>;
}

function ExamResultContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = parseInt(params.id as string);
  const attemptId = searchParams.get('attemptId');

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    }
  }, [attemptId]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      const data = await examApi.getAttemptDetail(Number(attemptId));
      setResult(data);
    } catch (error: any) {
      console.error('Error fetching result:', error);
      if (error?.response?.status === 401) {
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        router.push('/login');
      } else {
        alert('Không thể tải kết quả bài thi!');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-50 border-green-200';
    if (percentage >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy kết quả</p>
          <button
            onClick={() => router.push('/toan')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  const percentage = (result.total_correct / result.total_questions) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <div className={`bg-white rounded-2xl shadow-md border-2 p-8 mb-6 ${getScoreBgColor(percentage)}`}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg mb-4">
              <FiAward className={`${getScoreColor(percentage)}`} size={40} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Kết quả bài thi
            </h1>
            <p className="text-xl text-gray-700">{result.exam_title}</p>
            <p className="text-gray-600 mt-1">{result.subject_name}</p>
          </div>

          {/* Score Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Điểm số</p>
              <p className={`text-3xl font-bold ${getScoreColor(percentage)}`}>
                {Number(result.total_score || 0).toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Tỷ lệ đúng</p>
              <p className={`text-3xl font-bold ${getScoreColor(percentage)}`}>
                {percentage.toFixed(0)}%
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Câu đúng</p>
              <p className="text-3xl font-bold text-green-600">
                {result.total_correct}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-gray-600 text-sm mb-1">Thời gian</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatTime(result.duration_seconds)}
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="flex items-center justify-center space-x-2">
                <FiCheckCircle className="text-green-600" size={20} />
                <span className="text-gray-600">Đúng:</span>
                <span className="font-bold text-green-600">{result.total_correct}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="flex items-center justify-center space-x-2">
                <FiXCircle className="text-red-600" size={20} />
                <span className="text-gray-600">Sai:</span>
                <span className="font-bold text-red-600">{result.total_incorrect}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <div className="flex items-center justify-center space-x-2">
                <FiClock className="text-gray-600" size={20} />
                <span className="text-gray-600">Bỏ qua:</span>
                <span className="font-bold text-gray-600">{result.total_unanswered}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <button
            onClick={() => router.push('/toan')}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            <FiHome size={20} />
            <span>Về trang chủ</span>
          </button>
          <button
            onClick={() => router.push(`/exam/${examId}`)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <FiRotateCw size={20} />
            <span>Làm lại</span>
          </button>
        </div>

        {/* Detailed Answers */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Chi tiết đáp án</h2>
          <div className="space-y-4">
            {result.answers?.map((answer, index) => (
              <div
                key={index}
                className={`border-2 rounded-xl p-4 ${
                  answer.is_correct
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900">
                      Câu {answer.question_number}:
                    </span>
                    {answer.is_correct ? (
                      <FiCheckCircle className="text-green-600" size={20} />
                    ) : (
                      <FiXCircle className="text-red-600" size={20} />
                    )}
                  </div>
                  <span className={`font-bold ${answer.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                    {answer.is_correct ? `+${answer.points}` : '0'} điểm
                  </span>
                </div>
                <p className="text-gray-800 mb-3">{answer.question_text}</p>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-600 min-w-[120px]">Bạn chọn:</span>
                    <span className={answer.is_correct ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {answer.selected_answer_text}
                    </span>
                  </div>
                  {!answer.is_correct && (
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-600 min-w-[120px]">Đáp án đúng:</span>
                      <span className="text-green-700 font-semibold">
                        {answer.correct_answer_text}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    }>
      <ExamResultContent />
    </Suspense>
  );
}
