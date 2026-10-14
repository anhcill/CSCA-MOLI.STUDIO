'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { PlaybackSessionDto } from '@/lib/types/courses';

const BUNNY_ORIGIN = 'https://player.mediadelivery.net';
export function useBunnyWatermark(frame: RefObject<HTMLIFrameElement | null>, session: PlaybackSessionDto | null) {
  const [acknowledgedSession, setAcknowledgedSession] = useState<string | null>(null);
  const sendWatermark = useCallback(() => {
    if (!session) return;
    frame.current?.contentWindow?.postMessage({ type: 'moly:watermark', sessionId: session.sessionId,
      label: `${session.viewerCode || 'CSCA'} · ${session.sessionId.slice(0, 8)}` }, BUNNY_ORIGIN);
  }, [frame, session]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== BUNNY_ORIGIN || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'moly:watermark-ready') sendWatermark();
      if (session && event.data?.type === 'moly:watermark-applied' && event.data.sessionId === session.sessionId) {
        setAcknowledgedSession(session.sessionId);
      }
    };
    window.addEventListener('message', receive);
    sendWatermark();
    return () => window.removeEventListener('message', receive);
  }, [frame, session, sendWatermark]);
  return { sendWatermark, watermarkInside: Boolean(session && acknowledgedSession === session.sessionId) };
}
