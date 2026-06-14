'use client';

import { useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiClock, FiFileText, FiUpload } from 'react-icons/fi';
import { examAdminApi, ImportedExamItem, PdfImportPreview } from '@/lib/api/examAdmin';
import { PDF_IMPORT_PRESETS, PdfImportPreset } from '@/lib/pdf-import/presets';
import PdfImportReview from './PdfImportReview';

interface PdfImportPanelProps {
  canImport: boolean;
  subjectCode?: string;
  subjectName?: string;
  preview: PdfImportPreview | null;
  items: ImportedExamItem[];
  saving: boolean;
  onPreviewLoaded: (preview: PdfImportPreview) => void;
  onPreviewCleared: () => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
  onSave: (items?: ImportedExamItem[]) => void;
}

const PREVIEW_TIMEOUT_MS = 240000;
const PROGRESS_STEPS = [
  'Tải file',
  'Đọc OCR/text',
  'Tách câu',
  'Chuẩn hóa',
  'Xem trước',
];

function formatFileSize(bytes?: number) {
  if (!Number.isFinite(bytes || 0) || !bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function getPdfImportErrorMessage(error: any) {
  if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
    return 'Đã dừng phân tích file. Nếu file nặng, thử lại hoặc tách PDF ngắn hơn.';
  }

  if (error?.code === 'ECONNABORTED') {
    return 'Phân tích file quá lâu. Vui lòng thử file ngắn hơn hoặc chọn preset Auto/Math để dùng parser nhanh.';
  }

  return error?.response?.data?.message || 'Phân tích file thất bại. Vui lòng thử lại hoặc chọn PDF/Word có text rõ hơn.';
}

function getPreviewProgress(elapsedMs: number) {
  const ratio = Math.min(elapsedMs / PREVIEW_TIMEOUT_MS, 1);
  const percent = Math.min(92, Math.round(8 + ratio * 84));

  if (ratio < 0.08) {
    return {
      percent: Math.max(percent, 10),
      stage: 0,
      label: 'Đang tải file lên...',
      detail: 'Đang gửi file vào hàng đọc dữ liệu.',
    };
  }
  if (ratio < 0.25) {
    return {
      percent: Math.max(percent, 24),
      stage: 1,
      label: 'Đang trích OCR/text từ file...',
      detail: 'PDF có text và Word sẽ được đọc trực tiếp; PDF scan thuần cần OCR ảnh trước.',
    };
  }
  if (ratio < 0.72) {
    return {
      percent: Math.max(percent, 42),
      stage: 2,
      label: 'Đang tách câu hỏi, đáp án và lời giải...',
      detail: 'Hệ thống đang nhận diện cấu trúc đề, nhóm đọc hiểu và câu điền từ.',
    };
  }
  return {
    percent,
    stage: 3,
    label: 'Đang chuẩn hóa công thức...',
    detail: 'Đang sửa ký hiệu toán, đáp án và dựng bản xem trước để bạn kiểm tra.',
  };
}

function normalizeSubjectToken(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

function getChineseSubjectPreset(subjectCode?: string, subjectName?: string): PdfImportPreset | null {
  const text = normalizeSubjectToken(`${subjectCode || ''} ${subjectName || ''}`);
  if (!text.includes('trung') && !text.includes('chinese')) return null;
  if (/(tu\s*nhien|natural|khoa\s*hoc\s*tu\s*nhien|tn|science)/.test(text)) return 'chinese_natural';
  if (/(xa\s*hoi|social|xh|humanities)/.test(text)) return 'chinese_social';
  return null;
}

export default function PdfImportPanel({
  canImport,
  subjectCode,
  subjectName,
  preview,
  items,
  saving,
  onPreviewLoaded,
  onPreviewCleared,
  onChangeItems,
  onSave,
}: PdfImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PdfImportPreset>('auto');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [progressStage, setProgressStage] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const activeRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedOutRef = useRef(false);
  const autoChinesePreset = getChineseSubjectPreset(subjectCode, subjectName);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoChinesePreset && preset !== autoChinesePreset) {
      setPreset(autoChinesePreset);
      return;
    }
    if (!autoChinesePreset && (preset === 'chinese_natural' || preset === 'chinese_social')) {
      setPreset('auto');
    }
  }, [autoChinesePreset, preset]);

  const clearPreviewTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleCancelPreview = () => {
    abortRef.current?.abort();
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgress = () => {
    stopProgress();
    const startedAt = Date.now();
    const firstStep = getPreviewProgress(0);
    setProgress(firstStep.percent);
    setProgressLabel(firstStep.label);
    setProgressDetail(firstStep.detail);
    setProgressStage(firstStep.stage);
    setElapsedSeconds(0);
    progressIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const nextStep = getPreviewProgress(elapsedMs);
      setProgress(nextStep.percent);
      setProgressLabel(nextStep.label);
      setProgressDetail(nextStep.detail);
      setProgressStage(nextStep.stage);
      setElapsedSeconds(Math.floor(elapsedMs / 1000));
    }, 700);
  };

  const handlePreview = async () => {
    if (!canImport) {
      alert('Vui lòng tạo đề thi trước khi import PDF');
      return;
    }

    if (!file) {
      alert('Vui lòng chọn file PDF');
      return;
    }

    abortRef.current?.abort();
    clearPreviewTimer();

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const controller = new AbortController();
    abortRef.current = controller;
    timedOutRef.current = false;
    timeoutRef.current = setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, PREVIEW_TIMEOUT_MS);

    try {
      startProgress();
      setLoading(true);
      setErrorMessage('');
      const activePreset = autoChinesePreset || preset;
      const nextPreview = await examAdminApi.previewPdfImport(file, activePreset, controller.signal, {
        subjectCode,
        subjectName,
      });
      if (activeRequestRef.current !== requestId || controller.signal.aborted) return;

      stopProgress();
      setProgress(100);
      setProgressLabel('Hoàn tất, đang dựng bản xem trước...');
      setProgressDetail('Đã đọc xong file, chuẩn bị mở danh sách câu hỏi để review.');
      setProgressStage(4);
      setLoading(false);
      window.setTimeout(() => {
        if (activeRequestRef.current === requestId) {
          onPreviewLoaded(nextPreview);
        }
      }, 0);
    } catch (error: any) {
      if (activeRequestRef.current !== requestId) return;
      console.error('Error previewing PDF import:', error);
      if (timedOutRef.current) {
        setErrorMessage('Phân tích file quá lâu nên đã tự dừng. Thử tách file ngắn hơn hoặc chạy lại sau.');
      } else {
        setErrorMessage(getPdfImportErrorMessage(error));
      }
    } finally {
      if (activeRequestRef.current === requestId) {
        clearPreviewTimer();
        stopProgress();
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 mb-6">
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FiUpload className="text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Import OCR/PDF/Word đa môn</h3>
          </div>
          <p className="text-sm text-gray-500">
            Upload PDF dạng text, PDF đã OCR hoặc Word .doc/.docx để tách câu hỏi, đáp án và giải thích. PDF scan ảnh thuần vẫn cần OCR ảnh trước khi import.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {PDF_IMPORT_PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPreset(option.key)}
              disabled={Boolean(autoChinesePreset) && option.key !== autoChinesePreset}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                preset === option.key
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              } ${Boolean(autoChinesePreset) && option.key !== autoChinesePreset ? 'opacity-50' : ''
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-snug text-gray-500">{option.description}</span>
            </button>
          ))}
        </div>

        {autoChinesePreset && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            Môn này đang dùng parser riêng cho Tiếng Trung CSCA: rule mạnh trước, AI chỉ hỗ trợ khi rule thiếu/lệch.
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <input
              type="file"
              accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                if (loading) handleCancelPreview();
                setFile(event.target.files?.[0] || null);
                setErrorMessage('');
                setProgress(0);
                setProgressLabel('');
                setProgressDetail('');
                setProgressStage(0);
                setElapsedSeconds(0);
                onPreviewCleared();
              }}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={loading || !file}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FiUpload />
            <span>{loading ? 'Đang phân tích...' : 'Phân tích PDF/Word'}</span>
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancelPreview}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Dừng
            </button>
          )}
        </div>

        {errorMessage && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 text-sm text-slate-700 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100">
                <div className="absolute inset-1 animate-spin rounded-2xl border-2 border-sky-100 border-t-sky-500" />
                <FiFileText className="relative text-sky-600" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">Đang đọc file import</p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">
                      {file?.name || 'File đang xử lý'} • {formatFileSize(file?.size)} • {formatElapsed(elapsedSeconds)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-black text-sky-700 shadow-sm">
                    <FiClock size={13} />
                    {progress}%
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-sky-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400 transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {PROGRESS_STEPS.map((step, index) => {
                    const done = index < progressStage;
                    const active = index === progressStage;
                    return (
                      <div
                        key={step}
                        className={[
                          'rounded-xl border px-2.5 py-2 text-[11px] font-bold transition-colors',
                          done
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : active
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-100 bg-white/70 text-slate-400',
                        ].join(' ')}
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          {done ? (
                            <FiCheckCircle size={13} />
                          ) : (
                            <span className={active ? 'h-2 w-2 rounded-full bg-sky-500' : 'h-2 w-2 rounded-full bg-slate-200'} />
                          )}
                          <span>{index + 1}</span>
                        </div>
                        <span className="block leading-tight">{step}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                    {progressLabel}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {progressDetail} Đã xử lý ước lượng {progress}% luồng OCR/text. File dài có thể mất vài phút, vui lòng giữ nguyên trang này.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <PdfImportReview
          preview={preview}
          items={items}
          saving={saving}
          onSave={onSave}
          onChangeItems={(nextItems) => {
            onChangeItems(nextItems);
          }}
        />
      )}
    </div>
  );
}
