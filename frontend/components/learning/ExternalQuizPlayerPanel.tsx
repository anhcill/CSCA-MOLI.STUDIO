'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiLock,
  FiPlay,
  FiRefreshCw,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey, parseExternalApiError } from '@/lib/api/learning';
import type {
  ExternalQuizAttemptDto,
  ExternalQuizDetailDto,
  ExternalQuizSubmitResponseDto,
  ExternalUnitQuizDto,
  ExternalWorkspaceUnitSummaryDto,
} from '@/lib/types/courses';
import { ExternalQuizWorkspaceModal } from './ExternalQuizWorkspaceModal';

export interface ExternalQuizPlayerPanelProps {
  profileId: string | null;
  unitId: string | number;
  quizzes: ExternalUnitQuizDto[];
  isPublicPreviewAccess: boolean;
  nextUnit?: ExternalWorkspaceUnitSummaryDto | null;
  learningMode?: 'live' | 'recording' | string | null;
  currentUnitWatchPercent?: number | null;
  onQuizSubmitted?: (response: ExternalQuizSubmitResponseDto) => void;
  onOpenSolutionFile?: (fileId: string) => void;
  onAdvanceToNextUnit?: () => void;
}

function draftStorageKey(profileId: string, quizId: string | number, attemptId: string | number): string {
  return `csca_ext_quiz_${profileId}_${quizId}_${attemptId}`;
}

function readLocalDraft(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(key: string, answers: Record<string, unknown>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    /* ignore storage quota */
  }
}

function removeLocalDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function computeInitialRemainingSeconds(
  attempt: ExternalQuizAttemptDto | null | undefined,
  quiz: ExternalUnitQuizDto | null | undefined,
): number | null {
  if (!attempt) return null;
  if (typeof attempt.remainingSeconds === 'number' && Number.isFinite(attempt.remainingSeconds)) {
    return Math.max(0, Math.floor(attempt.remainingSeconds));
  }
  if (attempt.expiresAt) {
    const ms = Date.parse(attempt.expiresAt);
    if (Number.isFinite(ms)) {
      return Math.max(0, Math.floor((ms - Date.now()) / 1000));
    }
  }
  if (attempt.startedAt && typeof quiz?.durationMinutes === 'number' && quiz.durationMinutes > 0) {
    const startMs = Date.parse(attempt.startedAt);
    if (Number.isFinite(startMs)) {
      const endMs = startMs + quiz.durationMinutes * 60 * 1000;
      return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
    }
  }
  return null;
}

