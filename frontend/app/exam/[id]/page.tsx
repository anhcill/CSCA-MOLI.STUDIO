'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import examApi, { Exam, Question } from '@/lib/api/exams';
import { FiClock, FiCheck, FiChevronLeft, FiChevronRight, FiAlertCircle, FiSend, FiGrid, FiShield } from 'react-icons/fi';
import { ProUpgradeModal } from '@/components/common/ProModal';
import { ViolationWarning } from '@/components/common/ViolationWarning';
import { useExamProtection } from '@/lib/hooks/useExamProtection';
import { useAuthStore } from '@/lib/store/authStore';

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  // useMemo để tránh tính lại mỗi lần render
  const examId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;          // chưa có params
    const n = parseInt(raw as string, 10);
    return Number.isFinite(n) && n > 0 ? n : NaN; // NaN nếu không hợp lệ
  }, [params?.id]);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vipError, setVipError] = useState<string | null>(null);
  const [violations, setViolations] = useState(0);
  const [showViolation, setShowViolation] = useState(false);
  const [lastViolation, setLastViolation] = useState('');
  const [isScreenCaptured, setIsScreenCaptured] = useState(false);

  const { maxViolations } = useExamProtection({
    enabled: !!attemptId && !submitting,
    onViolation: (type: string) => {
      setViolations((v) => {
        const next = v + 1;
        setLastViolation(type);
        if (next > 0) setShowViolation(true);
        return next;
      });
      // Show capture shield briefly on visibility-related violations
      if (type === 'tab_switch' || type === 'window_blur') {
        setIsScreenCaptured(true);
      }
    },
  });

  // Auto-dismiss capture shield after 3 seconds
  useEffect(() => {
    if (!isScreenCaptured) return;
    const timer = setTimeout(() => setIsScreenCaptured(false), 3000);
    return () => clearTimeout(timer);
  }, [isScreenCaptured]);

  const handleViolationClose = useCallback(() => {
    setShowViolation(false);
    if (violations >= maxViolations) {
      // Optional: auto-submit or report to admin
      alert('Bạn đã vi phạm quá nhiều lần. Bài thi sẽ được gửi và báo cáo cho quản trị viên.');
      handleSubmit();
    }
  }, [violations, maxViolations]);

  useEffect(() => {
    if (examId === null) return;      // params chưa sẵn sàng, chờ
    if (!Number.isFinite(examId)) {   // NaN hoặc giá trị xấu
      setLoading(false);
      router.replace('/exam-room');
      return;
    }
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
    if (examId === null || Number.isNaN(examId)) {
      return;
    }

    try {
      setLoading(true);

      const token = sessionStorage.getItem('token');
      if (!token) {
        alert('Vui lòng đăng nhập để thực hiện tính năng này!');
        router.push('/login');
        return;
      }

      const response = await examApi.startExam(examId);

      setExam(response.exam);
      setQuestions(response.questions);
      setAttemptId(response.attemptId);
      setTimeLeft(response.exam.duration * 60); // Convert minutes to seconds
    } catch (error: any) {
      console.error('Error starting exam:', error);
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message || 'Không thể bắt đầu làm bài. Có thể do kết nối mạng.';

      if (errorCode === 'VIP_REQUIRED') {
        setVipError(errorMessage);
      } else {
        alert(errorMessage);
        router.push('/login');
      }
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
    } catch (error: any) {
      console.error('Error saving answer:', error);
      // Fails silently for user, state preserved locally.
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || submitting) return;

    const confirmed = confirm('Chắc chắn nộp bài chứ? Bạn không thể thay đổi sau khi nộp.');
    if (!confirmed) return;

    try {
      setSubmitting(true);
      await examApi.submitExam(attemptId);
      // Redirect to result page
      router.push(`/exam/${examId}/result?attemptId=${attemptId}`);
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Đã có lỗi xảy ra mạng lúc Nộp. Đừng hoảng loạn, thử ấn nộp lại.');
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
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-[100]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
        </div>
        <div className="absolute mt-24 font-bold text-gray-500 uppercase tracking-widest text-sm animate-pulse">
           Đang tải phòng thi...
        </div>
      </div>
    );
  }

  if (vipError) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-[100]">
        <ProUpgradeModal
          isOpen={true}
          onClose={() => router.back()}
          title="Đề thi dành cho VIP"
        />
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <FiAlertCircle className="text-red-500 mb-6" size={80} />
        <h2 className="text-2xl font-black text-gray-800 mb-2">Đề thi bị lỗi hoặc không tồn tại</h2>
        <p className="text-gray-500 mb-8 max-w-sm text-center">Chúng tôi không thể lấy dữ liệu câu hỏi từ hệ thống. Hãy báo cáo Admin.</p>
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:shadow-xl transition-all"
        >
          Trở lại an toàn
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionAnswer = selectedAnswers[currentQuestion.id];
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = (answeredCount / questions.length) * 100;
  const isTimeCritical = timeLeft < 300; // less than 5 min

  return (
    <div
      className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-200 exam-protected"
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Screen Capture Shield - covers content when screenshot detected */}
      {isScreenCaptured && (
        <div className="exam-capture-shield" onClick={() => setIsScreenCaptured(false)}>
          <div className="exam-capture-shield-content">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <FiShield size={32} className="text-red-400" />
            </div>
            <h3>Phát hiện hành vi chụp màn hình</h3>
            <p>Nội dung đề thi đã bị ẩn. Nhấn để tiếp tục làm bài.</p>
            <button
              onClick={() => setIsScreenCaptured(false)}
              className="px-6 py-2.5 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Tiếp tục làm bài
            </button>
          </div>
        </div>
      )}

      {/* Watermark overlay - user identity stamped across exam */}
      <div className="fixed inset-0 pointer-events-none z-[45] overflow-hidden" aria-hidden="true" style={{ opacity: 0.04 }}>
        <div className="absolute inset-0" style={{ transform: 'rotate(-35deg)', transformOrigin: 'center center' }}>
          {Array.from({ length: 12 }).map((_, row) => (
            <div key={row} className="flex whitespace-nowrap" style={{ marginTop: row === 0 ? '-10%' : '80px' }}>
              {Array.from({ length: 8 }).map((_, col) => (
                <span
                  key={col}
                  className="text-gray-900 font-bold text-lg mx-16 select-none"
                  style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
                >
                  {user?.full_name || 'CSCA'} • ID:{user?.id || '?'}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* FOCUS TOP BAR */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50 flex items-center justify-between px-4 sm:px-8 shadow-sm">
        {/* Left Side: Info */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white items-center justify-center shadow-inner font-black">
             {exam.title.substring(0, 1) || 'E'}
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight max-w-[200px] sm:max-w-md truncate">
               {exam.title}
            </h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
               Câu {currentQuestionIndex + 1} / {questions.length} • Hoàn thành {answeredCount}
            </p>
          </div>
        </div>

        {/* Right Side: Tools */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className={`flex items-center gap-2 px-4 py-1.5 sm:py-2 rounded-xl font-mono text-xl sm:text-2xl font-bold tracking-tight shadow-inner border ${
              isTimeCritical 
                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
            <FiClock size={18} className={isTimeCritical ? 'text-red-500' : 'text-slate-400'} />
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 sm:px-8 py-2 sm:py-2.5 rounded-xl font-bold shadow-md hover:shadow-xl hover:shadow-teal-500/20 active:scale-95 transition-all outline-none disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FiSend size={18} />
            )}
            <span className="hidden sm:inline">{submitting ? 'ĐANG NỘP' : 'NỘP BÀI KẾT THÚC'}</span>
          </button>
        </div>
        
        {/* Magic Progress Bar running along the exact bottom of Top Bar */}
        <div className="absolute bottom-0 left-0 h-[3px] bg-slate-200 w-full" />
        <div 
          className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out z-10" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>


      {/* MAIN EXAM ARENA */}
      <div 
        className="max-w-[1500px] mx-auto pt-24 pb-16 px-4 md:px-8 flex flex-col lg:flex-row gap-6 lg:gap-10 transition-[filter] duration-200"
        style={{ filter: isScreenCaptured ? 'blur(30px)' : 'none' }}
      >
        
        {/* Left Area: The Question Board */}
        <div className="lg:flex-1 lg:max-w-4xl max-w-full">
           <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-12 transition-all duration-300">
             
             {/* Question Badge */}
             <div className="flex items-center gap-3 mb-6">
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-black uppercase tracking-widest border border-indigo-200">
                   Câu Hỏi {currentQuestionIndex + 1}
                </span>
             </div>

             {/* Question Text */}
             <div className="text-xl md:text-[22px] font-semibold text-slate-800 leading-[1.8] tracking-tight mb-8">
                {currentQuestion.question_text.split('\n').map((line, idx) => (
                  <span key={idx}>
                    {line}
                    <br />
                  </span>
                ))}
                
                {/* Chinese / Secondary Translation if exist */}
                {currentQuestion.question_text_cn && currentQuestion.question_text_cn !== currentQuestion.question_text && (
                  <div className="text-lg md:text-xl font-medium text-slate-500 mt-5 pt-5 border-t border-dashed border-slate-200 leading-[1.8]">
                    {currentQuestion.question_text_cn}
                  </div>
                )}
             </div>

             {/* Question Attachments */}
             {currentQuestion.image_url && (
                <div className="mb-10 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center p-4">
                  <img
                    src={currentQuestion.image_url}
                    alt="Phụ lục câu hỏi"
                    className="max-w-full max-h-[400px] object-contain rounded-xl mix-blend-multiply"
                  />
                </div>
              )}

             {/* Options Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-6">
                {currentQuestion.answers?.map((answer, index) => {
                  const isSelected = currentQuestionAnswer === answer.id;
                  const labelLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                  // fallback to manual label if answer_key is missing or unformatted
                  const letter = labelLetters[index] || answer.answer_key || '?';

                  return (
                    <button
                      key={answer.id}
                      onClick={() => handleAnswerSelect(answer.id, answer.answer_key)}
                      className={`relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 group flex items-start gap-4 outline-none ${
                          isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-[0_4px_20px_-4px_rgba(79,70,229,0.15)] ring-1 ring-indigo-600/20'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 bg-white'
                        }`}
                    >
                      {/* Checkbox indicator */}
                      <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all ${
                          isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-500 bg-white'
                        }`}>
                        {isSelected ? <FiCheck strokeWidth={3} /> : letter}
                      </div>

                      {/* Content */}
                      <div className="flex-1 mt-0.5">
                        <span className={`text-base font-semibold leading-relaxed ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                           {answer.answer_text}
                        </span>

                        {answer.answer_text_cn && answer.answer_text_cn !== answer.answer_text && (
                          <div className={`mt-2 text-sm leading-relaxed ${isSelected ? 'text-indigo-700/80' : 'text-slate-500'}`}>
                             {answer.answer_text_cn}
                          </div>
                        )}

                        {answer.image_url && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-white p-2">
                            <img
                              src={answer.image_url}
                              alt={`Lựa chọn ${letter}`}
                              className="max-w-full max-h-32 object-contain mx-auto"
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
             </div>

           </div>

           {/* Mobile / Screen bottom Navigation Bar */}
           <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <FiChevronLeft size={20} /> <span className="hidden sm:inline">Câu Trước Đó</span>
              </button>

              <div className="text-slate-400 font-bold px-4">
                 {currentQuestionIndex + 1} / {questions.length}
              </div>

              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === questions.length - 1}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-indigo-700 bg-indigo-50 active:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50"
              >
                <span className="hidden sm:inline">Câu Tiếp Theo</span> <FiChevronRight size={20} />
              </button>
           </div>
        </div>

        {/* Right Area: Nav Grid Floating Panel */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-24">
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                 <FiGrid />
              </div>
              <h3 className="font-bold text-slate-800 tracking-tight">Biểu Đồ Câu Hỏi</h3>
            </div>
            
            {/* The Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2.5 max-h-[40vh] lg:max-h-[50vh] overflow-y-auto px-1 custom-scrollbar">
              {questions.map((q, index) => {
                const isActive = index === currentQuestionIndex;
                const isDone = !!selectedAnswers[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`
                      aspect-square rounded-xl font-bold text-[13px] transition-all flex items-center justify-center outline-none
                      ${isActive
                        ? 'bg-slate-800 text-white shadow-lg ring-4 ring-slate-100 scale-110 z-10'
                        : isDone
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 hover:border-indigo-300'
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }
                    `}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

             {/* Legend */}
             <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-indigo-100 border border-indigo-300"></div>
                <span className="text-xs font-semibold text-slate-600">Đã chọn</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-slate-800"></div>
                <span className="text-xs font-semibold text-slate-600">Hiện tại</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-md bg-white border border-slate-200"></div>
                <span className="text-xs font-semibold text-slate-600">Chưa làm</span>
              </div>
            </div>

            {/* PDF Download button — only shown if exam allows it */}
            {(exam as any)?.allow_download && (
              <a
                href={`/exam/${examId}/print`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-100 transition-colors"
              >
                📄 Tải / In đề thi
              </a>
            )}

          </div>
        </div>

        {/* Anti-cheat violation warning overlay */}
        {showViolation && (
          <ViolationWarning
            count={violations}
            maxViolations={maxViolations}
            onClose={handleViolationClose}
          />
        )}

      </div>
    </div>
  );
}
