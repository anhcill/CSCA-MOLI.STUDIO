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
import type { ExternalFileStreamResult, ExternalUnitFileDto } from '@/lib/types/courses';

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

  return (
    <div
      className={`relative flex-1 overflow-auto bg-slate-100 dark:bg-[#071225] ${!canDownload ? 'select-none print:hidden' : ''}`}
      onContextMenu={(event) => {
        if (!canDownload) event.preventDefault();
      }}
    >
      {loading ? (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#247d7e]/25 border-t-[#247d7e]" />
          <p className="text-sm font-bold text-[#414c61] dark:text-slate-300">
            Đang tải tài liệu bảo mật...
          </p>
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
        <div className="relative flex h-full min-h-full flex-col">
          {viewerError ? (
            <p role="alert" className="m-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {viewerError}
            </p>
          ) : null}

          {isPdf ? (
            <div className={`relative flex-1 p-2 sm:p-4 ${fullPage ? 'mx-auto w-full max-w-5xl' : ''}`}>
              <MobilePdfViewer
                data={stream.data}
                title={file.title || file.fileName}
                className={fullPage ? '!min-h-[calc(100svh-8rem)]' : '!min-h-[72svh]'}
                scrollContainerOnly
                onError={onViewerError}
              />
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
