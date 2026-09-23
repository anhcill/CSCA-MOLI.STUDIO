'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiArrowLeft, FiCheck, FiClock, FiFlag, FiMaximize, FiSend, FiShield, FiTarget, FiUser } from 'react-icons/fi';
import examApi, { Exam, Question, type QuestionReportType } from '@/lib/api/exams';

interface PdfRoomExamWorkspaceProps {
  exam: Exam;
  questions: Question[];
  selectedAnswers: Record<number, number | string>;
  flaggedQuestions: Set<number>;
  timeLeft: number;
  userName: string;
  violations: number;
  maxViolations: number;
  submitting: boolean;
  tabConflict: boolean;
  workspaceMode?: 'exam-room' | 'topic-practice';
  onSelectAnswer: (question: Question, answerId: number, answerKey: string) => void;
  onToggleFlag: (questionId: number) => void;
  onSubmit: () => void;
  onReportQuestion?: (question: Question, reportType: QuestionReportType, description: string) => Promise<void>;
  onExit?: () => void;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function PdfRoomExamWorkspace({
  exam,
  questions,
  selectedAnswers,
  flaggedQuestions,
  timeLeft,
  userName,
  violations,
  maxViolations,
  submitting,
  tabConflict,
  workspaceMode = 'exam-room',
  onSelectAnswer,
  onToggleFlag,
  onSubmit,
  onReportQuestion,
  onExit,
}: PdfRoomExamWorkspaceProps) {
  const isTopicPractice = workspaceMode === 'topic-practice';
  const [paperUrl, setPaperUrl] = useState('');
  const [paperError, setPaperError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reportQuestion, setReportQuestion] = useState<Question | null>(null);
  const [reportType, setReportType] = useState<QuestionReportType>('answer_mismatch');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setPaperError('');
    examApi.getExamPaper(exam.id, isTopicPractice)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPaperUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPaperError(isTopicPractice
          ? 'Không tải được file PDF. Bạn thử tải lại trang hoặc chọn một file khác.'
          : 'Không tải được đề PDF. Hãy báo giám thị để kiểm tra file đề.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [exam.id, isTopicPractice]);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((question) => selectedAnswers[question.id] !== undefined).length,
    [questions, selectedAnswers],
  );
  const answerKeys = useMemo(() => {
    const keys = Array.from(new Set(questions.flatMap((question) => (question.answers || []).map((answer) => answer.answer_key))));
    return keys.length ? keys.sort() : ['A', 'B', 'C', 'D'];
  }, [questions]);
  const interactionBlocked = !isTopicPractice && tabConflict;

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setPaperError('Trình duyệt đã chặn toàn màn hình. Hãy cho phép fullscreen để tiếp tục thi.');
    }
  };

  const submitReport = async () => {
    if (!reportQuestion || !onReportQuestion) return;
    try {
      setReporting(true);
      await onReportQuestion(reportQuestion, reportType, reportDescription.trim());
      setReportQuestion(null);
      setReportDescription('');
      setReportType('answer_mismatch');
    } catch {
      setPaperError('Chưa gửi được báo lỗi. Bạn thử lại sau nhé.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f4f7fc] text-slate-950 dark:bg-[#081120] dark:text-slate-50">
      <header className={`grid min-h-[76px] shrink-0 grid-cols-2 items-center gap-3 border-b border-blue-100 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-[#101b2d] dark:shadow-none lg:px-7 ${isTopicPractice ? 'lg:grid-cols-[1.5fr_1fr_1fr_1.15fr]' : 'lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.15fr]'}`}>
        <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${isTopicPractice ? 'bg-red-600' : 'bg-blue-600'}`}>{isTopicPractice ? <FiTarget size={23} /> : <FiShield size={23} />}</div>
          <div className="min-w-0"><p className={`text-[11px] font-black uppercase tracking-widest ${isTopicPractice ? 'text-red-600 dark:text-red-300' : 'text-blue-600 dark:text-blue-300'}`}>{isTopicPractice ? 'Luyện chủ đề' : 'Phòng thi thử'}</p><h1 className="truncate text-base font-black">{exam.title}</h1></div>
          {isTopicPractice && onExit && <button type="button" onClick={onExit} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-black text-slate-600 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:text-red-200"><FiArrowLeft /> Thoát</button>}
        </div>
        {isTopicPractice ? <HeaderInfo icon={FiTarget} label="Chế độ" value="Tự do luyện tập" accent="red" /> : <HeaderInfo icon={FiUser} label="Thí sinh" value={userName || 'Thí sinh'} />}
        <HeaderInfo icon={FiCheck} label="Đã làm" value={`${answeredCount}/${questions.length} câu`} />
        {!isTopicPractice && <HeaderInfo icon={FiAlertTriangle} label="Vi phạm" value={`${violations}/${maxViolations} lần`} danger={violations > 0} />}
        {isTopicPractice ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-red-600 px-4 py-3 text-white shadow-lg shadow-red-600/20">
            <FiCheck size={24} />
            <div><p className="text-[11px] font-bold text-red-100">Không giới hạn thời gian</p><p className="text-sm font-black">Làm theo nhịp của bạn</p></div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-600/20">
            <FiClock size={24} />
            <div><p className="text-[11px] font-bold text-blue-100">Thời gian còn lại</p><p className="text-xl font-black tabular-nums">{formatTime(timeLeft)}</p></div>
          </div>
        )}
      </header>

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(430px,0.9fr)]">
        <section className="min-h-[45vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
          {paperUrl ? (
            <iframe
              src={`${paperUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Đề thi ${exam.title}`}
              data-exam-pdf-viewer="true"
              className="h-full w-full bg-white"
            />
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center p-6 text-center dark:bg-[#101b2d]">
              {paperError ? <p className="max-w-md font-bold text-rose-600 dark:text-rose-300">{paperError}</p> : <p className="font-bold text-slate-500 dark:text-slate-300">Đang tải đề PDF...</p>}
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#101b2d] dark:shadow-none">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div><h2 className={`font-black ${isTopicPractice ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>BẢNG LÀM BÀI</h2><p className="text-xs font-semibold text-slate-400 dark:text-slate-400">Chọn đáp án theo nội dung trong PDF</p></div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-300"><span className="flex items-center gap-1"><i className={`h-2.5 w-2.5 rounded-full ${isTopicPractice ? 'bg-red-600' : 'bg-blue-600'}`} />Đã làm</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border border-slate-400 dark:border-slate-500" />Chưa làm</span></div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div
              className="grid min-w-[390px] items-center gap-y-1 text-center text-xs font-black text-slate-700 dark:text-slate-200"
              style={{ gridTemplateColumns: `70px repeat(${answerKeys.length}, minmax(42px, 1fr)) 34px${isTopicPractice ? ' 34px' : ''}` }}
            >
              <span />
              {answerKeys.map((key) => <span key={key}>{key}</span>)}
              <span />
              {isTopicPractice && <span />}
              {questions.map((question, index) => {
                const answers = question.answers || [];
                const selected = selectedAnswers[question.id];
                return (
                  <div key={question.id} className="contents">
                    <span className="py-2 text-left font-black">Câu {question.question_number || index + 1}</span>
                    {answerKeys.map((key) => {
                      const answer = answers.find((item) => item.answer_key === key);
                      const active = Boolean(answer && (selected === answer.id || selected === answer.answer_key));
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!answer || submitting || interactionBlocked}
                          onClick={() => answer && onSelectAnswer(question, answer.id, answer.answer_key)}
                          aria-label={`Câu ${question.question_number || index + 1}, đáp án ${key}`}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${active ? (isTopicPractice ? 'border-red-600 bg-red-600 text-white' : 'border-blue-600 bg-blue-600 text-white') : (isTopicPractice ? 'border-slate-300 bg-white hover:border-red-500 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-red-400' : 'border-slate-300 bg-white hover:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-blue-400')} disabled:cursor-not-allowed disabled:opacity-35`}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-white" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onToggleFlag(question.id)}
                      disabled={interactionBlocked}
                      className={`mx-auto p-1 ${flaggedQuestions.has(question.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'} disabled:cursor-not-allowed disabled:opacity-35`}
                      aria-label={`Đánh dấu câu ${question.question_number || index + 1}`}
                    ><FiFlag fill={flaggedQuestions.has(question.id) ? 'currentColor' : 'none'} /></button>
                    {isTopicPractice && onReportQuestion && (
                      <button
                        type="button"
                        onClick={() => setReportQuestion(question)}
                        className="mx-auto p-1 text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-300"
                        aria-label={`Báo lỗi câu ${question.question_number || index + 1}`}
                        title="Báo lỗi câu này"
                      ><FiAlertCircle /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
            <button type="button" onClick={enterFullscreen} className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-black transition ${isTopicPractice ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10' : 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-400/40 dark:text-blue-200 dark:hover:bg-blue-400/10'}`}><FiMaximize /> Toàn màn hình</button>
            <button type="button" onClick={onSubmit} disabled={submitting || interactionBlocked} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60 ${isTopicPractice ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}><FiSend />{submitting ? 'Đang nộp...' : 'Nộp bài'}</button>
          </div>
        </section>
      </main>

      {!isTopicPractice && !isFullscreen && !submitting && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <FiMaximize className="mx-auto mb-4 text-5xl text-blue-600" />
            <h2 className="text-xl font-black">Phòng thi yêu cầu toàn màn hình</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Thoát toàn màn hình được tính là một lần vi phạm. Bạn cần quay lại fullscreen để tiếp tục làm bài.</p>
            <button type="button" onClick={enterFullscreen} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-700">Trở lại toàn màn hình</button>
          </div>
        </div>
      )}

      {reportQuestion && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#111b2d]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"><FiAlertCircle size={21} /></div>
              <div><h2 className="text-lg font-black text-slate-950 dark:text-white">Báo lỗi Câu {reportQuestion.question_number}</h2><p className="mt-1 text-sm font-medium leading-5 text-slate-500 dark:text-slate-300">Báo lỗi sẽ chuyển thẳng tới Risk Center để đội ngũ kiểm tra file và đáp án.</p></div>
            </div>
            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Loại lỗi<select value={reportType} onChange={(event) => setReportType(event.target.value as QuestionReportType)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-rose-500/20"><option value="answer_mismatch">Đáp án đúng có vẻ sai</option><option value="wrong_answer">Nội dung câu hỏi sai</option><option value="formula_error">Lỗi công thức / dữ liệu</option><option value="translation_error">Lỗi dịch thuật</option><option value="missing_image">Thiếu hình / nội dung</option><option value="duplicate_question">Câu bị trùng</option><option value="other">Lỗi khác</option></select></label>
            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Mô tả (không bắt buộc)<textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={3} placeholder="Ví dụ: Theo PDF đáp án phải là B..." className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-rose-500/20" /></label>
            <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setReportQuestion(null)} disabled={reporting} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Hủy</button><button type="button" onClick={submitReport} disabled={reporting} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50">{reporting ? 'Đang gửi...' : 'Gửi báo lỗi'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderInfo({ icon: Icon, label, value, danger = false, accent = 'blue' }: { icon: any; label: string; value: string; danger?: boolean; accent?: 'blue' | 'red' }) {
  return (
    <div className="hidden min-w-0 items-center gap-3 lg:flex">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' : accent === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'}`}><Icon size={19} /></div>
      <div className="min-w-0"><p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">{label}</p><p className={`truncate text-sm font-black ${danger ? 'text-rose-600 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p></div>
    </div>
  );
}
