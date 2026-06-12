/**
 * useExamOffline — offline-aware wrapper for exam answer saving.
 *
 * When online: saves answer via API normally.
 * When offline: queues answer in IndexedDB, persists draft, shows banner.
 * When back online: flushes queue to backend batch endpoint.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  enqueueSync,
  getPendingQueue,
  updateQueueItem,
  removeQueueItem,
  type ExamDraft,
} from '@/lib/examOfflineStore';
import examApi from '@/lib/api/exams';
import axios from '@/lib/utils/axios';

interface UseExamOfflineOptions {
  examId: number | null;
  attemptId: number | null;
  practiceMode: boolean;
  selectedAnswers: Record<number, number | string>;
  timeLeft: number;
  started: boolean;
}

interface UseExamOfflineReturn {
  /** true when navigator.onLine === false */
  isOffline: boolean;
  /** Number of queued items not yet synced */
  pendingCount: number;
  /** true while flush is running */
  isSyncing: boolean;
  /** Save answer — queues if offline, calls API if online */
  saveAnswerOfflineAware: (
    questionId: number,
    answerKey: string,
    timeSpent: number,
    essayAnswer?: string,
  ) => Promise<any>;
  /** Submit exam — queues if offline */
  submitOfflineAware: () => Promise<any>;
  /** Persist current draft to IndexedDB (call on timer tick, answer change) */
  persistDraft: () => void;
  /** Load saved draft from IndexedDB */
  restoreDraft: () => Promise<ExamDraft | null>;
  /** Flush sync queue manually */
  flushQueue: () => Promise<void>;
  /** Clean up draft after successful submit */
  clearDraft: () => Promise<void>;
}

