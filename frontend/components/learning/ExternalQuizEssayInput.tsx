'use client';

import { useRef, useState } from 'react';
import { FiExternalLink, FiFile, FiImage, FiPaperclip, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import type { ExternalQuizEssayAnswerDto, ExternalQuizEssayAttachmentDto } from '@/lib/types/courses';
import { normalizeEssayValue } from './quizHelpers';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function formatBytes(bytes?: number): string {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(att: ExternalQuizEssayAttachmentDto): boolean {
  return String(att.mimeType || '').startsWith('image/')
    || /\.(?:jpe?g|png|webp|gif|heic|heif)$/i.test(String(att.name || ''));
}

export function resolveSafeEssayAttachmentUrl(
  att: ExternalQuizEssayAttachmentDto,
  profileId: string,
  unitId: string | number,
): string | null {
  const raw = typeof att.url === 'string' ? att.url.trim() : '';
  if (raw.startsWith('/api/learning/external/')) return raw;
  const assetId = String(att.assetId || '').trim();
  if (!assetId) return null;
  return `/api/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/submission-assets/${encodeURIComponent(assetId)}`;
}

export interface ExternalQuizEssayInputProps {
  profileId: string;
  unitId: string | number;
  quizId: string | number;
  questionId: string;
  value: unknown;
  disabled?: boolean;
  onChange: (next: ExternalQuizEssayAnswerDto) => void;
}

export function ExternalQuizEssayInput({
  profileId,
  unitId,
  quizId,
  questionId,
  value,
  disabled = false,
  onChange,
}: ExternalQuizEssayInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const answer = normalizeEssayValue(value);
  const attachments = answer.attachments ?? [];

  const updateAnswer = (patch: Partial<ExternalQuizEssayAnswerDto>) => {
    onChange({
      ...answer,
      ...patch,
    });
  };

  const handleUploadFiles = async (incomingList: FileList | File[] | null) => {
    if (disabled || uploading || !incomingList) return;
    const available = MAX_FILES - attachments.length;
    const candidateFiles = Array.from(incomingList).slice(0, Math.max(0, available));
    if (!candidateFiles.length) {
      setError(available <= 0 ? `Mỗi câu được đính kèm tối đa ${MAX_FILES} tệp.` : 'Chưa có tệp hợp lệ để tải lên.');
      return;
    }

    const oversized = candidateFiles.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`Tệp "${oversized.name}" vượt quá giới hạn 25MB.`);
      return;
    }

    setUploading(true);
    setError('');
    setUploadStatus(`Đang tải lên ${candidateFiles.length} tệp...`);
    try {
      const uploaded = await learningApi.uploadExternalQuizEssayAssets({
        profileId,
        unitId,
        quizId,
        files: candidateFiles,
      });
      if (uploaded.length > 0) {
        updateAnswer({ attachments: [...attachments, ...uploaded] });
      }
      setUploadStatus('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải tệp bài làm lên máy chủ.');
      setError(parsed.message);
      setUploadStatus('');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAttachment = (assetId: string) => {
    updateAnswer({
      attachments: attachments.filter((item) => String(item.assetId) !== String(assetId)),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor={`ext-essay-${questionId}`}
            className="text-xs font-black text-[#18243b] dark:text-slate-200"
          >
            Bài làm tự luận / Dịch thuật
          </label>
          <span className="text-[11px] font-semibold text-slate-400">
            Tự động lưu nháp khi nhập
          </span>
        </div>
        <textarea
          id={`ext-essay-${questionId}`}
          rows={7}
          disabled={disabled}
          value={answer.text ?? ''}
          onChange={(event) => updateAnswer({ text: event.target.value })}
          placeholder="Nhập bài làm tại đây (hỗ trợ LaTeX $...$ và có thể đính kèm ảnh chụp bài viết tay hoặc tệp PDF bên dưới)..."
          className="w-full resize-y rounded-2xl border border-[#d9cabc] bg-[#fffdf9] px-4 py-3 text-sm leading-6 text-[#18243b] outline-none transition focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 disabled:opacity-60 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
        />
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) void handleUploadFiles(event.dataTransfer.files);
        }}
        onPaste={(event) => {
          if (disabled) return;
          const pasted = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((f): f is File => Boolean(f));
          if (pasted.length > 0) {
            event.preventDefault();
            void handleUploadFiles(pasted);
          }
        }}
        tabIndex={disabled ? -1 : 0}
        className={`rounded-2xl border-2 border-dashed p-5 text-center outline-none transition-colors ${
          dragging
            ? 'border-[#247d7e] bg-[#eff9f7] dark:bg-[#132c3d]'
            : 'border-[#d8c8b9] bg-[#fffaf4] dark:border-[#34435a] dark:bg-[#0b172b]'
        }`}
      >
        <FiUploadCloud className="mx-auto mb-2 text-[#247d7e] dark:text-[#6ac6bd]" size={26} />
        <p className="text-sm font-black text-[#18243b] dark:text-slate-100">
          Kéo-thả, chọn hoặc dán (Ctrl+V) ảnh / tệp bài làm
        </p>
        <p className="mt-1 text-[11px] text-[#6f665f] dark:text-slate-400">
          Hỗ trợ ảnh JPG/PNG/WEBP/HEIC, PDF, DOC, DOCX · Tối đa {MAX_FILES} tệp (mỗi tệp 25MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled || uploading}
          accept="image/*,.pdf,.doc,.docx"
          onChange={(event) => void handleUploadFiles(event.target.files)}
          className="hidden"
        />
        <button
          type="button"
          disabled={disabled || uploading || attachments.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#247d7e] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1b6465] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPaperclip size={14} />
          {uploading ? 'Đang tải lên...' : 'Chọn ảnh hoặc tệp'}
        </button>
        {uploadStatus ? (
          <p className="mt-2 text-xs font-bold text-[#247d7e] dark:text-[#6ac6bd]">{uploadStatus}</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-[#18243b] dark:text-slate-200">Tệp đã đính kèm</span>
            <span className="text-slate-400">{attachments.length}/{MAX_FILES}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {attachments.map((att) => {
              const safeUrl = resolveSafeEssayAttachmentUrl(att, profileId, unitId);
              const sizeStr = formatBytes(att.size);
              return (
                <div
                  key={att.assetId}
                  className="flex items-center gap-3 rounded-xl border border-[#e3d4c5] bg-white p-3 dark:border-[#2c3a52] dark:bg-[#0f1d33]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#247d7e]/10 text-[#247d7e] dark:text-[#6ac6bd]">
                    {isImageAttachment(att) ? <FiImage size={17} /> : <FiFile size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {safeUrl ? (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-xs font-bold text-[#18243b] hover:text-[#247d7e] hover:underline dark:text-slate-100"
                      >
                        <span className="truncate">{att.name}</span>
                        <FiExternalLink className="shrink-0 text-[10px]" />
                      </a>
                    ) : (
                      <p className="truncate text-xs font-bold text-[#18243b] dark:text-slate-100">{att.name}</p>
                    )}
                    {sizeStr ? <p className="text-[11px] text-slate-400">{sizeStr}</p> : null}
                  </div>
                  {!disabled ? (
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.assetId)}
                      aria-label={`Xóa ${att.name}`}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
