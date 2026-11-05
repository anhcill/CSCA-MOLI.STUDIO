'use client';

import { useState } from 'react';
import RichMathText from '@/components/common/RichMathText';
import type { QuestionReportDetail } from '@/lib/api/riskCenter';
import { questionReportDescription, questionReportLabel } from '@/lib/questionReports';
import {
  FiAlertTriangle,
  FiCheck,
  FiExternalLink,
  FiHash,
  FiRefreshCw,
  FiShield,
  FiUser,
  FiX,
} from 'react-icons/fi';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200 dark:border-orange-500/35 dark:bg-orange-500/15 dark:text-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:border-yellow-500/35 dark:bg-yellow-500/15 dark:text-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-200',
  reviewing: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-200',
  resolved: 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/35 dark:bg-green-500/15 dark:text-green-200',
  ignored: 'border-gray-200 bg-gray-100 text-gray-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  escalated: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/35 dark:bg-purple-500/15 dark:text-purple-200',
  fixed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/35 dark:bg-green-500/15 dark:text-green-200',
};

function Badge({ text, colorClass }: { text: string; colorClass?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${colorClass || 'border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
      {text}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  return `${Math.floor(diff / 86400)} ngày`;
}

function ActionModal({
  title,
  isOpen,
  onClose,
  onConfirm,
  loading,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-slate-950/75">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
        {children}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Nhập lý do..."
          className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800">Hủy</button>
          <button
            onClick={() => { onConfirm(reason); setReason(''); }}
            disabled={loading || !reason.trim()}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface QuestionReportDrawerProps {
  detail: QuestionReportDetail | null;
  onClose: () => void;
  onAction: (id: number, action: string, body?: Record<string, unknown>) => Promise<void>;
  canResolve?: boolean;
  canModerateExam?: boolean;
  canOpenExam?: boolean;
}

export default function QuestionReportDrawer({
  detail,
  onClose,
  onAction,
  canResolve = false,
  canModerateExam = false,
  canOpenExam = false,
}: QuestionReportDrawerProps) {
  const [actionModal, setActionModal] = useState<{ action: string; title: string; requireAnswer?: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newCorrectAnswer, setNewCorrectAnswer] = useState('');

  if (!detail) return null;

  const handleAction = async (reason: string) => {
    if (!actionModal) return;
    if (actionModal.requireAnswer && !newCorrectAnswer.trim()) {
      window.alert('Vui lòng nhập đáp án đúng mới.');
      return;
    }
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { reason };
      if (actionModal.requireAnswer) body.new_correct_answer = newCorrectAnswer.trim().toUpperCase();
      await onAction(detail.id, actionModal.action, body);
      setActionModal(null);
      setNewCorrectAnswer('');
      onClose();
    } catch {
      window.alert('Không thể xử lý báo lỗi này.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-sm dark:bg-slate-950/75" onClick={onClose} aria-label="Đóng chi tiết báo lỗi" />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-4xl overflow-x-hidden overflow-y-auto bg-white shadow-2xl dark:border-l dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Báo lỗi #{detail.id}</h2>
            <p className="mt-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {detail.exam_title || `Đề #${detail.exam_id}`} · Câu {detail.question_number || '?'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge text={questionReportLabel(detail.report_type)} colorClass={SEVERITY_COLORS[detail.severity]} />
              <Badge text={detail.status} colorClass={STATUS_COLORS[detail.status]} />
              <span className="text-xs font-bold text-gray-400">Question ID #{detail.question_id}</span>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"><FiX size={18} /></button>
        </div>

        <div className="min-w-0 space-y-5 px-4 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-indigo-500"><FiHash /> Đề và câu bị báo</div>
              <p className="text-sm font-black text-gray-900 dark:text-white">{detail.exam_title || 'Không tìm thấy tên đề'}</p>
              <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-slate-300">{detail.exam_code || 'Không có mã đề'} · Exam ID #{detail.exam_id}</p>
              <p className="mt-1 text-xs font-black text-indigo-700 dark:text-indigo-300">Câu {detail.question_number || '?'} · Question ID #{detail.question_id}</p>
              {canOpenExam && (
                <a href={`/admin/exams/${detail.exam_id}?questionId=${detail.question_id}#question-${detail.question_id}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
                  <FiExternalLink size={12} /> Mở đúng câu trong đề
                </a>
              )}
              {detail.exam_is_hidden && <div className="mt-2"><Badge text="Đề đã ẩn" colorClass="border-red-200 bg-red-100 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-200" /></div>}
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-sky-600"><FiUser /> Người gửi báo lỗi</div>
              <p className="truncate text-sm font-black text-gray-900 dark:text-white">{detail.reporter_name || 'Tài khoản không còn tồn tại'}</p>
              <p className="mt-1 truncate text-xs text-gray-600 dark:text-slate-300">{detail.reporter_email || 'Không có email'}</p>
              <p className="mt-1 text-xs font-semibold text-sky-700 dark:text-sky-300">User ID #{detail.reporter_id || '?'}</p>
              <p className="mt-3 text-[11px] text-gray-500 dark:text-slate-400">Báo lúc {new Date(detail.created_at).toLocaleString('vi-VN')}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="mb-1 text-xs font-bold uppercase text-amber-700 dark:text-amber-300">Mô tả người dùng</p>
            <RichMathText value={questionReportDescription(detail.report_type, detail.description)} className="text-sm text-gray-800 dark:text-slate-100" />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase text-gray-400">Nội dung câu hỏi</p>
            <div className="max-h-96 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
              <RichMathText value={detail.question_text || 'N/A'} className="text-[15px] leading-7 text-gray-900 dark:text-slate-100 [&_.katex-display]:overflow-x-auto" />
              {detail.question_text_cn && <RichMathText value={detail.question_text_cn} className="mt-3 border-t border-gray-200 pt-3 text-sm leading-7 text-gray-500 dark:border-slate-800 dark:text-slate-300 [&_.katex-display]:overflow-x-auto" />}
              {detail.question_image && <img src={detail.question_image} alt={`Hình câu ${detail.question_number || detail.question_id}`} className="mt-4 h-auto max-h-80 max-w-full rounded-lg border border-gray-200 object-contain dark:border-slate-700" />}
            </div>
          </div>

          {detail.answers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-gray-400">Đáp án</p>
              <div className="space-y-2">{detail.answers.map((answer) => (
                <div key={answer.id} className={`flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-sm ${answer.is_correct ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-500/35 dark:bg-green-500/10 dark:text-green-200' : 'border-gray-100 bg-gray-50 text-gray-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'}`}>
                  <span className="font-black">{answer.answer_key}.</span>
                  <div className="min-w-0 flex-1"><RichMathText value={answer.answer_text || answer.answer_text_cn || ''} className="text-sm leading-6 [&_.katex-display]:overflow-x-auto" />{answer.answer_text_cn && answer.answer_text_cn !== answer.answer_text && <RichMathText value={answer.answer_text_cn} className="mt-1 text-xs leading-5 opacity-70 [&_.katex-display]:overflow-x-auto" />}</div>
                  {answer.is_correct && <span className="shrink-0 text-xs font-black text-green-700 dark:text-green-300">Đúng</span>}
                </div>
              ))}</div>
            </div>
          )}

          {(detail.explanation || detail.explanation_cn) && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-gray-400">Lời giải</p>
              <div className="max-h-80 overflow-y-auto rounded-xl bg-gray-50 p-4 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                {detail.explanation && <RichMathText value={detail.explanation} className="text-sm leading-7 text-gray-700 dark:text-slate-200 [&_.katex-display]:overflow-x-auto" readableBreaks />}
                {detail.explanation_cn && <RichMathText value={detail.explanation_cn} className="mt-3 border-t border-gray-200 pt-3 text-sm leading-7 text-gray-600 dark:border-slate-700 dark:text-slate-300 [&_.katex-display]:overflow-x-auto" readableBreaks />}
              </div>
            </div>
          )}

          {(canResolve || canModerateExam) ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-gray-400">Thao tác xử lý</p>
              <div className="flex flex-wrap gap-2">
                {canResolve && <button onClick={() => setActionModal({ action: 'resolve', title: 'Đánh dấu đã sửa' })} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 dark:border-green-500/35 dark:text-green-300 dark:hover:bg-green-500/10"><FiCheck size={12} /> Đã sửa</button>}
                {canResolve && <button onClick={() => setActionModal({ action: 'ignore', title: 'Bỏ qua báo lỗi' })} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"><FiX size={12} /> Bỏ qua</button>}
                {canModerateExam && <button onClick={() => setActionModal({ action: 'hide-question', title: 'Ẩn câu hỏi' })} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50 dark:border-orange-500/35 dark:text-orange-300 dark:hover:bg-orange-500/10"><FiAlertTriangle size={12} /> Ẩn câu</button>}
                {canModerateExam && <button onClick={() => setActionModal({ action: 'hide-exam', title: 'Ẩn đề thi' })} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-500/35 dark:text-red-300 dark:hover:bg-red-500/10"><FiShield size={12} /> Ẩn đề</button>}
                {canModerateExam && <button onClick={() => setActionModal({ action: 'regrade-affected-attempts', title: 'Chấm lại bài bị ảnh hưởng', requireAnswer: true })} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-500/35 dark:text-violet-300 dark:hover:bg-violet-500/10"><FiRefreshCw size={12} /> Chấm lại</button>}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">Bạn có quyền xem nhưng chưa được cấp quyền xử lý báo lỗi đề.</div>
          )}

          {detail.relatedReports.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-gray-400">Báo lỗi cùng câu ({detail.relatedReports.length})</p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">{detail.relatedReports.map((report) => (
                <div key={report.id} className="min-w-0 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300"><div className="mb-1 flex items-center justify-between gap-2"><Badge text={questionReportLabel(report.report_type)} colorClass={STATUS_COLORS[report.status]} /><span className="shrink-0 text-gray-400 dark:text-slate-500">{timeAgo(report.created_at)}</span></div><p className="break-words">{questionReportDescription(report.report_type, report.description)}</p></div>
              ))}</div>
            </div>
          )}

          {detail.regradeHistory.length > 0 && (
            <div><p className="mb-2 text-xs font-bold uppercase text-gray-400">Lịch sử chấm lại</p><div className="space-y-1.5">{detail.regradeHistory.map((log) => <div key={log.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">{log.old_answer || '?'} sang {log.new_answer || '?'} · {log.affected_count} bài · {timeAgo(log.created_at)}</div>)}</div></div>
          )}
        </div>
      </aside>

      <ActionModal title={actionModal?.title || ''} isOpen={!!actionModal} onClose={() => { setActionModal(null); setNewCorrectAnswer(''); }} onConfirm={handleAction} loading={actionLoading}>
        {actionModal?.requireAnswer && (
          <div className="mb-3"><label className="mb-1 block text-xs font-bold uppercase text-gray-400" htmlFor="new-correct-answer">Đáp án đúng mới</label><input id="new-correct-answer" value={newCorrectAnswer} onChange={(event) => setNewCorrectAnswer(event.target.value)} placeholder="A, B, C..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
        )}
      </ActionModal>
    </>
  );
}
