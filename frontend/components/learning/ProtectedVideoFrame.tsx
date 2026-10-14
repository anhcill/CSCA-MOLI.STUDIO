'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FiMaximize, FiMinimize } from 'react-icons/fi';
import type { PlaybackSessionDto } from '@/lib/types/courses';

// Browser deterrents only: the web has no reliable OS screen-recording signal.
export function ProtectedVideoFrame({ session, onPause, children, nativeControls = false, watermarkInside = false }: {
  session: PlaybackSessionDto; onPause: () => void; children: ReactNode; nativeControls?: boolean; watermarkInside?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pause = useRef(onPause);
  pause.current = onPause;
  const [covered, setCovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    const cover = () => {
      pause.current(); setCovered(true);
      if (document.fullscreenElement && root.current?.contains(document.fullscreenElement)) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
    const visibility = () => { if (document.hidden) cover(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
      // OS shortcuts may never reach the page; this is best-effort concealment.
      if (event.key === 'PrintScreen' || (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(event.key))) cover();
    };
    const fullscreen = () => setNativeFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('pagehide', cover);
    window.addEventListener('beforeprint', cover);
    window.addEventListener('keydown', key);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('pagehide', cover);
      window.removeEventListener('beforeprint', cover);
      window.removeEventListener('keydown', key);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === root.current) {
      await document.exitFullscreen().catch(() => undefined);
    } else if (expanded) setExpanded(false);
    else {
      try {
        if (!root.current?.requestFullscreen) throw new Error('Fullscreen unavailable');
        await root.current.requestFullscreen();
      } catch { setExpanded(true); }
    }
  };
  const viewer = session.viewerCode || `Phien ${session.sessionId.slice(0, 8)}`;
  return <div ref={root} data-protected-video className={`${expanded ? 'fixed inset-0 z-[10000]' : 'relative h-full w-full'} overflow-hidden bg-black print:invisible`}
    onContextMenu={event => event.preventDefault()}
    onDragStart={event => event.preventDefault()}
    onPlayCapture={() => { if (document.hidden || covered) pause.current(); }}>
    {children}
    {!watermarkInside && <div data-video-watermark aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-20 max-w-[calc(100%-4.5rem)] select-none truncate rounded bg-black/15 px-1.5 py-1 text-[9px] font-medium text-white/50 sm:text-[10px]"
      style={{ textShadow: '0 1px 2px #000' }}>
      {viewer} · {session.sessionId.slice(0, 8)}
    </div>}
    {!nativeControls && <button type="button" onClick={() => void toggleFullscreen()} className="absolute right-2 top-2 z-30 flex h-11 w-11 items-center justify-center rounded-lg bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      title={expanded || nativeFullscreen ? 'Thu nhỏ video' : 'Phóng to video'}
      aria-label={expanded || nativeFullscreen ? 'Thu nhỏ video' : 'Phóng to video'}>
      {expanded || nativeFullscreen ? <FiMinimize aria-hidden="true" className="h-5 w-5" /> : <FiMaximize aria-hidden="true" className="h-5 w-5" />}
    </button>}
    {covered ? <div role="status" data-video-shield className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black p-4 text-center text-sm text-white">
      <p>Video đã tạm dừng để bảo vệ nội dung.</p>
      <button type="button" onClick={() => { if (!document.hidden) setCovered(false); }} className="rounded bg-teal-700 px-4 py-2">Tiếp tục xem</button>
    </div> : null}
  </div>;
}
