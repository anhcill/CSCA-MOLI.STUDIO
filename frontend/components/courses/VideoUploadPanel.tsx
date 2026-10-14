'use client';

import { useEffect, useRef, useState } from 'react';
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

type VideoUploadProps = { courseId: number; lessonId: number; currentVideoAssetId?: number | null;
  onUploaded?: (videoAssetId: number) => Promise<void> | void; onDeleted?: () => Promise<void> | void };

export function VideoUploadPanel(props: VideoUploadProps) {
  const [provider, setProvider] = useState<'r2' | 'bunny' | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setFailed(false); setProvider(null);
    if (!props.currentVideoAssetId) { setProvider('r2'); return; }
    const path = process.env.NEXT_PUBLIC_BUNNY_STREAM_ENABLED === 'true' ? '/admin/bunny-media' : '/admin/course-media';
    void axios.get(`${path}/assets/${props.currentVideoAssetId}`).then(response => {
      if (active) setProvider(response.data.data.provider || 'r2');
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [props.currentVideoAssetId, props.lessonId, retry]);
  if (!provider) return <div role="status">{failed ? <button type="button" onClick={() => setRetry(value => value + 1)}>Chưa tải được trạng thái video. Thử lại</button> : 'Đang tải trạng thái video...'}</div>;
  return <div className="space-y-3">
    {!props.currentVideoAssetId && process.env.NEXT_PUBLIC_BUNNY_STREAM_ENABLED === 'true' ? <label className="block text-sm font-bold">Kho video <select value={provider} onChange={event => setProvider(event.target.value as 'r2' | 'bunny')} className="ml-2 rounded border p-2"><option value="r2">R2 hiện có</option><option value="bunny">Bunny Stream</option></select></label> : null}
    {provider === 'bunny' ? <BunnyUploadPanel key={props.lessonId} {...props} /> : <LegacyVideoUploadPanel key={props.lessonId} {...props} />}
  </div>;
}

function LegacyVideoUploadPanel({
  courseId,
  lessonId,
  currentVideoAssetId,
  onUploaded,
  onDeleted,
}: {
  courseId: number;
  lessonId: number;
  currentVideoAssetId?: number | null;
  onUploaded?: (videoAssetId: number) => Promise<void> | void;
  onDeleted?: () => Promise<void> | void;
}) {
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
      if (pending) { setPendingSessionId(pending.sessionId); setVideoAssetId(pending.videoAssetId); setAssetExternalKey(pending.assetExternalKey); setStage('error'); }
    } catch { /* Ignore invalid local recovery metadata. */ }
  }, [pendingKey]);
  useEffect(() => {
    if (!currentVideoAssetId) return;
    let active = true;
    void axios.get(`/admin/course-media/assets/${currentVideoAssetId}`).then(response => {
      if (!active) return;
      const asset = response.data.data;
      setVideoAssetId(asset.videoAssetId); setAssetExternalKey(asset.assetExternalKey);
      setStage(asset.status === 'ready' ? 'ready' : asset.status === 'processing' ? 'processing' : 'idle');
    }).catch(() => { if (active) setError('Chưa tải được trạng thái xử lý. Hãy mở lại bài để kiểm tra.'); });
    return () => { active = false; };
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
      localStorage.setItem(pendingKey,JSON.stringify({ sessionId: session.sessionId, videoAssetId: session.videoAssetId, assetExternalKey: session.assetExternalKey }));
      setPendingSessionId(session.sessionId);
      setVideoAssetId(session.videoAssetId);
      setAssetExternalKey(session.assetExternalKey);
      setStage('uploading');
      setProgress(0);
      await putVideoToSignedUrl(session, file, setProgress, controller.signal);
      setStage('completing');
      const completed = await courseMediaApi.completeUpload(session.sessionId);
      localStorage.removeItem(pendingKey); setPendingSessionId('');
      setProgress(100);
      setStage('processing');
      setVideoAssetId(completed.videoAssetId);
      try {
        await onUploaded?.(completed.videoAssetId);
      } catch {
        setError(`Video đã tải lên với asset #${completed.videoAssetId}, nhưng chưa gắn được vào bài học. Không tải lại tệp; hãy thử lưu bài học lại.`);
      }
    } catch (cause) {
      setError(createdAssetId
        ? `Chưa xác nhận hoàn tất asset #${createdAssetId}. Dữ liệu vẫn được giữ; kiểm tra trạng thái trước khi tải lại hoặc xóa.`
        : cause instanceof DOMException && cause.name === 'AbortError' ? 'Đã dừng tải.' : 'Không thể tạo phiên tải. Hãy kiểm tra kết nối.');
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
      localStorage.removeItem(pendingKey); setPendingSessionId('');
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
  const processingCode = videoAssetId && assetExternalKey
    ? `${courseId}:${lessonId}:${videoAssetId}:${assetExternalKey}`
    : '';
  const label = stage === 'hashing'
    ? `Đang tính SHA-256: ${progress}%`
    : stage === 'uploading'
      ? `Đang tải lên: ${progress}%`
      : stage === 'completing'
        ? 'Đang xác minh video...'
        : stage === 'finalizing'
          ? 'Đang kiểm tra HLS...'
        : stage === 'processing'
          ? 'Đã tải lên, đang chờ xử lý HLS.'
          : 'Tải video lên';

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-indigo-300 bg-white p-5">
      <div>
        <h4 className="font-black text-slate-800">{currentVideoAssetId ? 'Video nguồn hiện tại' : 'Gắn video nguồn'}</h4>
        {currentVideoAssetId ? <p className="mt-1 text-sm font-semibold text-emerald-700">Đang sử dụng asset #{currentVideoAssetId}</p> : null}
        <p className="mt-1 text-xs text-slate-500">MP4 hoặc MOV, tối đa 4 GiB. Tệp được tải thẳng vào kho riêng tư.</p>
        {mustDeleteBeforeUpload ? <p className="mt-2 text-sm font-semibold text-amber-700">Muốn tải video khác, hãy xóa video hiện tại trước để video cũ không tiếp tục chiếm dung lượng R2.</p> : null}
      </div>
      <input
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        disabled={busy || deleting || stage === 'processing' || mustDeleteBeforeUpload}
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-bold"
        aria-describedby={`video-help-${lessonId}`}
      />
      <span id={`video-help-${lessonId}`} className="sr-only">Chọn một tệp MP4 hoặc MOV không quá 4 GiB.</span>
      {file ? <p className="truncate text-sm text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</p> : null}
      {transferBusy ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {pendingSessionId ? <button type="button" disabled={busy} onClick={async () => {
          setStage('completing'); setError('');
          try {
            const result = await courseMediaApi.completeUpload(pendingSessionId);
            localStorage.removeItem(pendingKey); setPendingSessionId(''); setStage('processing');
            await onUploaded?.(result.videoAssetId);
          } catch { setStage('error'); setError('Chưa xác nhận được tệp đã tải đủ. Dữ liệu vẫn được giữ; kiểm tra kết nối rồi thử lại.'); }
        }} className="rounded-lg border px-4 py-2 text-sm font-bold">Kiểm tra lần tải trước</button> : null}
        <button type="button" disabled={!file || busy || deleting || stage === 'processing' || mustDeleteBeforeUpload} onClick={upload} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {stage === 'error' ? 'Thử tải lại' : label}
        </button>
        {transferBusy ? <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Hủy</button> : null}
        {existingAssetId ? (
          <>
            <a
              href={`csca-video:cleanup:${existingAssetId}`}
              title="Chỉ xóa HLS tạm trong .video-work trên máy, không xóa video trên R2"
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
            >
              Dọn HLS tạm trên máy
            </a>
            <button
              type="button"
              disabled={busy || deleting}
              onClick={() => void deleteVideo()}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
            >
              {deleting ? 'Đang xóa khỏi R2...' : 'Xóa video và dữ liệu R2'}
            </button>
          </>
        ) : null}
      </div>
      {existingAssetId ? <p className="text-xs font-semibold text-slate-500">“Dọn HLS tạm trên máy” chỉ giải phóng thư mục .video-work; video trên R2 và khóa học vẫn được giữ nguyên.</p> : null}
      {stage === 'processing' || stage === 'finalizing' ? (
        <div role="status" className="space-y-2 text-sm font-semibold text-amber-700">
          <p>{label}{videoAssetId ? ` Asset #${videoAssetId} đã được tạo.` : ''}</p>
          {processingCode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
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
          <p className="text-xs text-slate-600">Chạy file XU-LY-VIDEO-KHOA-HOC.cmd trên máy. Khi công cụ báo upload xong, bấm nút dưới đây.</p>
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
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
          Video đã sẵn sàng để phát trong khóa học.
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
