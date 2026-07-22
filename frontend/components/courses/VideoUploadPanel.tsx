'use client';

import { useEffect, useRef, useState } from 'react';
import {
  courseMediaApi,
  hashVideoFile,
  MAX_SINGLE_VIDEO_BYTES,
  putVideoToSignedUrl,
  videoContentType,
} from '@/lib/api/courseMedia';

type UploadStage = 'idle' | 'hashing' | 'uploading' | 'completing' | 'processing' | 'error';

export function VideoUploadPanel({
  courseId,
  lessonId,
  onUploaded,
}: {
  courseId: number;
  lessonId: number;
  onUploaded?: (videoAssetId: number) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [videoAssetId, setVideoAssetId] = useState<number | null>(null);
  const [assetExternalKey, setAssetExternalKey] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

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
      setAssetExternalKey(session.assetExternalKey);
      setStage('uploading');
      setProgress(0);
      await putVideoToSignedUrl(session, file, setProgress, controller.signal);
      setStage('completing');
      const completed = await courseMediaApi.completeUpload(session.sessionId);
      setProgress(100);
      setStage('processing');
      setVideoAssetId(completed.videoAssetId);
      try {
        await onUploaded?.(completed.videoAssetId);
      } catch {
        setError(`Video đã tải lên với asset #${completed.videoAssetId}, nhưng chưa gắn được vào bài học. Không tải lại tệp; hãy thử lưu bài học lại.`);
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setError('Đã hủy tải video. Bạn có thể thử lại.');
      } else {
        setError('Không thể tải video lên. Kiểm tra kết nối rồi thử lại.');
      }
      setStage('error');
    } finally {
      abortRef.current = null;
    }
  };

  const busy = stage === 'hashing' || stage === 'uploading' || stage === 'completing';
  const label = stage === 'hashing'
    ? `Đang tính SHA-256: ${progress}%`
    : stage === 'uploading'
      ? `Đang tải lên: ${progress}%`
      : stage === 'completing'
        ? 'Đang xác minh video...'
        : stage === 'processing'
          ? 'Đã tải lên, đang chờ xử lý HLS.'
          : 'Tải video lên';

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="font-bold text-slate-800">Video nguồn</h4>
        <p className="text-xs text-slate-500">MP4 hoặc MOV, tối đa 4 GiB. Tệp được tải thẳng vào kho riêng tư.</p>
      </div>
      <input
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        disabled={busy || stage === 'processing'}
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-bold"
        aria-describedby={`video-help-${lessonId}`}
      />
      <span id={`video-help-${lessonId}`} className="sr-only">Chọn một tệp MP4 hoặc MOV không quá 4 GiB.</span>
      {file ? <p className="truncate text-sm text-slate-600">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</p> : null}
      {busy ? (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!file || busy || stage === 'processing'} onClick={upload} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {stage === 'error' ? 'Thử tải lại' : label}
        </button>
        {busy ? <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Hủy</button> : null}
      </div>
      {stage === 'processing' ? <div role="status" className="space-y-1 text-sm font-semibold text-amber-700"><p>{label}{videoAssetId ? ` Asset #${videoAssetId} đã được tạo.` : ''}</p>{assetExternalKey ? <p className="break-all font-mono text-xs">Khóa xử lý HLS: {assetExternalKey}</p> : null}</div> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
