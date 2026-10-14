'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PlaybackSessionDto } from '@/lib/types/courses';

// Browser deterrents only: the web has no reliable OS screen-recording signal.
export function ProtectedVideoFrame({ session, onPause, children }: {
  session: PlaybackSessionDto; onPause: () => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pause = useRef(onPause);
  pause.current = onPause;
  const [covered, setCovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const cover = () => { pause.current(); setCovered(true); };
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
    const timer = window.setInterval(() => setStep(value => (value + 1) % 6), 9000);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('pagehide', cover);
      window.removeEventListener('beforeprint', cover);
      window.removeEventListener('keydown', key);
      window.clearInterval(timer);
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
  const positions = [
    { left: '4%', top: '18%' }, { left: '48%', top: '36%' },
    { left: '12%', top: '60%' }, { left: '48%', top: '18%' },
    { left: '4%', top: '38%' }, { left: '46%', top: '60%' },
  ];
  const viewer = session.viewerCode || `Phien ${session.sessionId.slice(0, 8)}`;
  return <div ref={root} data-protected-video className={`${expanded ? 'fixed inset-0 z-[10000]' : 'relative h-full w-full'} overflow-hidden bg-black print:invisible`}
    onContextMenu={event => event.preventDefault()}
    onDragStart={event => event.preventDefault()}
    onPlayCapture={() => { if (document.hidden || covered) pause.current(); }}>
    {children}
    <div data-video-watermark aria-hidden="true" className="pointer-events-none absolute z-20 max-w-[48%] select-none break-all rounded bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/60 sm:text-xs"
      style={{ ...positions[step], textShadow: '0 1px 2px #000' }}>
      {viewer}<br />CSCA · {session.sessionId.slice(0, 8)}
    </div>
    <button type="button" onClick={() => void toggleFullscreen()} className="absolute right-2 top-2 z-30 rounded bg-black/75 px-3 py-2 text-xs text-white"
      aria-label={expanded || nativeFullscreen ? 'Thu nhỏ video' : 'Phóng to video'}>
      {expanded || nativeFullscreen ? 'Thu nhỏ' : 'Phóng to'}
    </button>
    {covered ? <div role="status" data-video-shield className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black p-4 text-center text-sm text-white">
      <p>Video đã tạm dừng để bảo vệ nội dung.</p>
      <button type="button" onClick={() => { if (!document.hidden) setCovered(false); }} className="rounded bg-teal-700 px-4 py-2">Tiếp tục xem</button>
    </div> : null}
  </div>;
}
