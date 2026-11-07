'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'tus-js-client';
import { isAxiosError } from 'axios';
import {
  FiCheckCircle,
  FiClock,
  FiEye,
  FiRefreshCw,
  FiTrash2,
  FiUploadCloud,
  FiAlertCircle,
  FiPauseCircle,
} from 'react-icons/fi';
import { bunnyMediaApi, type BunnyAsset } from '@/lib/api/bunnyMedia';
import { hashVideoFile, videoContentType } from '@/lib/api/courseMedia';
import { ProtectedVideoFrame } from '@/components/learning/ProtectedVideoFrame';
import { useBunnyWatermark } from '@/components/learning/useBunnyWatermark';
import type { PlaybackSessionDto } from '@/lib/types/courses';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDurationVi(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  if (!total) return 'Đang cập nhật thời lượng';
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs} giờ ${mins.toString().padStart(2, '0')} phút ${secs.toString().padStart(2, '0')} giây`;
  }
  return `${mins} phút ${secs.toString().padStart(2, '0')} giây`;
}

export function BunnyUploadPanel({
  courseId,
  lessonId,
  currentVideoAssetId,
  onUploaded,
  onDeleted,
}: {
  courseId: number;
  lessonId: number;
  currentVideoAssetId?: number | null;
  onUploaded?: (id: number) => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
}) {
  const [asset, setAsset] = useState<BunnyAsset | null>(null);
  const [preview, setPreview] = useState<PlaybackSessionDto | null>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const { sendWatermark, watermarkInside } = useBunnyWatermark(
    previewFrame as React.RefObject<HTMLIFrameElement>,
    preview,
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [mismatchError, setMismatchError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentBytes, setSentBytes] = useState(0);
  const [label, setLabel] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [showAdvancedRecover, setShowAdvancedRecover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useRef<Upload | null>(null);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const storageKey = `bunny-upload:${courseId}:${lessonId}`;

  useEffect(() => {
    setPreview(null);
  }, [lessonId]);

  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(
      () => setPreview(null),
      Math.max(0, Date.parse(preview.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    alive.current = true;
    const savedId = Number(localStorage.getItem(storageKey));
    const id = currentVideoAssetId || (Number.isSafeInteger(savedId) && savedId > 0 ? savedId : 0);
    if (id) {
      void bunnyMediaApi
        .status(id)
        .then((value) => {
          if (alive.current) {
            setAsset(value);
            if (value.status === 'ready') {
              localStorage.removeItem(storageKey);
              localStorage.removeItem(`${storageKey}:hash`);
            }
          }
        })
        .catch((err) => {
          if (!alive.current) return;
          if (isAxiosError(err) && err.response?.status === 404 && !currentVideoAssetId) {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}:hash`);
            return;
          }
          setError('Chưa tải được trạng thái video. Bạn có thể bấm Kiểm tra lại hoặc Hủy phiên cũ.');
        });
    }
    return () => {
      alive.current = false;
      controller.current?.abort();
      void upload.current?.abort();
    };
  }, [currentVideoAssetId, storageKey]);

  useEffect(() => {
    if (!asset || asset.status !== 'processing') return;
    const timer = window.setInterval(() => {
      void bunnyMediaApi
        .sync(asset.videoAssetId)
        .then(async (next) => {
          if (!alive.current) return;
          setAsset(next);
          if (next.status === 'ready') {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`${storageKey}:hash`);
            await onUploaded?.(next.videoAssetId);
          }
        })
        .catch(() => {
          if (alive.current) {
            setError('Đang chờ Bunny xử lý mã hóa video. Hệ thống sẽ tự kiểm tra lại sau 15 giây.');
          }
        });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [asset, onUploaded, storageKey]);

  async function sync() {
    if (!asset || busy || deleting) return;
    setBusy(true);
    setError('');
    try {
      const next = await bunnyMediaApi.sync(asset.videoAssetId);
      if (alive.current) {
        setAsset(next);
        if (next.status === 'ready') {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`${storageKey}:hash`);
          await onUploaded?.(next.videoAssetId);
        }
      }
    } catch {
      if (alive.current) {
        setError('Chưa kiểm tra được trạng thái từ Bunny. Hãy thử lại sau vài giây.');
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function removeOrResetAsset(confirmMessage: string) {
    if (busy || deleting) return;
    if (!window.confirm(confirmMessage)) return;
    setDeleting(true);
    setError('');
    setMismatchError(false);
    try {
      const targetId = asset?.videoAssetId ?? currentVideoAssetId ?? Number(localStorage.getItem(storageKey));
      if (targetId && Number.isSafeInteger(targetId) && targetId > 0) {
        try {
          await bunnyMediaApi.remove(targetId);
        } catch (err) {
          if (!isAxiosError(err) || err.response?.status !== 404) {
            throw err;
          }
        }
      }
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}:hash`);
      setAsset(null);
      setPreview(null);
      setFile(null);
      setProgress(0);
      setSentBytes(0);
      setLabel('');
      setRecoveryId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onDeleted?.();
    } catch {
      setError('Không thể xóa phiên video hiện tại. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      if (alive.current) setDeleting(false);
    }
  }

  async function start() {
    if (!file || busy || deleting) return;
    setBusy(true);
    setError('');
    setMismatchError(false);
    setProgress(0);
    setSentBytes(0);
    const abort = new AbortController();
    controller.current = abort;
    try {
      setLabel('Đang kiểm tra độ toàn vẹn tệp');
      const hash = await hashVideoFile(file, setProgress, abort.signal);
      const savedHash = localStorage.getItem(`${storageKey}:hash`);
      if (asset && savedHash && savedHash !== hash) {
        throw new Error('FILE_MISMATCH');
      }
      const ticket = asset
        ? await bunnyMediaApi.authorization(asset.videoAssetId)
        : await bunnyMediaApi.create(courseId, lessonId);
      localStorage.setItem(storageKey, String(ticket.videoAssetId));
      localStorage.setItem(`${storageKey}:hash`, hash);
      if (!alive.current || abort.signal.aborted) return;

      setAsset(ticket);
      setLabel('Đang tải video lên Bunny Stream');
      setProgress(0);

      await new Promise<void>((resolve, reject) => {
        const task = new Upload(file, {
          endpoint: ticket.upload.endpoint,
          headers: ticket.upload.headers,
          chunkSize: 8 * 1024 * 1024,
          retryDelays: [0, 1000, 3000, 5000],
          metadata: {
            filetype: videoContentType(file) || 'video/mp4',
            title: file.name,
          },
          fingerprint: async () => `bunny:${ticket.videoAssetId}:${hash}`,
          removeFingerprintOnSuccess: true,
          onProgress: (sent, total) => {
            if (alive.current) {
              setSentBytes(sent);
              setProgress(Math.round((sent / total) * 100));
            }
          },
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload.current = task;
        const stop = () => {
          void task.abort();
          reject(new DOMException('Paused', 'AbortError'));
        };
        abort.signal.addEventListener('abort', stop, { once: true });
        void task
          .findPreviousUploads()
          .then((previous) => {
            if (abort.signal.aborted) return stop();
            if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
            task.start();
          })
          .catch(reject);
      });

      if (!alive.current) return;
      setLabel('Đang đồng bộ trạng thái xử lý');
      const next = await bunnyMediaApi.sync(ticket.videoAssetId);
      setAsset(next);
      if (next.status === 'ready') {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}:hash`);
      }
      await onUploaded?.(ticket.videoAssetId);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.data?.details?.videoAssetId) {
        const id = Number(cause.response.data.details.videoAssetId);
        localStorage.setItem(storageKey, String(id));
        try {
          const next = await bunnyMediaApi.status(id);
          if (alive.current) setAsset(next);
        } catch {
          /* Reload recovers the allocation. */
        }
      }
      if (!alive.current) return;
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setError('Đã tạm dừng tải lên. Chọn lại cùng tệp và bấm "Tiếp tục tải" để nối tiếp phần đang dở.');
      } else if (cause instanceof Error && cause.message === 'FILE_MISMATCH') {
        setMismatchError(true);
        setError(
          'Tệp bạn vừa chọn khác với tệp đang tải dở trước đó. Hãy chọn lại đúng tệp cũ để tải tiếp, hoặc bấm "Hủy phiên tải cũ & chọn tệp mới".',
        );
      } else {
        setError(
          'Quá trình tải bị gián đoạn. Tiến độ đã tải vẫn được lưu — hãy chọn lại cùng tệp để tải tiếp, hoặc hủy phiên cũ nếu muốn đổi video khác.',
        );
      }
    } finally {
      upload.current = null;
      controller.current = null;
      if (alive.current) setBusy(false);
    }
  }

  const currentStep =
    asset?.status === 'ready' ? 3 : asset?.status === 'processing' ? 2 : 1;

  const hasStuckSession = Boolean(
    mismatchError ||
      asset?.status === 'failed' ||
      (asset && asset.providerVideoId === null) ||
      (asset && asset.status !== 'ready' && asset.status !== 'processing'),
  );

  return (
    <div className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm dark:border-teal-800/60 dark:bg-slate-900">
      {/* Header + 3-step visual progress */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              ☁️ Bunny Stream CDN
            </span>
            {asset?.videoAssetId ? (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Mã video #{asset.videoAssetId}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Hỗ trợ MP4 / MOV tối đa 20 GB · Tự động nối tiếp nếu rớt mạng · Chống tải lậu kèm Watermark học viên
          </p>
        </div>

        {/* Stepper */}
        <ol className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <li
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
              currentStep === 1
                ? 'bg-teal-600 text-white'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            <span>{currentStep > 1 ? '✓' : '1.'}</span>
            <span>Tải video lên</span>
          </li>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <li
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
              currentStep === 2
                ? 'bg-amber-500 text-white'
                : currentStep > 2
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span>{currentStep > 2 ? '✓' : '2.'}</span>
            <span>Xử lý mã hóa</span>
          </li>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <li
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
              currentStep === 3
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span>{currentStep === 3 ? '✓' : '3.'}</span>
            <span>Sẵn sàng phát</span>
          </li>
        </ol>
      </div>

      {/* STEP 3: READY STATE */}
      {asset?.status === 'ready' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  Video đã sẵn sàng phát cho học viên!
                </p>
                <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300/90">
                  Thời lượng: <strong>{formatDurationVi(asset.durationSeconds)}</strong> · Asset #{asset.videoAssetId}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || deleting}
                onClick={() => {
                  if (preview) {
                    setPreview(null);
                    return;
                  }
                  setBusy(true);
                  setError('');
                  void bunnyMediaApi
                    .preview(asset.videoAssetId)
                    .then(setPreview)
                    .catch(() =>
                      setError('Không mở được bản xem thử (chỉ Admin có quyền xem thử hoặc video đang đồng bộ).'),
                    )
                    .finally(() => {
                      if (alive.current) setBusy(false);
                    });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-3.5 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-500 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-slate-800"
              >
                <FiEye className="h-4 w-4" />
                {preview ? 'Ẩn xem thử' : 'Xem thử video'}
              </button>
              <button
                type="button"
                disabled={busy || deleting}
                onClick={() =>
                  void removeOrResetAsset(
                    `Bạn muốn xóa video hiện tại (Asset #${asset.videoAssetId}) để tải video khác lên thay thế? Thao tác này sẽ gỡ video khỏi bài giảng.`,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
              >
                <FiTrash2 className="h-4 w-4" />
                {deleting ? 'Đang xóa...' : '🔄 Thay video khác / Xóa video'}
              </button>
            </div>
          </div>

          {preview ? (
            <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black dark:border-slate-700">
              <ProtectedVideoFrame
                nativeControls
                watermarkInside={watermarkInside}
                session={preview}
                onPause={() =>
                  previewFrame.current?.contentWindow?.postMessage(
                    JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'pause' }),
                    'https://player.mediadelivery.net',
                  )
                }
              >
                <iframe
                  ref={previewFrame}
                  onLoad={sendWatermark}
                  allowFullScreen
                  src={`${preview.embedUrl}&autoplay=false&playsinline=true&disableIosPlayer=true&chromecast=false&disableAirPlay=true`}
                  title="Xem thử bài giảng video"
                  className="h-full w-full border-0"
                  allow="encrypted-media; fullscreen; picture-in-picture 'none'; remote-playback 'none'"
                />
              </ProtectedVideoFrame>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* STEP 2: PROCESSING STATE */}
      {asset?.status === 'processing' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-700/50 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FiClock className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold text-amber-950 dark:text-amber-200">
                  Bước 2/3: Hệ thống Bunny đang mã hóa đa độ phân giải (360p → 1080p)...
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90">
                  Tệp đã tải lên 100%! Trang này tự động kiểm tra mỗi 15 giây — bạn có thể điền tiếp nội dung khác trong lúc chờ.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy || deleting}
                onClick={() => void sync()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <FiRefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                {busy ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
              </button>
              <button
                type="button"
                disabled={busy || deleting}
                onClick={() =>
                  void removeOrResetAsset(
                    'Hủy video đang xử lý này và tải lại tệp khác? Video hiện tại trên Bunny sẽ bị xóa.',
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
                Hủy & chọn tệp khác
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* STEP 1: UPLOAD / RESUME / FAILED STATE */}
      {asset?.status !== 'ready' && asset?.status !== 'processing' ? (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 transition hover:border-teal-400 dark:border-slate-700 dark:bg-slate-950/60">
            <label className="block cursor-pointer">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                <FiUploadCloud className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                {asset ? 'Chọn lại tệp video để tiếp tục tải lên' : 'Chọn tệp video bài giảng từ máy tính (.mp4, .mov)'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,.mp4,.mov"
                disabled={busy || deleting}
                onChange={(event) => {
                  const next = event.target.files?.[0];
                  setError('');
                  setMismatchError(false);
                  if (!next) {
                    setFile(null);
                    return;
                  }
                  if (!videoContentType(next) || next.size <= 0 || next.size > 20 * 1024 ** 3) {
                    setFile(null);
                    setError('Vui lòng chọn tệp video định dạng MP4 hoặc MOV, dung lượng tối đa 20 GB.');
                    return;
                  }
                  setFile(next);
                }}
                className="block w-full text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-teal-700 dark:text-slate-200"
              />
            </label>
            {file ? (
              <p className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="truncate">📄 {file.name}</span>
                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {formatBytes(file.size)}
                </span>
              </p>
            ) : null}
          </div>

          {/* Active Upload Progress Bar */}
          {busy ? (
            <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800/60 dark:bg-teal-950/30">
              <div className="flex items-center justify-between text-xs font-bold text-teal-900 dark:text-teal-200">
                <span>{label || 'Đang tải lên'}...</span>
                <span>
                  {progress}%
                  {file && sentBytes > 0 ? ` (${formatBytes(sentBytes)} / ${formatBytes(file.size)})` : ''}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-teal-200/70 dark:bg-slate-800"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy || deleting || !file}
              onClick={() => void start()}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiUploadCloud className="h-4 w-4" />
              {asset ? 'Tiếp tục tải lên Bunny' : 'Bắt đầu tải lên Bunny'}
            </button>

            {busy ? (
              <button
                type="button"
                onClick={() => controller.current?.abort()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <FiPauseCircle className="h-4 w-4" />
                Tạm dừng
              </button>
            ) : null}

            {asset && !busy ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void sync()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FiRefreshCw className="h-4 w-4" />
                Kiểm tra trạng thái
              </button>
            ) : null}

            {hasStuckSession && !busy ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  void removeOrResetAsset(
                    'Hủy phiên tải cũ của bài học này để chọn tệp video mới từ đầu?',
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <FiTrash2 className="h-4 w-4" />
                {deleting ? 'Đang hủy phiên cũ...' : '🗑️ Hủy phiên tải cũ & chọn tệp mới'}
              </button>
            ) : null}
          </div>

          {/* Stuck providerVideoId === null helper */}
          {asset && asset.providerVideoId === null ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-bold">
                Phiên khởi tạo video trước đó chưa nhận được mã Bunny Video ID (Asset #{asset.videoAssetId}).
              </p>
              <p className="mt-1">
                Cách nhanh nhất: bấm nút <strong>“🗑️ Hủy phiên tải cũ & chọn tệp mới”</strong> ở trên để tải lại sạch sẽ trong 1 chạm.
              </p>
              <button
                type="button"
                onClick={() => setShowAdvancedRecover((v) => !v)}
                className="mt-2 font-semibold underline"
              >
                {showAdvancedRecover ? 'Ẩn khôi phục thủ công' : 'Khôi phục nâng cao bằng Bunny Video ID'}
              </button>
              {showAdvancedRecover ? (
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Bunny Video ID"
                    placeholder={`Nhập Video ID cho lesson-${lessonId}-${asset.assetExternalKey}`}
                    value={recoveryId}
                    onChange={(event) => setRecoveryId(event.target.value)}
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || !recoveryId.trim()}
                    onClick={() => {
                      setBusy(true);
                      void bunnyMediaApi
                        .recover(asset.videoAssetId, recoveryId.trim())
                        .then(setAsset)
                        .catch(() => setError('Mã Bunny Video ID không khớp hoặc chưa thể khôi phục.'))
                        .finally(() => {
                          if (alive.current) setBusy(false);
                        });
                    }}
                    className="rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Khôi phục liên kết
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
