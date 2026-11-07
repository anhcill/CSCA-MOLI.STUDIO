'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import learningApi from '@/lib/api/learning';
import type { PlaybackSessionDto } from '@/lib/types/courses';
import { ProtectedVideoFrame } from './ProtectedVideoFrame';
import { useBunnyWatermark } from './useBunnyWatermark';

const ORIGIN = 'https://player.mediadelivery.net';
const COMPLETION_PCT_THRESHOLD = 85;

export function BunnyPlayer({ lessonId, session, onProgressSaved, onLessonCompleted }: {
  lessonId: number;
  session: PlaybackSessionDto;
  onProgressSaved?: () => Promise<void> | void;
  onLessonCompleted?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [active, setActive] = useState(session);
  const [iframeEmbedUrl, setIframeEmbedUrl] = useState(session.embedUrl || '');
  const deferredEmbedUrl = useRef<string | null>(null);
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
  const completionRequested = useRef(false);
  const callback = useRef(onProgressSaved);
  const completedCallback = useRef(onLessonCompleted);
  callback.current = onProgressSaved;
  completedCallback.current = onLessonCompleted;

  useEffect(() => {
    setActive(session);
    setIframeEmbedUrl(session.embedUrl || '');
    deferredEmbedUrl.current = null;
    position.current = session.resumePositionSeconds;
    completionRequested.current = false;
  }, [lessonId]);

  const send = useCallback((method: string, value?: unknown, listener?: string) => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ context: 'player.js', version: '0.0.11', method, value, listener }),
      ORIGIN,
    );
  }, []);

  const applyDeferredEmbedIfIdle = useCallback(() => {
    if (deferredEmbedUrl.current && !playing.current && !document.fullscreenElement) {
      setIframeEmbedUrl(deferredEmbedUrl.current);
      deferredEmbedUrl.current = null;
    }
  }, []);

  const flush = useCallback(async (keepalive = false) => {
    if (saving.current) return;
    saving.current = true;
    const delta = Math.min(60, Math.floor(watched.current));
    try {
      const progress = await learningApi.updateProgress(
        lessonId,
        { positionSeconds: Math.floor(position.current), watchedDeltaSeconds: delta },
        { keepalive },
      );
      watched.current = Math.max(0, watched.current - delta);
      if (progress.status === 'completed') {
        if (!completionRequested.current) {
          completionRequested.current = true;
          completedCallback.current?.();
        }
      } else if (progress.completionPct >= COMPLETION_PCT_THRESHOLD && !completionRequested.current) {
        completionRequested.current = true;
        await learningApi.completeLesson(lessonId).catch(() => {
          completionRequested.current = false;
        });
        if (completionRequested.current) {
          completedCallback.current?.();
        }
      }
      void Promise.resolve(callback.current?.()).catch(() => undefined);
    } catch {
      /* Retain unacknowledged watch time for the next request. */
    } finally {
      saving.current = false;
    }
  }, [lessonId]);

  const refresh = useCallback(async (forceSwap = false) => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    setBusy(true);
    try {
      const next = await learningApi.createPlaybackSession(lessonId);
      if (alive.current) {
        setActive(next);
        setError('');
        previous.current = null;
        const nextUrl = next.embedUrl || '';
        if (forceSwap || (!playing.current && !document.fullscreenElement)) {
          deferredEmbedUrl.current = null;
          setIframeEmbedUrl(nextUrl);
        } else {
          deferredEmbedUrl.current = nextUrl;
        }
      }
    } catch {
      if (alive.current) {
        send('pause');
        playing.current = false;
        setError('Không thể gia hạn phiên phát. Kiểm tra kết nối hoặc quyền học rồi thử lại.');
      }
    } finally {
      refreshPending.current = false;
      if (alive.current) setBusy(false);
    }
  }, [lessonId, send]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; void flush(true); };
  }, [flush]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void refresh(false),
      Math.max(5000, Date.parse(active.expiresAt) - Date.now() - 60000),
    );
    return () => window.clearTimeout(timer);
  }, [active.expiresAt, refresh]);

  useEffect(() => {
    let ready = false;
    const receive = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || event.source !== frame.current?.contentWindow) return;
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.context !== 'player.js') return;
      if (data.event === 'ready' && !ready) {
        ready = true;
        for (const name of ['play', 'pause', 'ended', 'timeupdate', 'error']) {
          send('addEventListener', name, `lesson-${lessonId}-${name}`);
        }
        if (position.current > 0) send('setCurrentTime', position.current);
        if (playing.current && !document.hidden) send('play');
      } else if (data.event === 'play') {
        playing.current = !document.hidden;
        previous.current = null;
        if (document.hidden) send('pause');
      } else if (data.event === 'pause' || data.event === 'ended') {
        playing.current = false;
        previous.current = null;
        void flush();
        applyDeferredEmbedIfIdle();
      } else if (data.event === 'error') {
        setError('Video tạm thời không phát được. Hãy thử lại.');
      } else if (data.event === 'timeupdate') {
        const seconds = Number(data.value?.seconds), duration = Number(data.value?.duration);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(duration) || duration <= 0 || seconds > duration + 1) return;
        const now = performance.now(), last = previous.current;
        if (playing.current && last) {
          const delta = seconds - last.seconds, elapsed = (now - last.time) / 1000;
          if (delta > 0 && delta <= 5 && delta <= elapsed * 2.1 + 0.2) watched.current += delta;
        }
        position.current = seconds;
        previous.current = { seconds, time: now };
      }
    };
    const onFullscreenChange = () => applyDeferredEmbedIfIdle();
    window.addEventListener('message', receive);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    const interval = window.setInterval(() => void flush(), 15000);
    const hide = () => void flush(true);
    window.addEventListener('pagehide', hide);
    return () => {
      window.removeEventListener('message', receive);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('pagehide', hide);
      window.clearInterval(interval);
    };
  }, [applyDeferredEmbedIfIdle, flush, iframeEmbedUrl, lessonId, send]);

  let url: URL;
  try {
    url = new URL(iframeEmbedUrl || active.embedUrl || ORIGIN);
  } catch {
    return <p role="alert" className="p-4 text-sm text-amber-200">Địa chỉ video không hợp lệ.</p>;
  }
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/embed/')) {
    return <p role="alert" className="p-4 text-sm text-amber-200">Địa chỉ video không hợp lệ.</p>;
  }
  url.searchParams.set('autoplay', 'false');
  url.searchParams.set('playsinline', 'true');
  url.searchParams.set('disableIosPlayer', 'true');
  url.searchParams.set('chromecast', 'false');
  url.searchParams.set('disableAirPlay', 'true');

  return (
    <ProtectedVideoFrame
      nativeControls
      watermarkInside={watermarkInside}
      session={active}
      onPause={() => {
        send('pause');
        playing.current = false;
        previous.current = null;
        void flush(true);
      }}
    >
      <iframe
        ref={frame}
        onLoad={sendWatermark}
        allowFullScreen
        src={url.toString()}
        title="Video bài học"
        className="h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture 'none'; display-capture 'none'; remote-playback 'none'"
      />
      {busy ? (
        <p role="status" className="pointer-events-none absolute left-2 top-8 z-30 rounded bg-black/75 px-2.5 py-1 text-xs text-white/90">
          Đang gia hạn phiên phát...
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="absolute inset-0 z-30 grid place-content-center gap-3 bg-black/90 p-4 text-center text-white">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh(true)}
            className="mx-auto rounded-lg bg-teal-700 px-4 py-2 font-bold hover:bg-teal-600 disabled:opacity-60"
          >
            Thử lại
          </button>
        </div>
      ) : null}
    </ProtectedVideoFrame>
  );
}
