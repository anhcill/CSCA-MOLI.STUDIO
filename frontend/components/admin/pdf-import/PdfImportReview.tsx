'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { FiAlertCircle, FiCheckCircle, FiPlus, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import ImageUpload from '@/components/admin/ImageUpload';
import BaseMathInput from '@/components/admin/MathInput';
import { examAdminApi } from '@/lib/api/examAdmin';
import type {
  ApplyExamReviewFixesResult,
  ImportedExamItem,
  ImportedFillBlankGroupData,
  ImportedItemsReviewResult,
  ImportedQuestionAiReview,
  ImportedQuestionData,
  ImportedReadingGroupData,
  PdfImportPreview,
} from '@/lib/api/examAdmin';
import {
  IMPORT_ANSWER_KEYS,
  createEmptyImportedAnswer,
  createEmptyImportedFillBlankGroup,
  createEmptyImportedFillBlankSubItem,
  createEmptyImportedQuestion,
  createEmptyImportedReadingGroup,
  getImportItemsQuestionCount,
  getNextOptionKey,
} from './pdfImportUtils';

interface Props {
  preview: PdfImportPreview;
  items: ImportedExamItem[];
  saving: boolean;
  onSave: (items?: ImportedExamItem[]) => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
}

const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
const tinyButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50';
const dangerButtonClass = 'inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50';
const reviewButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50';
const REVIEW_REVEAL_DELAY_MS = 2500;
const REVIEW_POST_RENDER_LOCK_MS = 3500;
const REVIEW_COOLDOWN_MS = 15000;

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function MathInput(props: ComponentProps<typeof BaseMathInput>) {
  return <BaseMathInput {...props} commitDelayMs={350} />;
}

function ImageUrlEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <ImageUpload
        compact
        label={label}
        currentImage={value || undefined}
        onImageUploaded={onChange}
      />
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        placeholder="Hoặc dán URL ảnh"
      />
    </div>
  );
}

function isSingleChoice(item: ImportedExamItem): item is ImportedQuestionData {
  return item.itemType !== 'reading_group' && item.itemType !== 'fill_blank_group';
}

function getAiReviewLabel(status?: string) {
  if (status === 'ok') return 'AI thấy ổn';
  if (status === 'formula_issue') return 'Nghi lỗi công thức';
  if (status === 'answer_issue') return 'Nghi sai đáp án';
  if (status === 'explanation_issue') return 'Nghi lỗi lời giải';
  return 'Cần kiểm tra';
}

function getAiReviewTone(status?: string) {
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/70 dark:bg-emerald-950/70 dark:text-emerald-100';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/70 dark:bg-rose-950/70 dark:text-rose-100';
  if (status === 'requesting') return 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/70 dark:bg-indigo-950/70 dark:text-indigo-100';
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50';
}

type ReviewLogState = 'pending' | 'fixed' | 'skipped';

type ReviewLogEntry = {
  path: string;
  label: string;
  status: ImportedQuestionAiReview['status'];
  confidence?: number;
  suggestedCorrectAnswer?: string;
  note?: string;
  formulaIssues: string[];
  explanationIssues: string[];
  fixState: ReviewLogState;
  fixedFields?: string[];
  skippedReason?: string;
  updatedAt: number;
};

function getReviewLedgerKey(preview: PdfImportPreview, questionCount: number) {
  const source = preview.source;
  return [
    'pdf-import-ai-review-ledger-v2',
    source?.fileName || 'file',
    source?.pages || 'na',
    source?.textLength || '0',
  ].join(':');
}

function loadReviewLedger(key: string): Record<string, ReviewLogEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveReviewLedger(key: string, ledger: Record<string, ReviewLogEntry>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ledger));
  } catch {
    // localStorage may be full/private; UI still keeps state in memory.
  }
}

function collectReviewIssueRows(items: ImportedExamItem[]) {
  const rows: Array<{
    key: string;
    path: string;
    label: string;
    status: string;
    confidence?: number;
    suggestedCorrectAnswer?: string;
    note?: string;
    formulaIssues: string[];
    explanationIssues: string[];
  }> = [];

  const push = (key: string, label: string, review?: ImportedQuestionData['aiReview']) => {
    if (!review || review.status === 'ok') return;
    rows.push({
      key,
      path: review.path || key,
      label,
      status: review.status,
      confidence: review.confidence,
      suggestedCorrectAnswer: review.suggestedCorrectAnswer,
      note: review.note,
      formulaIssues: review.formulaIssues || [],
      explanationIssues: review.explanationIssues || [],
    });
  };

  items.forEach((item, itemIndex) => {
    if (item.itemType === 'reading_group') {
      item.subQuestions.forEach((question, subIndex) => {
        push(`${itemIndex}-reading-${subIndex}`, `Đọc hiểu ${itemIndex + 1}.${subIndex + 1}`, question.aiReview);
      });
      return;
    }

    if (item.itemType === 'fill_blank_group') {
      item.subItems.forEach((question, subIndex) => {
        push(`${itemIndex}-blank-${subIndex}`, `Điền từ ${itemIndex + 1}.${subIndex + 1}`, question.aiReview);
      });
      return;
    }

    push(`${itemIndex}`, `Câu ${itemIndex + 1}`, item.aiReview);
  });

  return rows;
}

function collectImportedAiReviews(items: ImportedExamItem[]) {
  const reviews: NonNullable<ImportedQuestionData['aiReview']>[] = [];
  const push = (review?: ImportedQuestionData['aiReview']) => {
    if (review && review.status !== 'ok') reviews.push(review);
  };

  items.forEach((item) => {
    if (item.itemType === 'reading_group') {
      item.subQuestions.forEach(question => push(question.aiReview));
      return;
    }
    if (item.itemType === 'fill_blank_group') {
      item.subItems.forEach(question => push(question.aiReview));
      return;
    }
    push(item.aiReview);
  });

  return reviews;
}

function mergeReviewLedgerFromItems(
  current: Record<string, ReviewLogEntry>,
  items: ImportedExamItem[],
): Record<string, ReviewLogEntry> {
  const next = { ...current };
  const now = Date.now();

  for (const row of collectReviewIssueRows(items)) {
    const previous = next[row.path];
    if (previous?.fixState === 'fixed' || previous?.fixState === 'skipped') continue;
    next[row.path] = {
      path: row.path,
      label: row.label,
      status: row.status as ImportedQuestionAiReview['status'],
      confidence: row.confidence,
      suggestedCorrectAnswer: row.suggestedCorrectAnswer,
      note: row.note,
      formulaIssues: row.formulaIssues,
      explanationIssues: row.explanationIssues,
      fixState: 'pending',
      updatedAt: now,
    };
  }

  return next;
}

