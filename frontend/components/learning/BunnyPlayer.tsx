'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import learningApi from '@/lib/api/learning';
import type { PlaybackSessionDto } from '@/lib/types/courses';
import { ProtectedVideoFrame } from './ProtectedVideoFrame';
import { useBunnyWatermark } from './useBunnyWatermark';

const ORIGIN = 'https://player.mediadelivery.net';
export function BunnyPlayer({ lessonId, session, onProgressSaved }: {
  lessonId: number; session: PlaybackSessionDto; onProgressSaved?: () => Promise<void> | void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [active, setActive] = useState(session);
  const { sendWatermark, watermarkInside } = useBunnyWatermark(frame as any, active);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const position = useRef(session.resumePositionSeconds);
  const playing = useRef(false);
  const previous = useRef<{ seconds: number; time: number } | null>(null);
  const watched = useRef(0);
  const saving = useRef(false);
  const alive = useRef(true);
  const refreshPending = useRef(false);
  const callback = useRef(onProgressSaved);
  callback.current = onProgressSaved;
  const send = useCallback((method: string, value?: unknown, listener?: string) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method, value, listener }), ORIGIN);
  }, []);
  const flush = useCallback(async (keepalive = false) => {
    if (saving.current) return;
    saving.current = true;
    const delta = Math.min(60, Math.floor(watched.current));
    try {
      await learningApi.updateProgress(lessonId, { positionSeconds: Math.floor(position.current), watchedDeltaSeconds: delta }, { keepalive });
      watched.current = Math.max(0, watched.current - delta);
      void Promise.resolve(callback.current?.()).catch(() => undefined);
    } catch { /* Retain unacknowledged watch time for the next request. */ }
    finally { saving.current = false; }
  }, [lessonId]);
  const refresh = useCallback(async () => {
    if (refreshPending.current) return;
    refreshPending.current = true; setBusy(true);
    try {
      const next = await learningApi.createPlaybackSession(lessonId);
      if (alive.current) { setActive(next); setError(''); previous.current = null; }
    } catch {
      if (alive.current) { send('pause'); playing.current = false; setError('Không thể gia hạn phiên phát. Kiểm tra kết nối hoặc quyền học rồi thử lại.'); }
    } finally { refreshPending.current = false; if (alive.current) setBusy(false); }
  }, [lessonId, send]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; void flush(true); };
  }, [flush]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), Math.max(1000, Date.parse(active.expiresAt) - Date.now() - 30000));
    return () => window.clearTimeout(timer);
  }, [active, refresh]);
  useEffect(() => {
    let ready = false;
    const receive = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || event.source !== frame.current?.contentWindow) return;
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.context !== 'player.js') return;
      if (data.event === 'ready' && !ready) {
        ready = true;
        for (const name of ['play', 'pause', 'ended', 'timeupdate', 'error']) send('addEventListener', name, `lesson-${lessonId}-${name}`);
        send('setCurrentTime', position.current);
        if (playing.current) send('play');
      } else if (data.event === 'play') { playing.current = !document.hidden; previous.current = null; if (document.hidden) send('pause'); }
      else if (data.event === 'pause' || data.event === 'ended') { playing.current = false; previous.current = null; void flush(); }
      else if (data.event === 'error') { setError('Video tạm thời không phát được. Hãy thử lại.'); }
      else if (data.event === 'timeupdate') {
        const seconds = Number(data.value?.seconds), duration = Number(data.value?.duration);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(duration) || duration <= 0 || seconds > duration + 1) return;
        const now = performance.now(), last = previous.current;
        if (playing.current && last) {
          const delta = seconds - last.seconds, elapsed = (now - last.time) / 1000;
          if (delta > 0 && delta <= 5 && delta <= elapsed * 2.1 + 0.2) watched.current += delta;
        }
        position.current = seconds; previous.current = { seconds, time: now };
      }
    };
    window.addEventListener('message', receive);
    const interval = window.setInterval(() => void flush(), 15000);
    const hide = () => void flush(true);
    window.addEventListener('pagehide', hide);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('pagehide', hide); window.clearInterval(interval); };
  }, [active.sessionId, flush, lessonId, send]);
  const url = new URL(active.embedUrl || ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/embed/')) return <p role="alert">Địa chỉ video không hợp lệ.</p>;
  url.searchParams.set('autoplay', 'false');
  url.searchParams.set('playsinline', 'true');
  url.searchParams.set('disableIosPlayer', 'true');
  url.searchParams.set('chromecast', 'false');
  url.searchParams.set('disableAirPlay', 'true');
  return <ProtectedVideoFrame nativeControls watermarkInside={watermarkInside} session={active} onPause={() => { send('pause'); playing.current = false; previous.current = null; void flush(true); }}>
    <iframe key={active.sessionId} ref={frame} onLoad={sendWatermark} allowFullScreen src={url.toString()} title="Video bài học" className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture 'none'; display-capture 'none'; remote-playback 'none'" />
    {busy ? <p role="status" className="absolute left-2 top-2 rounded bg-black/80 p-2 text-sm text-white">Đang gia hạn phiên phát...</p> : null}
    {error ? <div role="alert" className="absolute inset-0 grid place-content-center gap-3 bg-black/90 p-4 text-center text-white"><p>{error}</p><button type="button" disabled={busy} onClick={() => void refresh()} className="rounded bg-teal-700 px-4 py-2">Thử lại</button></div> : null}
  </ProtectedVideoFrame>;
}
