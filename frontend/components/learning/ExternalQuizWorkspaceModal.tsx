'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiFlag,
  FiGlobe,
  FiGrid,
  FiLayers,
  FiList,
  FiLock,
  FiMaximize2,
  FiMinimize2,
  FiRefreshCw,
  FiSave,
  FiSend,
  FiShield,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import RichMathText from '@/components/common/RichMathText';
import type {
  ExternalQuizAttemptDto,
  ExternalQuizDetailDto,
  ExternalQuizEssayAttachmentDto,
  ExternalQuizItemDto,
  ExternalQuizOptionDto,
  ExternalQuizQuestionDto,
  ExternalQuizResultDto,
  ExternalQuizSubmitResponseDto,
  ExternalWorkspaceUnitSummaryDto,
} from '@/lib/types/courses';
import { ExternalQuizEssayInput, resolveSafeEssayAttachmentUrl } from './ExternalQuizEssayInput';
import {
  formatDisplayAnswer,
  formatTimerClock,
  isChoiceQuestionType,
  isEssayQuestionType,
  isQuestionAnswered,
  isShortInputQuestionType,
  itemsHaveChinese,
  localizedExplanationText,
  localizedOptionText,
  localizedPassageText,
  localizedQuestionText,
  mergeItemGroupsWithReview,
  normalizeEssayValue,
  normalizeMultipleChoiceValue,
  optionLabel,
} from './quizHelpers';

