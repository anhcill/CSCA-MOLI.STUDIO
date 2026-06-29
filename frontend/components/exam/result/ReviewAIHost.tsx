'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ReviewAIModal from './ReviewAIModal';
import type { QuestionResult, ReviewAIMode, ReviewAITask } from './types';

export interface ReviewAIHostHandle {
  open: (question: QuestionResult, mode: ReviewAIMode) => void;
  close: () => void;
  isOpen: () => boolean;
}

interface ReviewAIHostProps {
  attemptId: number;
  languageMode?: string | null;
  onOpenChat?: () => void;
}

const BUSY_MESSAGE = 'AI đang xử lý câu khác. Mở lại ô AI ở góc hoặc đóng kết quả hiện tại rồi hỏi tiếp.';

const ReviewAIHost = forwardRef<ReviewAIHostHandle, ReviewAIHostProps>(function ReviewAIHost(
  { attemptId, languageMode, onOpenChat },
  ref,
) {
  const [task, setTask] = useState<ReviewAITask | null>(null);
  const taskRef = useRef<ReviewAITask | null>(null);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  const close = useCallback(() => {
    taskRef.current = null;
    setTask(null);
  }, []);

  useImperativeHandle(ref, () => ({
    open(question, mode) {
      if (taskRef.current) {
        alert(BUSY_MESSAGE);
        return;
      }

      const nextTask = { question, mode };
      taskRef.current = nextTask;
      window.requestAnimationFrame(() => setTask(nextTask));
    },
    close,
    isOpen() {
      return Boolean(taskRef.current);
    },
  }), [close]);

  if (!task) return null;

  return (
    <ReviewAIModal
      question={task.question}
      mode={task.mode}
      attemptId={attemptId}
      languageMode={languageMode}
      onClose={close}
      onOpenChat={() => {
        close();
        onOpenChat?.();
      }}
    />
  );
});

export default ReviewAIHost;
