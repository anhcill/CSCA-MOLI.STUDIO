'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import { useAuthStore } from '@/lib/store/authStore';
import type {
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalUnitFileDto,
} from '@/lib/types/courses';
import {
  ExternalDocumentViewerHeader,
  ProtectedExternalDocumentBody,
} from '@/components/learning/ProtectedExternalDocumentView';

export default function ProtectedExternalDocumentPage({
  params,
}: {
  params: Promise<{ courseSlug: string; fileId: string }>;
}) {
  const { courseSlug, fileId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileIdParam = searchParams.get('profileId');
  const unitIdParam = searchParams.get('unitId') || '';

  const user = useAuthStore((state) => state.user);
  const [file, setFile] = useState<ExternalUnitFileDto | null>(null);
  const [resolvedProfileId, setResolvedProfileId] = useState<string | null>(profileIdParam);
  const [profileAllowsDownload, setProfileAllowsDownload] = useState(false);
  const [isPublicPreviewAccess, setIsPublicPreviewAccess] = useState(false);
  const [stream, setStream] = useState<ExternalFileStreamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<ExternalFileDownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageInfo, setPageInfo] = useState<{ currentPage: number; pageCount: number }>({ currentPage: 1, pageCount: 0 });

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
    const controller = new AbortController();
    let active = true;

    async function loadDocument() {
      if (!unitIdParam) {
        setLoading(false);
        setErrorCode('VALIDATION_ERROR');
        setError('Thiếu thông tin bài học để mở tài liệu bảo mật.');
        return;
      }
      setLoading(true);
      setDownloadProgress({
        phase: 'authenticating',
        loadedBytes: 0,
        totalBytes: 0,
        percent: null,
      });
      setError('');
      setErrorCode(null);
      setViewerError('');
      setStream(null);

      try {
        const fetchWorkspace = () => learningApi.getExternalCourseWorkspace({
          courseSlugOrId: courseSlug,
          profileId: profileIdParam,
          unitId: unitIdParam,
          timeoutMs: 60000,
          signal: controller.signal,
        });
        let ws;
        try {
          ws = await fetchWorkspace();
        } catch (wsErr) {
          const axErr = wsErr as { name?: string; code?: string; message?: string; response?: { status?: number } };
          const status = Number(axErr?.response?.status || 0);
          const transient = axErr?.code === 'ECONNABORTED'
            || axErr?.code === 'ERR_NETWORK'
            || status === 502
            || status === 503
            || status === 504
            || /timeout/i.test(String(axErr?.message || ''));
          if (!transient || controller.signal.aborted) throw wsErr;
          ws = await fetchWorkspace();
        }
        if (!active) return;

        const targetProfileId = ws.profile?.remoteProfileId || profileIdParam;
        setResolvedProfileId(targetProfileId);
        setProfileAllowsDownload(ws.profile?.capabilities?.allowFileDownload === true && !ws.isPublicPreviewAccess);
        setIsPublicPreviewAccess(Boolean(ws.isPublicPreviewAccess));

        const matchedFile = (ws.activeUnit?.files || []).find(
          (item) => String(item.id) === String(fileId),
        );
        if (!matchedFile) {
          setErrorCode('FILE_NOT_FOUND');
          setError('Không tìm thấy tài liệu trong bài học này hoặc bạn chưa được mở khóa bài học.');
          setLoading(false);
          return;
        }
        setFile(matchedFile);

        if (matchedFile.allowView === false) {
          setErrorCode('FILE_VIEW_DISABLED');
          setError('Tài liệu này hiện không cho phép xem trực tuyến.');
          setLoading(false);
          return;
        }
        if (!targetProfileId) {
          setErrorCode('PROFILE_NOT_FOUND');
          setError('Không xác định được lộ trình học của tài liệu.');
          setLoading(false);
          return;
        }

        const loadedStream = await learningApi.fetchExternalFileStream({
          profileId: targetProfileId,
          unitId: ws.activeUnit?.id || unitIdParam,
          fileId: matchedFile.id,
          disposition: 'inline',
          fallbackFileName: matchedFile.fileName,
          knownSizeBytes: matchedFile.sizeBytes,
          onProgress: (progress) => {
            if (active) setDownloadProgress(progress);
          },
          signal: controller.signal,
        });
        if (!active) return;
        setStream(loadedStream);
      } catch (err) {
        if (!active) return;
        if ((err as { name?: string; code?: string })?.name === 'CanceledError'
          || (err as { code?: string })?.code === 'ERR_CANCELED') {
          return;
        }
        const parsed = parseExternalApiError(err, 'Không thể mở tài liệu bảo mật.');
        setErrorCode(parsed.code);
        setError(parsed.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDocument();
    return () => {
      active = false;
      controller.abort();
    };
  }, [courseSlug, fileId, profileIdParam, reloadNonce, unitIdParam]);

  const handleDownload = useCallback(async () => {
    if (!file || !resolvedProfileId || !canDownload || downloading) return;
    try {
      setDownloading(true);
      setViewerError('');
      await learningApi.downloadExternalFile({
        profileId: resolvedProfileId,
        unitId: unitIdParam,
        fileId: file.id,
        fallbackFileName: file.fileName,
      });
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải tài liệu lúc này.');
      setViewerError(parsed.message);
    } finally {
      setDownloading(false);
    }
  }, [canDownload, downloading, file, resolvedProfileId, unitIdParam]);

  const backHref = unitIdParam
    ? `/hoc/${encodeURIComponent(courseSlug)}/bai-hoc/${encodeURIComponent(unitIdParam)}${resolvedProfileId ? `?profileId=${encodeURIComponent(resolvedProfileId)}` : ''}`
    : `/khoa-hoc/${encodeURIComponent(courseSlug)}`;

  const handleClosePage = useCallback(() => {
    if (typeof window !== 'undefined' && window.opener) {
      window.close();
      return;
    }
    router.push(backHref);
  }, [backHref, router]);

  return (
    <div className="fixed inset-0 z-[1200] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#0f172a] text-white">
      <ExternalDocumentViewerHeader
        title={file?.title || file?.fileName || 'Trình xem tài liệu bảo mật'}
        fileName={file?.fileName}
        canDownload={canDownload}
        downloading={downloading}
        loading={loading}
        zoom={zoom}
        pageInfo={pageInfo}
        showZoomControls={Boolean(stream)}
        onZoomChange={setZoom}
        onDownload={() => void handleDownload()}
        onClose={handleClosePage}
        closeLabel="Đóng"
      />

      <ProtectedExternalDocumentBody
        file={file || {
          id: fileId,
          title: 'Tài liệu',
          fileName: 'document.pdf',
          mimeType: 'application/pdf',
          fileKind: 'document',
          sizeBytes: 0,
        }}
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
