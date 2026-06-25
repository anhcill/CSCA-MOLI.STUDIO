import { FiAlertCircle, FiEdit2, FiRefreshCw } from 'react-icons/fi';
import type { ApplyExamReviewFixesResult, StoredExamReviewResult } from '@/lib/api/examAdmin';

export function getExamReviewIssues(result: StoredExamReviewResult | null) {
  return (result?.reviews || []).filter(review => review.status !== 'ok');
}

function getAiReviewLabel(status?: string) {
  if (status === 'ok') return 'AI thấy ổn';
  if (status === 'question_issue') return 'Nghi lỗi câu hỏi/OCR';
  if (status === 'formula_issue') return 'Nghi lỗi công thức';
  if (status === 'answer_issue') return 'Nghi sai đáp án';
  if (status === 'explanation_issue') return 'Nghi lỗi lời giải';
  if (status === 'missing_from_db') return 'DB thiếu so với file gốc';
  if (status === 'missing_answer_from_source') return 'Đáp án thiếu trong DB';
  if (status === 'source_mismatch') return 'Khác file gốc';
  if (status === 'needs_source_review') return 'Cần xem file gốc';
  return 'Cần kiểm tra';
}

function getAiReviewTone(status?: string) {
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/70 dark:bg-emerald-950/70 dark:text-emerald-100';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/70 dark:bg-rose-950/70 dark:text-rose-100';
  if (status === 'requesting') return 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/70 dark:bg-indigo-950/70 dark:text-indigo-100';
  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50';
}

