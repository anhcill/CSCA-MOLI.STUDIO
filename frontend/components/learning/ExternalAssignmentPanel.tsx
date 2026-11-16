'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiExternalLink,
  FiLock,
  FiRefreshCw,
  FiSend,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey, parseExternalApiError } from '@/lib/api/learning';
import type {
  ExternalAssignmentAttachmentDto,
  ExternalAssignmentDetailDto,
  ExternalAssignmentRubricItemDto,
  ExternalAssignmentSubmissionDto,
  ExternalUnitAssignmentDto,
} from '@/lib/types/courses';
import { CourseFilePicker } from '@/components/courses/CourseFilePicker';
import RichMathText from '@/components/common/RichMathText';

export interface ExternalAssignmentPanelProps {
  profileId: string | null;
  unitId: string | number;
  assignments: ExternalUnitAssignmentDto[];
  canSubmitAssignments: boolean;
  isPublicPreviewAccess: boolean;
  onAssignmentSubmitted?: () => void;
}

function isSafeHttpOrRelativeUrl(url: string | null | undefined): string | null {
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

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({ attachments }: { attachments: ExternalAssignmentAttachmentDto[] }) {
  if (!attachments.length) return null;
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((att, idx) => {
        const name = att.originalFilename || att.originalName || att.fileName || `Tệp ${idx + 1}`;
        const safeUrl = isSafeHttpOrRelativeUrl(att.url);
        const sizeLabel = formatFileSize(att.sizeBytes);
        return (
          <li
            key={att.id || `${name}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-[#e3d4c5] bg-white px-3 py-2 text-xs dark:border-[#2c3a52] dark:bg-[#0b172b]"
          >
            <span className="min-w-0 truncate font-bold text-[#1e2b44] dark:text-slate-200">
              {name} {sizeLabel ? `(${sizeLabel})` : ''}
            </span>
            {safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 font-black text-[#247d7e] hover:underline dark:text-[#6ac6bd]"
              >
                Mở <FiExternalLink />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RubricSection({ rubric }: { rubric: ExternalAssignmentRubricItemDto[] | string | null | undefined }) {
  if (!rubric) return null;
  if (typeof rubric === 'string') {
    if (!rubric.trim()) return null;
    return (
      <div className="mt-4 rounded-xl border border-[#e3d4c5] bg-[#fffaf4] p-4 dark:border-[#2c3a52] dark:bg-[#0b172b]">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#247d7e]">Tiêu chí chấm điểm (Rubric)</p>
        <RichMathText value={rubric} />
      </div>
    );
  }
  if (!Array.isArray(rubric) || !rubric.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-[#e3d4c5] bg-[#fffaf4] p-4 dark:border-[#2c3a52] dark:bg-[#0b172b]">
      <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-[#247d7e]">Tiêu chí chấm điểm (Rubric)</p>
      <ul className="space-y-2">
        {rubric.map((item, idx) => (
          <li
            key={item.id || `${item.criterion}-${idx}`}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-[#101e33]"
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#1e2b44] dark:text-slate-100">{item.criterion}</p>
              {item.description ? (
                <p className="mt-0.5 text-[#6f665f] dark:text-slate-400">{item.description}</p>
              ) : null}
            </div>
            {item.maxPoints !== undefined && item.maxPoints !== null ? (
              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {item.maxPoints} điểm
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignmentItemCard({
  summary,
  profileId,
  unitId,
  canSubmitAssignments,
  isPublicPreviewAccess,
  defaultExpanded,
  onSubmitted,
}: {
  summary: ExternalUnitAssignmentDto;
  profileId: string | null;
  unitId: string | number;
  canSubmitAssignments: boolean;
  isPublicPreviewAccess: boolean;
  defaultExpanded: boolean;
  onSubmitted?: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [detail, setDetail] = useState<ExternalAssignmentDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [contentText, setContentText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const idemKeyRef = useRef<string>(generateIdempotencyKey());
  const textSeededRef = useRef(false);

  const loadDetail = useCallback(async () => {
    if (!profileId || isPublicPreviewAccess) return;
    try {
      setLoading(true);
      setError('');
      const data = await learningApi.getExternalAssignmentDetail({
        profileId,
        unitId,
        assignmentId: summary.id,
      });
      setDetail(data);
      const existingText = data.submission?.contentText ?? data.submission?.textContent ?? '';
      if (!textSeededRef.current && existingText) {
        setContentText(existingText);
        textSeededRef.current = true;
      }
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải chi tiết bài tập.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [isPublicPreviewAccess, profileId, summary.id, unitId]);

  useEffect(() => {
    if (expanded && !detail && !loading && profileId && !isPublicPreviewAccess) {
      void loadDetail();
    }
  }, [detail, expanded, isPublicPreviewAccess, loadDetail, loading, profileId]);

  const assignment = detail?.assignment ?? summary;
  const submission: ExternalAssignmentSubmissionDto | null = detail?.submission ?? null;
  const displayScore = submission?.score ?? summary.score ?? null;
  const displayMaxScore = submission?.maxScore ?? assignment.maxScore ?? summary.maxScore ?? 100;
  const displayGradedAt = submission?.gradedAt ?? summary.gradedAt ?? null;
  const displayFeedback = submission?.teacherFeedback ?? summary.teacherFeedback ?? null;
  const isSubmitted = Boolean(submission || summary.isSubmitted);
  const isGraded = submission?.status === 'graded' || displayScore !== null || Boolean(displayGradedAt);

  const handleSubmit = async () => {
    if (!profileId || !canSubmitAssignments || isPublicPreviewAccess || submitting) return;
    const trimmed = contentText.trim();
    if (!trimmed && files.length === 0) {
      setSubmitError('Hãy nhập nội dung bài làm hoặc đính kèm ít nhất một tệp.');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError('');
      setSubmitSuccess('');
      const saved = await learningApi.submitExternalAssignment({
        profileId,
        unitId,
        assignmentId: summary.id,
        contentText: trimmed,
        files,
        idempotencyKey: idemKeyRef.current,
      });
      idemKeyRef.current = generateIdempotencyKey();
      setFiles([]);
      setDetail((prev) => ({
        assignment: prev?.assignment ?? summary,
        submission: saved,
        submissions: prev?.submissions ?? [],
      }));
      setSubmitSuccess('Đã nộp bài tập thành công!');
      onSubmitted?.();
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể nộp bài tập. Vui lòng thử lại.');
      setSubmitError(parsed.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] dark:border-[#34435a] dark:bg-[#101e33]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-[#fcf6ef] dark:hover:bg-[#13233c] sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-[#18243b] dark:text-white">{assignment.title}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
              isGraded
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : isSubmitted
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {isGraded
                ? `Đã chấm${displayScore !== null ? `: ${displayScore}/${displayMaxScore}` : ''}`
                : isSubmitted
                  ? 'Đã nộp — chờ chấm'
                  : 'Chưa nộp'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6f665f] dark:text-slate-400">
            {displayMaxScore ? <span>Thang điểm: {displayMaxScore}</span> : null}
            {assignment.dueDate ? (
              <span className="inline-flex items-center gap-1">
                <FiClock /> Hạn nộp: {new Date(assignment.dueDate).toLocaleString('vi-VN')}
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-[#6f665f] dark:text-slate-400">
          {expanded ? <FiChevronUp /> : <FiChevronDown />}
        </span>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-[#ebe0d4] p-4 dark:border-[#26354b] sm:p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs font-bold text-[#6f665f] dark:text-slate-400">
              <FiRefreshCw className="animate-spin text-[#247d7e]" /> Đang tải chi tiết bài tập...
            </div>
          ) : error ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <span>{error}</span>
              <button type="button" onClick={() => void loadDetail()} className="underline">Thử lại</button>
            </div>
          ) : null}

          {(assignment.description || detail?.assignment?.instructions) ? (
            <div className="rounded-xl border border-[#e3d4c5] bg-white p-4 dark:border-[#2c3a52] dark:bg-[#0b172b]">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#ad2033]">Đề bài & Hướng dẫn</p>
              <RichMathText value={detail?.assignment?.instructions || assignment.description || ''} />
              {detail?.assignment?.attachments?.length ? (
                <AttachmentRow attachments={detail.assignment.attachments} />
              ) : null}
            </div>
          ) : null}

          <RubricSection rubric={assignment.rubric} />

          {isSubmitted ? (
            <div className={`rounded-xl border p-4 ${
              isGraded
                ? 'border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/60 dark:bg-emerald-950/25'
                : 'border-amber-200 bg-amber-50/75 dark:border-amber-900/60 dark:bg-amber-950/25'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#18243b] dark:text-white">
                  <FiCheckCircle className={isGraded ? 'text-emerald-600' : 'text-amber-600'} />
                  {isGraded ? 'Bài làm đã được chấm' : 'Đã nộp — đang chờ giáo viên chấm'}
                </span>
                {submission?.submittedAt ? (
                  <span className="text-xs font-semibold text-[#6f665f] dark:text-slate-400">
                    Nộp lúc: {new Date(submission.submittedAt).toLocaleString('vi-VN')}
                  </span>
                ) : null}
              </div>

              {isGraded ? (
                <div className="mt-3 rounded-xl bg-white/85 p-3.5 dark:bg-slate-950/40">
                  {displayScore !== null ? (
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {displayScore} / {displayMaxScore} điểm
                    </p>
                  ) : null}
                  {displayGradedAt ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      Chấm lúc: {new Date(displayGradedAt).toLocaleString('vi-VN')}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#29354b] dark:text-slate-200">
                    <strong>Nhận xét của giáo viên:</strong> {displayFeedback || 'Chưa có nhận xét chi tiết.'}
                  </p>
                </div>
              ) : null}

              {(submission?.contentText || submission?.textContent) ? (
                <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs dark:bg-slate-950/30">
                  <p className="font-bold text-slate-500">Nội dung đã nộp:</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#1e2b44] dark:text-slate-200">
                    {submission.contentText || submission.textContent}
                  </p>
                </div>
              ) : null}

              {(submission?.attachments?.length || submission?.files?.length || submission?.assets?.length) ? (
                <AttachmentRow attachments={submission.attachments || submission.files || submission.assets || []} />
              ) : null}
            </div>
          ) : null}

          {isPublicPreviewAccess || !profileId || !canSubmitAssignments ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <FiLock className="shrink-0" />
              <span>
                {isPublicPreviewAccess
                  ? 'Đăng ký khóa học để nộp bài tập và nhận phản hồi từ giảng viên.'
                  : 'Hồ sơ hiện tại chưa được bật quyền nộp bài tập.'}
              </span>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-[#e3d4c5] bg-white p-4 dark:border-[#2c3a52] dark:bg-[#0b172b]">
              <h4 className="font-black text-[#18243b] dark:text-white">
                {isSubmitted ? 'Nộp lại bài tập' : 'Nộp bài làm của bạn'}
              </h4>
              <label className="block text-xs font-bold text-[#414c61] dark:text-slate-300">
                Nội dung trả lời (tùy chọn nếu có đính kèm tệp)
                <textarea
                  rows={4}
                  value={contentText}
                  disabled={submitting}
                  onChange={(event) => {
                    setContentText(event.target.value);
                    idemKeyRef.current = generateIdempotencyKey();
                    setSubmitSuccess('');
                  }}
                  placeholder="Nhập lời giải hoặc ghi chú cho giáo viên..."
                  className="mt-2 w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] p-3 text-sm font-normal outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
                />
              </label>

              <CourseFilePicker
                files={files}
                onChange={(nextFiles) => {
                  setFiles(nextFiles);
                  idemKeyRef.current = generateIdempotencyKey();
                  setSubmitSuccess('');
                }}
                disabled={submitting}
                label="Chọn hoặc dán ảnh / PDF / DOC bài làm"
              />

              {submitError ? (
                <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/35 dark:text-red-300">
                  <FiAlertCircle className="shrink-0" /> {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300">
                  <FiCheckCircle className="shrink-0" /> {submitSuccess}
                </p>
              ) : null}

              <button
                type="button"
                disabled={submitting || (!contentText.trim() && files.length === 0)}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
              >
                <FiSend />
                {submitting ? 'Đang tải và nộp...' : isSubmitted ? 'Nộp lại bài' : 'Nộp bài cho giáo viên'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ExternalAssignmentPanel({
  profileId,
  unitId,
  assignments,
  canSubmitAssignments,
  isPublicPreviewAccess,
  onAssignmentSubmitted,
}: ExternalAssignmentPanelProps) {
  if (!assignments.length) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-base font-black text-[#18243b] dark:text-white">Bài tập tự luận / Thực hành</h3>
      <div className="space-y-3">
        {assignments.map((item, idx) => (
          <AssignmentItemCard
            key={item.id}
            summary={item}
            profileId={profileId}
            unitId={unitId}
            canSubmitAssignments={canSubmitAssignments}
            isPublicPreviewAccess={isPublicPreviewAccess}
            defaultExpanded={assignments.length === 1 || idx === 0}
            onSubmitted={onAssignmentSubmitted}
          />
        ))}
      </div>
    </section>
  );
}
