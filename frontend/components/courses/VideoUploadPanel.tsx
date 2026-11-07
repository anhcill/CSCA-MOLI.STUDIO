'use client';

import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import axios from '@/lib/utils/axios';
import { BunnyUploadPanel } from './BunnyUploadPanel';
import {
  courseMediaApi,
  hashVideoFile,
  MAX_SINGLE_VIDEO_BYTES,
  putVideoToSignedUrl,
  videoContentType,
} from '@/lib/api/courseMedia';

type UploadStage = 'idle' | 'hashing' | 'uploading' | 'completing' | 'processing' | 'finalizing' | 'ready' | 'error';

export type VideoUploadProps = {
  courseId: number;
  lessonId: number;
  currentVideoAssetId?: number | null;
  onUploaded?: (videoAssetId: number) => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
};

export function VideoUploadPanel(props: VideoUploadProps) {
  const bunnyEnabled = process.env.NEXT_PUBLIC_BUNNY_STREAM_ENABLED === 'true';
  const [provider, setProvider] = useState<'r2' | 'bunny' | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setProvider(null);

    if (!props.currentVideoAssetId) {
      setProvider(bunnyEnabled ? 'bunny' : 'r2');
      return;
    }

    const assetId = props.currentVideoAssetId;
    const checkAsset = async () => {
      if (bunnyEnabled) {
        try {
          const response = await axios.get(`/admin/bunny-media/assets/${assetId}`);
          if (active) setProvider(response.data?.data?.provider || 'bunny');
          return;
        } catch (err) {
          if (!isAxiosError(err) || (err.response?.status !== 404 && err.response?.status !== 400)) {
            if (active) setFailed(true);
            return;
          }
        }
      }
      try {
        const fallback = await axios.get(`/admin/course-media/assets/${assetId}`);
        if (active) setProvider(fallback.data?.data?.provider || 'r2');
      } catch {
        if (active) setFailed(true);
      }
    };

    void checkAsset();
    return () => {
      active = false;
    };
  }, [props.currentVideoAssetId, props.lessonId, retry, bunnyEnabled]);

  if (!provider) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        {failed ? (
          <>
            <span className="text-red-600 dark:text-red-400">Chưa tải được trạng thái video hiện tại.</span>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Thử lại
            </button>
          </>
        ) : (
          <span className="animate-pulse">Đang kiểm tra trạng thái video của bài học...</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!props.currentVideoAssetId && bunnyEnabled ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900/70">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Phương thức lưu trữ & phát video:
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setProvider('bunny')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                provider === 'bunny'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              ☁️ Bunny Stream (Khuyên dùng - Tải trực tiếp trên web)
            </button>
            <button
              type="button"
              onClick={() => setProvider('r2')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                provider === 'r2'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Kho R2 (công cụ máy tính cũ)
            </button>
          </div>
        </div>
      ) : null}

      {provider === 'bunny' ? (
        <BunnyUploadPanel key={`bunny-${props.lessonId}`} {...props} />
      ) : (
        <LegacyVideoUploadPanel key={`r2-${props.lessonId}`} {...props} />
      )}
    </div>
  );
}

