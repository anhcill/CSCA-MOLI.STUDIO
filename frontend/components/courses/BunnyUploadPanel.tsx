'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'tus-js-client';
import { isAxiosError } from 'axios';
import { bunnyMediaApi, type BunnyAsset } from '@/lib/api/bunnyMedia';
import { hashVideoFile, videoContentType } from '@/lib/api/courseMedia';
import { ProtectedVideoFrame } from '@/components/learning/ProtectedVideoFrame';
import type { PlaybackSessionDto } from '@/lib/types/courses';

export function BunnyUploadPanel({ courseId, lessonId, currentVideoAssetId, onUploaded }: {
  courseId: number; lessonId: number; currentVideoAssetId?: number | null; onUploaded?: (id: number) => Promise<void> | void;
}) {
  const [asset, setAsset] = useState<BunnyAsset | null>(null);
  const [preview, setPreview] = useState<PlaybackSessionDto | null>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const upload = useRef<Upload | null>(null);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const storageKey = `bunny-upload:${courseId}:${lessonId}`;
  useEffect(() => {
    setPreview(null);
  }, [lessonId]);
  useEffect(() => {
    if (!preview) return;
    const timer = window.setTimeout(() => setPreview(null), Math.max(0, Date.parse(preview.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [preview]);
  useEffect(() => {
    alive.current = true;
    const id = currentVideoAssetId || Number(localStorage.getItem(storageKey));
    if (id) void bunnyMediaApi.status(id).then(value => { if (alive.current) setAsset(value); }).catch(() => { if (alive.current) setError('Chưa tải được trạng thái video. Hãy mở lại bài để kiểm tra.'); });
    return () => { alive.current = false; controller.current?.abort(); void upload.current?.abort(); };
  }, [currentVideoAssetId, storageKey]);
  useEffect(() => {
    if (!asset || asset.status !== 'processing') return;
    const timer = window.setInterval(() => {
      void bunnyMediaApi.sync(asset.videoAssetId).then(next => { if (alive.current) setAsset(next); }).catch(() => { if (alive.current) setError('Chưa đồng bộ được. Video vẫn được giữ, bạn có thể kiểm tra lại.'); });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [asset]);
  async function sync() {
    if (!asset || busy) return;
    setBusy(true); setError('');
    try { setAsset(await bunnyMediaApi.sync(asset.videoAssetId)); }
    catch { setError('Chưa kiểm tra được trạng thái từ Bunny. Hãy thử lại sau.'); }
    finally { setBusy(false); }
  }
  async function start() {
    if (!file || busy) return;
    setBusy(true); setError(''); setProgress(0);
    const abort = new AbortController(); controller.current = abort;
    try {
      setLabel('Đang kiểm tra tệp');
      const hash = await hashVideoFile(file, setProgress, abort.signal);
      const savedHash = localStorage.getItem(`${storageKey}:hash`);
      if (asset && savedHash && savedHash !== hash) throw new Error('FILE_MISMATCH');
      const ticket = asset ? await bunnyMediaApi.authorization(asset.videoAssetId) : await bunnyMediaApi.create(courseId, lessonId);
      localStorage.setItem(storageKey, String(ticket.videoAssetId));
      localStorage.setItem(`${storageKey}:hash`, hash);
      if (!alive.current || abort.signal.aborted) return;
      setAsset(ticket); setLabel('Đang tải lên'); setProgress(0);
      await new Promise<void>((resolve, reject) => {
        const task = new Upload(file, {
          endpoint: ticket.upload.endpoint, headers: ticket.upload.headers,
          chunkSize: 8 * 1024 * 1024, retryDelays: [0, 1000, 3000, 5000],
          metadata: { filetype: videoContentType(file) || 'video/mp4', title: file.name },
          fingerprint: async () => `bunny:${ticket.videoAssetId}:${hash}`,
          removeFingerprintOnSuccess: true,
          onProgress: (sent, total) => { if (alive.current) setProgress(Math.round(sent / total * 100)); },
          onError: reject, onSuccess: () => resolve(),
        });
        upload.current = task;
        const stop = () => { void task.abort(); reject(new DOMException('Paused', 'AbortError')); };
        abort.signal.addEventListener('abort', stop, { once: true });
        void task.findPreviousUploads().then(previous => {
          if (abort.signal.aborted) return stop();
          if (previous[0]) task.resumeFromPreviousUpload(previous[0]);
          task.start();
        }).catch(reject);
      });
      if (!alive.current) return;
      setLabel('Đang kiểm tra xử lý');
      const next = await bunnyMediaApi.sync(ticket.videoAssetId); setAsset(next);
      await onUploaded?.(ticket.videoAssetId);
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.data?.details?.videoAssetId) {
        const id = Number(cause.response.data.details.videoAssetId);
        localStorage.setItem(storageKey,String(id));
        try { const next = await bunnyMediaApi.status(id); if (alive.current) setAsset(next); } catch { /* Reload recovers the allocation. */ }
      }
      if (alive.current) setError(cause instanceof Error && cause.message === 'FILE_MISMATCH'
        ? 'Hãy chọn đúng tệp đã tải trước đó để tiếp tục.'
        : 'Chưa hoàn tất. Video đã tạo vẫn được giữ. Kiểm tra trạng thái trước; chọn lại cùng tệp để tiếp tục nếu còn đang tải.');
    } finally { upload.current = null; controller.current = null; if (alive.current) setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-teal-300 bg-white p-5 text-slate-800">
    <h4 className="font-bold">Video Bunny Stream</h4>
    {asset?.status === 'ready' ? <button type="button" disabled={busy} className="rounded-lg border border-teal-700 px-4 py-2 font-bold text-teal-800" onClick={() => {
      setBusy(true); setError('');
      void bunnyMediaApi.preview(asset.videoAssetId).then(setPreview).catch(() => setError('Chỉ admin tổng được xem thử. Kiểm tra quyền tài khoản và trạng thái video.')).finally(() => setBusy(false));
    }}>Xem thử (admin tổng)</button> : null}
    {preview ? <div className="aspect-video overflow-hidden rounded-xl">
      <ProtectedVideoFrame session={preview} onPause={() => previewFrame.current?.contentWindow?.postMessage(JSON.stringify({context:'player.js',version:'0.0.11',method:'pause'}),'https://player.mediadelivery.net')}>
        <iframe ref={previewFrame} src={`${preview.embedUrl}&autoplay=false&playsinline=true`} title="Video demo admin" className="h-full w-full border-0" allow="encrypted-media; fullscreen 'none'; picture-in-picture 'none'; remote-playback 'none'" />
      </ProtectedVideoFrame>
    </div> : null}
    <p className="text-sm">MP4/MOV, tối đa 20 GiB. Có thể tạm dừng và chọn lại cùng tệp để tải tiếp.</p>
    {asset ? <p role="status">{asset.status === 'ready' ? `Sẵn sàng · ${Math.ceil(asset.durationSeconds)} giây` : asset.status === 'processing' ? 'Đang xử lý video...' : asset.status === 'failed' ? 'Bunny báo xử lý lỗi.' : 'Đang chờ hoàn tất tải lên.'}</p> : null}
    <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy || asset?.status === 'ready' || asset?.status === 'processing'} onChange={event => {
      const next = event.target.files?.[0]; setError('');
      if (!next || !videoContentType(next) || next.size <= 0 || next.size > 20 * 1024 ** 3) { setFile(null); setError('Chọn tệp MP4/MOV hợp lệ, tối đa 20 GiB.'); return; }
      setFile(next);
    }} className="block w-full text-sm" />
    {busy ? <p role="status">{label}: {progress}%</p> : null}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !file || asset?.status === 'ready' || asset?.status === 'processing'} onClick={() => void start()} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{asset ? 'Tiếp tục tải' : 'Tải lên Bunny'}</button>
      {busy ? <button type="button" onClick={() => controller.current?.abort()} className="rounded-lg border px-4 py-2">Tạm dừng</button> : null}
      {asset ? <button type="button" disabled={busy} onClick={() => void sync()} className="rounded-lg border px-4 py-2">Kiểm tra trạng thái</button> : null}
    </div>
    {asset && asset.providerVideoId === null ? <div className="space-y-2 text-sm"><p>Chưa xác nhận được mã video. Kiểm tra video tên lesson-{lessonId}-{asset.assetExternalKey} trong Bunny Library rồi nhập Video ID để khôi phục.</p><input aria-label="Bunny Video ID" value={recoveryId} onChange={event => setRecoveryId(event.target.value)} className="w-full rounded border p-2" /><button type="button" disabled={busy || !recoveryId} onClick={() => { setBusy(true); void bunnyMediaApi.recover(asset.videoAssetId,recoveryId).then(setAsset).catch(() => setError('Mã video không khớp hoặc chưa thể khôi phục.')).finally(() => setBusy(false)); }} className="rounded border p-2">Khôi phục liên kết</button></div> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </div>;
}