function safeImgSrc(url: string | null | undefined): string | null {
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

export interface ExternalQuizWorkspaceModalProps {
  open: boolean;
  mode: 'play' | 'result' | 'preview';
  profileId: string;
  unitId: string | number;
  detail: ExternalQuizDetailDto;
  activeAttempt: ExternalQuizAttemptDto | null;
  result: ExternalQuizResultDto | null;
  submitResponse: ExternalQuizSubmitResponseDto | null;
  nextUnit?: ExternalWorkspaceUnitSummaryDto | null;
  learningMode?: 'live' | 'recording' | string | null;
  currentUnitWatchPercent?: number | null;
  starting?: boolean;
  submitting?: boolean;
  answers: Record<string, unknown>;
  remainingSeconds: number | null;
  autosaveStatus: 'idle' | 'local' | 'saving' | 'saved';
  lastSavedTime: string;
  error: string;
  errorCode: string | null;
  onSelectAnswer: (questionId: string, value: unknown) => void;
  onSubmit: () => void;
  onRetryQuiz: () => void;
  onOpenSolutionFile?: (fileId: string) => void;
  onAdvanceToNextUnit?: () => void;
  onClose: () => void;
}

export function ExternalQuizWorkspaceModal({
  open,
  mode,
  profileId,
  unitId,
  detail,
  activeAttempt,
  result,
  submitResponse,
  nextUnit = null,
  learningMode = null,
  currentUnitWatchPercent = null,
  starting = false,
  submitting = false,
  answers,
  remainingSeconds,
  autosaveStatus,
  lastSavedTime,
  error,
  errorCode,
  onSelectAnswer,
  onSubmit,
  onRetryQuiz,
  onOpenSolutionFile,
  onAdvanceToNextUnit,
  onClose,
}: ExternalQuizWorkspaceModalProps) {
  const [showChinese, setShowChinese] = useState(true);
  const [viewMode, setViewMode] = useState<'item' | 'all'>('item');
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'unanswered' | 'flagged'>('all');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabViolations, setTabViolations] = useState(0);
  const [showViolationBanner, setShowViolationBanner] = useState(false);

  const quiz = detail.quiz;
  const isPlay = mode === 'play';
  const isPreview = mode === 'preview';
  const canFreeReview = Boolean(detail.canReviewFreely || detail.isAdminBypass);

  useEffect(() => {
    if (!open) return;
    setShowChinese(true);
    setCurrentItemIndex(0);
    setPaletteFilter('all');
    setShowSubmitConfirm(false);
    setMobileDrawerOpen(false);
    setTabViolations(0);
    setShowViolationBanner(false);
  }, [open, quiz.id, mode]);

  const baseItems: ExternalQuizItemDto[] = useMemo(() => {
    if (detail.items && detail.items.length > 0) return detail.items;
    return detail.questions.map((q) => ({
      id: q.id,
      kind: 'question',
      question: q,
      questions: [q],
    }));
  }, [detail.items, detail.questions]);

  const displayItems: ExternalQuizItemDto[] = useMemo(() => {
    if (isPlay) return baseItems;
    if (isPreview) {
      const reviewGroups = detail.reviewItemGroups ?? [];
      const flatRev = detail.reviewItems ?? [];
      const merged = mergeItemGroupsWithReview(baseItems, reviewGroups, flatRev);
      return merged.length > 0 ? merged : baseItems;
    }
    const revGroups = result?.items ?? [];
    const flatRev = result?.review ?? result?.questions ?? [];
    const merged = mergeItemGroupsWithReview(baseItems, revGroups, flatRev);
    return merged.length > 0 ? merged : baseItems;
  }, [baseItems, detail.reviewItemGroups, detail.reviewItems, isPlay, isPreview, result?.items, result?.questions, result?.review]);

  const flatEntries = useMemo(() => {
    const entries: Array<{ question: ExternalQuizQuestionDto; itemIndex: number; globalNumber: number }> = [];
    displayItems.forEach((item, itemIdx) => {
      item.questions.forEach((q) => {
        entries.push({
          question: q,
          itemIndex: itemIdx,
          globalNumber: entries.length + 1,
        });
      });
    });
    return entries;
  }, [displayItems]);

  const flatQuestions = useMemo(() => flatEntries.map((e) => e.question), [flatEntries]);
  const hasChinese = useMemo(() => itemsHaveChinese(displayItems, flatQuestions), [displayItems, flatQuestions]);

  const questionNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    flatEntries.forEach((entry) => {
      map.set(String(entry.question.id), entry.globalNumber);
    });
    return map;
  }, [flatEntries]);

  useEffect(() => {
    if (currentItemIndex >= displayItems.length && displayItems.length > 0) {
      setCurrentItemIndex(0);
    }
  }, [currentItemIndex, displayItems.length]);

  useEffect(() => {
    if (!open || !isPlay) return undefined;
    const onVisibility = () => {
      if (document.hidden) {
        setTabViolations((c) => c + 1);
        setShowViolationBanner(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isPlay, open]);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFs);
    return () => document.removeEventListener('fullscreenchange', syncFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  const answeredCount = useMemo(
    () => flatQuestions.filter((q) => isQuestionAnswered(q, answers[String(q.id)])).length,
    [answers, flatQuestions],
  );
  const flaggedCount = useMemo(
    () => flatQuestions.filter((q) => Boolean(flagged[String(q.id)])).length,
    [flagged, flatQuestions],
  );
  const unansweredCount = Math.max(0, flatQuestions.length - answeredCount);
  const progressPercent = flatQuestions.length > 0 ? Math.round((answeredCount / flatQuestions.length) * 100) : 0;

  // Keyboard shortcuts A-F for standalone single-choice / true-false in step mode
  useEffect(() => {
    if (!open || !isPlay || showSubmitConfirm || viewMode !== 'item') return undefined;
    const activeItem = displayItems[currentItemIndex];
    if (!activeItem || activeItem.kind !== 'question' || activeItem.questions.length !== 1) return undefined;
    const q = activeItem.questions[0];
    const qType = String(q.questionType || '').toLowerCase();
    if (qType !== 'single_choice' && qType !== 'true_false') return undefined;
    const opts = q.options ?? [];
    if (!opts.length) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const idx = event.key.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < opts.length) {
        const key = optionLabel(opts[idx], idx);
        onSelectAnswer(String(q.id), key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentItemIndex, displayItems, isPlay, onSelectAnswer, open, showSubmitConfirm, viewMode]);

  if (!open) return null;

  const canViewSolution = isPreview
    || canFreeReview
    || Boolean(submitResponse?.canViewSolution ?? result?.canViewSolution ?? detail.canViewSolution);
  const solutionFileId = result?.solutionFileId || quiz.solutionFileId || null;
  const solutionReviewItems = result?.review ?? result?.questions ?? [];
  const effectiveScore = result?.score ?? 0;
  const effectiveMaxScore = result?.maxScore ?? 10;
  const effectivePercent = result?.percentage
    ?? result?.percent
    ?? (effectiveMaxScore > 0 ? Math.round((effectiveScore / effectiveMaxScore) * 100) : 0);
  const isPassed = Boolean(result?.isPassed ?? result?.passed);

  const unitCompleted = Boolean(
    submitResponse?.unitProgress?.isCompleted
    || submitResponse?.unlockedNextUnitId
    || canFreeReview,
  );
  const canAdvanceNext = Boolean(
    nextUnit && (
      unitCompleted
      || !nextUnit.isLocked
    ),
  );
  const watchPercentDisplay = Math.round(
    submitResponse?.unitProgress?.completionPercent ?? currentUnitWatchPercent ?? 0,
  );

  const renderChoiceCard = (
    q: ExternalQuizQuestionDto,
    opt: ExternalQuizOptionDto,
    oIdx: number,
    isMultiple: boolean,
  ) => {
    const qId = String(q.id);
    const val = optionLabel(opt, oIdx);
    const selectedSingle = answers[qId] != null ? String(answers[qId]) : '';
    const selectedMulti = normalizeMultipleChoiceValue(answers[qId]);
    const isSelected = isMultiple ? selectedMulti.includes(val) : selectedSingle === val;
    const optImg = safeImgSrc(opt.imageUrl);

    const handleToggle = () => {
      if (isMultiple) {
        const nextSet = isSelected
          ? selectedMulti.filter((item) => item !== val)
          : [...selectedMulti, val].sort();
        onSelectAnswer(qId, nextSet);
      } else {
        onSelectAnswer(qId, val);
      }
    };

    return (
      <label
        key={`${qId}-${val}-${oIdx}`}
        className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-3.5 transition ${
          isSelected
            ? 'border-[#247d7e] bg-[#eff9f7] ring-2 ring-[#247d7e]/20 dark:border-[#49b6ac] dark:bg-[#132c3d]'
            : 'border-[#e5d9ce] bg-[#fffdf9] hover:border-[#247d7e]/45 hover:bg-[#fffaf4] dark:border-[#2c3a52] dark:bg-[#0b172b] dark:hover:border-[#49b6ac]/40'
        }`}
      >
        <input
          type={isMultiple ? 'checkbox' : 'radio'}
          name={isMultiple ? `ext-quiz-multi-${qId}-${val}` : `ext-quiz-q-${qId}`}
          checked={isSelected}
          onChange={handleToggle}
          className="sr-only"
        />
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black transition ${
            isSelected
              ? 'border-[#247d7e] bg-[#247d7e] text-white'
              : 'border-[#d6c6b8] bg-white text-[#534a43] dark:border-[#34435a] dark:bg-[#0f1d33] dark:text-slate-300'
          }`}
        >
          {val}
        </span>
        <div className="min-w-0 flex-1 pt-0.5 text-sm text-[#1e2b44] dark:text-slate-100">
          <RichMathText value={localizedOptionText(opt, showChinese)} />
          {optImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optImg}
              alt={`Đáp án ${val}`}
              className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
            />
          ) : null}
        </div>
      </label>
    );
  };

  const renderInteractiveQuestionBody = (q: ExternalQuizQuestionDto, subLabel?: string) => {
    const qId = String(q.id);
    const num = questionNumberMap.get(qId);
    const qType = String(q.questionType || 'single_choice').toLowerCase();
    const isFlagged = Boolean(flagged[qId]);
    const isMulti = qType === 'multiple_choice';
    const isEssay = isEssayQuestionType(qType);
    const isShortInput = isShortInputQuestionType(qType);
    const opts = q.options ?? [];
    const qImg = safeImgSrc(q.imageUrl);

    return (
      <div
        key={qId}
        id={`ext-quiz-question-${qId}`}
        className="space-y-4 rounded-2xl border border-[#e3d4c5] bg-white p-5 shadow-sm dark:border-[#2c3a52] dark:bg-[#0f1d33]"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-[#ad2033]/10 px-2.5 py-1 text-xs font-black text-[#ad2033] dark:bg-[#ad2033]/25 dark:text-[#ff8f9d]">
              {subLabel || `Câu ${num ?? q.position ?? ''}`}
            </span>
            {isMulti ? (
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                Chọn nhiều đáp án
              </span>
            ) : isEssay ? (
              <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                Tự luận / Dịch thuật
              </span>
            ) : null}
            {q.points != null ? (
              <span className="text-xs font-bold text-[#6f665f] dark:text-slate-400">
                {q.points} điểm
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {isQuestionAnswered(q, answers[qId]) && !isEssay ? (
              <button
                type="button"
                onClick={() => onSelectAnswer(qId, isMulti ? [] : '')}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Bỏ chọn
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => toggleFlag(qId)}
              aria-pressed={isFlagged}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                isFlagged
                  ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-[#e3d4c5] bg-white text-[#6f665f] hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-300'
              }`}
            >
              <FiFlag size={12} /> {isFlagged ? 'Đã cắm cờ' : 'Cắm cờ'}
            </button>
          </div>
        </div>

        <div className="text-base font-medium leading-7 text-[#18243b] dark:text-slate-100">
          <RichMathText value={localizedQuestionText(q, showChinese)} />
        </div>

        {qImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qImg}
            alt={`Hình minh họa câu ${num ?? ''}`}
            className="max-h-72 rounded-xl border border-[#e3d4c5] object-contain dark:border-[#2c3a52]"
          />
        ) : null}

        {isEssay ? (
          <ExternalQuizEssayInput
            profileId={profileId}
            unitId={unitId}
            quizId={quiz.id}
            questionId={qId}
            value={answers[qId]}
            disabled={submitting}
            onChange={(val) => onSelectAnswer(qId, val)}
          />
        ) : isShortInput || (!isChoiceQuestionType(qType) && opts.length === 0) ? (
          <input
            type="text"
            value={answers[qId] != null ? String(answers[qId]) : ''}
            onChange={(event) => onSelectAnswer(qId, event.target.value)}
            placeholder="Nhập câu trả lời của bạn..."
            className="w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] px-4 py-3 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
          />
        ) : (
          <div className="space-y-2.5">
            {opts.map((opt, oIdx) => renderChoiceCard(q, opt, oIdx, isMulti))}
          </div>
        )}
      </div>
    );
  };

  const renderInteractiveItem = (item: ExternalQuizItemDto, itemIdx: number) => {
    const passageText = localizedPassageText(item, showChinese);
    const passageImg = safeImgSrc(item.passageImageUrl);
    const pool = item.linkedOptions ?? [];

    if (item.kind === 'fill_blank_group') {
      const blanks = item.questions;
      const firstNum = blanks[0] ? questionNumberMap.get(String(blanks[0].id)) : null;
      const lastNum = blanks[blanks.length - 1]
        ? questionNumberMap.get(String(blanks[blanks.length - 1].id))
        : null;

      return (
        <div key={`item-${item.id}-${itemIdx}`} className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900/60 dark:bg-[#0f1d33]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <FiLayers size={12} />
                {item.clozeMode === 'sentences' ? 'Nối / Điền đáp án theo nhóm' : 'Bài đọc điền từ (Pool)'}
                {firstNum && lastNum ? ` · Câu ${firstNum}${lastNum !== firstNum ? `–${lastNum}` : ''}` : ''}
              </span>
            </div>

            {passageText ? (
              <div className="mb-4 rounded-xl border border-[#e8ddd0] bg-[#fffaf4] p-4 text-sm leading-7 text-[#18243b] dark:border-[#2c3a52] dark:bg-[#0b172b] dark:text-slate-200">
                <RichMathText value={passageText} />
              </div>
            ) : null}

            {passageImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={passageImg}
                alt="Hình minh họa nhóm câu hỏi"
                className="mb-4 max-h-72 rounded-xl border border-[#e3d4c5] object-contain dark:border-[#2c3a52]"
              />
            ) : null}

            {pool.length > 0 ? (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Kho đáp án ({pool.length} lựa chọn)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {pool.map((opt, oIdx) => (
                    <div
                      key={`${item.id}-pool-${oIdx}`}
                      className="flex items-start gap-2 rounded-lg border border-emerald-200/70 bg-white px-3 py-2 text-xs text-[#18243b] dark:border-emerald-800/60 dark:bg-[#0b172b] dark:text-emerald-100"
                    >
                      <span className="font-black text-emerald-700 dark:text-emerald-300">
                        {optionLabel(opt, oIdx)}.
                      </span>
                      <span className="leading-5">
                        <RichMathText value={localizedOptionText(opt, showChinese)} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {blanks.map((subQ, subIdx) => {
              const qId = String(subQ.id);
              const qNum = questionNumberMap.get(qId);
              const currentVal = answers[qId] != null ? String(answers[qId]) : '';
              const effectivePool = subQ.linkedOptions?.length
                ? subQ.linkedOptions
                : (pool.length ? pool : (subQ.options ?? []));
              const isFlagged = Boolean(flagged[qId]);

              return (
                <div
                  key={qId}
                  id={`ext-quiz-question-${qId}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[#e3d4c5] bg-white p-4 shadow-sm sm:flex-row sm:items-center dark:border-[#2c3a52] dark:bg-[#0f1d33]"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#ad2033]/10 px-2 py-0.5 text-xs font-black text-[#ad2033] dark:text-[#ff8f9d]">
                        Câu {qNum ?? subQ.subQuestionNumber ?? subIdx + 1}
                      </span>
                      {subQ.points != null ? (
                        <span className="text-[11px] font-bold text-[#6f665f] dark:text-slate-400">
                          {subQ.points} điểm
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleFlag(qId)}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          isFlagged ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <FiFlag size={11} /> {isFlagged ? 'Đã cờ' : 'Cờ'}
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-[#18243b] dark:text-slate-100">
                      <RichMathText value={localizedQuestionText(subQ, showChinese) || `Chỗ trống (${subQ.subQuestionNumber ?? subIdx + 1})`} />
                    </div>
                  </div>

                  <div className="shrink-0 sm:w-72">
                    <select
                      aria-label={`Chọn đáp án cho câu ${qNum ?? subIdx + 1}`}
                      value={currentVal}
                      onChange={(event) => onSelectAnswer(qId, event.target.value)}
                      className="w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] px-3 py-2.5 text-sm font-bold text-[#18243b] outline-none transition focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
                    >
                      <option value="">-- Chọn đáp án --</option>
                      {effectivePool.map((opt, oIdx) => {
                        const key = optionLabel(opt, oIdx);
                        return (
                          <option key={key} value={key}>
                            {key}. {localizedOptionText(opt, showChinese)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (item.kind === 'reading_group') {
      const subQuestions = item.questions;
      const firstNum = subQuestions[0] ? questionNumberMap.get(String(subQuestions[0].id)) : null;
      const lastNum = subQuestions[subQuestions.length - 1]
        ? questionNumberMap.get(String(subQuestions[subQuestions.length - 1].id))
        : null;

      return (
        <div key={`item-${item.id}-${itemIdx}`} className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm dark:border-indigo-900/60 dark:bg-[#0f1d33]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                <FiFileText size={12} />
                Bài đọc hiểu
                {firstNum && lastNum ? ` · Câu ${firstNum}${lastNum !== firstNum ? `–${lastNum}` : ''}` : ''}
              </span>
            </div>
            {passageText ? (
              <div className="rounded-xl border border-[#e8ddd0] bg-[#fffaf4] p-4 text-sm leading-7 text-[#18243b] dark:border-[#2c3a52] dark:bg-[#0b172b] dark:text-slate-100">
                <RichMathText value={passageText} />
              </div>
            ) : null}
            {passageImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={passageImg}
                alt="Ảnh đoạn văn đọc hiểu"
                className="mt-3 max-h-80 rounded-xl border border-[#e3d4c5] object-contain dark:border-[#2c3a52]"
              />
            ) : null}
          </div>

          <div className="space-y-4">
            {subQuestions.map((subQ) => renderInteractiveQuestionBody(subQ))}
          </div>
        </div>
      );
    }

    const singleQ = item.questions[0];
    if (!singleQ) return null;
    return (
      <div key={`item-${item.id}-${itemIdx}`}>
        {renderInteractiveQuestionBody(singleQ)}
      </div>
    );
  };

  const renderReviewQuestionCard = (
    q: ExternalQuizQuestionDto,
    indexFallback: number,
    groupPool?: ExternalQuizOptionDto[],
  ) => {
    const qId = String(q.questionId || q.id);
    const num = questionNumberMap.get(qId) ?? indexFallback + 1;
    const isEssay = isEssayQuestionType(q.questionType);
    const isCorrect = q.isCorrect;
    const userAns = answers[qId] ?? q.userAnswer ?? q.studentAnswer;
    const essayData = isEssay ? normalizeEssayValue(userAns) : null;
    const reviewOpts = q.options?.length ? q.options : (q.linkedOptions?.length ? q.linkedOptions : (groupPool ?? []));
    const expText = localizedExplanationText(q, showChinese);

    return (
      <div
        key={qId}
        className="rounded-2xl border border-[#e3d4c5] bg-white p-5 shadow-sm dark:border-[#2c3a52] dark:bg-[#0f1d33]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#ad2033] dark:text-[#ff8f9d]">
              Câu {num}
            </span>
            {q.points != null ? (
              <span className="text-xs font-bold text-[#6f665f] dark:text-slate-400">
                ({q.earnedPoints != null ? `${q.earnedPoints}/` : ''}{q.points} điểm)
              </span>
            ) : null}
          </div>
          {isPreview ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
              Đáp án tham khảo
            </span>
          ) : isCorrect === true ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FiCheckCircle /> Đúng
            </span>
          ) : isCorrect === false ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-800 dark:bg-red-950/60 dark:text-red-300">
              <FiXCircle /> Sai
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {isEssay && q.isGraded === false ? 'Chờ giáo viên chấm' : 'Đã ghi nhận'}
            </span>
          )}
        </div>

        <div className="mt-2.5 text-sm font-medium leading-7 text-[#18243b] dark:text-slate-100">
          <RichMathText value={localizedQuestionText(q, showChinese)} />
        </div>

        {reviewOpts.length > 0 && !isEssay ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reviewOpts.map((opt, oIdx) => {
              const key = optionLabel(opt, oIdx);
              const isRight = Array.isArray(q.correctAnswer)
                ? q.correctAnswer.map(String).includes(key)
                : String(q.correctAnswer || '') === key;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    isRight && canViewSolution
                      ? 'border-emerald-300 bg-emerald-50/70 font-bold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-[#e8ddd0] bg-[#fffaf4] text-[#29354b] dark:border-[#2c3a52] dark:bg-[#0b172b] dark:text-slate-300'
                  }`}
                >
                  <strong className="shrink-0 text-[#247d7e] dark:text-[#6ac6bd]">{key}.</strong>
                  <span><RichMathText value={localizedOptionText(opt, showChinese)} /></span>
                </div>
              );
            })}
          </div>
        ) : null}

        {!isPreview ? (
          <div className={`mt-3 grid gap-2 text-xs ${!isEssay && q.correctAnswer !== undefined && canViewSolution ? 'sm:grid-cols-2' : ''}`}>
            <div className="rounded-xl bg-[#f7efe7] px-3 py-2.5 dark:bg-[#0b172b]">
              <span className="font-bold text-[#6f665f] dark:text-slate-400">Bạn chọn / trả lời: </span>
              <span className="font-bold text-[#18243b] dark:text-slate-100">
                {formatDisplayAnswer(userAns, q, showChinese, groupPool)}
              </span>
              {essayData?.attachments && essayData.attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {essayData.attachments.map((att: ExternalQuizEssayAttachmentDto, idx: number) => {
                    const href = resolveSafeEssayAttachmentUrl(att, profileId, unitId);
                    return href ? (
                      <a
                        key={`${att.assetId}-${idx}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#247d7e]/40 bg-white px-2.5 py-1 text-[11px] font-bold text-[#247d7e] hover:underline dark:bg-[#101e33] dark:text-[#6ac6bd]"
                      >
                        <FiFileText size={12} /> {att.name || `Tệp ${idx + 1}`}
                      </a>
                    ) : null;
                  })}
                </div>
              ) : null}
            </div>

            {!isEssay && q.correctAnswer !== undefined && canViewSolution ? (
              <div className="rounded-xl bg-emerald-50/90 px-3 py-2.5 dark:bg-emerald-950/35">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Đáp án đúng: </span>
                <span className="font-black text-emerald-900 dark:text-emerald-100">
                  {formatDisplayAnswer(q.correctAnswer, q, showChinese, groupPool)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (!isEssay && q.correctAnswer !== undefined ? (
          <div className="mt-3 rounded-xl bg-emerald-50/90 px-3 py-2 text-xs dark:bg-emerald-950/35">
            <span className="font-bold text-emerald-700 dark:text-emerald-300">Đáp án đúng: </span>
            <span className="font-black text-emerald-900 dark:text-emerald-100">
              {formatDisplayAnswer(q.correctAnswer, q, showChinese, groupPool)}
            </span>
          </div>
        ) : null)}

        {q.essayFeedback ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/25">
            <p className="mb-1 font-black text-amber-800 dark:text-amber-300">Nhận xét của giáo viên</p>
            <p className="whitespace-pre-wrap text-[#18243b] dark:text-slate-200">{q.essayFeedback}</p>
          </div>
        ) : null}

        {canViewSolution && expText ? (
          <div className="mt-3 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-3 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/25">
            <p className="mb-1 font-black text-indigo-700 dark:text-indigo-300">Giải thích</p>
            <RichMathText value={expText} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderPaletteContent = () => {
    const filtered = flatEntries.filter((entry) => {
      const qId = String(entry.question.id);
      if (paletteFilter === 'unanswered') return !isQuestionAnswered(entry.question, answers[qId]);
      if (paletteFilter === 'flagged') return Boolean(flagged[qId]);
      return true;
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black text-[#18243b] dark:text-white">
          <span>Bảng câu hỏi ({flatQuestions.length})</span>
          <span className="text-[#247d7e] dark:text-[#6ac6bd]">{progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#efe4d7] dark:bg-[#1e2d45]">
          <div
            className="h-full rounded-full bg-[#247d7e] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
          {([
            { id: 'all', label: 'Tất cả' },
            { id: 'unanswered', label: `Chưa làm (${unansweredCount})` },
            { id: 'flagged', label: `Cờ (${flaggedCount})` },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPaletteFilter(tab.id)}
              className={`rounded-lg px-2 py-1.5 transition ${
                paletteFilter === tab.id
                  ? 'bg-[#247d7e] text-white'
                  : 'bg-[#f7efe7] text-[#534a43] hover:bg-[#efe3d5] dark:bg-[#0b172b] dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {filtered.map((entry) => {
            const qId = String(entry.question.id);
            const isAns = isQuestionAnswered(entry.question, answers[qId]);
            const isFlag = Boolean(flagged[qId]);
            const isActiveItem = viewMode === 'item' && entry.itemIndex === currentItemIndex;
            return (
              <button
                key={qId}
                type="button"
                onClick={() => {
                  setViewMode('item');
                  setCurrentItemIndex(entry.itemIndex);
                  setMobileDrawerOpen(false);
                }}
                className={`relative flex h-9 items-center justify-center rounded-xl border text-xs font-black transition ${
                  isActiveItem
                    ? 'border-[#ad2033] bg-[#ad2033] text-white shadow-sm'
                    : isAns
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-[#e3d4c5] bg-white text-[#29354b] hover:border-[#247d7e] dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200'
                }`}
              >
                {entry.globalNumber}
                {isFlag ? (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={quiz.title}
      className="fixed inset-0 z-[1150] flex h-dvh w-screen flex-col overflow-hidden bg-[#f5efe6] dark:bg-[#071225]"
    >
      {/* Top sticky Course-style header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e3d4c5] bg-[#fffdf9] px-4 py-3 shadow-sm dark:border-[#26354b] dark:bg-[#0f1d33] sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-3 py-2 text-xs font-black text-[#29354b] transition hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
          >
            <FiArrowLeft /> Thoát
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#ad2033]/10 px-2 py-0.5 text-[11px] font-black text-[#ad2033] dark:bg-[#ad2033]/25 dark:text-[#ff8f9d]">
                {isPreview ? 'Xem đáp án nhanh' : isPlay ? 'Đang làm bài' : 'Kết quả bài làm'}
              </span>
              {activeAttempt?.attemptNumber && isPlay ? (
                <span className="text-[11px] font-bold text-[#6f665f] dark:text-slate-400">
                  Lần {activeAttempt.attemptNumber}
                </span>
              ) : null}
              <span className="text-[11px] font-bold text-[#6f665f] dark:text-slate-400">
                {flatQuestions.length} câu hỏi
              </span>
            </div>
            <h2 className="truncate text-sm font-black text-[#18243b] dark:text-white sm:text-base">
              {quiz.title}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasChinese ? (
            <button
              type="button"
              onClick={() => setShowChinese((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-[#eff9f7] px-3 py-1.5 text-xs font-black text-[#247d7e] transition hover:bg-[#dff4f0] dark:border-[#49b6ac] dark:bg-[#132c3d] dark:text-[#6ac6bd]"
            >
              <FiGlobe /> {showChinese ? 'Tiếng Việt' : '中文'}
            </button>
          ) : null}

          {isPlay ? (
            <>
              <span className="hidden items-center gap-1 rounded-xl bg-[#f7efe7] px-2.5 py-1.5 text-[11px] font-bold text-[#6f665f] sm:inline-flex dark:bg-[#0b172b] dark:text-slate-300">
                <FiSave size={12} />
                {autosaveStatus === 'saving'
                  ? 'Đang lưu...'
                  : autosaveStatus === 'saved'
                    ? `Đã lưu ${lastSavedTime || ''}`
                    : autosaveStatus === 'local'
                      ? 'Lưu tạm trên máy'
                      : 'Sẵn sàng lưu'}
              </span>

              {remainingSeconds !== null ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-black ${
                    remainingSeconds < 300
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-[#f7efe7] text-[#18243b] dark:bg-[#0b172b] dark:text-white'
                  }`}
                >
                  <FiClock /> {formatTimerClock(remainingSeconds)}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-3 py-1.5 text-xs font-black text-[#29354b] lg:hidden dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
              >
                <FiGrid /> {answeredCount}/{flatQuestions.length}
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Toàn màn hình"
                className="hidden h-8 w-8 items-center justify-center rounded-xl border border-[#d8c8b9] bg-white text-[#29354b] hover:bg-slate-50 sm:inline-flex dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
              >
                {isFullscreen ? <FiMinimize2 size={14} /> : <FiMaximize2 size={14} />}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowSubmitConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
              >
                <FiSend size={13} /> {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {isPlay && showViolationBanner ? (
        <div className="flex shrink-0 items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5">
            <FiAlertTriangle /> Hệ thống ghi nhận bạn vừa chuyển khỏi tab làm bài ({tabViolations} lần). Bài làm vẫn được lưu an toàn.
          </span>
          <button type="button" onClick={() => setShowViolationBanner(false)} className="underline">
            Ẩn
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            {(errorCode === 'DEVICE_BINDING_REVOKED' || errorCode === 'UNTRUSTED_DEVICE_PROOF') ? (
              <Link href="/login" className="mt-1 inline-block underline">Đăng nhập lại</Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main Scrollable Area */}
      {isPlay ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl space-y-5">
              {/* Item / All View Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3d4c5] bg-white px-4 py-3 shadow-sm dark:border-[#2c3a52] dark:bg-[#0f1d33]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#6f665f] dark:text-slate-300">
                  <span>
                    {viewMode === 'item'
                      ? `Mục ${Math.min(currentItemIndex + 1, displayItems.length)} / ${displayItems.length}`
                      : `Hiển thị toàn bộ (${displayItems.length} mục)`}
                  </span>
                  <span>·</span>
                  <span>Đã trả lời {answeredCount}/{flatQuestions.length} câu</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl border border-[#e3d4c5] bg-[#f7efe7] p-0.5 text-[11px] font-bold dark:border-[#34435a] dark:bg-[#0b172b]">
                    <button
                      type="button"
                      onClick={() => setViewMode('item')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                        viewMode === 'item'
                          ? 'bg-white text-[#18243b] shadow-sm dark:bg-[#1e2d45] dark:text-white'
                          : 'text-[#6f665f] dark:text-slate-400'
                      }`}
                    >
                      <FiLayers size={11} /> Từng mục
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('all')}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                        viewMode === 'all'
                          ? 'bg-white text-[#18243b] shadow-sm dark:bg-[#1e2d45] dark:text-white'
                          : 'text-[#6f665f] dark:text-slate-400'
                      }`}
                    >
                      <FiList size={11} /> Tất cả
                    </button>
                  </div>
                </div>
              </div>

              {starting ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-[#6f665f] dark:text-slate-300">
                  <FiRefreshCw className="animate-spin text-[#247d7e]" /> Đang nạp đề thi & bản nháp...
                </div>
              ) : viewMode === 'item' ? (
                <>
                  {displayItems[currentItemIndex]
                    ? renderInteractiveItem(displayItems[currentItemIndex], currentItemIndex)
                    : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={currentItemIndex <= 0}
                      onClick={() => setCurrentItemIndex((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-4 py-2.5 text-xs font-black text-[#29354b] hover:bg-slate-50 disabled:opacity-40 dark:border-[#34435a] dark:bg-[#0f1d33] dark:text-slate-200"
                    >
                      <FiArrowLeft /> Mục trước
                    </button>

                    <div className="flex items-center gap-2">
                      {currentItemIndex < displayItems.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentItemIndex((i) => Math.min(displayItems.length - 1, i + 1))}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#1b6465]"
                        >
                          Mục tiếp <FiArrowRight />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => setShowSubmitConfirm(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#ad2033] px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#911a2b] disabled:opacity-50"
                        >
                          <FiSend /> Hoàn tất & Nộp bài
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  {displayItems.map((item, idx) => renderInteractiveItem(item, idx))}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowSubmitConfirm(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-[#911a2b] disabled:opacity-50"
                    >
                      <FiSend /> {submitting ? 'Đang nộp bài...' : 'Nộp bài kiểm tra'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Desktop Question Palette Sidebar */}
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-[#e3d4c5] bg-[#fffdf9] p-5 dark:border-[#26354b] dark:bg-[#0f1d33] lg:block">
            {renderPaletteContent()}
          </aside>
        </div>
      ) : (
        /* Result / Live Preview Mode */
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {!isPreview && result ? (
              <div className={`rounded-2xl border p-6 shadow-sm ${
                isPassed
                  ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-[#0f1d33]'
                  : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/60 dark:from-amber-950/40 dark:to-[#0f1d33]'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#6f665f] dark:text-slate-400">
                      Kết quả bài làm
                    </p>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="text-3xl font-black text-[#18243b] dark:text-white">
                        {effectiveScore} / {effectiveMaxScore} điểm
                      </span>
                      <span className="text-sm font-black text-[#247d7e] dark:text-[#6ac6bd]">
                        ({effectivePercent}%)
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black ${
                    isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}>
                    {isPassed ? <FiCheck /> : <FiAlertTriangle />}
                    {isPassed ? 'Đạt yêu cầu' : 'Chưa đạt'}
                  </span>
                </div>

                {/* Next Lesson Flow Banner */}
                {nextUnit ? (
                  canAdvanceNext && onAdvanceToNextUnit ? (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white/90 p-4 dark:border-emerald-800/60 dark:bg-[#0b172b]">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {isPassed ? 'Tuyệt vời! Bạn đã sẵn sàng chuyển sang bài tiếp theo' : 'Bạn có thể chuyển tiếp trong lộ trình học'}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-bold text-[#18243b] dark:text-white">
                          Bài kế tiếp: {nextUnit.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onAdvanceToNextUnit}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#247d7e] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#1b6465]"
                      >
                        Chuyển sang bài kế tiếp <FiArrowRight />
                      </button>
                    </div>
                  ) : isPassed && learningMode !== 'live' ? (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-200">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <FiLock className="shrink-0" />
                        Bạn đã đạt bài tập! Hãy xem video bài học đủ 50% (hiện tại {watchPercentDisplay}%) để mở khóa &ldquo;{nextUnit.title}&rdquo;.
                      </span>
                      <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 font-black text-white hover:bg-amber-800"
                      >
                        Quay lại xem video
                      </button>
                    </div>
                  ) : null
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(detail.canStartAttempt || canFreeReview) ? (
                    <button
                      type="button"
                      disabled={starting}
                      onClick={onRetryQuiz}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#911a2b] disabled:opacity-50"
                    >
                      <FiRefreshCw size={13} /> Làm lại bài tập
                    </button>
                  ) : null}
                  {solutionFileId && canViewSolution && onOpenSolutionFile ? (
                    <button
                      type="button"
                      onClick={() => onOpenSolutionFile(String(solutionFileId))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-white px-4 py-2 text-xs font-black text-[#247d7e] hover:bg-[#eff9f7] dark:bg-[#0b172b] dark:text-[#6ac6bd]"
                    >
                      <FiFileText size={13} /> Xem file lời giải (PDF)
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-4 py-2 text-xs font-black text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#247d7e]/35 bg-[#eff9f7] p-4 dark:border-[#49b6ac]/35 dark:bg-[#102635]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#18595a] dark:text-[#7ddad0]">
                  <FiShield />
                  <span>Chế độ lớp Live / Admin: bạn có thể xem trước toàn bộ đáp án & lời giải hoặc bấm Làm bài thử ngay.</span>
                </div>
                <div className="flex items-center gap-2">
                  {solutionFileId && canViewSolution && onOpenSolutionFile ? (
                    <button
                      type="button"
                      onClick={() => onOpenSolutionFile(String(solutionFileId))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-white px-3.5 py-2 text-xs font-black text-[#247d7e] dark:bg-[#0b172b] dark:text-[#6ac6bd]"
                    >
                      <FiFileText size={13} /> File lời giải
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onRetryQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white hover:bg-[#911a2b]"
                  >
                    Làm bài ngay
                  </button>
                </div>
              </div>
            )}

            {/* Grouped Review List */}
            {(!canViewSolution && !isPreview) ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <FiLock className="shrink-0" />
                <span>
                  {detail.solutionEmbargoedReason || 'Đáp án chi tiết sẽ mở sau khi hết thời gian quy định hoặc giáo viên mở lời giải.'}
                </span>
              </div>
            ) : (displayItems.length > 0 || solutionReviewItems.length > 0) ? (
              <div className="space-y-5">
                <h3 className="text-sm font-black uppercase tracking-wider text-[#29354b] dark:text-slate-200">
                  {isPreview ? 'Đáp án & lời giải tham khảo' : 'Xem lại đáp án & lời giải chi tiết'}
                </h3>
                {displayItems.map((item, idx) => {
                  const pool = item.linkedOptions ?? [];
                  const passage = localizedPassageText(item, showChinese);
                  if (item.kind === 'reading_group' || item.kind === 'fill_blank_group') {
                    return (
                      <div
                        key={`rev-grp-${item.id}-${idx}`}
                        className="space-y-3 rounded-2xl border border-[#ddcfc2] bg-[#fffaf4] p-4 dark:border-[#34435a] dark:bg-[#0b172b]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#247d7e]/15 px-3 py-1 text-xs font-black text-[#247d7e] dark:text-[#6ac6bd]">
                            {item.kind === 'fill_blank_group' ? 'Nhóm nối / điền đáp án (Pool)' : 'Đoạn văn đọc hiểu'}
                          </span>
                        </div>
                        {passage ? (
                          <div className="rounded-xl border border-[#e8ddd0] bg-white p-4 text-sm leading-7 text-[#18243b] dark:border-[#2c3a52] dark:bg-[#0f1d33] dark:text-slate-100">
                            <RichMathText value={passage} />
                          </div>
                        ) : null}
                        {pool.length > 0 ? (
                          <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:grid-cols-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            {pool.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-start gap-1.5 text-xs text-[#18243b] dark:text-emerald-100">
                                <strong className="text-emerald-700 dark:text-emerald-300">{optionLabel(opt, oIdx)}.</strong>
                                <span><RichMathText value={localizedOptionText(opt, showChinese)} /></span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="space-y-3">
                          {item.questions.map((subQ, sIdx) => renderReviewQuestionCard(subQ, sIdx, pool))}
                        </div>
                      </div>
                    );
                  }
                  const q = item.questions[0];
                  return q ? renderReviewQuestionCard(q, idx, pool) : null;
                })}
              </div>
            ) : null}
          </div>
        </main>
      )}

      {/* Mobile Palette Drawer */}
      {isPlay && mobileDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileDrawerOpen(false);
          }}
        >
          <div className="flex h-full w-80 max-w-[85vw] flex-col bg-[#fffdf9] p-5 shadow-2xl dark:bg-[#0f1d33]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-black text-[#18243b] dark:text-white">Điều hướng câu hỏi</span>
              <button type="button" onClick={() => setMobileDrawerOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <FiX />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderPaletteContent()}</div>
          </div>
        </div>
      ) : null}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#e3d4c5] bg-white p-6 shadow-2xl dark:border-[#2c3a52] dark:bg-[#0f1d33]">
            <h3 className="text-lg font-black text-[#18243b] dark:text-white">
              Xác nhận nộp bài kiểm tra?
            </h3>
            <p className="mt-2 text-sm text-[#414c61] dark:text-slate-300">
              Bạn đã trả lời <strong>{answeredCount}/{flatQuestions.length}</strong> câu hỏi.
              {unansweredCount > 0 ? (
                <span className="mt-1 block font-bold text-amber-700 dark:text-amber-300">
                  Còn {unansweredCount} câu chưa trả lời. Bạn vẫn muốn nộp ngay chứ?
                </span>
              ) : null}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-xl border border-[#d8c8b9] px-4 py-2 text-xs font-black text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:text-slate-200"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowSubmitConfirm(false);
                  onSubmit();
                }}
                className="rounded-xl bg-[#ad2033] px-5 py-2 text-xs font-black text-white hover:bg-[#911a2b] disabled:opacity-50"
              >
                {submitting ? 'Đang nộp...' : 'Xác nhận nộp bài'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
