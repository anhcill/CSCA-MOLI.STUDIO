'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDownload, FiExternalLink, FiLock, FiX } from 'react-icons/fi';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import { useAuthStore } from '@/lib/store/authStore';
import type { ExternalFileStreamResult, ExternalUnitFileDto } from '@/lib/types/courses';
import {
  formatExternalFileSize,
  ProtectedExternalDocumentBody,
} from './ProtectedExternalDocumentView';

export interface ExternalFileViewerModalProps {
  open: boolean;
  file: ExternalUnitFileDto | null;
  courseSlug?: string;
  profileId: string | null;
  unitId: string | number;
  profileAllowsDownload: boolean;
  isPublicPreviewAccess: boolean;
  onClose: () => void;
}

export function ExternalFileViewerModal({
  open,
  file,
  courseSlug,
  profileId,
  unitId,
  profileAllowsDownload,
  isPublicPreviewAccess,
  onClose,
}: ExternalFileViewerModalProps) {
  const user = useAuthStore((state) => state.user);
  const [stream, setStream] = useState<ExternalFileStreamResult | null>(null);
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
    if (!courseSlug || !profileId || !file || typeof window === 'undefined') return;
    const viewerPath = learningApi.buildExternalFileViewerPath({
      courseSlug,
      profileId,
      unitId,
      fileId: file.id,
    });
    window.open(viewerPath, '_blank', 'noopener,noreferrer');
  }, [courseSlug, file, profileId, unitId]);

  if (!open || !file) return null;

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
              {file.fileName} · {formatExternalFileSize(stream?.sizeBytes || file.sizeBytes)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {courseSlug && profileId && file.allowView !== false ? (
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

        <ProtectedExternalDocumentBody
          file={file}
          stream={stream}
          loading={loading}
          error={error}
          errorCode={errorCode}
          viewerError={viewerError}
          canDownload={canDownload}
          downloading={downloading}
          watermarkLabel={watermarkLabel}
          onRetry={() => setReloadNonce((n) => n + 1)}
          onDownload={() => void handleDownload()}
          onViewerError={setViewerError}
        />
      </div>
    </div>
  );
}