export function useExamOffline(opts: UseExamOfflineOptions): UseExamOfflineReturn {
  const { examId, attemptId, practiceMode, selectedAnswers, timeLeft, started } = opts;

  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const flushingRef = useRef(false);
  const draftStartTimeRef = useRef<number | null>(null);

  const refreshPendingCount = useCallback(async () => {
    if (!attemptId) {
      setPendingCount(0);
      return;
    }
    try {
      const items = await getPendingQueue(attemptId);
      setPendingCount(items.length);
    } catch { /* ignore */ }
  }, [attemptId]);

  // Refresh pending count periodically
  useEffect(() => {
    if (!attemptId) return;
    const refresh = async () => {
      try {
        await refreshPendingCount();
      } catch { /* ignore */ }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [attemptId, isSyncing, refreshPendingCount]);

  // Auto-persist draft every 10s while exam is active
  useEffect(() => {
    if (!started || !examId || !attemptId) return;
    if (!draftStartTimeRef.current) {
      draftStartTimeRef.current = Date.now();
    }
    const interval = setInterval(() => {
      persistDraft();
    }, 10000);
    return () => clearInterval(interval);
  }, [started, examId, attemptId, selectedAnswers, timeLeft]);

  const persistDraft = useCallback(() => {
    if (!examId || !attemptId) return;
    saveDraft({
      examId,
      attemptId,
      selectedAnswers,
      startTime: draftStartTimeRef.current || Date.now(),
      timeLeftSeconds: timeLeft,
      practiceMode,
      updatedAt: Date.now(),
    }).catch(() => { /* silent */ });
  }, [examId, attemptId, selectedAnswers, timeLeft, practiceMode]);

  const restoreDraft = useCallback(async (): Promise<ExamDraft | null> => {
    if (!examId || !attemptId) return null;
    return loadDraft(examId, attemptId);
  }, [examId, attemptId]);

  const clearDraft = useCallback(async () => {
    if (!examId || !attemptId) return;
    await deleteDraft(examId, attemptId).catch(() => {});
  }, [examId, attemptId]);

  const saveAnswerOfflineAware = useCallback(async (
    questionId: number,
    answerKey: string,
    timeSpent: number,
    essayAnswer?: string,
  ) => {
    if (!attemptId) return;

    // Always persist draft first
    persistDraft();

    if (!navigator.onLine) {
      // Queue for later sync
      await enqueueSync({
        type: 'answer_changed',
        attemptId,
        questionId,
        answerKey,
        essayAnswer,
        timeSpent,
        practiceMode,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      });
      await refreshPendingCount();
      return { queued: true };
    }

    // Online — save directly
    try {
      return await examApi.saveAnswer(attemptId, questionId, answerKey, timeSpent, essayAnswer, practiceMode);
    } catch (err: any) {
      // Network error → queue
      if (!err.response) {
        await enqueueSync({
          type: 'answer_changed',
          attemptId,
          questionId,
          answerKey,
          essayAnswer,
          timeSpent,
          practiceMode,
          createdAt: Date.now(),
          retryCount: 0,
          status: 'pending',
        });
        await refreshPendingCount();
        return { queued: true };
      }
      throw err;
    }
  }, [attemptId, practiceMode, persistDraft, refreshPendingCount]);

  const submitOfflineAware = useCallback(async () => {
    if (!attemptId) return;

    if (!navigator.onLine) {
      await enqueueSync({
        type: 'submit_attempt',
        attemptId,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      });
      await refreshPendingCount();
      return { queued: true };
    }

    try {
      return await examApi.submitExam(attemptId);
    } catch (err: any) {
      if (!err.response) {
        await enqueueSync({
          type: 'submit_attempt',
          attemptId,
          createdAt: Date.now(),
          retryCount: 0,
          status: 'pending',
        });
        await refreshPendingCount();
        return { queued: true };
      }
      throw err;
    }
  }, [attemptId, refreshPendingCount]);

  const flushQueue = useCallback(async () => {
    if (!attemptId || flushingRef.current) return;
    flushingRef.current = true;
    setIsSyncing(true);

    try {
      const items = await getPendingQueue(attemptId);
      if (items.length === 0) return;

      const answers = items.filter((i) => i.type === 'answer_changed');
      const submits = items.filter((i) => i.type === 'submit_attempt');

      if (answers.length > 0) {
        try {
          const response = await axios.post(`/attempts/${attemptId}/answers/batch`, {
            answers: answers.map((a) => ({
              clientId: a.id,
              questionId: a.questionId,
              answerKey: a.answerKey,
              essayAnswer: a.essayAnswer,
              timeSpent: a.timeSpent || 0,
              practiceMode: a.practiceMode || false,
            })),
          });
          const savedClientIds = new Set<number>(
            (response.data?.data?.savedClientIds || [])
              .map((id: unknown) => Number(id))
              .filter((id: number) => Number.isFinite(id))
          );

          for (const item of answers) {
            if (!item.id) continue;
            if (savedClientIds.has(item.id)) {
              await removeQueueItem(item.id);
            } else {
              await updateQueueItem(item.id, {
                retryCount: item.retryCount + 1,
                status: 'failed',
                errorMessage: 'Chưa đồng bộ được đáp án này',
              });
            }
          }
        } catch (err) {
          console.error('[ExamOffline] Batch sync failed:', err);
          for (const item of answers) {
            if (item.id) {
              await updateQueueItem(item.id, {
                retryCount: item.retryCount + 1,
                status: 'failed',
                errorMessage: 'Mất mạng hoặc máy chủ chưa nhận đáp án',
              });
            }
          }
        }
      }

      const remainingAfterAnswers = await getPendingQueue(attemptId);
      const hasUnsyncedAnswers = remainingAfterAnswers.some((i) => i.type === 'answer_changed');

      if (!hasUnsyncedAnswers && submits.length > 0) {
        try {
          await examApi.submitExam(attemptId);
          for (const item of submits) {
            if (item.id) await removeQueueItem(item.id);
          }
          await clearDraft();
        } catch (err) {
          console.error('[ExamOffline] Submit sync failed:', err);
          for (const item of submits) {
            if (item.id) {
              await updateQueueItem(item.id, {
                retryCount: item.retryCount + 1,
                status: 'failed',
                errorMessage: 'Chưa nộp được bài, sẽ thử lại khi có mạng',
              });
            }
          }
        }
      }

      // Refresh count
      const remaining = await getPendingQueue(attemptId);
      setPendingCount(remaining.length);
    } finally {
      flushingRef.current = false;
      setIsSyncing(false);
    }
  }, [attemptId, clearDraft]);

  // Track online/offline after flushQueue is available.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOffline(!navigator.onLine);

    const goOnline = () => {
      setIsOffline(false);
      flushQueue();
    };
    const goOffline = () => setIsOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [flushQueue]);

  return {
    isOffline,
    pendingCount,
    isSyncing,
    saveAnswerOfflineAware,
    submitOfflineAware,
    persistDraft,
    restoreDraft,
    flushQueue,
    clearDraft,
  };
}
