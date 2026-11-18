'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiDownload,
  FiFileText,
  FiLock,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import MobilePdfViewer from '@/components/materials/MobilePdfViewer';
import type {
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalUnitFileDto,
} from '@/lib/types/courses';

export function formatExternalFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdfDocument(file: ExternalUnitFileDto, mimeType: string, resolvedName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime.includes('pdf')
    || file.isSlide === true
    || file.fileKind === 'slide'
    || /\.pdf$/i.test(resolvedName || file.fileName);
}

export function isImageDocument(file: ExternalUnitFileDto, mimeType: string, resolvedName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/svg+xml') return false;
  return mime.startsWith('image/')
    || file.fileKind === 'image'
    || /\.(png|jpe?g|webp|gif|bmp)$/i.test(resolvedName || file.fileName);
}

export function FileWatermarkOverlay({ label }: { label: string }) {
  const tiles = useMemo(() => Array.from({ length: 12 }, (_, idx) => idx), []);
  if (!label) return null;
  return (
    <div
      aria-hidden="true"
      data-file-watermark
      className="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden"
    >
      <div className="grid h-full w-full grid-cols-2 gap-8 p-6 opacity-[0.14] sm:grid-cols-3">
        {tiles.map((idx) => (
          <div key={idx} className="flex items-center justify-center">
            <span className="-rotate-[24deg] whitespace-nowrap text-center text-xs font-black tracking-wide text-slate-900 dark:text-white sm:text-sm">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 rounded-lg bg-slate-950/75 px-3 py-1 text-[11px] font-bold text-white/90 shadow-sm backdrop-blur">
        <span className="inline-flex items-center gap-1.5">
          <FiShield className="text-amber-300" /> {label}
        </span>
      </div>
    </div>
  );
}

interface ProtectedExternalDocumentBodyProps {
  file: ExternalUnitFileDto;
  stream: ExternalFileStreamResult | null;
  loading: boolean;
  downloadProgress?: ExternalFileDownloadProgress | null;
  error: string;
  errorCode: string | null;
  viewerError: string;
  canDownload: boolean;
  downloading: boolean;
  watermarkLabel: string;
  fullPage?: boolean;
  onRetry: () => void;
  onDownload: () => void;
  onViewerError: (msg: string) => void;
}

export function ProtectedExternalDocumentBody({
  file,
  stream,
  loading,
  downloadProgress = null,
  error,
  errorCode,
  viewerError,
  canDownload,
  downloading,
  watermarkLabel,
  fullPage = false,
  onRetry,
  onDownload,
  onViewerError,
}: ProtectedExternalDocumentBodyProps) {
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [pdfRendering, setPdfRendering] = useState(false);
  const showWatermark = !canDownload || file.allowDownload === false;

  useEffect(() => {
    if (!stream) {
      setImageObjectUrl(null);
      return undefined;
    }
    if (!isImageDocument(file, stream.mimeType, stream.fileName)) {
      setImageObjectUrl(null);
      return undefined;
    }
    const blob = new Blob([stream.data], { type: stream.mimeType || 'image/png' });
    const url = URL.createObjectURL(blob);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, stream]);

  useEffect(() => {
    if (canDownload) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['s', 'p'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDownload]);

  const isPdf = stream ? isPdfDocument(file, stream.mimeType, stream.fileName) : false;
  const isImage = stream ? isImageDocument(file, stream.mimeType, stream.fileName) : false;

  useEffect(() => {
    setPdfRendering(Boolean(stream && isPdf));
  }, [isPdf, stream]);

  const knownTotal = downloadProgress?.totalBytes || file.sizeBytes || 0;
  const loadedBytes = downloadProgress?.loadedBytes || 0;
  const progressPercent = downloadProgress?.percent ?? (knownTotal > 0 && loadedBytes > 0
    ? Math.min(99, Math.round((loadedBytes / knownTotal) * 100))
    : null);
  const phaseLabel = downloadProgress?.phase === 'authenticating'
    ? 'Đang xác thực quyền truy cập & thông tin tài liệu...'
    : downloadProgress?.phase === 'connecting'
      ? 'Đang kết nối máy chủ tài liệu...'
      : downloadProgress?.phase === 'rendering'
        ? 'Đã tải xong dữ liệu, đang dựng trang tài liệu...'
        : 'Đang tải tài liệu bảo mật...';

  return (
    <div
      className={`relative flex flex-1 flex-col bg-slate-100 dark:bg-[#071225] ${isPdf && stream ? 'min-h-0 overflow-hidden' : 'overflow-auto'} ${!canDownload ? 'select-none print:hidden' : ''}`}
      onContextMenu={(event) => {
        if (!canDownload) event.preventDefault();
      }}
    >
      {loading ? (
        <div className="flex h-full min-h-72 flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-2xl border border-[#e3d7cb] bg-white/95 p-6 shadow-lg dark:border-[#2a3950] dark:bg-[#0f1d33]/95">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#247d7e]/10 text-[#247d7e] dark:bg-[#247d7e]/20 dark:text-[#6ac6bd]">
              <FiFileText className="h-6 w-6" />
            </div>
            <p className="mt-3 truncate text-sm font-black text-[#18243b] dark:text-white">
              {file.title || file.fileName || 'Tài liệu học tập'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#5a667d] dark:text-slate-300">
              {phaseLabel}
            </p>

            <div className="mt-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                {progressPercent !== null ? (
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#247d7e] to-[#34b3a0] transition-all duration-200 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
                  />
                ) : (
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-gradient-to-r from-[#247d7e] to-[#34b3a0]" />
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs font-bold text-[#414c61] dark:text-slate-300">
                <span>
                  {loadedBytes > 0 && knownTotal > 0
                    ? `${formatExternalFileSize(loadedBytes)} / ${formatExternalFileSize(knownTotal)}`
                    : loadedBytes > 0
                      ? `Đã tải ${formatExternalFileSize(loadedBytes)}`
                      : knownTotal > 0
                        ? `Dung lượng: ${formatExternalFileSize(knownTotal)}`
                        : 'Đang chuẩn bị dữ liệu...'}
                </span>
                <span className="tabular-nums text-[#247d7e] dark:text-[#6ac6bd]">
                  {progressPercent !== null ? `${progressPercent}%` : '...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <FiAlertTriangle className="h-10 w-10 text-red-500" />
          <p className="max-w-md text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
          {errorCode ? <p className="text-xs text-slate-500">Mã lỗi: {errorCode}</p> : null}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {errorCode === 'DEVICE_BINDING_REVOKED' || errorCode === 'UNTRUSTED_DEVICE_PROOF' ? (
              <Link href="/login" className="rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white">
                Đăng nhập lại
              </Link>
            ) : (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-4 py-2 text-xs font-black text-white"
              >
                <FiRefreshCw /> Thử lại
              </button>
            )}
          </div>
        </div>
      ) : stream ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {viewerError ? (
            <p role="alert" className="m-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {viewerError}
            </p>
          ) : null}

          {isPdf ? (
            <div className={`relative flex min-h-0 flex-1 flex-col p-2 sm:p-4 ${fullPage ? 'mx-auto w-full max-w-6xl' : ''}`}>
              <MobilePdfViewer
                data={stream.data}
                title={file.title || file.fileName}
                className="h-full min-h-0"
                scrollContainerOnly
                onReady={() => setPdfRendering(false)}
                onError={(msg) => {
                  setPdfRendering(false);
                  onViewerError(msg);
                }}
              />
              {pdfRendering ? (
                <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Đang dựng trang PDF để hiển thị...
                  </div>
                </div>
              ) : null}
              {showWatermark ? <FileWatermarkOverlay label={watermarkLabel} /> : null}
            </div>
          ) : isImage && imageObjectUrl ? (
            <div className="relative flex flex-1 items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageObjectUrl}
                alt={file.title || file.fileName}
                draggable={false}
                className={`${fullPage ? 'max-h-[calc(100svh-9rem)]' : 'max-h-[76svh]'} max-w-full rounded-xl object-contain shadow-lg select-none`}
              />
              {showWatermark ? <FileWatermarkOverlay label={watermarkLabel} /> : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#247d7e]/15 text-3xl text-[#247d7e]">
                <FiFileText />
              </span>
              <h4 className="mt-4 text-lg font-black text-[#18243b] dark:text-white">
                {file.title || file.fileName}
              </h4>
              <p className="mt-2 max-w-md text-xs leading-6 text-[#6f665f] dark:text-slate-400">
                Định dạng tệp ({stream.mimeType || 'tệp đính kèm'}) chưa hỗ trợ xem trực tiếp trên trình duyệt.
              </p>
              {canDownload ? (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={downloading}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#247d7e] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#1b6465] disabled:opacity-50"
                >
                  <FiDownload /> {downloading ? 'Đang tải...' : 'Tải tài liệu về máy'}
                </button>
              ) : (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                  <FiLock /> Chế độ chỉ xem · Quyền tải xuống đang bị khóa đối với tài liệu này.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
