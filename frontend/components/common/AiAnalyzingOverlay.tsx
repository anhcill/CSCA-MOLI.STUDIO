'use client';

import { useEffect, useState } from 'react';
import { FiActivity, FiCheckCircle } from 'react-icons/fi';

const EXAM_MESSAGES = [
  'AI đang chấm đáp án của bạn...',
  'Đang tìm lỗi sai hay gặp...',
  'Đang tổng hợp điểm mạnh và điểm yếu...',
  'Đang chuẩn bị gợi ý ôn tập...',
];

const PRACTICE_MESSAGES = [
  'AI đang đọc bài luyện tập...',
  'Đang đối chiếu đáp án từng câu...',
  'Đang mở giải thích cho câu sai...',
  'Đang tổng hợp kết quả luyện tập...',
];

const SUBMIT_MESSAGES = [
  'Đang gửi bài làm của bạn...',
  'Đang chấm điểm từng câu...',
  'Đang chuẩn bị kết quả...',
];

interface AiAnalyzingOverlayProps {
  open: boolean;
  mode?: 'exam' | 'practice' | 'submit';
  compactAfterMs?: number;
}

export default function AiAnalyzingOverlay({ open, mode = 'exam', compactAfterMs = 0 }: AiAnalyzingOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const messages = mode === 'practice'
    ? PRACTICE_MESSAGES
    : mode === 'submit'
      ? SUBMIT_MESSAGES
      : EXAM_MESSAGES;
  const steps = mode === 'submit'
    ? ['Gửi bài làm', 'Chấm điểm', 'Chuẩn bị kết quả']
    : ['Chấm bài', 'Phân tích lỗi sai', 'Tạo gợi ý học tiếp'];

  useEffect(() => {
    if (!open) {
      setMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [messages.length, open]);

  useEffect(() => {
    if (!open) {
      setCompact(false);
      return;
    }

    if (!compactAfterMs) {
      setCompact(false);
      return;
    }

    setCompact(false);
    const timer = window.setTimeout(() => setCompact(true), compactAfterMs);
    return () => window.clearTimeout(timer);
  }, [compactAfterMs, open]);

  if (!open) return null;

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="fixed inset-x-3 top-14 z-[80] sm:left-1/2 sm:right-auto sm:w-[min(calc(100vw-2rem),760px)] sm:-translate-x-1/2"
      >
        <div className="rounded-full border border-indigo-100 bg-white/95 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md sm:px-4">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 shrink-0">
              <div className="absolute inset-0 rounded-full border-[3px] border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 animate-spin" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <p className="truncate text-sm font-black text-slate-900">{messages[messageIndex]}</p>
              <span className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300 sm:block" />
              <p className="hidden truncate text-xs font-semibold text-slate-500 sm:block">
                Bạn vẫn xem điểm và đáp án được. AI xong sẽ tự hiện phân tích.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl">
        <div className="relative bg-gradient-to-r from-indigo-600 to-emerald-500 px-6 py-5 text-white">
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <FiActivity size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/75">
                {mode === 'submit' ? 'Nộp bài' : 'AI Analysis'}
              </p>
              <h2 className="text-xl font-black">
                {mode === 'submit' ? 'Đang xử lý bài làm' : 'AI đang phân tích bài làm'}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
              <div className="absolute inset-3 rounded-full bg-indigo-50" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">{messages[messageIndex]}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Vui lòng giữ nguyên trang trong lúc hệ thống tạo kết quả.
              </p>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-2 font-semibold text-slate-600">
                <FiCheckCircle className={index <= messageIndex % 3 ? 'text-emerald-500' : 'text-slate-300'} />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