function applyFixResultToLedger(
  current: Record<string, ReviewLogEntry>,
  result: ApplyExamReviewFixesResult,
  items: ImportedExamItem[],
): Record<string, ReviewLogEntry> {
  const next = mergeReviewLedgerFromItems(current, items);
  const now = Date.now();

  const changesByPath = new Map<string, string[]>();
  for (const change of result.changes || []) {
    if (!change.path) continue;
    const fields = changesByPath.get(change.path) || [];
    fields.push(getFixFieldLabel(change.field));
    changesByPath.set(change.path, fields);
  }

  for (const [path, fields] of changesByPath.entries()) {
    const previous = next[path];
    next[path] = {
      ...(previous || {
        path,
        label: path,
        status: 'needs_review',
        formulaIssues: [],
        explanationIssues: [],
      }),
      fixState: 'fixed',
      fixedFields: Array.from(new Set(fields)),
      skippedReason: undefined,
      updatedAt: now,
    };
  }

  for (const skipped of result.skipped || []) {
    if (!skipped.path || changesByPath.has(skipped.path)) continue;
    const previous = next[skipped.path];
    next[skipped.path] = {
      ...(previous || {
        path: skipped.path,
        label: skipped.label || skipped.path,
        status: skipped.status || 'needs_review',
        confidence: skipped.confidence,
        note: skipped.note,
        formulaIssues: [],
        explanationIssues: [],
      }),
      label: skipped.label || previous?.label || skipped.path,
      status: (skipped.status || previous?.status || 'needs_review') as ImportedQuestionAiReview['status'],
      confidence: skipped.confidence ?? previous?.confidence,
      note: skipped.note || previous?.note,
      fixState: 'skipped',
      skippedReason: skipped.reason,
      updatedAt: now,
    };
  }

  for (const issue of result.remainingIssues || []) {
    if (!issue.path || changesByPath.has(issue.path)) continue;
    const previous = next[issue.path];
    next[issue.path] = {
      ...(previous || {
        path: issue.path,
        label: issue.label || issue.path,
        formulaIssues: [],
        explanationIssues: [],
      }),
      path: issue.path,
      label: issue.label || previous?.label || issue.path,
      status: issue.status,
      confidence: issue.confidence ?? previous?.confidence,
      suggestedCorrectAnswer: issue.suggestedCorrectAnswer || previous?.suggestedCorrectAnswer,
      note: issue.note || previous?.note,
      formulaIssues: issue.formulaIssues || previous?.formulaIssues || [],
      explanationIssues: issue.explanationIssues || previous?.explanationIssues || [],
      fixState: previous?.fixState === 'skipped' ? 'skipped' : 'pending',
      updatedAt: now,
    };
  }

  return next;
}

