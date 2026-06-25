import type { ReactNode } from 'react';

export interface ExamAiRun {
  action: 'review_quality' | 'apply_fixes' | 'display_format_fixes' | 'missing_explanations' | 'polish_explanations' | 'normalize_formulas' | string;
  status: string;
  summary?: Record<string, any>;
  run_by?: number | null;
  run_by_name?: string | null;
  created_at: string;
}

export function getExamAiRunLabel(action: string) {
  if (action === 'review_quality') return 'AI soát đề';
  if (action === 'apply_fixes') return 'AI sửa log';
  if (action === 'display_format_fixes') return 'AI sửa format hiển thị';
  if (action === 'missing_explanations') return 'AI thêm giải thích';
  if (action === 'polish_explanations') return 'AI chuẩn hóa lời giải';
  if (action === 'normalize_formulas') return 'Chuẩn hóa công thức';
  return action;
}

export function formatAiRunTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getExamAiRunDetail(run: ExamAiRun) {
  const summary = run.summary || {};
  if (summary.questionChangedCount) return `${summary.questionChangedCount} câu đã sửa`;
  if (summary.changedCount) return `${summary.changedCount} chỗ đã sửa`;
  if (summary.formulaChangedCount) return `${summary.formulaChangedCount} công thức đã sửa`;
  if (summary.generatedCount) return `${summary.generatedCount} giải thích đã thêm`;
  if (summary.polishedCount) return `${summary.polishedCount} lời giải đã chuẩn hóa`;
  if (summary.issues) return `${summary.issues} lỗi đã phát hiện`;
  if (summary.total) return `${summary.total} câu đã quét`;
  return 'Đã xử lý bằng AI';
}

interface ExamAiHistoryProps {
  runs: ExamAiRun[];
  title?: ReactNode;
  limit?: number;
}

export default function ExamAiHistory({ runs, title, limit = 6 }: ExamAiHistoryProps) {
  if (!runs.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black">{title || 'Lịch sử AI của đề này'}</p>
          <p className="mt-1 text-cyan-800">Đề đã được AI xử lý. Chạy lại vẫn được, nhưng hệ thống sẽ hỏi xác nhận để tránh tốn token.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {runs.slice(0, limit).map((run) => {
          const summary = run.summary || {};
          return (
            <div key={`${run.action}-${run.created_at}`} className="rounded-lg border border-cyan-200 bg-white/70 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{getExamAiRunLabel(run.action)}</span>
                <span className="text-xs font-semibold text-cyan-700">{formatAiRunTime(run.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-cyan-800">
                {run.run_by_name ? `Bởi ${run.run_by_name}` : 'Không rõ admin'}
                {` · ${getExamAiRunDetail(run)}`}
                {summary.model ? ` · ${summary.model}` : ''}
                {summary.sourceFileName ? ` · File gốc: ${summary.sourceFileName}` : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
