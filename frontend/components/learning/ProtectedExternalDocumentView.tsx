'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import MobilePdfViewer, {
  PDF_MAX_ZOOM,
  PDF_MIN_ZOOM,
  PDF_ZOOM_STEP,
} from '@/components/materials/MobilePdfViewer';
import type {
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalUnitFileDto,
} from '@/lib/types/courses';

export interface ExternalDocumentViewerHeaderProps {
  title: string;
  fileName?: string;
  canDownload: boolean;
  downloading?: boolean;
  loading?: boolean;
  zoom?: number;
  pageInfo?: { currentPage: number; pageCount: number };
  showZoomControls?: boolean;
  onZoomChange?: (nextZoom: number) => void;
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
  onClose?: () => void;
  closeLabel?: string;
}

export function ExternalDocumentViewerHeader({
  title,
  fileName,
  canDownload,
  downloading = false,
  loading = false,
  zoom = 1,
  pageInfo,
  showZoomControls = true,
  onZoomChange,
  onDownload,
  onOpenInNewTab,
  onClose,
  closeLabel = 'Đóng',
}: ExternalDocumentViewerHeaderProps) {
  const displayTitle = fileName || title || 'Tài liệu học tập';
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[#334155] bg-[#0f172a] px-4 text-white">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {!canDownload ? (
          <span className="shrink-0 rounded-full border border-[#38bdf8] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#7dd3fc]">
            CHỈ XEM
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-emerald-400/70 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-emerald-300">
            TÀI LIỆU
          </span>
        )}
        <strong className="min-w-0 truncate text-sm font-bold text-slate-100" title={displayTitle}>
          {displayTitle}
        </strong>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pageInfo && pageInfo.pageCount > 0 ? (
          <span className="hidden rounded-md bg-[#1e293b]/80 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-300 sm:inline-block">
            Trang {pageInfo.currentPage}/{pageInfo.pageCount}
          </span>
        ) : null}

        {showZoomControls && onZoomChange ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onZoomChange(Number(Math.max(PDF_MIN_ZOOM, zoom - PDF_ZOOM_STEP).toFixed(2)))}
              disabled={zoom <= PDF_MIN_ZOOM}
              aria-label="Thu nhỏ"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#334155] bg-[#1e293b] text-sm font-bold text-white transition hover:bg-[#334155] disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(1)}
              title="Đặt lại 100%"
              className="min-w-[48px] text-center text-xs font-bold tabular-nums text-slate-200 hover:text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Number(Math.min(PDF_MAX_ZOOM, zoom + PDF_ZOOM_STEP).toFixed(2)))}
              disabled={zoom >= PDF_MAX_ZOOM}
              aria-label="Phóng to"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#334155] bg-[#1e293b] text-sm font-bold text-white transition hover:bg-[#334155] disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : null}

        {canDownload && onDownload ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading || loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#14b8a6]/60 bg-[#0d9488] px-3 text-xs font-bold text-white transition hover:bg-[#0f766e] disabled:opacity-50"
          >
            <FiDownload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{downloading ? 'Đang tải...' : 'Tải xuống'}</span>
          </button>
        ) : null}

        {onOpenInNewTab ? (
          <button
            type="button"
            onClick={onOpenInNewTab}
            title="Mở tab mới"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#334155] bg-[#1e293b] px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-[#334155]"
          >
            <FiExternalLink className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Tab mới</span>
          </button>
        ) : null}

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[#334155] bg-[#1e293b] px-3.5 text-xs font-bold text-white transition hover:bg-[#334155]"
          >
            {closeLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

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
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onPageInfoChange?: (info: { currentPage: number; pageCount: number }) => void;
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
  zoom,
  onZoomChange,
  onPageInfoChange,
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
      className={`relative flex min-h-0 flex-1 flex-col bg-[#1e1e1e] text-white ${isPdf && stream ? 'overflow-hidden' : 'overflow-auto'} ${!canDownload ? 'select-none print:hidden' : ''}`}
      onContextMenu={(event) => {
        if (!canDownload) event.preventDefault();
      }}
    >
      {loading ? (
        <div className="flex h-full min-h-72 flex-col items-center justify-center bg-[#0f172a] p-6 text-center">
          <div className="w-full max-w-md rounded-2xl border border-[#334155] bg-[#1e293b]/90 p-6 shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-[#7dd3fc]">
              <FiFileText className="h-6 w-6" />
            </div>
            <p className="mt-3 truncate text-sm font-black text-white">
              {file.title || file.fileName || 'Tài liệu học tập'}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-300">
              {phaseLabel}
            </p>

            <div className="mt-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                {progressPercent !== null ? (
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#2dd4bf] transition-all duration-200 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
                  />
                ) : (
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#2dd4bf]" />
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs font-bold text-slate-300">
                <span>
                  {loadedBytes > 0 && knownTotal > 0
                    ? `${formatExternalFileSize(loadedBytes)} / ${formatExternalFileSize(knownTotal)}`
                    : loadedBytes > 0
                      ? `Đã tải ${formatExternalFileSize(loadedBytes)}`
                      : knownTotal > 0
                        ? `Dung lượng: ${formatExternalFileSize(knownTotal)}`
                        : 'Đang chuẩn bị dữ liệu...'}
                </span>
                <span className="tabular-nums text-[#7dd3fc]">
                  {progressPercent !== null ? `${progressPercent}%` : '...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 bg-[#0f172a] p-6 text-center">
          <FiAlertTriangle className="h-10 w-10 text-red-400" />
          <p className="max-w-md text-sm font-bold text-red-300">{error}</p>
          {errorCode ? <p className="text-xs text-slate-400">Mã lỗi: {errorCode}</p> : null}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {errorCode === 'DEVICE_BINDING_REVOKED' || errorCode === 'UNTRUSTED_DEVICE_PROOF' ? (
              <Link href="/login" className="rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white">
                Đăng nhập lại
              </Link>
            ) : (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0d9488] px-4 py-2 text-xs font-black text-white"
              >
                <FiRefreshCw /> Thử lại
              </button>
            )}
          </div>
        </div>
      ) : stream ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {viewerError ? (
            <p role="alert" className="m-3 rounded-xl bg-red-950/50 px-3 py-2 text-xs font-bold text-red-300">
              {viewerError}
            </p>
          ) : null}

          {isPdf ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MobilePdfViewer
                data={stream.data}
                title={file.title || file.fileName}
                className="h-full min-h-0"
                scrollContainerOnly
                hideToolbar={typeof onZoomChange === 'function'}
                darkCanvasSurface
                zoom={zoom}
                onZoomChange={onZoomChange}
                onPageInfoChange={onPageInfoChange}
                onReady={() => setPdfRendering(false)}
                onError={(msg) => {
                  setPdfRendering(false);
                  onViewerError(msg);
                }}
              />
              {pdfRendering ? (
                <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center px-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Đang dựng trang PDF để hiển thị...
                  </div>
                </div>
              ) : null}
              {showWatermark ? <FileWatermarkOverlay label={watermarkLabel} /> : null}
            </div>
          ) : isImage && imageObjectUrl ? (
            <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[#1e1e1e] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageObjectUrl}
                alt={file.title || file.fileName}
                draggable={false}
                style={zoom && Math.abs(zoom - 1) > 0.01 ? { transform: `scale(${zoom})`, transformOrigin: 'center' } : undefined}
                className={`${fullPage ? 'max-h-[calc(100svh-5rem)]' : 'max-h-[calc(100svh-5rem)]'} max-w-full rounded-sm object-contain shadow-2xl select-none transition-transform`}
              />
              {showWatermark ? <FileWatermarkOverlay label={watermarkLabel} /> : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-[#0f172a] p-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#38bdf8]/15 text-3xl text-[#7dd3fc]">
                <FiFileText />
              </span>
              <h4 className="mt-4 text-lg font-black text-white">
                {file.title || file.fileName}
              </h4>
              <p className="mt-2 max-w-md text-xs leading-6 text-slate-300">
                Định dạng tệp ({stream.mimeType || 'tệp đính kèm'}) chưa hỗ trợ xem trực tiếp trên trình duyệt.
              </p>
              {canDownload ? (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={downloading}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50"
                >
                  <FiDownload /> {downloading ? 'Đang tải...' : 'Tải tài liệu về máy'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
