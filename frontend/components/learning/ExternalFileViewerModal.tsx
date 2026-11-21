'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import { MOLY_ZALO_DISPLAY } from '@/lib/constants/moly';
import { useAuthStore } from '@/lib/store/authStore';
import type {
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalUnitFileDto,
} from '@/lib/types/courses';
import {
  ExternalDocumentViewerHeader,
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
  const [downloadProgress, setDownloadProgress] = useState<ExternalFileDownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageInfo, setPageInfo] = useState<{ currentPage: number; pageCount: number }>({ currentPage: 1, pageCount: 0 });

  useEffect(() => {
    if (!open) return undefined;
    setZoom(1);
    setPageInfo({ currentPage: 1, pageCount: 0 });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [file?.id, onClose, open]);

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
      setDownloadProgress(null);
      setError('');
      setErrorCode(null);
      setViewerError('');
      return undefined;
    }
    if (file.allowView === false) {
      setStream(null);
      setDownloadProgress(null);
      setErrorCode('FILE_VIEW_DISABLED');
      setError('Tài liệu này hiện không cho phép xem trực tuyến.');
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setDownloadProgress({
      phase: 'connecting',
      loadedBytes: 0,
      totalBytes: Number(file.sizeBytes || 0),
      percent: file.sizeBytes > 0 ? 0 : null,
    });
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
      knownSizeBytes: file.sizeBytes,
      onProgress: (progress) => {
        if (active) setDownloadProgress(progress);
      },
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
          setError(`Bạn chưa mua khóa học này nhaa 💛 Nhắn Zalo admin ${MOLY_ZALO_DISPLAY} để được hỗ trợ mở khóa nhé.`);
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
      className="fixed inset-0 z-[1200] flex h-dvh w-screen flex-col overflow-hidden bg-[#0f172a] text-white"
    >
      <ExternalDocumentViewerHeader
        title={file.title || file.fileName}
        fileName={file.fileName}
        canDownload={canDownload}
        downloading={downloading}
        loading={loading}
        zoom={zoom}
        pageInfo={pageInfo}
        showZoomControls={Boolean(stream)}
        onZoomChange={setZoom}
        onDownload={() => void handleDownload()}
        onOpenInNewTab={courseSlug && profileId && file.allowView !== false ? handleOpenInNewTab : undefined}
        onClose={onClose}
        closeLabel="Đóng"
      />

      <ProtectedExternalDocumentBody
        file={file}
        stream={stream}
        loading={loading}
        downloadProgress={downloadProgress}
        error={error}
        errorCode={errorCode}
        viewerError={viewerError}
        canDownload={canDownload}
        downloading={downloading}
        watermarkLabel={watermarkLabel}
        fullPage
        zoom={zoom}
        onZoomChange={setZoom}
        onPageInfoChange={setPageInfo}
        onRetry={() => setReloadNonce((n) => n + 1)}
        onDownload={() => void handleDownload()}
        onViewerError={setViewerError}
      />
    </div>
  );
}
