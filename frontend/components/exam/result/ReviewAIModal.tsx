'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiCpu, FiMaximize2, FiMessageCircle, FiMinimize2, FiX, FiZap } from 'react-icons/fi';
import AIFormattedText from '@/components/ai/AIFormattedText';
import CuteLoadingText from '@/components/ai/CuteLoadingText';
import { pickCuteAILoadingMessage } from '@/components/ai/cuteLoadingMessages';
import { authFetch } from '@/lib/utils/authFetch';
import BilingualMathText from './BilingualMathText';
import QuestionExplanationBlock from './QuestionExplanationBlock';
import type { QuestionResult, ReviewAIMode } from './types';
import {
  buildQuestionExplanationPrompt,
  buildQuestionTheoryPrompt,
  formatReviewAnswer,
  getQuestionDisplayText,
  getQuestionReviewStatus,
} from './utils';

interface ReviewAIModalProps {
  question: QuestionResult;
  mode: ReviewAIMode;
  attemptId: number;
  languageMode?: string | null;
  onClose: () => void;
  onOpenChat?: () => void;
}

export default function ReviewAIModal({ question, mode, attemptId, languageMode, onClose, onOpenChat }: ReviewAIModalProps) {
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [cuteMessage, setCuteMessage] = useState(() => pickCuteAILoadingMessage(Date.now()));

  const questionNo = question.sub_question_number || question.question_number;
  const questionText = getQuestionDisplayText(question, undefined, languageMode);
  const answerStatus = getQuestionReviewStatus(question);
  const taskKey = `${attemptId}:${mode}:${question.question_id || question.id || question.question_number}:${question.sub_question_number || 0}`;
  const title = mode === 'theory' ? 'Giảng lại lý thuyết' : `Phân tích câu ${questionNo}`;

  const minimizeModal = useCallback(() => setMinimized(true), []);
  const restoreModal = useCallback(() => setMinimized(false), []);

  const answerBox = useMemo(() => {
    if (answerStatus === 'correct') {
      return {
        box: 'border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/25',
        label: 'text-green-600 dark:text-green-300',
        text: 'text-green-800 dark:text-green-100',
      };
    }
    if (answerStatus === 'unanswered') {
      return {
        box: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25',
        label: 'text-amber-600 dark:text-amber-300',
        text: 'text-amber-800 dark:text-amber-100',
      };
    }
    return {
      box: 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/25',
      label: 'text-red-600 dark:text-red-300',
      text: 'text-red-800 dark:text-red-100',
    };
  }, [answerStatus]);

  useEffect(() => {
    let alive = true;

    async function loadAnswer() {
      setLoading(true);
      setAnswer(null);
      setMinimized(false);
      setCuteMessage(pickCuteAILoadingMessage(Date.now() + Math.random() * 1000));

      try {
        const res = await authFetch('/api/ai/ask', {
          method: 'POST',
          body: JSON.stringify({
            question: mode === 'theory'
              ? buildQuestionTheoryPrompt(question, questionText, languageMode)
              : buildQuestionExplanationPrompt(question, questionText, languageMode),
            attemptId,
          }),
        });
        const data = await res.json();
        if (alive) setAnswer(data);
      } catch (error) {
        console.error(error);
        if (alive) setAnswer({ success: false, message: 'Không thể gọi AI lúc này.' });
      } finally {
        if (alive) setLoading(false);
      }
    }

    const frameId = window.requestAnimationFrame(loadAnswer);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [attemptId, mode, question, questionText, taskKey]);

  useEffect(() => {
    if (minimized) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [minimized]);

  const minimizedLauncher = minimized ? (
      <button
        type="button"
        onClick={restoreModal}
        className="fixed bottom-4 right-4 z-[9999] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-left shadow-2xl shadow-violet-950/20 ring-1 ring-white/60 transition hover:-translate-y-0.5 hover:shadow-violet-950/30 dark:border-violet-800/70 dark:bg-gray-950 dark:ring-gray-800"
        aria-live="polite"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <FiCheckCircle size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
            {loading ? `AI đang làm câu ${questionNo}` : answer?.success ? `AI xong câu ${questionNo}` : `AI lỗi câu ${questionNo}`}
          </span>
          <span className="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            Nhấn để mở lại
          </span>
        </span>
        <FiMaximize2 className="shrink-0 text-slate-400" size={16} />
      </button>
  ) : null;

  return (
    <>
    {minimizedLauncher}
    <div
      className={`fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm no-print transition-opacity duration-150 sm:items-center sm:p-4 ${minimized ? 'pointer-events-none invisible opacity-0' : 'opacity-100'}`}
      aria-hidden={minimized}
      onClick={loading ? undefined : onClose}
    >
      <div
        className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-white shadow-2xl dark:bg-gray-950 sm:max-h-[86vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-4 dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-violet-950/40 sm:p-6">
          <div className="flex min-w-0 items-center gap-3 pr-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
              {mode === 'theory' ? <FiMessageCircle size={18} /> : <FiCpu size={18} />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {title}
              </h3>
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {loading ? 'Đang xử lý, có thể thu nhỏ xuống góc' : 'Kết quả đã sẵn sàng'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={minimizeModal}
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white hover:text-violet-700 dark:text-slate-300 dark:hover:bg-gray-900 dark:hover:text-violet-200"
              title="Thu nhỏ"
            >
              <FiMinimize2 size={17} />
            </button>
            {!loading && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-gray-900 dark:hover:text-white"
                title="Đóng"
              >
                <FiX size={19} />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/25">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-violet-700 dark:text-violet-200">Câu hỏi</p>
            <BilingualMathText
              primary={question.question_text || question.question_text_en}
              secondary={question.question_text_cn}
              tertiary={question.question_text_en}
              languageMode={languageMode}
              className="break-words text-sm font-medium leading-6 text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100"
              secondaryClassName="mt-2 text-sm text-violet-700 dark:text-violet-200"
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-3 ${answerBox.box}`}>
              <p className={`mb-1 text-xs font-bold ${answerBox.label}`}>
                {answerStatus === 'unanswered' ? 'Chưa trả lời' : 'Đáp án của bạn'}
              </p>
              <BilingualMathText
                primary={formatReviewAnswer(question.selected_answer_key, question.selected_answer_text, 'Bạn đã bỏ qua')}
                secondary={question.selected_answer_text_cn}
                tertiary={question.selected_answer_text_en}
                languageMode={languageMode}
                className={`text-sm font-semibold ${answerBox.text}`}
                secondaryClassName="mt-1 text-xs text-slate-600 dark:text-slate-300"
              />
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/60 dark:bg-green-950/25">
              <p className="mb-1 text-xs font-bold text-green-600 dark:text-green-300">Đáp án đúng</p>
              <BilingualMathText
                primary={formatReviewAnswer(question.correct_answer_key, question.correct_answer_text, 'Chưa có đáp án đúng')}
                secondary={question.correct_answer_text_cn}
                tertiary={question.correct_answer_text_en}
                languageMode={languageMode}
                className="text-sm font-semibold text-green-800 dark:text-green-100"
                secondaryClassName="mt-1 text-xs text-green-700 dark:text-green-300"
              />
            </div>
          </div>

          {loading ? (
            <QuestionAnalysisLoading mode={mode} cuteMessage={cuteMessage} />
          ) : answer?.success ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-4 shadow-sm dark:border-violet-900/60 dark:from-violet-950/25 dark:to-gray-950 sm:p-5">
                <p className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-violet-700 dark:text-violet-200">
                  <FiCpu size={12} /> AI phân tích
                </p>
                <div className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
                  <AIFormattedText
                    value={answer.answer}
                    className="min-w-0 overflow-x-auto text-[15px] leading-7 text-slate-800 dark:text-slate-100 [&_.katex-display]:overflow-x-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_p]:mb-3 [&_strong]:font-black [&_strong]:text-slate-950 dark:[&_strong]:text-white"
                  />
                </div>
              </div>
              <QuestionExplanationBlock question={question} languageMode={languageMode} title="📖 Giải thích có sẵn" />
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500 dark:text-gray-400">
              <p className="mb-2 text-sm">
                {answer?.message || 'Không thể phân tích câu này'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Thử vào tab Hỏi AI để hỏi chi tiết hơn
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-800 sm:pb-4">
          {loading && (
            <button
              type="button"
              onClick={minimizeModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              <FiMinimize2 size={14} /> Thu nhỏ xuống góc
            </button>
          )}
          {!loading && mode === 'theory' && onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <FiMessageCircle size={14} /> Hỏi AI thêm
            </button>
          )}
          {!loading && (
            <>
              <button
                type="button"
                onClick={minimizeModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <FiMinimize2 size={14} /> Thu nhỏ
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Đóng
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function QuestionAnalysisLoading({ mode, cuteMessage }: { mode: ReviewAIMode; cuteMessage: string }) {
  const steps = mode === 'theory'
    ? ['Tìm điểm kiến thức', 'Kiểm tra ví dụ', 'Soạn mẹo dễ nhớ']
    : ['Đọc câu hỏi', 'Đối chiếu đáp án', 'Soạn giải thích'];
  const subtitle = mode === 'theory'
    ? 'AI đang gom ý chính, ví dụ và mẹo nhớ cho bài học này.'
    : 'AI đang đọc lại đề, đáp án và soạn lời giải dễ hiểu.';

  return (
    <div className="rounded-3xl border border-violet-100 bg-gradient-to-b from-white via-violet-50/80 to-fuchsia-50/70 px-4 py-7 shadow-sm dark:border-violet-900/60 dark:from-gray-950 dark:via-violet-950/20 dark:to-fuchsia-950/20 sm:px-6" aria-live="polite">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-3xl shadow-lg shadow-violet-100 ring-1 ring-violet-100 dark:bg-gray-900 dark:shadow-none dark:ring-violet-900/60">
        <FiZap className="text-violet-600 dark:text-violet-300" size={26} />
      </div>
      <p className="text-center text-base font-black text-violet-800 dark:text-violet-100 sm:text-lg">
        <CuteLoadingText text={cuteMessage} />
      </p>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
        {subtitle}
      </p>
      <div className="mx-auto mt-6 max-w-md space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border border-white bg-white/85 px-3 py-3 shadow-sm shadow-violet-100/60 ring-1 ring-violet-100/70 dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-none dark:ring-violet-900/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 text-xs font-black text-violet-700 shadow-sm dark:from-violet-900 dark:to-fuchsia-900 dark:text-violet-100">
              {index + 1}
            </span>
            <div className="h-2.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-400"
                style={{ width: `${38 + index * 24}%`, animation: 'pulse 1.4s ease-in-out infinite' }}
              />
            </div>
            <span className="min-w-[6.5rem] text-xs font-black text-violet-700 dark:text-violet-200">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
