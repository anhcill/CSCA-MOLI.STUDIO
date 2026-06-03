'use client';

import { useEffect, useRef, useState } from 'react';
import { FiAlertCircle, FiUpload } from 'react-icons/fi';
import { examAdminApi, ImportedExamItem, PdfImportPreview } from '@/lib/api/examAdmin';
import { PDF_IMPORT_PRESETS, PdfImportPreset } from '@/lib/pdf-import/presets';
import PdfImportReview from './PdfImportReview';

interface PdfImportPanelProps {
  canImport: boolean;
  preview: PdfImportPreview | null;
  items: ImportedExamItem[];
  saving: boolean;
  onPreviewLoaded: (preview: PdfImportPreview) => void;
  onPreviewCleared: () => void;
  onChangeItems: (items: ImportedExamItem[]) => void;
  onSave: (items?: ImportedExamItem[]) => void;
}

const PREVIEW_TIMEOUT_MS = 240000;

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
    return { percent: Math.max(percent, 10), label: 'Đang tải file lên...' };
  }
  if (ratio < 0.25) {
    return { percent: Math.max(percent, 24), label: 'Đang trích text/OCR từ PDF...' };
  }
  if (ratio < 0.72) {
    return { percent: Math.max(percent, 42), label: 'AI đang tách câu hỏi, đáp án và lời giải...' };
  }
  return { percent, label: 'Đang chuẩn hóa công thức và dựng bản xem trước...' };
}

export default function PdfImportPanel({
  canImport,
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
  const activeRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedOutRef = useRef(false);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

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
    progressIntervalRef.current = setInterval(() => {
      const nextStep = getPreviewProgress(Date.now() - startedAt);
      setProgress(nextStep.percent);
      setProgressLabel(nextStep.label);
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
      const nextPreview = await examAdminApi.previewPdfImport(file, preset, controller.signal);
      if (activeRequestRef.current !== requestId || controller.signal.aborted) return;

      stopProgress();
      setProgress(100);
      setProgressLabel('Hoàn tất, đang dựng bản xem trước...');
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
            Upload PDF dạng text, PDF đã OCR hoặc Word .doc/.docx để AI tách câu hỏi, đáp án và giải thích. PDF scan ảnh thuần vẫn cần OCR ảnh ở bước sau.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {PDF_IMPORT_PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPreset(option.key)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                preset === option.key
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-snug text-gray-500">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <input
              type="file"
              accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                if (loading) handleCancelPreview();
                setFile(event.target.files?.[0] || null);
                setErrorMessage('');
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
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">Đang dùng AI phân tích file...</p>
                  <span className="shrink-0 text-xs font-bold text-blue-700">{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-blue-700">{progressLabel}</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-700">
                  AI đang tách câu hỏi, đáp án, lời giải và chỉnh lại công thức. File PDF/Word dài có thể mất vài phút, vui lòng giữ nguyên trang này.
                </p>
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
