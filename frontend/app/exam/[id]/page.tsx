'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import examApi, { Exam, Question } from '@/lib/api/exams';
import { FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = parseInt(params.id as string);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    startExam();
  }, [examId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const startExam = async () => {
    try {
      setLoading(true);

      // Check token
      const token = sessionStorage.getItem('token');
      console.log('Token exists:', !!token);
      console.log('Exam ID:', examId);

      const response = await examApi.startExam(examId);
      console.log('Start exam response:', response);

      setExam(response.exam);
      setQuestions(response.questions);
      setAttemptId(response.attemptId);
      setTimeLeft(response.exam.duration * 60); // Convert minutes to seconds
    } catch (error: any) {
      console.error('Error starting exam:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message || 'Không thể bắt đầu làm bài';
      alert(errorMessage + '. Vui lòng đăng nhập!');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = async (answerId: number, answerKey: string) => {
    if (!attemptId || submitting) return;

    const questionId = questions[currentQuestionIndex].id;

    // Update UI immediately for better UX
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: answerId,
    });

    // Save answer to backend (non-blocking)
    try {
      await examApi.saveAnswer(attemptId, questionId, answerKey, 0);
      console.log('Answer saved successfully:', { questionId, answerKey });
    } catch (error: any) {
      console.error('Error saving answer:', error);
      console.error('Error response:', error.response?.data);
      // Don't remove from selectedAnswers - keep the UI updated
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || submitting) return;

    const confirmed = confirm('Bạn có chắc muốn nộp bài?');
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const result = await examApi.submitExam(attemptId);

      // Redirect to result page
      router.push(`/exam/${examId}/result?attemptId=${attemptId}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Có lỗi khi nộp bài. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 text-lg">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertCircle className="mx-auto text-red-500" size={64} />
          <p className="mt-4 text-gray-600 text-lg">Không tìm thấy đề thi</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionAnswer = selectedAnswers[currentQuestion.id];
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Câu {currentQuestionIndex + 1}/{questions.length} • Đã làm: {answeredCount}/{questions.length}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              {/* Timer */}
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                <FiClock size={20} />
                <span className="font-bold text-lg">{formatTime(timeLeft)}</span>
              </div>
              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              {/* Question Text */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Câu {currentQuestionIndex + 1}:
                </h2>
                <p className="text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.question_text}
                </p>
                {currentQuestion.question_text_cn && currentQuestion.question_text_cn !== currentQuestion.question_text && (
                  <p className="text-lg text-gray-600 mt-4 leading-relaxed">
                    {currentQuestion.question_text_cn}
                  </p>
                )}
              </div>

              {/* Question Image */}
              {currentQuestion.image_url && (
                <div className="mb-8">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-w-full rounded-lg shadow-sm border border-gray-200"
                  />
                </div>
              )}

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.answers?.map((answer) => (
                  <button
                    key={answer.id}
                    onClick={() => handleAnswerSelect(answer.id, answer.answer_key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${currentQuestionAnswer === answer.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 bg-white'
                      }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${currentQuestionAnswer === answer.id
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-400'
                        }`}>
                        {currentQuestionAnswer === answer.id && (
                          <FiCheckCircle className="text-white" size={16} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900">{answer.answer_text}</p>
                        {answer.answer_text_cn && answer.answer_text_cn !== answer.answer_text && (
                          <p className="text-gray-600 text-sm mt-1">{answer.answer_text_cn}</p>
                        )}
                        {answer.image_url && (
                          <img
                            src={answer.image_url}
                            alt={`Option ${answer.answer_key}`}
                            className="mt-3 max-w-xs rounded-lg shadow-sm border border-gray-200"
                          />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Câu trước
                </button>
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Câu sau →
                </button>
              </div>
            </div>
          </div>

          {/* Question Navigator */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-4">Danh sách câu hỏi</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, index) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`aspect-square rounded-lg font-semibold text-sm transition-all ${index === currentQuestionIndex
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : selectedAnswers[q.id]
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300"></div>
                  <span className="text-gray-600">Đã làm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-blue-600"></div>
                  <span className="text-gray-600">Đang làm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
                  <span className="text-gray-600">Chưa làm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
