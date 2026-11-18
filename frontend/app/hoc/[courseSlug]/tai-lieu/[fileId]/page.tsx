'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiDownload, FiLock } from 'react-icons/fi';
import learningApi, { parseExternalApiError } from '@/lib/api/learning';
import { useAuthStore } from '@/lib/store/authStore';
import type {
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalUnitFileDto,
} from '@/lib/types/courses';
import {
  formatExternalFileSize,
  ProtectedExternalDocumentBody,
} from '@/components/learning/ProtectedExternalDocumentView';

export default function ProtectedExternalDocumentPage({
  params,
}: {
  params: Promise<{ courseSlug: string; fileId: string }>;
}) {
  const { courseSlug, fileId } = use(params);
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

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f5efe6] dark:bg-[#071225]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5d9ce] bg-[#fffdf9] px-4 py-3 shadow-sm dark:border-[#2d3b52] dark:bg-[#101e33] sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-3 py-2 text-xs font-black text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200"
          >
            <FiArrowLeft /> Quay lại bài học
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black text-[#18243b] dark:text-white sm:text-base">
              {file?.title || file?.fileName || 'Trình xem tài liệu bảo mật'}
            </h1>
            {file ? (
              <p className="truncate text-xs text-[#6f665f] dark:text-slate-400">
                {file.fileName} · {formatExternalFileSize(stream?.sizeBytes || file.sizeBytes)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canDownload ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1b6465] disabled:opacity-50"
            >
              <FiDownload /> {downloading ? 'Đang tải...' : 'Tải xuống'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <FiLock /> Chỉ xem · Khóa tải về
            </span>
          )}
        </div>
      </header>

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
        onRetry={() => setReloadNonce((n) => n + 1)}
        onDownload={() => void handleDownload()}
        onViewerError={setViewerError}
      />
    </div>
  );
}