export function ExternalQuizPlayerPanel({
  profileId,
  unitId,
  quizzes,
  isPublicPreviewAccess,
  nextUnit = null,
  learningMode = null,
  currentUnitWatchPercent = null,
  onQuizSubmitted,
  onOpenSolutionFile,
  onAdvanceToNextUnit,
}: ExternalQuizPlayerPanelProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<'play' | 'result' | 'preview'>('play');
  const [detail, setDetail] = useState<ExternalQuizDetailDto | null>(null);
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'local' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitResponse, setSubmitResponse] = useState<ExternalQuizSubmitResponseDto | null>(null);
  const [quizSummaryOverrides, setQuizSummaryOverrides] = useState<Record<string, {
    bestScore?: number | null;
    maxScore?: number | null;
    isCompleted?: boolean;
  }>>({});

  const dirtyRef = useRef(false);
  const lastChangedQuestionRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const submitIdempotencyRef = useRef<{ attemptId: string; key: string } | null>(null);
  const autoSubmittedAttemptRef = useRef<string | null>(null);
  const answersRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Reset on unit/profile switch
  useEffect(() => {
    setSelectedQuizId(null);
    setWorkspaceOpen(false);
    setDetail(null);
    setSubmitResponse(null);
    setError('');
    setErrorCode(null);
    setAutosaveStatus('idle');
    setLastSavedTime('');
    setAnswers({});
    setRemainingSeconds(null);
    setQuizSummaryOverrides({});
    dirtyRef.current = false;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, [profileId, unitId]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  const activeAttempt = detail?.activeAttempt?.status === 'in_progress' ? detail.activeAttempt : null;
  const activeAttemptId = activeAttempt?.id ?? null;

  const hydrateAttemptAnswers = useCallback((
    pid: string,
    qid: string,
    attempt: ExternalQuizAttemptDto,
  ) => {
    const serverAnswers = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
    const localDraft = readLocalDraft(draftStorageKey(pid, qid, attempt.id));
    const merged = { ...(localDraft || {}), ...serverAnswers };
    answersRef.current = merged;
    setAnswers(merged);
  }, []);

  const persistAnswers = useCallback(async (explicitQuestionId?: string) => {
    if (!profileId || !activeAttemptId) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const qid = explicitQuestionId || lastChangedQuestionRef.current || undefined;
    const currentAnswers = answersRef.current;
    try {
      setAutosaveStatus('saving');
      await learningApi.saveExternalQuizAnswers({
        profileId,
        unitId,
        attemptId: activeAttemptId,
        answers: currentAnswers,
        ...(qid ? { questionId: qid, answer: currentAnswers[qid] } : {}),
      });
      dirtyRef.current = false;
      setAutosaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Chưa thể đồng bộ bản nháp lên máy chủ.');
      if (parsed.code === 'ATTEMPT_ALREADY_SUBMITTED' || parsed.code === 'ATTEMPT_EXPIRED') {
        setErrorCode(parsed.code);
        setError('Phiên làm bài đã kết thúc hoặc đã được nộp trước đó.');
        if (selectedQuizId) {
          void learningApi.getExternalQuizDetail({ profileId, unitId, quizId: selectedQuizId })
            .then((fresh) => {
              setDetail(fresh);
              if (fresh.latestResult) setWorkspaceMode('result');
            })
            .catch(() => {});
        }
      } else {
        setAutosaveStatus('local');
      }
    }
  }, [activeAttemptId, profileId, selectedQuizId, unitId]);

  const handleSubmitAttempt = useCallback(async () => {
    if (!profileId || !activeAttemptId || submitting) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (!submitIdempotencyRef.current || submitIdempotencyRef.current.attemptId !== activeAttemptId) {
      submitIdempotencyRef.current = {
        attemptId: activeAttemptId,
        key: generateIdempotencyKey(),
      };
    }

    try {
      setSubmitting(true);
      setError('');
      setErrorCode(null);
      const currentAnswers = answersRef.current;
      if (dirtyRef.current) {
        await learningApi.saveExternalQuizAnswers({
          profileId,
          unitId,
          attemptId: activeAttemptId,
          answers: currentAnswers,
        });
        dirtyRef.current = false;
      }
      const res = await learningApi.submitExternalQuizAttempt({
        profileId,
        unitId,
        attemptId: activeAttemptId,
        answers: currentAnswers,
        idempotencyKey: submitIdempotencyRef.current.key,
      });
      if (selectedQuizId) {
        removeLocalDraft(draftStorageKey(profileId, selectedQuizId, activeAttemptId));
      }
      setSubmitResponse(res);
      setDetail((prev) => prev ? {
        ...prev,
        activeAttempt: null,
        latestAttempt: res.attempt,
        latestResult: res.result,
        items: res.result?.items ?? prev.items,
        canViewSolution: res.canViewSolution ?? res.result?.canViewSolution ?? prev.canViewSolution,
      } : prev);
      if (selectedQuizId && res.result) {
        setQuizSummaryOverrides((prev) => ({
          ...prev,
          [selectedQuizId]: {
            bestScore: res.result.score,
            maxScore: res.result.maxScore,
            isCompleted: Boolean(res.result.isPassed || res.unitProgress?.isQuizCompleted),
          },
        }));
      }
      setRemainingSeconds(null);
      setAutosaveStatus('idle');
      setWorkspaceMode('result');
      setWorkspaceOpen(true);
      onQuizSubmitted?.(res);

      if (selectedQuizId) {
        void learningApi.getExternalQuizDetail({ profileId, unitId, quizId: selectedQuizId })
          .then((fresh) => setDetail((prev) => ({
            ...fresh,
            latestResult: fresh.latestResult ?? res.result ?? prev?.latestResult ?? null,
            canViewSolution: fresh.canViewSolution ?? res.canViewSolution ?? res.result?.canViewSolution,
          })))
          .catch(() => {});
      }
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể nộp bài kiểm tra. Hãy thử nhấn Nộp bài lại.');
      setErrorCode(parsed.code);
      if (parsed.code === 'ATTEMPT_ALREADY_SUBMITTED' && selectedQuizId) {
        setError('Lượt làm bài này đã được nộp trước đó. Đang tải kết quả mới nhất...');
        void learningApi.getExternalQuizDetail({ profileId, unitId, quizId: selectedQuizId })
          .then((fresh) => {
            setDetail(fresh);
            setWorkspaceMode('result');
          })
          .catch(() => {});
      } else {
        setError(parsed.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [activeAttemptId, onQuizSubmitted, profileId, selectedQuizId, submitting, unitId]);

  useEffect(() => {
    if (!activeAttemptId || remainingSeconds === null) return undefined;
    if (remainingSeconds <= 0) {
      if (autoSubmittedAttemptRef.current !== activeAttemptId) {
        autoSubmittedAttemptRef.current = activeAttemptId;
        void handleSubmitAttempt();
      }
      return undefined;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds((curr) => (curr === null ? null : Math.max(0, curr - 1)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeAttemptId, handleSubmitAttempt, remainingSeconds]);

  const startOrResumeAttemptForQuiz = useCallback(async (
    quizId: string,
    loadedDetail: ExternalQuizDetailDto,
    newAttempt: boolean,
  ) => {
    if (!profileId) return;
    if (!newAttempt && loadedDetail.activeAttempt?.status === 'in_progress') {
      hydrateAttemptAnswers(profileId, quizId, loadedDetail.activeAttempt);
      setRemainingSeconds(computeInitialRemainingSeconds(loadedDetail.activeAttempt, loadedDetail.quiz));
      setSubmitResponse(null);
      dirtyRef.current = false;
      setAutosaveStatus('idle');
      setWorkspaceMode('play');
      setWorkspaceOpen(true);
      return;
    }

    setStarting(true);
    setError('');
    setErrorCode(null);
    try {
      const started = await learningApi.startExternalQuizAttempt({
        profileId,
        unitId,
        quizId,
        newAttempt,
      });
      hydrateAttemptAnswers(profileId, quizId, started.attempt);
      setDetail((prev) => {
        const base = prev && prev.quiz.id === quizId ? prev : loadedDetail;
        return {
          ...base,
          quiz: started.quiz ?? base.quiz,
          items: started.items ?? base.items,
          questions: started.questions ?? base.questions,
          activeAttempt: started.attempt,
        };
      });
      setRemainingSeconds(computeInitialRemainingSeconds(started.attempt, started.quiz ?? loadedDetail.quiz));
      setSubmitResponse(null);
      dirtyRef.current = false;
      setAutosaveStatus('idle');
      setWorkspaceMode('play');
      setWorkspaceOpen(true);
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể bắt đầu lượt làm bài.');
      setErrorCode(parsed.code);
      setError(
        parsed.code === 'ATTEMPT_LIMIT_REACHED'
          ? 'Bạn đã hết số lượt làm bài cho phép ở bài kiểm tra này.'
          : parsed.message,
      );
      if (loadedDetail.latestResult) {
        setDetail(loadedDetail);
        setWorkspaceMode('result');
        setWorkspaceOpen(true);
      }
    } finally {
      setStarting(false);
    }
  }, [hydrateAttemptAnswers, profileId, unitId]);

  const handleOpenQuizWorkspace = async (
    quizId: string,
    desiredAction: 'take' | 'retry' | 'result' | 'preview',
  ) => {
    if (!profileId || isPublicPreviewAccess || loadingQuizId || starting) return;
    setSelectedQuizId(quizId);
    setLoadingQuizId(quizId);
    setError('');
    setErrorCode(null);
    setSubmitResponse(null);

    try {
      const fresh = await learningApi.getExternalQuizDetail({ profileId, unitId, quizId });
      setDetail(fresh);

      if (desiredAction === 'preview') {
        setAnswers({});
        setRemainingSeconds(null);
        setWorkspaceMode('preview');
        setWorkspaceOpen(true);
        return;
      }

      if (desiredAction === 'result' && fresh.latestResult) {
        setAnswers(fresh.latestAttempt?.answers ?? {});
        setRemainingSeconds(null);
        setWorkspaceMode('result');
        setWorkspaceOpen(true);
        return;
      }

      if (desiredAction === 'retry') {
        await startOrResumeAttemptForQuiz(quizId, fresh, true);
        return;
      }

      // desiredAction === 'take': resume active attempt OR start fresh if allowed, otherwise show result
      if (fresh.activeAttempt?.status === 'in_progress') {
        await startOrResumeAttemptForQuiz(quizId, fresh, false);
      } else if (fresh.canStartAttempt !== false) {
        await startOrResumeAttemptForQuiz(quizId, fresh, Boolean(fresh.latestResult));
      } else if (fresh.latestResult) {
        setAnswers(fresh.latestAttempt?.answers ?? {});
        setWorkspaceMode('result');
        setWorkspaceOpen(true);
      } else {
        setError('Hiện tại bạn chưa thể mở lượt làm mới cho bài tập này.');
      }
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải bài tập từ máy chủ.');
      setErrorCode(parsed.code);
      setError(parsed.message);
    } finally {
      setLoadingQuizId(null);
    }
  };

  const handleUpdateAnswer = (questionId: string, nextValue: unknown) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: nextValue };
      answersRef.current = updated;
      if (profileId && selectedQuizId && activeAttemptId) {
        writeLocalDraft(draftStorageKey(profileId, selectedQuizId, activeAttemptId), updated);
      }
      return updated;
    });
    dirtyRef.current = true;
    lastChangedQuestionRef.current = questionId;
    setAutosaveStatus('local');
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistAnswers(questionId);
    }, 700);
  };

  if (!quizzes.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-[#18243b] dark:text-white">
          Bài tập & Kiểm tra trắc nghiệm
        </h3>
        <span className="text-xs font-semibold text-[#6f665f] dark:text-slate-400">
          Nhấn &ldquo;Làm bài tập&rdquo; để mở không gian làm bài toàn màn hình chuẩn CSCA-Course
        </span>
      </div>

      {isPublicPreviewAccess || !profileId ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <FiLock className="shrink-0" />
          <span>Đăng ký hoặc đăng nhập khóa học để làm bài kiểm tra, xem đáp án và lưu điểm tiến độ.</span>
        </div>
      ) : null}

      {error && !workspaceOpen ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            {(errorCode === 'DEVICE_BINDING_REVOKED' || errorCode === 'UNTRUSTED_DEVICE_PROOF') ? (
              <Link href="/login" className="mt-1 inline-block underline">Đăng nhập lại</Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {quizzes.map((quiz) => {
          const override = quizSummaryOverrides[quiz.id];
          const isCompleted = override?.isCompleted ?? Boolean(quiz.isCompleted);
          const bestScore = override?.bestScore ?? quiz.bestScore ?? null;
          const maxScore = override?.maxScore ?? quiz.maxScore ?? 10;
          const isBusy = loadingQuizId === quiz.id || (selectedQuizId === quiz.id && starting);
          const canFreeReview = Boolean(detail?.quiz.id === quiz.id && (detail.canReviewFreely || detail.isAdminBypass))
            || learningMode === 'live';

          return (
            <div
              key={quiz.id}
              className="rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 shadow-xs transition hover:border-[#247d7e]/50 dark:border-[#34435a] dark:bg-[#101e33] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-[#18243b] dark:text-white">
                      {quiz.title}
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <FiCheckCircle /> Đã đạt
                      </span>
                    ) : bestScore !== null && bestScore !== undefined ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Đã làm
                      </span>
                    ) : null}
                  </div>

                  {quiz.description ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-[#5a5049] dark:text-slate-300">
                      {quiz.description}
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#6f665f] dark:text-slate-400">
                    {quiz.durationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <FiClock /> {quiz.durationMinutes} phút
                      </span>
                    ) : null}
                    {quiz.passingScore !== undefined && quiz.passingScore !== null ? (
                      <span>Điểm đạt: {quiz.passingScore}%</span>
                    ) : null}
                    {quiz.attemptLimit != null ? (
                      <span>Lượt làm: {quiz.attemptsCount ?? quiz.attemptsUsed ?? 0}/{quiz.attemptLimit}</span>
                    ) : (
                      <span>Không giới hạn lượt làm</span>
                    )}
                    {bestScore !== null && bestScore !== undefined ? (
                      <span className="font-black text-[#247d7e] dark:text-[#6ac6bd]">
                        Điểm: {bestScore}/{maxScore}
                      </span>
                    ) : null}
                  </div>
                </div>

                {!isPublicPreviewAccess && profileId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(loadingQuizId) || starting}
                      onClick={() => void handleOpenQuizWorkspace(quiz.id, 'take')}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
                    >
                      {isBusy ? <FiRefreshCw className="animate-spin" /> : <FiPlay />}
                      {isBusy
                        ? 'Đang mở...'
                        : bestScore !== null && bestScore !== undefined
                          ? 'Làm bài / Làm lại'
                          : 'Làm bài tập'}
                    </button>

                    {(bestScore !== null && bestScore !== undefined) ? (
                      <button
                        type="button"
                        disabled={Boolean(loadingQuizId) || starting}
                        onClick={() => void handleOpenQuizWorkspace(quiz.id, 'result')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-white px-3.5 py-2.5 text-xs font-black text-[#247d7e] transition hover:bg-[#eff9f7] disabled:opacity-50 dark:bg-[#0b172b] dark:text-[#6ac6bd]"
                      >
                        <FiFileText /> Xem kết quả & đáp án
                      </button>
                    ) : canFreeReview ? (
                      <button
                        type="button"
                        disabled={Boolean(loadingQuizId) || starting}
                        onClick={() => void handleOpenQuizWorkspace(quiz.id, 'preview')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-white px-3.5 py-2.5 text-xs font-black text-[#247d7e] transition hover:bg-[#eff9f7] disabled:opacity-50 dark:bg-[#0b172b] dark:text-[#6ac6bd]"
                      >
                        <FiEye /> Xem đáp án nhanh
                      </button>
                    ) : null}

                    {isCompleted && nextUnit && !nextUnit.isLocked && onAdvanceToNextUnit ? (
                      <button
                        type="button"
                        onClick={onAdvanceToNextUnit}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-3.5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#1b6465]"
                      >
                        Bài kế tiếp <FiArrowRight />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {workspaceOpen && detail && profileId ? (
        <ExternalQuizWorkspaceModal
          open={workspaceOpen}
          mode={workspaceMode}
          profileId={profileId}
          unitId={unitId}
          detail={detail}
          activeAttempt={activeAttempt}
          result={submitResponse?.result ?? detail.latestResult ?? null}
          submitResponse={submitResponse}
          nextUnit={nextUnit}
          learningMode={learningMode}
          currentUnitWatchPercent={currentUnitWatchPercent}
          starting={starting}
          submitting={submitting}
          answers={answers}
          remainingSeconds={remainingSeconds}
          autosaveStatus={autosaveStatus}
          lastSavedTime={lastSavedTime}
          error={error}
          errorCode={errorCode}
          onSelectAnswer={handleUpdateAnswer}
          onSubmit={() => void handleSubmitAttempt()}
          onRetryQuiz={() => {
            if (detail.quiz?.id) {
              void startOrResumeAttemptForQuiz(detail.quiz.id, detail, true);
            }
          }}
          onOpenSolutionFile={onOpenSolutionFile ? (fid) => {
            setWorkspaceOpen(false);
            onOpenSolutionFile(fid);
          } : undefined}
          onAdvanceToNextUnit={onAdvanceToNextUnit ? () => {
            setWorkspaceOpen(false);
            onAdvanceToNextUnit();
          } : undefined}
          onClose={() => setWorkspaceOpen(false)}
        />
      ) : null}
    </section>
  );
}