function AiReviewLogPanel({
  summary,
  diagnostics,
  issueRows,
}: {
  summary: ImportedItemsReviewResult['summary'] | null;
  diagnostics: ImportedItemsReviewResult['diagnostics'];
  issueRows: ReturnType<typeof collectReviewIssueRows>;
}) {
  if (!summary && !diagnostics?.length && issueRows.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-slate-950 dark:text-white">Log AI review</p>
          {summary && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              Model: {summary.model || 'chưa rõ'} - Gọi AI: {summary.aiCalls ?? 0} batch, lỗi: {summary.failedBatches ?? 0}, JSON lỗi: {summary.invalidBatches ?? 0}
            </p>
          )}
        </div>
        {summary && (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {summary.reviewedCount ?? summary.total}/{summary.questionTotal ?? summary.total} có review
          </span>
        )}
      </div>

      {!!diagnostics?.length && (
        <div className="mb-3 space-y-2">
          {diagnostics.map((log) => (
            <div key={`${log.batch}-${log.status}`} className={`rounded-lg border px-3 py-2 text-xs ${getAiReviewTone(log.status)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                <span>Batch {log.batch}: {log.range || (log.labels || []).join(', ') || 'không rõ câu'}</span>
                <span>{log.status === 'requesting' ? 'Đang gửi request' : log.status === 'ok' ? 'Đã gọi AI' : log.status === 'invalid_response' ? 'AI trả sai JSON' : log.status === 'no_questions' ? 'Không có câu hợp lệ' : 'Lỗi gọi AI'}</span>
              </div>
              <p className="mt-1">Model: {log.model || summary?.model || 'chưa rõ'}{log.durationMs ? ` - ${Math.round(log.durationMs / 1000)}s` : ''}</p>
              {log.message && <p className="mt-1 whitespace-pre-wrap">{log.message}</p>}
              {log.providerStatus && <p className="mt-1">Provider status: {log.providerStatus}</p>}
              {log.errorCode && <p className="mt-1">Mã lỗi: {log.errorCode}</p>}
              {log.retryAfter ? <p className="mt-1">Thử lại sau khoảng {log.retryAfter}s.</p> : null}
              {log.rawPreview && <p className="mt-1 whitespace-pre-wrap break-words">Phản hồi đầu: {log.rawPreview}</p>}
            </div>
          ))}
        </div>
      )}

      {issueRows.length > 0 ? (
        <div className="space-y-2">
          {issueRows.map((row) => (
            <div key={row.key} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50">
              <div className="flex flex-wrap items-center gap-2 font-black">
                <span>{row.label}</span>
                <span>-</span>
                <span>{getAiReviewLabel(row.status)}</span>
                {Number.isFinite(row.confidence) && <span>{Math.round((row.confidence || 0) * 100)}%</span>}
              </div>
              {row.suggestedCorrectAnswer && <p className="mt-1">Gợi ý đáp án: {row.suggestedCorrectAnswer}</p>}
              {row.note && <p className="mt-1 whitespace-pre-wrap">{row.note}</p>}
              {row.formulaIssues.map((issue, index) => <p key={`formula-${index}`} className="mt-1">Công thức: {issue}</p>)}
              {row.explanationIssues.map((issue, index) => <p key={`explanation-${index}`} className="mt-1">Lời giải: {issue}</p>)}
            </div>
          ))}
        </div>
      ) : summary ? (
        <p className="text-xs font-semibold text-emerald-700">
          {summary.total > 0 ? 'Không có câu bị AI đánh dấu lỗi.' : 'Chưa có review theo câu. Xem log batch phía trên.'}
        </p>
      ) : null}
    </div>
  );
}

function getFixFieldLabel(field?: string) {
  if (field === 'correctAnswer' || field === 'correctAnswerKey') return 'Đáp án đúng';
  if (field === 'questionText') return 'Câu hỏi';
  if (field === 'questionTextCn') return 'Câu hỏi tiếng Trung';
  if (field === 'explanation') return 'Lời giải';
  if (field === 'explanationCn') return 'Lời giải tiếng Trung';
  if (field?.startsWith('answers.')) return `Đáp án ${field.split('.')[1] || ''}`;
  return field || 'Trường dữ liệu';
}

function compactFixValue(value?: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'trống';
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function ApplyFixResultPanel({ result }: { result: ApplyExamReviewFixesResult | null }) {
  if (!result) return null;

  const changes = result.changes || [];
  const skipped = result.skipped || [];
  const remainingIssues = result.remainingIssues || [];
  const fixedIssueCount = result.fixedIssueCount ?? result.summary?.fixedIssueCount ?? 0;
  const totalIssueCount = result.summary?.total ?? (fixedIssueCount + remainingIssues.length);
  const remainingIssueCount = result.remainingIssueCount ?? result.summary?.remainingIssueCount ?? remainingIssues.length;

  return (
    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="font-black">
        {result.message || `AI đã sửa ${fixedIssueCount}/${totalIssueCount} log.`}
      </p>
      <p className="mt-1 text-xs font-semibold">
        Đã đổi {changes.length} trường. Còn {remainingIssueCount} log cần xem lại. Bấm sửa lần nữa chỉ gửi các log còn lại.
      </p>

      {!!changes.length && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-2">
          <p className="text-xs font-black uppercase text-emerald-700">Đã sửa</p>
          <div className="mt-2 space-y-2">
            {changes.slice(0, 20).map((change, index) => (
              <div key={`${change.path}-${change.field}-${index}`} className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs">
                <p className="font-bold">{change.label || change.path || 'Mục'} - {getFixFieldLabel(change.field)}</p>
                <p className="mt-1 text-emerald-800">Trước: {compactFixValue(change.before)}</p>
                <p className="mt-0.5 text-emerald-950">Sau: {compactFixValue(change.after)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!skipped.length && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
          <p className="text-xs font-black uppercase">AI bỏ qua, cần xem tay</p>
          <div className="mt-2 space-y-1.5">
            {skipped.slice(0, 20).map((item, index) => (
              <p key={`${item.path}-${index}`} className="text-xs">
                <span className="font-bold">{item.label || item.path || 'Mục'}:</span> {item.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {!!remainingIssues.length && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-900">
          <p className="text-xs font-black uppercase">Còn lỗi sau khi sửa</p>
          <div className="mt-2 space-y-1.5">
            {remainingIssues.slice(0, 20).map((item, index) => (
              <p key={`${item.path}-${index}`} className="text-xs">
                <span className="font-bold">{item.label || item.path} - {getAiReviewLabel(item.status)}:</span> {item.note || item.formulaIssues?.[0] || item.explanationIssues?.[0] || 'Cần xem lại.'}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewLedgerPanel({ ledger }: { ledger: Record<string, ReviewLogEntry> }) {
  const rows = Object.values(ledger).sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  if (!rows.length) return null;

  const fixed = rows.filter((row) => row.fixState === 'fixed').length;
  const skipped = rows.filter((row) => row.fixState === 'skipped').length;
  const pending = rows.length - fixed - skipped;

  const toneByState: Record<ReviewLogState, string> = {
    fixed: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    skipped: 'border-amber-200 bg-amber-50 text-amber-900',
    pending: 'border-rose-200 bg-rose-50 text-rose-900',
  };

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black">Sổ log AI</p>
          <p className="text-xs font-semibold text-slate-500">Log AI phát hiện được giữ lại theo file import này.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-800">Đã sửa {fixed}</span>
          <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-800">Chờ sửa {pending}</span>
          <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-800">Sửa tay {skipped}</span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.slice(0, 60).map((row) => (
          <div key={row.path} className={`rounded-lg border px-3 py-2 text-xs ${toneByState[row.fixState]}`}>
            <div className="flex flex-wrap items-center gap-2 font-black">
              {row.fixState === 'fixed' ? <FiCheckCircle className="shrink-0" /> : <FiAlertCircle className="shrink-0" />}
              <span>{row.label || row.path}</span>
              <span>-</span>
              <span>{row.fixState === 'fixed' ? 'Đã sửa' : row.fixState === 'skipped' ? 'Cần sửa tay' : 'Chờ AI sửa'}</span>
              <span className="font-semibold">{getAiReviewLabel(row.status)}</span>
            </div>
            {row.fixedFields?.length ? (
              <p className="mt-1">Đã sửa: {row.fixedFields.join(', ')}</p>
            ) : null}
            {row.skippedReason ? (
              <p className="mt-1">Lý do giữ lại: {row.skippedReason}</p>
            ) : null}
            {row.note && row.fixState !== 'fixed' ? <p className="mt-1 whitespace-pre-wrap">{row.note}</p> : null}
            {row.suggestedCorrectAnswer && row.fixState !== 'fixed' ? <p className="mt-1">Gợi ý đáp án: {row.suggestedCorrectAnswer}</p> : null}
            {row.formulaIssues.map((issue, index) => <p key={`formula-${index}`} className="mt-1">Công thức: {issue}</p>)}
            {row.explanationIssues.map((issue, index) => <p key={`explanation-${index}`} className="mt-1">Lời giải: {issue}</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemWarnings({ item }: { item: Pick<ImportedQuestionData, 'imageHint' | 'reviewNotes' | 'needsImage' | 'aiReview'> }) {
  if (!item.imageHint && !item.reviewNotes && !item.needsImage && !item.aiReview) return null;

  const isOk = item.aiReview?.status === 'ok';

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
      isOk
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
    }`}>
      {item.aiReview && (
        <div className="mb-1 flex items-start gap-2 font-semibold">
          {isOk ? <FiCheckCircle className="mt-0.5 shrink-0" /> : <FiAlertCircle className="mt-0.5 shrink-0" />}
          <span>
            {getAiReviewLabel(item.aiReview.status)}
            {Number.isFinite(item.aiReview.confidence) ? ` - ${Math.round(item.aiReview.confidence * 100)}%` : ''}
          </span>
        </div>
      )}
      {item.needsImage && <p className="font-semibold">Cần kiểm tra hoặc thêm ảnh cho mục này.</p>}
      {item.imageHint && <p>{item.imageHint}</p>}
      {item.aiReview?.suggestedCorrectAnswer && item.aiReview.status !== 'ok' && (
        <p>Gợi ý đáp án: {item.aiReview.suggestedCorrectAnswer}</p>
      )}
      {item.reviewNotes && <div className="whitespace-pre-line">{item.reviewNotes}</div>}
    </div>
  );
}

type NewImportedItemType = 'single_choice' | 'reading_group' | 'fill_blank_group';

function createImportedItem(type: NewImportedItemType): ImportedExamItem {
  if (type === 'reading_group') return createEmptyImportedReadingGroup();
  if (type === 'fill_blank_group') return createEmptyImportedFillBlankGroup();
  return createEmptyImportedQuestion();
}

function AddItemButtons({
  label,
  onAdd,
  disabled = false,
}: {
  label: string;
  onAdd: (type: NewImportedItemType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <button type="button" onClick={() => onAdd('single_choice')} disabled={disabled} className={tinyButtonClass}>
        <FiPlus size={12} /> Trắc nghiệm
      </button>
      <button type="button" onClick={() => onAdd('reading_group')} disabled={disabled} className={tinyButtonClass}>
        <FiPlus size={12} /> Đọc hiểu
      </button>
      <button type="button" onClick={() => onAdd('fill_blank_group')} disabled={disabled} className={tinyButtonClass}>
        <FiPlus size={12} /> Điền từ
      </button>
    </div>
  );
}

function formatSourceSummary(source: PdfImportPreview['source']) {
  if (!source) return '';

  const parts = [source.fileName || 'File import'];
  if (source.fileType === 'pdf' || source.pages) {
    parts.push(`${source.pages || '?'} trang`);
  } else if (source.fileType) {
    parts.push(source.fileType.toUpperCase());
  }
  parts.push(`${source.textLength || 0} ký tự`);

  return parts.join(' - ');
}

function isTechnicalImportWarning(warning: string) {
  return /không gọi AI|tránh tốn tiền|Parser nhanh đã đọc đủ nhiều câu/i.test(warning);
}

export default function PdfImportReview({ preview, items: sourceItems, saving, onSave, onChangeItems }: Props) {
  const [draftItems, setDraftItems] = useState<ImportedExamItem[]>(sourceItems);
  const [reviewing, setReviewing] = useState(false);
  const [reviewSettling, setReviewSettling] = useState(false);
  const [reviewPostRenderUntil, setReviewPostRenderUntil] = useState(0);
  const [reviewPostRenderSeconds, setReviewPostRenderSeconds] = useState(0);
  const [reviewCooldownUntil, setReviewCooldownUntil] = useState(0);
  const [reviewCooldownSeconds, setReviewCooldownSeconds] = useState(0);
  const [reviewError, setReviewError] = useState('');
  const [fixingReviewIssues, setFixingReviewIssues] = useState(false);
  const [fixResult, setFixResult] = useState<ApplyExamReviewFixesResult | null>(null);
  const [reviewLedger, setReviewLedger] = useState<Record<string, ReviewLogEntry>>(() => (
    loadReviewLedger(getReviewLedgerKey(preview, getImportItemsQuestionCount(sourceItems)))
  ));
  const [reviewSummary, setReviewSummary] = useState<ImportedItemsReviewResult['summary'] | null>(null);
  const [reviewDiagnostics, setReviewDiagnostics] = useState<ImportedItemsReviewResult['diagnostics']>([]);
  const reviewLockRef = useRef(false);
  const reviewRunRef = useRef(0);
  const reviewRevealTimerRef = useRef<number | null>(null);
  const items = draftItems;
  const reviewIssueRows = collectReviewIssueRows(items);
  const questionCount = getImportItemsQuestionCount(items);
  const reviewLedgerKey = getReviewLedgerKey(preview, questionCount);
  const pendingReviewIssueRows = reviewIssueRows.filter((row) => {
    const state = reviewLedger[row.path]?.fixState;
    return state !== 'fixed' && state !== 'skipped';
  });
  const pendingReviewCount = pendingReviewIssueRows.length;
  const unresolvedLedgerCount = Object.values(reviewLedger).filter((row) => row.fixState !== 'fixed').length;
  const getPendingAiReviews = () => collectImportedAiReviews(items).filter((review) => {
    const state = reviewLedger[review.path]?.fixState;
    return state !== 'fixed' && state !== 'skipped';
  });
  const persistReviewLedger = (ledger: Record<string, ReviewLogEntry>) => {
    saveReviewLedger(reviewLedgerKey, ledger);
    examAdminApi.saveImportReviewLedger({
      key: reviewLedgerKey,
      source: { ...(preview.source || {}) },
      questionCount,
      ledger,
    }).catch(() => {
      // Local copy already saved; DB can retry on next successful AI run.
    });
  };
  const commitReviewLedger = (updater: (current: Record<string, ReviewLogEntry>) => Record<string, ReviewLogEntry>) => {
    setReviewLedger((current) => {
      const next = updater(current);
      persistReviewLedger(next);
      return next;
    });
  };

  useEffect(() => {
    setDraftItems(sourceItems);
  }, [sourceItems]);

  useEffect(() => {
    let cancelled = false;
    const localLedger = loadReviewLedger(reviewLedgerKey);
    setReviewLedger(localLedger);

    examAdminApi.getImportReviewLedger(reviewLedgerKey)
      .then((result) => {
        if (cancelled) return;
        const serverLedger = result.ledger && typeof result.ledger === 'object' && !Array.isArray(result.ledger)
          ? result.ledger as Record<string, ReviewLogEntry>
          : {};
        const hasServerLedger = Object.keys(serverLedger).length > 0 || !!result.updatedAt;

        if (hasServerLedger) {
          setReviewLedger(serverLedger);
          saveReviewLedger(reviewLedgerKey, serverLedger);
          return;
        }

        if (Object.keys(localLedger).length > 0) {
          examAdminApi.saveImportReviewLedger({
            key: reviewLedgerKey,
            source: { ...(preview.source || {}) },
            questionCount,
            ledger: localLedger,
          }).catch(() => {
            // DB is best-effort here; local copy still protects this browser.
          });
        }
      })
      .catch(() => {
        // Keep local ledger if backend/db is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [reviewLedgerKey]);

  useEffect(() => {
    reviewRunRef.current += 1;
    if (reviewRevealTimerRef.current) {
      clearTimeout(reviewRevealTimerRef.current);
      reviewRevealTimerRef.current = null;
    }
    reviewLockRef.current = false;
    setReviewing(false);
    setReviewSettling(false);
    setReviewPostRenderUntil(0);
    setReviewPostRenderSeconds(0);
    setReviewSummary(null);
    setReviewDiagnostics([]);
    setReviewError('');
    setFixResult(null);
  }, [preview]);

  useEffect(() => {
    return () => {
      if (reviewRevealTimerRef.current) clearTimeout(reviewRevealTimerRef.current);
      reviewLockRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!reviewCooldownUntil) {
      setReviewCooldownSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const seconds = Math.max(0, Math.ceil((reviewCooldownUntil - Date.now()) / 1000));
      setReviewCooldownSeconds(seconds);
      if (seconds <= 0) setReviewCooldownUntil(0);
    };

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 500);
    return () => window.clearInterval(timer);
  }, [reviewCooldownUntil]);

  useEffect(() => {
    if (!reviewPostRenderUntil) {
      setReviewPostRenderSeconds(0);
      return;
    }

    const updatePostRenderLock = () => {
      const seconds = Math.max(0, Math.ceil((reviewPostRenderUntil - Date.now()) / 1000));
      setReviewPostRenderSeconds(seconds);
      if (seconds <= 0) setReviewPostRenderUntil(0);
    };

    updatePostRenderLock();
    const timer = window.setInterval(updatePostRenderLock, 300);
    return () => window.clearInterval(timer);
  }, [reviewPostRenderUntil]);

  const visibleWarnings = (preview.warnings || []).filter((warning) => !isTechnicalImportWarning(warning));
  const reviewBusy = reviewing || reviewSettling;
  const aiBusy = reviewBusy || fixingReviewIssues;
  const reviewInteractionLocked = aiBusy || reviewPostRenderSeconds > 0;
  const reviewBlocked = saving || aiBusy || reviewCooldownSeconds > 0 || items.length === 0;
  const fixBlocked = saving || aiBusy || reviewCooldownSeconds > 0 || pendingReviewCount === 0;
  const aiLockMessage = reviewing
    ? 'AI đang soát đáp án/lời giải, tạm khóa thao tác.'
    : fixingReviewIssues
      ? 'AI đang sửa log lỗi, tạm khóa thao tác.'
      : reviewSettling
        ? 'Đang sắp xếp kết quả AI, tạm khóa thao tác.'
        : reviewPostRenderSeconds > 0
          ? `Đợi ${reviewPostRenderSeconds}s để giao diện ổn định.`
          : '';

  const updateItem = (index: number, updater: (item: ImportedExamItem) => ImportedExamItem | null) => {
    if (reviewInteractionLocked) return;
    const nextItems = [...items];
    const updated = updater(nextItems[index]);
    if (!updated) return;
    nextItems[index] = updated;
    setDraftItems(nextItems);
  };

  const removeItem = (index: number) => {
    if (reviewInteractionLocked) return;
    if (!confirm('Xóa mục này khỏi danh sách import?')) return;
    setDraftItems(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = (type: NewImportedItemType) => {
    if (reviewInteractionLocked) return;
    setDraftItems([...items, createImportedItem(type)]);
  };

  const insertItemAfter = (index: number, type: NewImportedItemType) => {
    if (reviewInteractionLocked) return;
    const nextItems = [...items];
    nextItems.splice(index + 1, 0, createImportedItem(type));
    setDraftItems(nextItems);
  };

  const handleSave = () => {
    if (reviewInteractionLocked) return;
    onChangeItems(items);
    onSave(items);
  };

  const handleAiReview = async () => {
    if (!items.length || reviewBusy || reviewLockRef.current || reviewCooldownSeconds > 0) return;
    if (unresolvedLedgerCount > 0 && !confirm(`Còn ${unresolvedLedgerCount} log AI chưa xử lý xong. Chạy soát lại sẽ gọi AI và tốn thêm tiền. Vẫn chạy?`)) return;
    reviewLockRef.current = true;
    const reviewRunId = reviewRunRef.current + 1;
    reviewRunRef.current = reviewRunId;
    if (reviewRevealTimerRef.current) {
      clearTimeout(reviewRevealTimerRef.current);
      reviewRevealTimerRef.current = null;
    }

    try {
      flushSync(() => {
        setReviewing(true);
        setReviewSettling(false);
        setReviewError('');
        setReviewSummary(null);
        setReviewDiagnostics([{
        batch: 0,
        range: `${questionCount} câu`,
        status: 'requesting',
        expectedReviews: questionCount,
        message: 'Đang gửi yêu cầu AI review. Nếu không thấy log Beeknoee mới, request chưa tới backend hoặc bị chặn trước khi gọi model.',
        }]);
      });
      await waitForNextPaint();
      const result = await examAdminApi.reviewImportedItems(items);
      if (reviewRunRef.current !== reviewRunId) return;
      const hasQuestionReviews = (result.reviews || []).length > 0;
      setReviewing(false);
      setReviewSettling(true);
      setReviewDiagnostics([{
        batch: 0,
        range: `${questionCount} câu`,
        status: 'requesting',
        expectedReviews: questionCount,
        message: 'AI đã phân tích xong. Đang sắp xếp kết quả vài giây để trang không bị khựng.',
      }]);
      reviewRevealTimerRef.current = window.setTimeout(() => {
        if (reviewRunRef.current !== reviewRunId) return;
        if (hasQuestionReviews) {
          setDraftItems(result.items);
          onChangeItems(result.items);
          commitReviewLedger((current) => mergeReviewLedgerFromItems(current, result.items));
        }
        setReviewSummary(result.summary);
        setReviewDiagnostics(result.diagnostics || []);
        setReviewSettling(false);
        setReviewPostRenderUntil(Date.now() + REVIEW_POST_RENDER_LOCK_MS);
        setReviewCooldownUntil(Date.now() + REVIEW_COOLDOWN_MS);
        reviewLockRef.current = false;
        reviewRevealTimerRef.current = null;
      }, REVIEW_REVEAL_DELAY_MS);
    } catch (error: any) {
      if (reviewRunRef.current !== reviewRunId) return;
      setReviewError(error.response?.data?.message || 'AI soát đề thất bại.');
      setReviewDiagnostics([{
        batch: 0,
        range: `${questionCount} câu`,
        status: 'failed',
        expectedReviews: questionCount,
        message: error.response?.data?.message || error.message || 'Request AI review thất bại trước khi nhận phản hồi.',
        providerStatus: error.response?.status,
      }]);
      setReviewCooldownUntil(Date.now() + REVIEW_COOLDOWN_MS);
      reviewLockRef.current = false;
    } finally {
      setReviewing(false);
    }
  };

  const handleFixAllReviewIssues = async () => {
    const reviews = getPendingAiReviews();
    if (!reviews.length || fixBlocked || reviewLockRef.current) return;
    if (!confirm('Cho AI sửa toàn bộ log lỗi trong bản import này? Bạn vẫn cần xem lại rồi bấm lưu đề.')) return;

    reviewLockRef.current = true;
    const reviewRunId = reviewRunRef.current + 1;
    reviewRunRef.current = reviewRunId;
    if (reviewRevealTimerRef.current) {
      clearTimeout(reviewRevealTimerRef.current);
      reviewRevealTimerRef.current = null;
    }

    try {
      flushSync(() => {
        setFixingReviewIssues(true);
        setReviewSettling(false);
        setReviewError('');
        setFixResult(null);
        setReviewDiagnostics([{
        batch: 0,
        range: `${reviews.length} lỗi`,
        status: 'requesting',
        expectedReviews: reviews.length,
        message: 'Đang gọi AI để sửa toàn bộ log lỗi.',
        }]);
      });
      await waitForNextPaint();
      const result = await examAdminApi.applyImportedReviewFixes(items, reviews);
      if (reviewRunRef.current !== reviewRunId) return;
      setFixingReviewIssues(false);
      setReviewSettling(true);
      setReviewDiagnostics([{
        batch: 0,
        range: `${reviews.length} lỗi`,
        status: 'requesting',
        expectedReviews: reviews.length,
        message: 'AI đã sửa xong. Đang sắp xếp kết quả vài giây để trang không bị khựng.',
      }]);
      reviewRevealTimerRef.current = window.setTimeout(() => {
        if (reviewRunRef.current !== reviewRunId) return;
        const nextItems = result.items || items;
        if (result.items) {
          setDraftItems(result.items);
          onChangeItems(result.items);
        }
        commitReviewLedger((current) => applyFixResultToLedger(current, result, nextItems));
        setFixResult(result);
        setReviewDiagnostics(result.diagnostics || []);
        setReviewSettling(false);
        setReviewPostRenderUntil(Date.now() + REVIEW_POST_RENDER_LOCK_MS);
        setReviewCooldownUntil(Date.now() + REVIEW_COOLDOWN_MS);
        reviewLockRef.current = false;
        reviewRevealTimerRef.current = null;
      }, REVIEW_REVEAL_DELAY_MS);
    } catch (error: any) {
      if (reviewRunRef.current !== reviewRunId) return;
      setReviewError(error.response?.data?.message || 'AI sửa lỗi đề thất bại.');
      setReviewDiagnostics([{
        batch: 0,
        range: `${reviews.length} lỗi`,
        status: 'failed',
        expectedReviews: reviews.length,
        message: error.response?.data?.message || error.message || 'Request AI sửa log thất bại.',
        providerStatus: error.response?.status,
      }]);
      setReviewCooldownUntil(Date.now() + REVIEW_COOLDOWN_MS);
      reviewLockRef.current = false;
    } finally {
      setFixingReviewIssues(false);
    }
  };

  const updateSingle = (index: number, updates: Partial<ImportedQuestionData>) => {
    updateItem(index, (item) => (isSingleChoice(item) ? { ...item, ...updates } : null));
  };

  const updateSingleAnswer = (
    questionIndex: number,
    answerIndex: number,
    updates: Partial<{ text: string; textCn: string; imageUrl: string }>,
  ) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item)) return null;
      const answers = [...(item.answers || [])];
      answers[answerIndex] = { ...answers[answerIndex], ...updates };
      return { ...item, answers };
    });
  };

  const addSingleAnswer = (questionIndex: number) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item) || (item.answers || []).length >= IMPORT_ANSWER_KEYS.length) return null;
      return { ...item, answers: [...(item.answers || []), createEmptyImportedAnswer()] };
    });
  };

  const removeSingleAnswer = (questionIndex: number, answerIndex: number) => {
    updateItem(questionIndex, (item) => {
      if (!isSingleChoice(item)) return null;
      const answers = item.answers || [];
      if (answers.length <= 2) return null;
      const nextAnswers = answers.filter((_, index) => index !== answerIndex);
      const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, nextAnswers.length);
      return {
        ...item,
        answers: nextAnswers,
        correctAnswer: allowedKeys.includes(item.correctAnswer || '') ? item.correctAnswer : '',
      };
    });
  };

  const updateReadingGroup = (index: number, updates: Partial<ImportedReadingGroupData>) => {
    updateItem(index, (item) => (item.itemType === 'reading_group' ? { ...item, ...updates } : null));
  };

  const updateReadingSubQuestion = (groupIndex: number, subIndex: number, updates: Partial<ImportedQuestionData>) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      subQuestions[subIndex] = { ...subQuestions[subIndex], ...updates };
      return { ...item, subQuestions };
    });
  };

  const addReadingSubQuestion = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      return { ...item, subQuestions: [...item.subQuestions, createEmptyImportedQuestion()] };
    });
  };

  const removeReadingSubQuestion = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group' || item.subQuestions.length <= 1) return null;
      return { ...item, subQuestions: item.subQuestions.filter((_, index) => index !== subIndex) };
    });
  };

  const updateReadingSubAnswer = (
    groupIndex: number,
    subIndex: number,
    answerIndex: number,
    updates: Partial<{ text: string; textCn: string; imageUrl: string }>,
  ) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      const answers = [...(subQuestion.answers || [])];
      answers[answerIndex] = { ...answers[answerIndex], ...updates };
      subQuestions[subIndex] = { ...subQuestion, answers };
      return { ...item, subQuestions };
    });
  };

  const addReadingSubAnswer = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      if ((subQuestion.answers || []).length >= IMPORT_ANSWER_KEYS.length) return null;
      subQuestions[subIndex] = {
        ...subQuestion,
        answers: [...(subQuestion.answers || []), createEmptyImportedAnswer()],
      };
      return { ...item, subQuestions };
    });
  };

  const removeReadingSubAnswer = (groupIndex: number, subIndex: number, answerIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'reading_group') return null;
      const subQuestions = [...item.subQuestions];
      const subQuestion = subQuestions[subIndex];
      const answers = subQuestion.answers || [];
      if (answers.length <= 2) return null;
      const nextAnswers = answers.filter((_, index) => index !== answerIndex);
      const allowedKeys = IMPORT_ANSWER_KEYS.slice(0, nextAnswers.length);
      subQuestions[subIndex] = {
        ...subQuestion,
        answers: nextAnswers,
        correctAnswer: allowedKeys.includes(subQuestion.correctAnswer || '') ? subQuestion.correctAnswer : '',
      };
      return { ...item, subQuestions };
    });
  };

  const updateFillBlankGroup = (index: number, updates: Partial<ImportedFillBlankGroupData>) => {
    updateItem(index, (item) => (item.itemType === 'fill_blank_group' ? { ...item, ...updates } : null));
  };

  const updateFillBlankOption = (groupIndex: number, optionIndex: number, updates: Partial<{ key: string; text: string; textCn: string }>) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      const linkedOptions = [...item.linkedOptions];
      linkedOptions[optionIndex] = { ...linkedOptions[optionIndex], ...updates };
      return { ...item, linkedOptions };
    });
  };

  const addFillBlankOption = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.linkedOptions.length >= IMPORT_ANSWER_KEYS.length) return null;
      const key = getNextOptionKey(item.linkedOptions.map((option) => option.key));
      return { ...item, linkedOptions: [...item.linkedOptions, { key, text: '', textCn: '' }] };
    });
  };

  const removeFillBlankOption = (groupIndex: number, optionIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.linkedOptions.length <= 2) return null;
      const removedKey = item.linkedOptions[optionIndex]?.key;
      return {
        ...item,
        linkedOptions: item.linkedOptions.filter((_, index) => index !== optionIndex),
        subItems: item.subItems.map((subItem) => ({
          ...subItem,
          correctAnswerKey: subItem.correctAnswerKey === removedKey ? '' : subItem.correctAnswerKey,
        })),
      };
    });
  };

  const updateFillBlankSubItem = (
    groupIndex: number,
    subIndex: number,
    updates: Partial<ImportedFillBlankGroupData['subItems'][number]>,
  ) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      const subItems = [...item.subItems];
      subItems[subIndex] = { ...subItems[subIndex], ...updates };
      return { ...item, subItems };
    });
  };

  const addFillBlankSubItem = (groupIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group') return null;
      return {
        ...item,
        subItems: [...item.subItems, createEmptyImportedFillBlankSubItem(item.subItems.length + 1)],
      };
    });
  };

  const removeFillBlankSubItem = (groupIndex: number, subIndex: number) => {
    updateItem(groupIndex, (item) => {
      if (item.itemType !== 'fill_blank_group' || item.subItems.length <= 1) return null;
      return { ...item, subItems: item.subItems.filter((_, index) => index !== subIndex) };
    });
  };

  return (
    <div className="relative mt-5 border-t border-gray-200 pt-5">
      {reviewInteractionLocked && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-white/70 px-4 py-24 backdrop-blur-[1px]">
          <div className="flex max-w-[92vw] items-center gap-3 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-bold text-indigo-800 shadow-lg">
            <FiRefreshCw className="shrink-0 animate-spin" size={18} />
            <span>{aiLockMessage}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Tìm thấy {questionCount} câu hỏi trong {items.length} mục
          </p>
          {preview.source && (
            <p className="text-xs text-gray-500">
              {formatSourceSummary(preview.source)}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Công thức nhập bằng LaTeX, ví dụ <code className="rounded bg-gray-100 px-1">{'\\(f^{-1}(x)=\\frac{x+3}{x-2}\\)'}</code>. Ảnh chỉ dùng cho hình/biểu đồ cần upload.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <AddItemButtons label="Thêm mục" onAdd={addItem} disabled={reviewInteractionLocked} />
          <button
            type="button"
            onClick={handleAiReview}
            disabled={reviewBlocked}
            className={reviewButtonClass}
          >
            <FiRefreshCw className={reviewBusy ? 'animate-spin' : ''} size={15} />
            {reviewing
              ? 'AI đang soát...'
              : reviewSettling
                ? 'Đang sắp xếp kết quả...'
                : reviewCooldownSeconds > 0
                  ? `Chờ ${reviewCooldownSeconds}s`
                  : 'AI soát đề đăng lên'}
          </button>
          <button
            type="button"
            onClick={handleFixAllReviewIssues}
            disabled={fixBlocked}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <FiRefreshCw className={fixingReviewIssues ? 'animate-spin' : ''} size={15} />
            {fixingReviewIssues
              ? 'AI đang sửa log...'
              : reviewCooldownSeconds > 0
                ? `Chờ ${reviewCooldownSeconds}s`
                : `AI sửa log chưa xong${pendingReviewCount ? ` (${pendingReviewCount})` : ''}`}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || reviewInteractionLocked || items.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : `Lưu ${questionCount} câu vào đề`}
          </button>
        </div>
      </div>

      {reviewSummary && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          AI đã trả review cho {reviewSummary.reviewedCount ?? reviewSummary.total}/{reviewSummary.questionTotal ?? reviewSummary.total} câu: {reviewSummary.ok} ổn, {reviewSummary.issues} cần xem lại.
        </div>
      )}

      {reviewError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {reviewError}
        </div>
      )}

      <ApplyFixResultPanel result={fixResult} />

      <ReviewLedgerPanel ledger={reviewLedger} />

      {reviewSettling && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-800">
          <FiRefreshCw className="shrink-0 animate-spin" size={16} />
          <span>AI đã xử lý xong. Đợi vài giây để trang sắp xếp kết quả mượt hơn.</span>
        </div>
      )}

      {reviewPostRenderSeconds > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">
          <FiRefreshCw className="shrink-0 animate-spin" size={16} />
          <span>Kết quả đã hiện. Chờ {reviewPostRenderSeconds}s để giao diện ổn định rồi sửa tiếp.</span>
        </div>
      )}

      <AiReviewLogPanel
        summary={reviewSummary}
        diagnostics={reviewDiagnostics}
        issueRows={reviewIssueRows}
      />

      {!!visibleWarnings.length && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {visibleWarnings.map((warning, index) => (
            <div key={index} className="flex gap-2">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div
          aria-busy={reviewInteractionLocked}
          aria-disabled={reviewInteractionLocked}
          className={`divide-y divide-gray-200 ${reviewInteractionLocked ? 'pointer-events-none select-none opacity-60' : ''}`}
        >
        {items.map((item, itemIndex) => {
          if (item.itemType === 'reading_group') {
            return (
              <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Đọc hiểu - {item.subQuestions.length} câu</h4>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} disabled={reviewInteractionLocked} />
                    <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                      <FiTrash2 size={13} /> Bỏ mục
                    </button>
                  </div>
                </div>
                <MathInput
                  label="Đoạn văn"
                  value={item.passageText || ''}
                  onChange={(value) => updateReadingGroup(itemIndex, { passageText: value })}
                  placeholder="Nhập đoạn văn. Công thức dùng \\frac{tử}{mẫu}, ví dụ \\(\\frac{2x+3}{x-1}\\)"
                />
                <ImageUrlEditor
                  label="Ảnh đoạn văn"
                  value={item.passageImageUrl || ''}
                  onChange={(url) => updateReadingGroup(itemIndex, { passageImageUrl: url })}
                />
                <details className="mt-3 rounded-lg border border-gray-200 p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">Câu con đọc hiểu</summary>
                  <div className="mt-3 space-y-4">
                    {item.subQuestions.map((subQuestion, subIndex) => {
                      const subAnswerKeys = IMPORT_ANSWER_KEYS.slice(0, subQuestion.answers?.length || 0);
                      return (
                        <div key={subIndex} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-700">Câu con {subIndex + 1}</p>
                            <button type="button" onClick={() => removeReadingSubQuestion(itemIndex, subIndex)} disabled={item.subQuestions.length <= 1} className={dangerButtonClass}>
                              <FiTrash2 size={12} /> Xóa câu con
                            </button>
                          </div>
                          <MathInput
                            label={`Câu con ${subIndex + 1}`}
                            value={subQuestion.questionText || ''}
                            onChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { questionText: value })}
                            cnLabel="Tiếng Trung"
                            cnValue={subQuestion.questionTextCn || ''}
                            onCnChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { questionTextCn: value })}
                            placeholder="Nội dung câu hỏi. Phân số: \\frac{x+3}{x-2}"
                            cnPlaceholder="Nội dung tiếng Trung"
                          />
                          <ImageUrlEditor
                            label={`Ảnh câu con ${subIndex + 1}`}
                            value={subQuestion.imageUrl || ''}
                            onChange={(url) => updateReadingSubQuestion(itemIndex, subIndex, { imageUrl: url })}
                          />
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {(subQuestion.answers || []).map((answer, answerIndex) => (
                              <div key={answerIndex} className="rounded-lg border border-gray-200 p-2">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                                  <button type="button" onClick={() => removeReadingSubAnswer(itemIndex, subIndex, answerIndex)} disabled={(subQuestion.answers || []).length <= 2} className={dangerButtonClass}>
                                    <FiTrash2 size={12} /> Xóa
                                  </button>
                                </div>
                                <MathInput
                                  label=""
                                  value={answer.text || ''}
                                  onChange={(value) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { text: value })}
                                  cnLabel="Tiếng Trung"
                                  cnValue={answer.textCn || ''}
                                  onCnChange={(value) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { textCn: value })}
                                  placeholder={`Đáp án ${IMPORT_ANSWER_KEYS[answerIndex]} (Việt/Anh)`}
                                  cnPlaceholder={`Đáp án ${IMPORT_ANSWER_KEYS[answerIndex]} (Tiếng Trung)`}
                                />
                                <ImageUrlEditor
                                  label={`Ảnh đáp án ${IMPORT_ANSWER_KEYS[answerIndex]}`}
                                  value={answer.imageUrl || ''}
                                  onChange={(url) => updateReadingSubAnswer(itemIndex, subIndex, answerIndex, { imageUrl: url })}
                                />
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => addReadingSubAnswer(itemIndex, subIndex)} disabled={(subQuestion.answers || []).length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                            <FiPlus size={12} /> Thêm đáp án
                          </button>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                              <select value={subQuestion.correctAnswer || ''} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { correctAnswer: event.target.value })} className={inputClass}>
                                <option value="">Chọn đáp án</option>
                                {subAnswerKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                              <input type="number" min="0.1" step="0.1" value={subQuestion.points || 1} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                              <select value={subQuestion.difficulty || 'medium'} onChange={(event) => updateReadingSubQuestion(itemIndex, subIndex, { difficulty: event.target.value })} className={inputClass}>
                                <option value="easy">Dễ</option>
                                <option value="medium">Trung bình</option>
                                <option value="hard">Khó</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <MathInput
                              label="Giải thích"
                              value={subQuestion.explanation || ''}
                              onChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { explanation: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subQuestion.explanationCn || ''}
                              onCnChange={(value) => updateReadingSubQuestion(itemIndex, subIndex, { explanationCn: value })}
                              placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                              cnPlaceholder="Giải thích tiếng Trung"
                              defaultTab="cn"
                            />
                          </div>
                          <ItemWarnings item={subQuestion} />
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => addReadingSubQuestion(itemIndex)} className={`${tinyButtonClass} mt-3`}>
                    <FiPlus size={12} /> Thêm câu con
                  </button>
                </details>
                <ItemWarnings item={item} />
              </div>
            );
          }

          if (item.itemType === 'fill_blank_group') {
            return (
              <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-900">Điền từ - {item.subItems.length} chỗ trống</h4>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} disabled={reviewInteractionLocked} />
                    <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                      <FiTrash2 size={13} /> Bỏ mục
                    </button>
                  </div>
                </div>
                <div className="mb-3 max-w-xs">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dạng điền từ</label>
                  <select value={item.clozeMode || 'sentences'} onChange={(event) => updateFillBlankGroup(itemIndex, { clozeMode: event.target.value as ImportedFillBlankGroupData['clozeMode'] })} className={inputClass}>
                    <option value="sentences">Từng câu</option>
                    <option value="passage">Đoạn văn có chỗ trống</option>
                  </select>
                </div>
                <MathInput
                  label="Đoạn văn / ngữ cảnh"
                  value={item.passageText || ''}
                  onChange={(value) => updateFillBlankGroup(itemIndex, { passageText: value })}
                  placeholder="Nhập ngữ cảnh. Công thức dùng \\frac{tử}{mẫu}"
                />
                <ImageUrlEditor
                  label="Ảnh đoạn văn"
                  value={item.passageImageUrl || ''}
                  onChange={(url) => updateFillBlankGroup(itemIndex, { passageImageUrl: url })}
                />
                <details className="mt-3 rounded-lg border border-gray-200 p-3" open>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">Pool đáp án và chỗ trống</summary>
                  <div className="mt-3 space-y-4">
                    <div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {item.linkedOptions.map((option, optionIndex) => (
                          <div key={`${option.key}-${optionIndex}`} className="rounded-lg border border-gray-200 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <input value={option.key || ''} onChange={(event) => updateFillBlankOption(itemIndex, optionIndex, { key: event.target.value.toUpperCase().slice(0, 1) })} className={`${inputClass} max-w-[4rem] text-center font-bold`} />
                              <button type="button" onClick={() => removeFillBlankOption(itemIndex, optionIndex)} disabled={item.linkedOptions.length <= 2} className={dangerButtonClass}>
                                <FiTrash2 size={12} /> Xóa
                              </button>
                            </div>
                            <MathInput
                              label=""
                              value={option.text || ''}
                              onChange={(value) => updateFillBlankOption(itemIndex, optionIndex, { text: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={option.textCn || ''}
                              onCnChange={(value) => updateFillBlankOption(itemIndex, optionIndex, { textCn: value })}
                              placeholder="Việt/Anh"
                              cnPlaceholder="Tiếng Trung"
                            />
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addFillBlankOption(itemIndex)} disabled={item.linkedOptions.length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                        <FiPlus size={12} /> Thêm lựa chọn
                      </button>
                    </div>
                    <div className="space-y-3">
                      {item.subItems.map((subItem, subIndex) => (
                        <div key={subIndex} className="rounded-lg border border-gray-200 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-700">Chỗ trống {subIndex + 1}</p>
                            <button type="button" onClick={() => removeFillBlankSubItem(itemIndex, subIndex)} disabled={item.subItems.length <= 1} className={dangerButtonClass}>
                              <FiTrash2 size={12} /> Xóa
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <MathInput
                              label=""
                              value={subItem.questionText || ''}
                              onChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { questionText: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subItem.questionTextCn || ''}
                              onCnChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { questionTextCn: value })}
                              placeholder={`Chỗ trống ${subIndex + 1} (Việt/Anh)`}
                              cnPlaceholder={`Chỗ trống ${subIndex + 1} (Tiếng Trung)`}
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                              <select value={subItem.correctAnswerKey || ''} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { correctAnswerKey: event.target.value })} className={inputClass}>
                                <option value="">Đáp án</option>
                                {item.linkedOptions.map((option) => <option key={option.key} value={option.key}>{option.key}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                              <input type="number" min="0.1" step="0.1" value={subItem.points || 1} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                              <select value={subItem.difficulty || 'medium'} onChange={(event) => updateFillBlankSubItem(itemIndex, subIndex, { difficulty: event.target.value })} className={inputClass}>
                                <option value="easy">Dễ</option>
                                <option value="medium">Trung bình</option>
                                <option value="hard">Khó</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <MathInput
                              label="Giải thích"
                              value={subItem.explanation || ''}
                              onChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { explanation: value })}
                              cnLabel="Tiếng Trung"
                              cnValue={subItem.explanationCn || ''}
                              onCnChange={(value) => updateFillBlankSubItem(itemIndex, subIndex, { explanationCn: value })}
                              placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                              cnPlaceholder="Giải thích tiếng Trung"
                              defaultTab="cn"
                            />
                          </div>
                          <ItemWarnings item={subItem} />
                        </div>
                      ))}
                      <button type="button" onClick={() => addFillBlankSubItem(itemIndex)} className={tinyButtonClass}>
                        <FiPlus size={12} /> Thêm chỗ trống
                      </button>
                    </div>
                  </div>
                </details>
                <ItemWarnings item={item} />
              </div>
            );
          }

          const answerKeys = IMPORT_ANSWER_KEYS.slice(0, item.answers?.length || 0);
          return (
            <div key={itemIndex} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-semibold text-gray-900">Câu {itemIndex + 1}</h4>
                <div className="flex flex-wrap items-center justify-end gap-2">
                <AddItemButtons label="Thêm sau" onAdd={(type) => insertItemAfter(itemIndex, type)} disabled={reviewInteractionLocked} />
                  <button type="button" onClick={() => removeItem(itemIndex)} className={dangerButtonClass}>
                    <FiTrash2 size={13} /> Bỏ mục
                  </button>
                </div>
              </div>
              <MathInput
                label="Nội dung câu hỏi"
                value={item.questionText || ''}
                onChange={(value) => updateSingle(itemIndex, { questionText: value })}
                cnLabel="Tiếng Trung"
                cnValue={item.questionTextCn || ''}
                onCnChange={(value) => updateSingle(itemIndex, { questionTextCn: value })}
                placeholder="Nội dung (Việt/Anh). Phân số: \\frac{2x+3}{x-1}"
                cnPlaceholder="Nội dung tiếng Trung"
              />
              <ImageUrlEditor
                label="Ảnh câu hỏi"
                value={item.imageUrl || ''}
                onChange={(url) => updateSingle(itemIndex, { imageUrl: url })}
              />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(item.answers || []).map((answer, answerIndex) => (
                  <div key={answerIndex} className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-500">Đáp án {IMPORT_ANSWER_KEYS[answerIndex]}</span>
                      <button type="button" onClick={() => removeSingleAnswer(itemIndex, answerIndex)} disabled={(item.answers || []).length <= 2} className={dangerButtonClass}>
                        <FiTrash2 size={12} /> Xóa
                      </button>
                    </div>
                    <MathInput
                      label=""
                      value={answer.text || ''}
                      onChange={(value) => updateSingleAnswer(itemIndex, answerIndex, { text: value })}
                      cnLabel="Tiếng Trung"
                      cnValue={answer.textCn || ''}
                      onCnChange={(value) => updateSingleAnswer(itemIndex, answerIndex, { textCn: value })}
                      placeholder="Việt/Anh"
                      cnPlaceholder="Tiếng Trung"
                    />
                    <ImageUrlEditor
                      label={`Ảnh đáp án ${IMPORT_ANSWER_KEYS[answerIndex]}`}
                      value={answer.imageUrl || ''}
                      onChange={(url) => updateSingleAnswer(itemIndex, answerIndex, { imageUrl: url })}
                    />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addSingleAnswer(itemIndex)} disabled={(item.answers || []).length >= IMPORT_ANSWER_KEYS.length} className={`${tinyButtonClass} mt-2`}>
                <FiPlus size={12} /> Thêm đáp án
              </button>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Đáp án đúng</label>
                  <select value={item.correctAnswer || ''} onChange={(event) => updateSingle(itemIndex, { correctAnswer: event.target.value })} className={inputClass}>
                    <option value="">Chọn đáp án</option>
                    {answerKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Điểm</label>
                  <input type="number" min="0.1" step="0.1" value={item.points || 1} onChange={(event) => updateSingle(itemIndex, { points: Number.parseFloat(event.target.value) || 1 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Độ khó</label>
                  <select value={item.difficulty || 'medium'} onChange={(event) => updateSingle(itemIndex, { difficulty: event.target.value })} className={inputClass}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <MathInput
                  label="Giải thích"
                  value={item.explanation || ''}
                  onChange={(value) => updateSingle(itemIndex, { explanation: value })}
                  cnLabel="Tiếng Trung"
                  cnValue={item.explanationCn || ''}
                  onCnChange={(value) => updateSingle(itemIndex, { explanationCn: value })}
                  placeholder="Giải thích (Việt/Anh). Phân số: \\frac{10}{\\sqrt{5}}=2\\sqrt{5}"
                  cnPlaceholder="Giải thích tiếng Trung"
                  defaultTab="cn"
                />
              </div>
              <ItemWarnings item={item} />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