function formatTokenEstimate(value?: number) {
  const tokens = Number(value);
  if (!Number.isFinite(tokens) || tokens <= 0) return '';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M token`;
  if (tokens >= 1000) return `${Math.round(tokens / 100) / 10}k token`;
  return `${Math.round(tokens)} token`;
}

interface ExamReviewResultPanelProps {
  result: StoredExamReviewResult | null;
  error: string;
  reviewing: boolean;
  normalizingFormulas: boolean;
  applyingReviewFixes: boolean;
  applyResult: ApplyExamReviewFixesResult | null;
  onApplySafeFix: () => void;
  onApplyAiFixes: () => void;
  onOpenQuestion: (review: StoredExamReviewResult['reviews'][number]) => void;
}

export default function ExamReviewResultPanel({
  result,
  error,
  reviewing,
  normalizingFormulas,
  applyingReviewFixes,
  applyResult,
  onApplySafeFix,
  onApplyAiFixes,
  onOpenQuestion,
}: ExamReviewResultPanelProps) {
  if (!result && !error && !reviewing && !applyResult && !applyingReviewFixes) return null;

  const summary = result?.summary;
  const issueRows = getExamReviewIssues(result);
  const safeFix = result?.safeFixPreview;
  const tokenEstimate = formatTokenEstimate(summary?.tokenEstimate);
  const maxTokenBudget = formatTokenEstimate(summary?.maxTokenBudget);
  const sourceSummary = summary as (typeof summary & { sourceFileName?: string }) | undefined;
  const sourceFileName = result?.sourceFile?.fileName || sourceSummary?.sourceFileName;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-black text-slate-950 dark:text-white">AI soát đề đã lưu</p>
          {reviewing ? (
            <p className="mt-1 flex items-center gap-2 text-indigo-700">
              <FiRefreshCw className="animate-spin" size={15} />
              Đang soát câu hỏi, đáp án, lời giải và file gốc nếu có...
            </p>
          ) : summary ? (
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {summary.reviewedCount ?? summary.total}/{summary.questionTotal ?? summary.total} câu có review: {summary.ok} ổn, {summary.issues} cần xem.
              {summary.model ? ` Model: ${summary.model}.` : ''}
              {tokenEstimate ? ` Ước tính đã dùng: ${tokenEstimate}.` : ''}
              {maxTokenBudget ? ` Trần yêu cầu: ${maxTokenBudget}.` : ''}
            </p>
          ) : null}
          {sourceFileName && (
            <p className="mt-1 text-xs font-bold text-violet-700">Đã đối chiếu file gốc: {sourceFileName}</p>
          )}
          {safeFix && (
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Sửa công thức chắc chắn: {safeFix.changedCount || 0} chỗ. Nghi lỗi cần xem tay: {safeFix.warningCount || 0} chỗ.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {issueRows.length > 0 && (
            <button
              type="button"
              onClick={onApplyAiFixes}
              disabled={applyingReviewFixes}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw size={15} className={applyingReviewFixes ? 'animate-spin' : ''} />
              {applyingReviewFixes ? 'AI đang sửa...' : `AI sửa toàn bộ log (${issueRows.length})`}
            </button>
          )}
          {safeFix && (safeFix.changedCount > 0 || safeFix.warningCount > 0) && (
            <button
              type="button"
              onClick={onApplySafeFix}
              disabled={normalizingFormulas}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiRefreshCw size={15} className={normalizingFormulas ? 'animate-spin' : ''} />
              {normalizingFormulas ? 'Đang sửa...' : 'Sửa công thức chắc chắn'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}

      {applyResult && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          {applyResult.message || `AI đã sửa ${applyResult.changedCount || 0} chỗ.`}
          {!!applyResult.skippedCount && <span> Còn {applyResult.skippedCount} chỗ cần xem tay.</span>}
        </div>
      )}

      {!!result?.diagnostics?.length && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {result.diagnostics.slice(0, 4).map((log) => (
            <div key={`${log.batch}-${log.status}-${log.range || ''}`} className={`rounded-lg border px-3 py-2 text-xs ${getAiReviewTone(log.status)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                <span>Batch {log.batch}: {log.range || 'không rõ câu'}</span>
                <span>{log.status === 'ok' ? 'Đã gọi AI' : log.status === 'invalid_response' ? 'JSON lỗi' : log.status === 'no_questions' ? 'Không có câu' : 'Lỗi'}</span>
              </div>
              <p className="mt-1">Model: {log.model || summary?.model || 'chưa rõ'}{log.durationMs ? ` - ${Math.round(log.durationMs / 1000)}s` : ''}</p>
              {log.tokenEstimate ? <p className="mt-1">Token ước tính: {formatTokenEstimate(log.tokenEstimate)} / trần {formatTokenEstimate(log.maxTokenBudget) || 'chưa rõ'}.</p> : null}
              {log.message && <p className="mt-1 whitespace-pre-wrap">{log.message}</p>}
            </div>
          ))}
        </div>
      )}

      {issueRows.length > 0 ? (
        <div className="mt-4 space-y-2">
          {issueRows.map((review) => (
            <div key={`${review.path}-${review.questionId || ''}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-300/80 dark:bg-amber-950/75 dark:text-amber-50">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-black">
                    <FiAlertCircle className="shrink-0" size={15} />
                    <span>{review.label || `Câu ${review.questionNumber || '?'}`}</span>
                    <span>-</span>
                    <span>{getAiReviewLabel(review.status)}</span>
                    {Number.isFinite(review.confidence) && <span>{Math.round((review.confidence || 0) * 100)}%</span>}
                  </div>
                  {review.suggestedCorrectAnswer && <p className="mt-1">Gợi ý đáp án: {review.suggestedCorrectAnswer}</p>}
                  {review.note && <p className="mt-1 whitespace-pre-wrap">{review.note}</p>}
                  {(review.questionIssues || []).map((issue, index) => <p key={`question-${index}`} className="mt-1">Câu hỏi/OCR: {issue}</p>)}
                  {(review.formulaIssues || []).map((issue, index) => <p key={`formula-${index}`} className="mt-1">Công thức: {issue}</p>)}
                  {(review.explanationIssues || []).map((issue, index) => <p key={`explanation-${index}`} className="mt-1">Lời giải: {issue}</p>)}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenQuestion(review)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-300/70 dark:bg-slate-950 dark:text-amber-100 dark:hover:bg-amber-950"
                >
                  <FiEdit2 size={13} /> Sửa câu
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : summary && !reviewing ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
          AI chưa đánh dấu câu lỗi.
        </p>
      ) : null}
    </div>
  );
}
