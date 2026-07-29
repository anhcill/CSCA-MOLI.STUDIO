'use client';

import { FiBookOpen, FiZap } from 'react-icons/fi';
import type { QuestionReviewStatus, ReviewAIMode } from './types';
import { getReviewAIButtonLabel } from './utils';

interface ReviewAIButtonsProps {
  status: QuestionReviewStatus;
  disabled?: boolean;
  onOpen: (mode: ReviewAIMode) => void;
  className?: string;
}

export default function ReviewAIButtons({ status, disabled = false, onOpen, className = '' }: ReviewAIButtonsProps) {
  if (status === 'correct') return null;

  const disabledClass = disabled
    ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
    : '';
  const title = disabled ? 'AI đang xử lý câu khác. Chờ xong rồi hỏi tiếp.' : undefined;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => onOpen('explain')}
        disabled={disabled}
        title={title}
        className={`flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 disabled:hover:text-slate-400 dark:text-purple-300 dark:hover:text-purple-200 dark:disabled:hover:text-slate-500 ${disabledClass}`}
      >
        <FiZap size={14} /> {getReviewAIButtonLabel(status)}
      </button>
      <button
        type="button"
        onClick={() => onOpen('theory')}
        disabled={disabled}
        title={title}
        className={`flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:hover:text-slate-400 dark:text-indigo-300 dark:hover:text-indigo-200 dark:disabled:hover:text-slate-500 ${disabledClass}`}
      >
        <FiBookOpen size={14} /> Giảng lại lý thuyết
      </button>
    </div>
  );
}
