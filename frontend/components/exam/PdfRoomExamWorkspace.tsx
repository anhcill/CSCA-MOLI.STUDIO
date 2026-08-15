'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiClock, FiFlag, FiMaximize, FiSend, FiShield, FiUser } from 'react-icons/fi';
import examApi, { Exam, Question } from '@/lib/api/exams';

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
  onSelectAnswer: (question: Question, answerId: number, answerKey: string) => void;
  onToggleFlag: (questionId: number) => void;
  onSubmit: () => void;
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
  onSelectAnswer,
  onToggleFlag,
  onSubmit,
}: PdfRoomExamWorkspaceProps) {
  const [paperUrl, setPaperUrl] = useState('');
  const [paperError, setPaperError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setPaperError('');
    examApi.getExamPaper(exam.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPaperUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPaperError('Không tải được đề PDF. Hãy báo giám thị để kiểm tra file đề.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [exam.id]);

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

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setPaperError('Trình duyệt đã chặn toàn màn hình. Hãy cho phép fullscreen để tiếp tục thi.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#f4f7fc] text-slate-950">
      <header className="grid min-h-[76px] shrink-0 grid-cols-2 items-center gap-3 border-b border-blue-100 bg-white px-4 shadow-sm lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.15fr] lg:px-7">
        <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><FiShield size={23} /></div>
          <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-widest text-blue-600">Phòng thi thử</p><h1 className="truncate text-base font-black">{exam.title}</h1></div>
        </div>
        <HeaderInfo icon={FiUser} label="Thí sinh" value={userName || 'Thí sinh'} />
        <HeaderInfo icon={FiCheck} label="Đã làm" value={`${answeredCount}/${questions.length} câu`} />
        <HeaderInfo icon={FiAlertTriangle} label="Vi phạm" value={`${violations}/${maxViolations} lần`} danger={violations > 0} />
        <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-4 py-3 text-white shadow-lg shadow-blue-600/20">
          <FiClock size={24} />
          <div><p className="text-[11px] font-bold text-blue-100">Thời gian còn lại</p><p className="text-xl font-black tabular-nums">{formatTime(timeLeft)}</p></div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(430px,0.9fr)]">
        <section className="min-h-[45vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm">
          {paperUrl ? (
            <iframe
              src={`${paperUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={`Đề thi ${exam.title}`}
              data-exam-pdf-viewer="true"
              className="h-full w-full bg-white"
            />
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center p-6 text-center">
              {paperError ? <p className="max-w-md font-bold text-rose-600">{paperError}</p> : <p className="font-bold text-slate-500">Đang tải đề PDF...</p>}
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="font-black text-blue-700">BẢNG LÀM BÀI</h2><p className="text-xs font-semibold text-slate-400">Chọn đáp án theo nội dung trong PDF</p></div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500"><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" />Đã làm</span><span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full border border-slate-400" />Chưa làm</span></div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div
              className="grid min-w-[390px] items-center gap-y-1 text-center text-xs font-black text-slate-700"
              style={{ gridTemplateColumns: `70px repeat(${answerKeys.length}, minmax(42px, 1fr)) 34px` }}
            >
              <span />
              {answerKeys.map((key) => <span key={key}>{key}</span>)}
              <span />
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
                          disabled={!answer || submitting || tabConflict}
                          onClick={() => answer && onSelectAnswer(question, answer.id, answer.answer_key)}
                          aria-label={`Câu ${question.question_number || index + 1}, đáp án ${key}`}
                          className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white hover:border-blue-500'} disabled:cursor-not-allowed disabled:opacity-35`}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-white" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onToggleFlag(question.id)}
                      className={`mx-auto p-1 ${flaggedQuestions.has(question.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                      aria-label={`Đánh dấu câu ${question.question_number || index + 1}`}
                    ><FiFlag fill={flaggedQuestions.has(question.id) ? 'currentColor' : 'none'} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-slate-100 p-4">
            <button type="button" onClick={enterFullscreen} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"><FiMaximize /> Toàn màn hình</button>
            <button type="button" onClick={onSubmit} disabled={submitting || tabConflict} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"><FiSend />{submitting ? 'Đang nộp...' : 'Nộp bài'}</button>
          </div>
        </section>
      </main>

      {!isFullscreen && !submitting && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">
            <FiMaximize className="mx-auto mb-4 text-5xl text-blue-600" />
            <h2 className="text-xl font-black">Phòng thi yêu cầu toàn màn hình</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Thoát toàn màn hình được tính là một lần vi phạm. Bạn cần quay lại fullscreen để tiếp tục làm bài.</p>
            <button type="button" onClick={enterFullscreen} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-700">Trở lại toàn màn hình</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderInfo({ icon: Icon, label, value, danger = false }: { icon: any; label: string; value: string; danger?: boolean }) {
  return (
    <div className="hidden min-w-0 items-center gap-3 lg:flex">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}><Icon size={19} /></div>
      <div className="min-w-0"><p className="text-[11px] font-semibold text-slate-400">{label}</p><p className={`truncate text-sm font-black ${danger ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p></div>
    </div>
  );
}
