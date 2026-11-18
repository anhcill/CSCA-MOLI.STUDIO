'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiPlay,
  FiRefreshCw,
  FiSave,
  FiSend,
  FiXCircle,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey, parseExternalApiError } from '@/lib/api/learning';
import type {
  ExternalQuizAttemptDto,
  ExternalQuizDetailDto,
  ExternalQuizOptionDto,
  ExternalQuizQuestionDto,
  ExternalQuizResultDto,
  ExternalQuizSubmitResponseDto,
  ExternalUnitQuizDto,
} from '@/lib/types/courses';
import RichMathText from '@/components/common/RichMathText';

export interface ExternalQuizPlayerPanelProps {
  profileId: string | null;
  unitId: string | number;
  quizzes: ExternalUnitQuizDto[];
  isPublicPreviewAccess: boolean;
  onQuizSubmitted?: (response: ExternalQuizSubmitResponseDto) => void;
}

function formatCountdown(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function isSafeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function optionValue(opt: ExternalQuizOptionDto, idx: number): string {
  if (opt.id !== undefined && opt.id !== null && String(opt.id) !== '') return String(opt.id);
  if (opt.key !== undefined && opt.key !== null && String(opt.key) !== '') return String(opt.key);
  if (opt.label !== undefined && opt.label !== null && String(opt.label) !== '') return String(opt.label);
  return String.fromCharCode(65 + idx);
}

function optionLabel(opt: ExternalQuizOptionDto, idx: number): string {
  return opt.label || opt.key || String.fromCharCode(65 + idx);
}

function isAnsweredValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number' || typeof val === 'boolean') return true;
  return false;
}

function formatDisplayAnswer(val: unknown, question?: ExternalQuizQuestionDto): string {
  if (val === null || val === undefined) return '—';
  const opts = question?.options?.length ? question.options : (question?.linkedOptions ?? []);
  const mapOption = (raw: string) => {
    const foundIndex = opts.findIndex((opt, idx) => optionValue(opt, idx) === raw || opt.key === raw);
    const found = foundIndex >= 0 ? opts[foundIndex] : undefined;
    if (!found) return raw;
    return `${optionLabel(found, foundIndex)}. ${found.text}`;
  };
  if (Array.isArray(val)) {
    return val.length ? val.map((item) => mapOption(String(item))).join(', ') : '—';
  }
  if (typeof val === 'boolean') return val ? 'Đúng' : 'Sai';
  const str = String(val).trim();
  if (!str) return '—';
  if (opts.length) return mapOption(str);
  if (question?.questionType === 'true_false') {
    if (str === 'true') return 'Đúng';
    if (str === 'false') return 'Sai';
  }
  return str;
}