function LegacyVideoUploadPanel({
  courseId,
  lessonId,
  currentVideoAssetId,
  onUploaded,
  onDeleted,
}: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [videoAssetId, setVideoAssetId] = useState<number | null>(null);
  const [assetExternalKey, setAssetExternalKey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState('');
  const pendingKey = `r2-upload:${courseId}:${lessonId}`;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    try {
      const pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
      if (pending) {
        setPendingSessionId(pending.sessionId);
        setVideoAssetId(pending.videoAssetId);
        setAssetExternalKey(pending.assetExternalKey);
        setStage('error');
      }
    } catch {
      /* Ignore invalid local recovery metadata. */
    }
  }, [pendingKey]);

  useEffect(() => {
    if (!currentVideoAssetId) return;
    let active = true;
    void axios
      .get(`/admin/course-media/assets/${currentVideoAssetId}`)
      .then((response) => {
        if (!active) return;
        const asset = response.data.data;
        setVideoAssetId(asset.videoAssetId);
        setAssetExternalKey(asset.assetExternalKey);
        setStage(asset.status === 'ready' ? 'ready' : asset.status === 'processing' ? 'processing' : 'idle');
      })
      .catch(() => {
        if (active) setError('Chưa tải được trạng thái xử lý. Hãy mở lại bài để kiểm tra.');
      });
    return () => {
      active = false;
    };
  }, [currentVideoAssetId]);

  const selectFile = (next: File | null) => {
    setError('');
    setProgress(0);
    setStage('idle');
    if (!next) return setFile(null);
    if (!videoContentType(next)) {
      setFile(null);
      return setError('Chỉ chấp nhận video MP4 hoặc MOV.');
    }
    if (next.size <= 0 || next.size > MAX_SINGLE_VIDEO_BYTES) {
      setFile(null);
      return setError('Video phải lớn hơn 0 byte và không vượt quá 4 GiB.');
    }
    setFile(next);
  };

  const upload = async () => {
    if (!file || stage === 'hashing' || stage === 'uploading' || stage === 'completing') return;
    const contentType = videoContentType(file);
    if (!contentType) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    let createdAssetId: number | null = null;
    try {
      setStage('hashing');
      setProgress(0);
      const checksumSha256 = await hashVideoFile(file, setProgress, controller.signal);
      const session = await courseMediaApi.createUpload({
        courseId,
        lessonId,
        contentType,
        sizeBytes: file.size,
        checksumSha256,
      });
      createdAssetId = session.videoAssetId;
      localStorage.setItem(
        pendingKey,
        JSON.stringify({
          sessionId: session.sessionId,
          videoAssetId: session.videoAssetId,
          assetExternalKey: session.assetExternalKey,
        }),
      );
      setPendingSessionId(session.sessionId);
      setVideoAssetId(session.videoAssetId);
      setAssetExternalKey(session.assetExternalKey);
      setStage('uploading');
      setProgress(0);
      await putVideoToSignedUrl(session, file, setProgress, controller.signal);
      setStage('completing');
      const completed = await courseMediaApi.completeUpload(session.sessionId);
      localStorage.removeItem(pendingKey);
      setPendingSessionId('');
      setProgress(100);
      setStage('processing');
      setVideoAssetId(completed.videoAssetId);
      try {
        await onUploaded?.(completed.videoAssetId);
      } catch {
        setError(
          `Video đã tải lên với asset #${completed.videoAssetId}, nhưng chưa gắn được vào bài học. Không tải lại tệp; hãy thử lưu bài học lại.`,
        );
      }
    } catch (cause) {
      setError(
        createdAssetId
          ? `Chưa xác nhận hoàn tất asset #${createdAssetId}. Dữ liệu vẫn được giữ; kiểm tra trạng thái trước khi tải lại hoặc xóa.`
          : cause instanceof DOMException && cause.name === 'AbortError'
            ? 'Đã dừng tải.'
            : 'Không thể tạo phiên tải. Hãy kiểm tra kết nối.',
      );
      setStage('error');
    } finally {
      abortRef.current = null;
    }
  };

  const deleteVideo = async () => {
    const assetId = videoAssetId ?? currentVideoAssetId ?? null;
    if (!assetId || deleting || busy) return;
    const confirmed = window.confirm(
      `Xóa Asset #${assetId}? Video nguồn, toàn bộ HLS trên R2 và liên kết với bài học sẽ bị xóa. Không thể hoàn tác.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      await courseMediaApi.deleteAsset(assetId);
      localStorage.removeItem(pendingKey);
      setPendingSessionId('');
      setFile(null);
      setVideoAssetId(null);
      setAssetExternalKey('');
      setProgress(0);
      setStage('idle');
      await onDeleted?.();
    } catch {
      setError('Chưa thể xóa video. Hãy dừng công cụ xử lý video nếu đang chạy rồi thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const finalizeHls = async () => {
    if (!videoAssetId || stage === 'finalizing') return;
    setError('');
    setStage('finalizing');
    try {
      await courseMediaApi.finalizeHls(videoAssetId);
      setStage('ready');
    } catch {
      setError('Chưa tìm thấy đủ dữ liệu HLS trên R2. Hãy chờ công cụ trên máy chạy xong rồi thử lại.');
      setStage('processing');
    }
  };

  const transferBusy = stage === 'hashing' || stage === 'uploading' || stage === 'completing';
  const busy = transferBusy || stage === 'finalizing';
  const existingAssetId = videoAssetId ?? currentVideoAssetId ?? null;
  const mustDeleteBeforeUpload = Boolean(existingAssetId);
  const processingCode =
    videoAssetId && assetExternalKey ? `${courseId}:${lessonId}:${videoAssetId}:${assetExternalKey}` : '';
  const label =
    stage === 'hashing'
      ? `Đang tính SHA-256: ${progress}%`
      : stage === 'uploading'
        ? `Đang tải lên: ${progress}%`
        : stage === 'completing'
          ? 'Đang xác minh video...'
          : stage === 'finalizing'
            ? 'Đang kiểm tra HLS...'
            : stage === 'processing'
              ? 'Đã tải lên, đang chờ xử lý HLS.'
              : 'Tải video lên R2';

  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Kho R2 cũ
          </span>
          <h4 className="font-black text-slate-800 dark:text-slate-100">
            {currentVideoAssetId ? 'Video nguồn R2 hiện tại' : 'Gắn video qua Kho R2 (cần chạy tool trên máy tính)'}
          </h4>
        </div>
        {currentVideoAssetId ? (
          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Đang sử dụng asset #{currentVideoAssetId}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          MP4 hoặc MOV, tối đa 4 GiB. Lưu ý: kho R2 yêu cầu chạy thêm công cụ mã hóa HLS trên máy tính.
        </p>
        {mustDeleteBeforeUpload ? (
          <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            Muốn tải video khác, hãy xóa video hiện tại trước để giải phóng dung lượng R2.
          </p>
        ) : null}
      </div>

      <input
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        disabled={busy || deleting || stage === 'processing' || mustDeleteBeforeUpload}
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-2 file:font-bold file:text-slate-700 dark:text-slate-200 dark:file:border-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
        aria-describedby={`video-help-${lessonId}`}
      />
      <span id={`video-help-${lessonId}`} className="sr-only">
        Chọn một tệp MP4 hoặc MOV không quá 4 GiB.
      </span>
      {file ? (
        <p className="truncate text-sm text-slate-600 dark:text-slate-300">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
        </p>
      ) : null}
      {transferBusy ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {pendingSessionId ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setStage('completing');
              setError('');
              try {
                const result = await courseMediaApi.completeUpload(pendingSessionId);
                localStorage.removeItem(pendingKey);
                setPendingSessionId('');
                setStage('processing');
                await onUploaded?.(result.videoAssetId);
              } catch {
                setStage('error');
                setError('Chưa xác nhận được tệp đã tải đủ. Dữ liệu vẫn được giữ; kiểm tra kết nối rồi thử lại.');
              }
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            Kiểm tra lần tải trước
          </button>
        ) : null}
        <button
          type="button"
          disabled={!file || busy || deleting || stage === 'processing' || mustDeleteBeforeUpload}
          onClick={upload}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stage === 'error' ? 'Thử tải lại' : label}
        </button>
        {transferBusy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Hủy
          </button>
        ) : null}
        {existingAssetId ? (
          <>
            <a
              href={`csca-video:cleanup:${existingAssetId}`}
              title="Chỉ xóa HLS tạm trong .video-work trên máy, không xóa video trên R2"
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Dọn HLS tạm trên máy
            </a>
            <button
              type="button"
              disabled={busy || deleting}
              onClick={() => void deleteVideo()}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            >
              {deleting ? 'Đang xóa khỏi R2...' : 'Xóa video và dữ liệu R2'}
            </button>
          </>
        ) : null}
      </div>
      {existingAssetId ? (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          “Dọn HLS tạm trên máy” chỉ giải phóng thư mục .video-work; video trên R2 và khóa học vẫn được giữ nguyên.
        </p>
      ) : null}
      {stage === 'processing' || stage === 'finalizing' ? (
        <div role="status" className="space-y-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          <p>
            {label}
            {videoAssetId ? ` Asset #${videoAssetId} đã được tạo.` : ''}
          </p>
          {processingCode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-950/30">
              <p className="mb-1 text-xs font-black uppercase tracking-wide">Mã xử lý một chạm</p>
              <p className="break-all font-mono text-xs">{processingCode}</p>
              <button
                type="button"
                className="mt-2 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-bold text-white"
                onClick={() => navigator.clipboard.writeText(processingCode)}
              >
                Sao chép mã
              </button>
              <a
                href={`csca-video:${encodeURIComponent(processingCode)}`}
                className="ml-2 mt-2 inline-block rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Mở công cụ xử lý trên máy
              </a>
            </div>
          ) : null}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chạy file XU-LY-VIDEO-KHOA-HOC.cmd trên máy. Khi công cụ báo upload xong, bấm nút dưới đây.
          </p>
          <button
            type="button"
            disabled={stage === 'finalizing'}
            onClick={finalizeHls}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
          >
            {stage === 'finalizing' ? 'Đang kiểm tra HLS...' : 'Kiểm tra và hoàn tất video'}
          </button>
        </div>
      ) : null}
      {stage === 'ready' ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          Video R2 đã sẵn sàng để phát trong khóa học.
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
