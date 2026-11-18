'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiX,
} from 'react-icons/fi';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import { useAuthStore } from '@/lib/store/authStore';
import type { ExternalFileStreamResult, ExternalUnitFileDto } from '@/lib/types/courses';
import MobilePdfViewer from '@/components/materials/MobilePdfViewer';

export interface ExternalFileViewerModalProps {
  open: boolean;
  file: ExternalUnitFileDto | null;
  profileId: string | null;
  unitId: string | number;
  profileAllowsDownload: boolean;
  isPublicPreviewAccess: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfDocument(file: ExternalUnitFileDto, mimeType: string, resolvedName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime.includes('pdf')
    || file.isSlide === true
    || file.fileKind === 'slide'
    || /\.pdf$/i.test(resolvedName || file.fileName);
}

function isImageDocument(file: ExternalUnitFileDto, mimeType: string, resolvedName: string): boolean {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/svg+xml') return false;
  return mime.startsWith('image/')
    || file.fileKind === 'image'
    || /\.(png|jpe?g|webp|gif|bmp)$/i.test(resolvedName || file.fileName);
}

function WatermarkOverlay({ label }: { label: string }) {
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

export function ExternalFileViewerModal({
  open,
  file,
  profileId,
  unitId,
  profileAllowsDownload,
  isPublicPreviewAccess,
  onClose,
}: ExternalFileViewerModalProps) {
  const user = useAuthStore((state) => state.user);
  const [stream, setStream] = useState<ExternalFileStreamResult | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const canDownload = Boolean(
    file
    && !isPublicPreviewAccess
    && file.allowDownload === true
    && file.allowDownloadOverride !== false
    && (profileAllowsDownload || file.allowDownloadOverride === true),
  );
  const showWatermark = Boolean(file && (!canDownload || file.allowDownload === false));

  const watermarkLabel = useMemo(() => {
    if (isPublicPreviewAccess || !user) return 'Moly Preview';
    const name = user?.full_name || user?.display_name || user?.username || 'Học viên Moly';
    const email = user?.email || '';
    const idStr = user?.id != null ? `ID #${user.id}` : '';
    return [name, email, idStr].filter(Boolean).join(' · ');
  }, [isPublicPreviewAccess, user]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !file || !profileId) {
      setStream(null);
      setError('');
      setErrorCode(null);
      setViewerError('');
      return undefined;
    }
    if (file.allowView === false) {
      setStream(null);
      setErrorCode('FILE_VIEW_DISABLED');
      setError('Tài liệu này hiện không cho phép xem trực tuyến.');
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    setErrorCode(null);
    setViewerError('');
    setStream(null);

    learningApi.fetchExternalFileStream({
      profileId,
      unitId,
      fileId: file.id,
      disposition: 'inline',
      fallbackFileName: file.fileName,
      signal: controller.signal,
    })
      .then((res) => {
        if (!active) return;
        setStream(res);
      })
      .catch((err) => {
        if (!active) return;
        if ((err as { name?: string; code?: string })?.name === 'CanceledError'
          || (err as { code?: string })?.code === 'ERR_CANCELED') {
          return;
        }
        const parsed = parseExternalApiError(err, 'Không thể tải nội dung tài liệu.');
        setErrorCode(parsed.code);
        if (parsed.code === 'DEVICE_BINDING_REVOKED' || parsed.code === 'UNTRUSTED_DEVICE_PROOF') {
          setError('Phiên thiết bị đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại để tiếp tục.');
        } else if (parsed.code === 'COURSE_ACCESS_REVOKED' || parsed.code === 'ENTITLEMENT_REQUIRED' || parsed.status === 403) {
          setError(parsed.message || 'Bạn không có quyền xem tài liệu này hoặc quyền truy cập đã hết hạn.');
        } else {
          setError(parsed.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [file, open, profileId, reloadNonce, unitId]);

  useEffect(() => {
    if (!stream || !file) {
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
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, stream]);

  const handleDownload = useCallback(async () => {
    if (!file || !profileId || !canDownload || downloading) return;
    try {
      setDownloading(true);
      setViewerError('');
      await learningApi.downloadExternalFile({
        profileId,
        unitId,
        fileId: file.id,
        fallbackFileName: file.fileName,
      });
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải tài liệu lúc này.');
      setViewerError(parsed.message);
    } finally {
      setDownloading(false);
    }
  }, [canDownload, downloading, file, profileId, unitId]);

  const handleOpenInNewTab = useCallback(() => {
    if (!stream || loading) return;
    learningApi.openStreamBlobInNewTab(stream);
  }, [loading, stream]);

  if (!open || !file) return null;

  const isPdf = stream ? isPdfDocument(file, stream.mimeType, stream.fileName) : false;
  const isImage = stream ? isImageDocument(file, stream.mimeType, stream.fileName) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={file.title || file.fileName}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#d9cabc] bg-[#fffaf4] shadow-2xl dark:border-[#2d3b52] dark:bg-[#0b172b]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5d9ce] bg-[#fffdf9] px-4 py-3 dark:border-[#2d3b52] dark:bg-[#101e33] sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-[#18243b] dark:text-white">
                {file.title || file.fileName}
              </h3>
              {file.isSlide ? (
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-black text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                  Slide
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-[#6f665f] dark:text-slate-400">
              {file.fileName} · {formatFileSize(stream?.sizeBytes || file.sizeBytes)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {stream && !loading ? (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#247d7e] bg-white px-3.5 py-2 text-xs font-black text-[#247d7e] transition hover:bg-[#eff9f7] dark:bg-[#0b172b] dark:text-[#6ac6bd]"
              >
                <FiExternalLink /> Mở tab mới
              </button>
            ) : null}
            {canDownload ? (
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading || loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1b6465] disabled:opacity-50"
              >
                <FiDownload />
                {downloading ? 'Đang tải...' : 'Tải xuống'}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                <FiLock /> Chỉ xem · Khóa tải về
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình xem tài liệu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8c8b9] bg-white text-[#29354b] transition hover:bg-slate-100 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          className="relative flex-1 overflow-auto bg-slate-100 dark:bg-[#071225]"
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
                    onClick={() => setReloadNonce((n) => n + 1)}
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
                <div className="relative flex-1 p-2 sm:p-4">
                  <MobilePdfViewer
                    data={stream.data}
                    title={file.title || file.fileName}
                    className="!min-h-[72svh]"
                    scrollContainerOnly
                    onError={(msg) => setViewerError(msg)}
                  />
                  {showWatermark ? <WatermarkOverlay label={watermarkLabel} /> : null}
                </div>
              ) : isImage && imageObjectUrl ? (
                <div className="relative flex flex-1 items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageObjectUrl}
                    alt={file.title || file.fileName}
                    draggable={false}
                    className="max-h-[76svh] max-w-full rounded-xl object-contain shadow-lg select-none"
                  />
                  {showWatermark ? <WatermarkOverlay label={watermarkLabel} /> : null}
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
                      onClick={() => void handleDownload()}
                      disabled={downloading}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#247d7e] px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#1b6465] disabled:opacity-50"
                    >
                      <FiDownload /> {downloading ? 'Đang tải...' : 'Tải tài liệu về máy'}
                    </button>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                      <FiLock /> Quyền tải xuống đang bị khóa đối với tài liệu này.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