function shouldRenderGroupBanner(questions: ExternalQuizQuestionDto[], idx: number): boolean {
  const curr = questions[idx];
  if (!curr) return false;
  const hasGroup = curr.groupId !== undefined && curr.groupId !== null;
  const hasPassage = Boolean(curr.passageText || (curr.linkedOptions && curr.linkedOptions.length > 0));
  if (!hasGroup && !hasPassage) return false;
  if (idx === 0) return true;
  const prev = questions[idx - 1];
  if (!prev) return true;
  if (hasGroup && prev.groupId !== undefined && prev.groupId !== null) {
    return String(curr.groupId) !== String(prev.groupId);
  }
  return (curr.passageText || '') !== (prev.passageText || '');
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
  onQuizSubmitted,
}: ExternalQuizPlayerPanelProps) {
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExternalQuizDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState('');

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitResponse, setSubmitResponse] = useState<ExternalQuizSubmitResponseDto | null>(null);

  const dirtyRef = useRef(false);
  const lastChangedQuestionRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const submitIdempotencyRef = useRef<{ attemptId: string; key: string } | null>(null);
  const autoSubmittedAttemptRef = useRef<string | null>(null);
  const answersRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Reset when unit changes
  useEffect(() => {
    setSelectedQuizId(null);
    setDetail(null);
    setSubmitResponse(null);
    setError('');
    setErrorCode(null);
    setSaveNotice('');
    setAnswers({});
    setRemainingSeconds(null);
    dirtyRef.current = false;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, [profileId, unitId]);

  const loadQuizDetail = useCallback(async (quizId: string) => {
    if (!profileId || isPublicPreviewAccess) return;
    try {
      setLoadingDetail(true);
      setError('');
      setErrorCode(null);
      const data = await learningApi.getExternalQuizDetail({ profileId, unitId, quizId });
      setDetail(data);
      if (data.activeAttempt && data.activeAttempt.status === 'in_progress') {
        setAnswers(data.activeAttempt.answers ?? {});
        setRemainingSeconds(computeInitialRemainingSeconds(data.activeAttempt, data.quiz));
        setSubmitResponse(null);
      } else {
        setAnswers({});
        setRemainingSeconds(null);
      }
      dirtyRef.current = false;
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải chi tiết bài kiểm tra.');
      setError(parsed.message);
      setErrorCode(parsed.code);
    } finally {
      setLoadingDetail(false);
    }
  }, [isPublicPreviewAccess, profileId, unitId]);

  useEffect(() => {
    if (selectedQuizId) {
      void loadQuizDetail(selectedQuizId);
    }
  }, [loadQuizDetail, selectedQuizId]);

  const activeAttempt = detail?.activeAttempt?.status === 'in_progress' ? detail.activeAttempt : null;
  const activeAttemptId = activeAttempt?.id ?? null;

  const persistAnswers = useCallback(async (explicitQuestionId?: string) => {
    if (!profileId || !activeAttemptId) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const qid = explicitQuestionId || lastChangedQuestionRef.current || undefined;
    const currentAnswers = answersRef.current;
    try {
      setSaving(true);
      await learningApi.saveExternalQuizAnswers({
        profileId,
        unitId,
        attemptId: activeAttemptId,
        answers: currentAnswers,
        ...(qid ? { questionId: qid, answer: currentAnswers[qid] } : {}),
      });
      dirtyRef.current = false;
      setSaveNotice(`Đã lưu nháp lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Chưa thể lưu nháp câu trả lời.');
      if (parsed.code === 'ATTEMPT_ALREADY_SUBMITTED' || parsed.code === 'ATTEMPT_EXPIRED') {
        setErrorCode(parsed.code);
        setError('Phiên làm bài đã kết thúc hoặc đã được nộp trước đó.');
        if (selectedQuizId) void loadQuizDetail(selectedQuizId);
      } else {
        setError(parsed.message);
        setErrorCode(parsed.code);
      }
    } finally {
      setSaving(false);
    }
  }, [activeAttemptId, loadQuizDetail, profileId, selectedQuizId, unitId]);

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
      if (dirtyRef.current) {
        await learningApi.saveExternalQuizAnswers({
          profileId,
          unitId,
          attemptId: activeAttemptId,
          answers: answersRef.current,
        });
        dirtyRef.current = false;
      }
      const res = await learningApi.submitExternalQuizAttempt({
        profileId,
        unitId,
        attemptId: activeAttemptId,
        idempotencyKey: submitIdempotencyRef.current.key,
      });
      setSubmitResponse(res);
      setDetail((prev) => prev ? {
        ...prev,
        activeAttempt: null,
        latestAttempt: res.attempt,
        latestResult: res.result,
        canViewSolution: res.canViewSolution ?? res.result?.canViewSolution ?? prev.canViewSolution,
      } : prev);
      setRemainingSeconds(null);
      setSaveNotice('');
      onQuizSubmitted?.(res);
      if (selectedQuizId) {
        // Refresh quiz detail quietly to update attemptsCount & solution review data
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
      if (parsed.code === 'ATTEMPT_ALREADY_SUBMITTED') {
        setError('Lượt làm bài này đã được nộp trước đó. Đang tải kết quả mới nhất...');
        if (selectedQuizId) void loadQuizDetail(selectedQuizId);
      } else {
        setError(parsed.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [activeAttemptId, loadQuizDetail, onQuizSubmitted, profileId, selectedQuizId, submitting, unitId]);

  // Countdown timer for timed active attempt
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

  useEffect(() => () => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
  }, []);

  const handleStartAttempt = async (newAttempt: boolean) => {
    if (!profileId || !selectedQuizId || starting) return;
    try {
      setStarting(true);
      setError('');
      setErrorCode(null);
      setSubmitResponse(null);
      const res = await learningApi.startExternalQuizAttempt({
        profileId,
        unitId,
        quizId: selectedQuizId,
        newAttempt,
      });
      setAnswers(res.attempt.answers ?? {});
      setDetail((prev) => prev ? {
        ...prev,
        quiz: res.quiz ?? prev.quiz,
        questions: res.questions ?? prev.questions,
        activeAttempt: res.attempt,
      } : prev);
      setRemainingSeconds(computeInitialRemainingSeconds(res.attempt, res.quiz ?? detail?.quiz));
      dirtyRef.current = false;
      setSaveNotice('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể bắt đầu lượt làm bài.');
      setErrorCode(parsed.code);
      if (parsed.code === 'ATTEMPT_LIMIT_REACHED') {
        setError('Bạn đã hết số lượt làm bài cho phép ở bài kiểm tra này.');
      } else {
        setError(parsed.message);
      }
    } finally {
      setStarting(false);
    }
  };

  const updateAnswer = (questionId: string, nextValue: unknown) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: nextValue };
      answersRef.current = updated;
      return updated;
    });
    dirtyRef.current = true;
    lastChangedQuestionRef.current = questionId;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistAnswers(questionId);
    }, 1200);
  };

  const toggleMultipleChoice = (questionId: string, optionId: string) => {
    const existing = Array.isArray(answers[questionId]) ? (answers[questionId] as string[]) : [];
    const next = existing.includes(optionId)
      ? existing.filter((item) => item !== optionId)
      : [...existing, optionId];
    updateAnswer(questionId, next);
  };

  const questions = useMemo(() => {
    const base = detail?.questions?.length
      ? detail.questions
      : (submitResponse?.result?.questions ?? detail?.latestResult?.questions ?? []);
    const reviewItems = submitResponse?.result?.review
      ?? submitResponse?.result?.questions
      ?? detail?.latestResult?.review
      ?? detail?.latestResult?.questions
      ?? [];
    const reviewById = new Map(
      reviewItems.map((item) => [String(item.id || item.questionId || ''), item]),
    );
      const merged = (base.length ? base : reviewItems).map((item, idx) => {
      const rev = reviewById.get(String(item.id || item.questionId || ''));
      const prompt = item.prompt || item.questionText || rev?.prompt || rev?.questionText || '';
      const baseOpts = Array.isArray(item.options) && item.options.length > 0 ? item.options : (item.linkedOptions ?? []);
      const revOpts = Array.isArray(rev?.options) && rev.options.length > 0 ? rev.options : (rev?.linkedOptions ?? []);
      const baseLinked = Array.isArray(item.linkedOptions) && item.linkedOptions.length > 0 ? item.linkedOptions : [];
      const revLinked = Array.isArray(rev?.linkedOptions) && rev.linkedOptions.length > 0 ? rev.linkedOptions : [];
      return {
        ...item,
        ...(rev || {}),
        id: String(item.id || item.questionId || rev?.id || idx + 1),
        prompt,
        options: revOpts.length > 0 ? revOpts : baseOpts,
        linkedOptions: revLinked.length > 0 ? revLinked : baseLinked,
        groupId: item.groupId ?? rev?.groupId ?? null,
        groupKind: item.groupKind ?? rev?.groupKind ?? null,
        passageText: item.passageText ?? rev?.passageText ?? null,
        passageImageUrl: item.passageImageUrl ?? rev?.passageImageUrl ?? null,
        clozeMode: item.clozeMode ?? rev?.clozeMode ?? null,
        userAnswer: item.userAnswer ?? item.studentAnswer ?? rev?.userAnswer ?? rev?.studentAnswer,
      };
    });
    return [...merged].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [detail?.latestResult?.questions, detail?.latestResult?.review, detail?.questions, submitResponse?.result?.questions, submitResponse?.result?.review]);

  if (!quizzes.length) return null;

  if (!selectedQuizId) {
    return (
      <section className="space-y-3">
        <h3 className="text-base font-black text-[#18243b] dark:text-white">Bài kiểm tra (Quiz)</h3>
        {isPublicPreviewAccess ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Đăng ký khóa học để làm bài kiểm tra và chấm điểm tự động.
          </p>
        ) : null}
        <div className="grid gap-3">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#1e2b44] dark:text-slate-100">{q.title}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                    q.isCompleted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {q.isCompleted ? 'Đã đạt' : 'Chưa hoàn thành'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6f665f] dark:text-slate-400">
                  {q.durationMinutes ? `${q.durationMinutes} phút · ` : ''}
                  Điểm đạt: {q.passingScore ?? '—'} · Lượt làm: {q.attemptsCount ?? 0}
                  {q.attemptLimit ? `/${q.attemptLimit}` : ''}
                  {q.bestScore !== null && q.bestScore !== undefined
                    ? ` · Điểm cao nhất: ${q.bestScore}${q.maxScore ? `/${q.maxScore}` : ''}`
                    : ''}
                </p>
              </div>
              {!isPublicPreviewAccess && profileId ? (
                <button
                  type="button"
                  onClick={() => setSelectedQuizId(q.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#911a2b]"
                >
                  <FiPlay /> {(q.attemptsCount ?? 0) > 0 ? 'Làm bài / Xem kết quả' : 'Bắt đầu làm bài'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <FiLock /> Khóa xem thử
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  const quizInfo = detail?.quiz || quizzes.find((item) => item.id === selectedQuizId);
  const displayedResult: ExternalQuizResultDto | null = submitResponse?.result ?? detail?.latestResult ?? null;
  const displayedAttempt: ExternalQuizAttemptDto | null = submitResponse?.attempt ?? detail?.latestAttempt ?? null;

  const explicitCanViewSolution = submitResponse?.canViewSolution
    ?? displayedResult?.canViewSolution
    ?? detail?.canViewSolution
    ?? detail?.quiz?.canViewSolution;
  const reviewPolicy = displayedResult?.reviewPolicy ?? detail?.reviewPolicy ?? detail?.quiz?.reviewPolicy ?? null;
  const isSolutionEmbargoed = errorCode === 'SOLUTION_EMBARGOED'
    || explicitCanViewSolution === false
    || (explicitCanViewSolution === undefined && ['never', 'embargoed', 'after_due', 'after_graded'].includes(String(reviewPolicy || '')));
  const embargoUntil = displayedResult?.embargoUntil ?? detail?.embargoUntil ?? detail?.quiz?.embargoUntil ?? null;

  const limitReached = detail?.isAdminBypass
    ? false
    : (errorCode === 'ATTEMPT_LIMIT_REACHED'
      || detail?.canStartAttempt === false
      || (typeof detail?.attemptsRemaining === 'number' && detail.attemptsRemaining <= 0));

  const hasPreviousAttempt = Boolean(
    displayedAttempt
    || (detail?.attemptsCount ?? quizInfo?.attemptsUsed ?? quizInfo?.attemptsCount ?? 0) > 0,
  );
  const startOrRetakeButton = !activeAttempt ? (
    limitReached ? (
      <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
        <FiLock /> Bạn đã dùng hết số lượt làm bài cho phép (ATTEMPT_LIMIT_REACHED).
      </p>
    ) : (
      <button
        type="button"
        disabled={starting}
        onClick={() => void handleStartAttempt(hasPreviousAttempt)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
      >
        <FiPlay />
        {starting
          ? 'Đang khởi tạo...'
          : hasPreviousAttempt
            ? 'Làm bài lại'
            : 'Bắt đầu làm bài'}
      </button>
    )
  ) : null;

  return (
    <section className="space-y-5 rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe0d4] pb-4 dark:border-[#26354b]">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => {
              setSelectedQuizId(null);
              setDetail(null);
              setSubmitResponse(null);
              setError('');
              setErrorCode(null);
            }}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-black text-[#247d7e] hover:underline dark:text-[#6ac6bd]"
          >
            <FiArrowLeft /> Quay lại danh sách bài kiểm tra
          </button>
          <h3 className="text-lg font-black text-[#18243b] dark:text-white">
            {quizInfo?.title || 'Bài kiểm tra'}
          </h3>
          {quizInfo?.description ? (
            <p className="mt-1 text-xs text-[#6f665f] dark:text-slate-400">{quizInfo.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeAttempt && remainingSeconds !== null ? (
            <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-sm font-black ${
              remainingSeconds <= 60
                ? 'animate-pulse bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                : 'bg-[#061126] text-[#7ee3d8]'
            }`}>
              <FiClock /> {formatCountdown(remainingSeconds)}
            </span>
          ) : null}
          {quizInfo?.durationMinutes ? (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {quizInfo.durationMinutes} phút
            </span>
          ) : null}
          {quizInfo?.passingScore !== undefined && quizInfo?.passingScore !== null ? (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Điểm đạt: {quizInfo.passingScore}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          <FiAlertCircle className="mt-0.5 shrink-0 text-base" />
          <div className="flex-1">
            <p>{error}</p>
            {errorCode ? <p className="mt-0.5 text-[11px] opacity-75">Mã trạng thái: {errorCode}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void loadQuizDetail(selectedQuizId)}
            className="shrink-0 rounded-lg border border-red-300 px-2.5 py-1 text-[11px] font-black hover:bg-red-100 dark:border-red-800"
          >
            Tải lại
          </button>
        </div>
      ) : null}

      {loadingDetail ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-[#6f665f] dark:text-slate-400">
          <FiRefreshCw className="animate-spin text-[#247d7e]" /> Đang tải câu hỏi bài kiểm tra...
        </div>
      ) : activeAttempt ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7efe7] px-3.5 py-2.5 text-xs dark:bg-[#0b172b]">
            <span className="font-bold text-[#29354b] dark:text-slate-200">
              Đã trả lời {questions.filter((q) => isAnsweredValue(answers[q.id])).length}/{questions.length} câu
            </span>
            <div className="flex items-center gap-2">
              {saving ? (
                <span className="text-[#247d7e]">Đang lưu nháp...</span>
              ) : saveNotice ? (
                <span className="text-emerald-700 dark:text-emerald-300">{saveNotice}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void persistAnswers()}
                disabled={saving || submitting}
                className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] bg-white px-2.5 py-1 font-bold text-[#29354b] hover:bg-slate-50 disabled:opacity-50 dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200"
              >
                <FiSave /> Lưu nháp
              </button>
            </div>
          </div>

          {questions.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, idx) => {
                const answered = isAnsweredValue(answers[q.id]);
                return (
                  <a
                    key={q.id}
                    href={`#ext-quiz-q-${q.id}`}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition ${
                      answered
                        ? 'bg-[#247d7e] text-white'
                        : 'border border-[#ddcfc2] bg-white text-[#6f665f] dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </a>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-5">
            {questions.map((question, qIdx) => {
              const qType = String(question.questionType || 'single_choice').toLowerCase();
              const currentAns = answers[question.id];
              const safeImg = isSafeImageUrl(question.imageUrl);
              const safePassageImg = isSafeImageUrl(question.passageImageUrl);
              const showGroupBanner = shouldRenderGroupBanner(questions, qIdx);
              const baseChoiceOptions = question.options?.length ? question.options : (question.linkedOptions ?? []);
              const tfOptions: ExternalQuizOptionDto[] = baseChoiceOptions.length
                ? baseChoiceOptions
                : [
                    { key: 'true', label: 'A', text: 'Đúng' },
                    { key: 'false', label: 'B', text: 'Sai' },
                  ];
              const isChoiceQuestion =
                qType === 'single_choice'
                || qType === 'true_false'
                || qType === 'reading_item'
                || ((qType === 'fill_blank_item' || qType === 'fill_blank') && baseChoiceOptions.length > 0);

              return (
                <div key={question.id} className="space-y-3">
                  {showGroupBanner ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/25">
                      <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {question.linkedOptions?.length ? 'Ngữ cảnh & Kho lựa chọn' : 'Bài đọc / Ngữ cảnh chung'}
                      </p>
                      {question.passageText ? (
                        <div className="mt-1.5 text-[#18243b] dark:text-slate-100">
                          <RichMathText value={question.passageText} />
                        </div>
                      ) : null}
                      {safePassageImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={safePassageImg}
                          alt="Hình minh họa nhóm câu hỏi"
                          className="mt-2 max-h-64 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                        />
                      ) : null}
                      {question.linkedOptions && question.linkedOptions.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {question.linkedOptions.map((opt, oIdx) => (
                            <span
                              key={optionValue(opt, oIdx)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-950 dark:border-emerald-800 dark:bg-[#0b172b] dark:text-emerald-200"
                            >
                              <strong className="text-emerald-700 dark:text-emerald-300">{optionLabel(opt, oIdx)}.</strong>
                              <span>{opt.text}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    id={`ext-quiz-q-${question.id}`}
                    className="rounded-xl border border-[#e3d4c5] bg-white p-4 shadow-sm dark:border-[#2c3a52] dark:bg-[#0b172b]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-md bg-[#ad2033]/10 px-2.5 py-0.5 text-xs font-black text-[#ad2033] dark:text-[#f08d9c]">
                        Câu {qIdx + 1}
                      </span>
                      {question.points !== undefined ? (
                        <span className="text-xs font-bold text-[#8b8178] dark:text-slate-400">
                          {question.points} điểm
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2.5 text-[#18243b] dark:text-slate-100">
                      <RichMathText value={question.prompt} />
                    </div>

                    {safeImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={safeImg}
                        alt={`Minh họa câu ${qIdx + 1}`}
                        className="mt-3 max-h-64 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                      />
                    ) : null}

                    <div className="mt-4 space-y-2">
                      {isChoiceQuestion ? (
                        (qType === 'true_false' ? tfOptions : baseChoiceOptions).map((opt, optIdx) => {
                          const val = optionValue(opt, optIdx);
                          const checked = String(currentAns ?? '') === val;
                          return (
                            <label
                              key={val}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                checked
                                  ? 'border-[#247d7e] bg-[#eff9f7] dark:border-[#49b6ac] dark:bg-[#132c3d]'
                                  : 'border-[#e6d9cc] bg-[#fffdf9] hover:border-[#c9b4a0] dark:border-[#2c3a52] dark:bg-[#101e33]'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`quiz-q-${question.id}`}
                                checked={checked}
                                disabled={submitting}
                                onChange={() => updateAnswer(question.id, val)}
                                className="mt-1 h-4 w-4 accent-[#247d7e]"
                              />
                              <span className="font-bold text-[#247d7e] dark:text-[#6ac6bd]">
                                {optionLabel(opt, optIdx)}.
                              </span>
                              <div className="min-w-0 flex-1 text-[#29354b] dark:text-slate-200">
                                <RichMathText value={opt.text} />
                              </div>
                            </label>
                          );
                        })
                      ) : qType === 'multiple_choice' ? (
                        baseChoiceOptions.map((opt, optIdx) => {
                          const val = optionValue(opt, optIdx);
                          const selectedArr = Array.isArray(currentAns) ? currentAns.map(String) : [];
                          const checked = selectedArr.includes(val);
                          return (
                            <label
                              key={val}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                checked
                                  ? 'border-[#247d7e] bg-[#eff9f7] dark:border-[#49b6ac] dark:bg-[#132c3d]'
                                  : 'border-[#e6d9cc] bg-[#fffdf9] hover:border-[#c9b4a0] dark:border-[#2c3a52] dark:bg-[#101e33]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={submitting}
                                onChange={() => toggleMultipleChoice(question.id, val)}
                                className="mt-1 h-4 w-4 accent-[#247d7e]"
                              />
                              <span className="font-bold text-[#247d7e] dark:text-[#6ac6bd]">
                                {optionLabel(opt, optIdx)}.
                              </span>
                              <div className="min-w-0 flex-1 text-[#29354b] dark:text-slate-200">
                                <RichMathText value={opt.text} />
                              </div>
                            </label>
                          );
                        })
                      ) : (qType === 'essay' || qType === 'translation') ? (
                        <textarea
                          rows={4}
                          value={typeof currentAns === 'string' ? currentAns : ''}
                          disabled={submitting}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          placeholder="Nhập câu trả lời tự luận của bạn..."
                          className="w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] p-3 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
                        />
                      ) : (
                        <input
                          type="text"
                          value={typeof currentAns === 'string' ? currentAns : ''}
                          disabled={submitting}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          placeholder="Nhập đáp án điền vào chỗ trống..."
                          className="w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] px-3.5 py-2.5 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#ebe0d4] pt-4 dark:border-[#26354b]">
            <button
              type="button"
              onClick={() => void persistAnswers()}
              disabled={saving || submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8c8b9] bg-white px-4 py-2.5 text-sm font-black text-[#29354b] hover:bg-slate-50 disabled:opacity-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
            >
              <FiSave /> Lưu tạm
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitAttempt()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
            >
              <FiSend /> {submitting ? 'Đang nộp bài...' : 'Nộp bài kiểm tra'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedResult || displayedAttempt?.status === 'submitted' || displayedAttempt?.status === 'graded' ? (
            <div className={`rounded-2xl border p-5 ${
              (displayedResult?.isPassed ?? displayedAttempt?.isPassed)
                ? 'border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/60 dark:bg-emerald-950/25'
                : 'border-amber-200 bg-amber-50/75 dark:border-amber-900/60 dark:bg-amber-950/25'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider opacity-80">Kết quả lần làm gần nhất</p>
                  <p className="mt-1 text-2xl font-black text-[#18243b] dark:text-white">
                    {displayedResult?.score ?? displayedAttempt?.score ?? 0}
                    {(displayedResult?.maxScore ?? displayedAttempt?.maxScore)
                      ? ` / ${displayedResult?.maxScore ?? displayedAttempt?.maxScore}`
                      : ''}{' '}
                    điểm
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black ${
                    (displayedResult?.isPassed ?? displayedAttempt?.isPassed)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {(displayedResult?.isPassed ?? displayedAttempt?.isPassed) ? <FiCheckCircle /> : <FiXCircle />}
                    {(displayedResult?.isPassed ?? displayedAttempt?.isPassed) ? 'Đạt yêu cầu' : 'Chưa đạt'}
                  </span>
                  {startOrRetakeButton}
                </div>
              </div>
              {displayedResult?.correctCount !== undefined && displayedResult?.totalQuestions !== undefined ? (
                <p className="mt-2 text-xs font-bold opacity-85">
                  Số câu đúng: {displayedResult.correctCount}/{displayedResult.totalQuestions}
                </p>
              ) : null}
              <p className="mt-1 text-xs font-semibold text-[#5d5854] dark:text-slate-300">
                Đã làm {detail?.attemptsCount ?? quizInfo?.attemptsUsed ?? quizInfo?.attemptsCount ?? 0} lượt
                {detail?.isAdminBypass
                  ? ' · Quyền Admin (không giới hạn lượt)'
                  : typeof detail?.maxAttempts === 'number'
                    ? ` / Tối đa ${detail.maxAttempts} lượt`
                    : ''}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e3d4c5] bg-white p-5 dark:border-[#2c3a52] dark:bg-[#0b172b]">
              <div>
                <p className="font-bold text-[#1e2b44] dark:text-slate-200">
                  Bài kiểm tra gồm {questions.length || 'nhiều'} câu hỏi.
                </p>
                <p className="mt-1 text-xs text-[#6f665f] dark:text-slate-400">
                  Hệ thống tự động lưu nháp trong quá trình làm bài. Bạn có thể bấm nút bên cạnh để bắt đầu ngay.
                </p>
              </div>
              {startOrRetakeButton}
            </div>
          )}

          {(displayedResult || displayedAttempt?.status === 'submitted' || displayedAttempt?.status === 'graded') ? (
            isSolutionEmbargoed ? (
              <div className="rounded-2xl border border-amber-300/80 bg-amber-50 p-5 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex items-start gap-3">
                  <FiLock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="font-black">Đáp án và lời giải chi tiết đang được tạm khóa (SOLUTION_EMBARGOED)</p>
                    <p className="mt-1 text-xs leading-5 opacity-90">
                      {detail?.solutionEmbargoedReason
                        || (embargoUntil
                          ? `Lời giải sẽ được mở sau ${new Date(embargoUntil).toLocaleString('vi-VN')}.`
                          : 'Chính sách xem đáp án hiện chưa mở lời giải cho lượt làm này.')}
                    </p>
                  </div>
                </div>
              </div>
            ) : questions.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-black text-[#18243b] dark:text-white">Xem lại đáp án & lời giải</h4>
                {questions.map((question, idx) => {
                  const userAns = question.userAnswer ?? displayedAttempt?.answers?.[question.id];
                  const correct = question.isCorrect;
                  const showGroupBanner = shouldRenderGroupBanner(questions, idx);
                  const reviewOpts = question.options?.length ? question.options : (question.linkedOptions ?? []);
                  return (
                    <div key={question.id} className="space-y-2">
                      {showGroupBanner ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/25">
                          <p className="font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            {question.linkedOptions?.length ? 'Ngữ cảnh & Kho lựa chọn' : 'Bài đọc / Ngữ cảnh chung'}
                          </p>
                          {question.passageText ? (
                            <div className="mt-1 text-[#18243b] dark:text-slate-100">
                              <RichMathText value={question.passageText} />
                            </div>
                          ) : null}
                          {question.linkedOptions && question.linkedOptions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {question.linkedOptions.map((opt, oIdx) => (
                                <span
                                  key={optionValue(opt, oIdx)}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-950 dark:border-emerald-800 dark:bg-[#0b172b] dark:text-emerald-200"
                                >
                                  <strong className="text-emerald-700 dark:text-emerald-300">{optionLabel(opt, oIdx)}.</strong>
                                  <span>{opt.text}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div
                        className="rounded-xl border border-[#e3d4c5] bg-white p-4 dark:border-[#2c3a52] dark:bg-[#0b172b]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#ad2033] dark:text-[#f08d9c]">Câu {idx + 1}</span>
                          {typeof correct === 'boolean' ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                              correct
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            }`}>
                              {correct ? <FiCheckCircle /> : <FiXCircle />}
                              {correct ? 'Đúng' : 'Sai'}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-[#18243b] dark:text-slate-100">
                          <RichMathText value={question.prompt} />
                        </div>
                        {reviewOpts.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {reviewOpts.map((opt, oIdx) => (
                              <span
                                key={optionValue(opt, oIdx)}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-[#101e33] dark:text-slate-300"
                              >
                                <strong className="text-[#247d7e] dark:text-[#6ac6bd]">{optionLabel(opt, oIdx)}.</strong> {opt.text}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-[#101e33]">
                            <span className="font-bold text-slate-500">Bạn chọn: </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatDisplayAnswer(userAns, question)}
                            </span>
                          </div>
                          {question.correctAnswer !== undefined ? (
                            <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/30">
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">Đáp án đúng: </span>
                              <span className="font-bold text-emerald-900 dark:text-emerald-100">
                                {formatDisplayAnswer(question.correctAnswer, question)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        {question.explanation ? (
                          <div className="mt-3 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-3 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/25">
                            <p className="mb-1 font-black text-indigo-700 dark:text-indigo-300">Giải thích</p>
                            <RichMathText value={question.explanation} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {startOrRetakeButton}
          </div>
        </div>
      )}
    </section>
  );
}
