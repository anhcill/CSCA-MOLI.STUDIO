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
      // Replace current task instead of blocking with alert()
      const nextTask = { question, mode };
      taskRef.current = nextTask;
      setTask(nextTask);
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
