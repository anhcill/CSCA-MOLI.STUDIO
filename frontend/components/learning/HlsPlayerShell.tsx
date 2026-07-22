'use client';

import Hls, { ErrorTypes, Events, type ErrorData, type Level } from 'hls.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import learningApi from '@/lib/api/learning';
import type { PlaybackSessionDto } from '@/lib/types/courses';

const PROGRESS_INTERVAL_MS = 15_000;
const MAX_WATCHED_DELTA_PER_UPDATE = 60;
const SESSION_REFRESH_MARGIN_MS = 60_000;
const COMPLETION_THRESHOLD = 0.85;

type PlayerProps = {
  lessonId: number;
  session: PlaybackSessionDto | null;
  loading?: boolean;
  error?: string;
};

type QualityOption = { levelIndex: number; height: number; label: string };

function responseStatus(data: ErrorData): number | null {
  const response = data.response as { code?: number; status?: number } | undefined;
  return response?.code ?? response?.status ?? null;
}

function qualityOptions(levels: Level[]): QualityOption[] {
  const byHeight = new Map<number, number>();
  levels.forEach((level, index) => {
    if (level.height > 0 && !byHeight.has(level.height)) byHeight.set(level.height, index);
  });
  return [...byHeight.entries()]
    .sort(([heightA], [heightB]) => heightA - heightB)
    .map(([height, levelIndex]) => ({ levelIndex, height, label: `${height}p` }));
}

export function HlsPlayerShell({ lessonId, session, loading = false, error = '' }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const refreshPromiseRef = useRef<Promise<PlaybackSessionDto> | null>(null);
  const refreshLessonIdRef = useRef<number | null>(null);
  const currentLessonIdRef = useRef(lessonId);
  const playbackRetryRef = useRef(false);
  const pendingPositionRef = useRef(0);
  const watchedDeltaSecondsRef = useRef(0);
  const lastPositionRef = useRef(0);
  const lastTimeUpdateRef = useRef<number | null>(null);
  const progressDirtyRef = useRef(false);
  const progressRequestRef = useRef<Promise<void> | null>(null);
  const completionRequestedRef = useRef(false);
  const initializedLessonRef = useRef<number | null>(null);
  const mediaRecoveryAttemptsRef = useRef(0);

  const [activeSession, setActiveSession] = useState(session);
  const [playerError, setPlayerError] = useState(error);
  const [refreshing, setRefreshing] = useState(false);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(-1);
  const [nativeHls, setNativeHls] = useState(false);
  currentLessonIdRef.current = lessonId;

  useEffect(() => {
    setActiveSession(session);
    setPlayerError(error);
  }, [error, session]);

  useEffect(() => {
    initializedLessonRef.current = null;
    pendingPositionRef.current = 0;
    lastPositionRef.current = 0;
    watchedDeltaSecondsRef.current = 0;
    lastTimeUpdateRef.current = null;
    progressDirtyRef.current = false;
    completionRequestedRef.current = false;
  }, [lessonId]);

  useEffect(() => {
    if (initializedLessonRef.current === lessonId || activeSession?.lessonId !== lessonId) return;
    initializedLessonRef.current = lessonId;
    const resume = Math.max(0, activeSession.resumePositionSeconds || 0);
    pendingPositionRef.current = resume;
    lastPositionRef.current = resume;
    watchedDeltaSecondsRef.current = 0;
    progressDirtyRef.current = false;
    completionRequestedRef.current = false;
  }, [activeSession, lessonId]);

  const refreshSession = useCallback(() => {
    if (refreshPromiseRef.current && refreshLessonIdRef.current === lessonId) {
      return refreshPromiseRef.current;
    }
    setRefreshing(true);
    const request = learningApi.createPlaybackSession(lessonId)
      .then((nextSession) => {
        if (currentLessonIdRef.current !== lessonId) return nextSession;
        const video = videoRef.current;
        pendingPositionRef.current = video?.currentTime || lastPositionRef.current;
        playbackRetryRef.current = false;
        setPlayerError('');
        setActiveSession(nextSession);
        return nextSession;
      })
      .catch((refreshError) => {
        if (currentLessonIdRef.current === lessonId) {
          setPlayerError('Phiên phát video đã hết hạn hoặc tạm thời gián đoạn. Vui lòng thử lại.');
        }
        throw refreshError;
      })
      .finally(() => {
        if (refreshPromiseRef.current === request) {
          refreshPromiseRef.current = null;
          refreshLessonIdRef.current = null;
          setRefreshing(false);
        }
      });
    refreshPromiseRef.current = request;
    refreshLessonIdRef.current = lessonId;
    return request;
  }, [lessonId]);

  useEffect(() => {
    if (activeSession?.lessonId !== lessonId) return;
    const expiresAt = Date.parse(activeSession.expiresAt);
    const delay = Number.isFinite(expiresAt)
      ? Math.max(1_000, expiresAt - Date.now() - SESSION_REFRESH_MARGIN_MS)
      : 0;
    if (!delay) return;
    const timer = window.setTimeout(() => void refreshSession().catch(() => undefined), delay);
    return () => window.clearTimeout(timer);
  }, [activeSession, lessonId, refreshSession]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeSession?.lessonId !== lessonId) return;

    setPlayerError('');
    setQualities([]);
    setSelectedLevel(-1);
    playbackRetryRef.current = false;
    mediaRecoveryAttemptsRef.current = 0;

    const restorePosition = () => {
      const position = pendingPositionRef.current;
      if (position > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(position, Math.max(0, video.duration - 0.25));
      }
    };
    video.addEventListener('loadedmetadata', restorePosition);

    if (Hls.isSupported()) {
      setNativeHls(false);
      const hls = new Hls({
        enableWorker: true,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(Events.MEDIA_ATTACHED, () => hls.loadSource(activeSession.manifestUrl));
      hls.on(Events.MANIFEST_PARSED, () => setQualities(qualityOptions(hls.levels)));
      hls.on(Events.LEVEL_SWITCHED, (_event, data) => {
        if (hls.autoLevelEnabled) setSelectedLevel(-1);
        else setSelectedLevel(data.level);
      });
      hls.on(Events.ERROR, (_event, data) => {
        if (data.type === ErrorTypes.NETWORK_ERROR && responseStatus(data) === 401 && !playbackRetryRef.current) {
          playbackRetryRef.current = true;
          void refreshSession().catch(() => undefined);
          return;
        }
        if (!data.fatal) return;
        if (data.type === ErrorTypes.MEDIA_ERROR && mediaRecoveryAttemptsRef.current < 1) {
          mediaRecoveryAttemptsRef.current += 1;
          hls.recoverMediaError();
          return;
        }
        setPlayerError('Không thể phát video. Hãy kiểm tra kết nối rồi thử lại.');
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      setNativeHls(true);
      video.src = activeSession.manifestUrl;
      video.load();
    } else {
      setPlayerError('Trình duyệt này không hỗ trợ phát video HLS.');
    }

    const onVideoError = () => {
      if (!hlsRef.current && !playbackRetryRef.current) {
        playbackRetryRef.current = true;
        void refreshSession().catch(() => undefined);
        return;
      }
      if (!hlsRef.current) setPlayerError('Không thể phát video. Hãy thử tải lại phiên phát.');
    };
    video.addEventListener('error', onVideoError);

    return () => {
      video.removeEventListener('loadedmetadata', restorePosition);
      video.removeEventListener('error', onVideoError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };
  }, [activeSession, lessonId, refreshSession]);

  const flushProgress = useCallback((keepalive = false) => {
    if (!progressDirtyRef.current) return progressRequestRef.current ?? Promise.resolve();
    if (progressRequestRef.current) return progressRequestRef.current;

    const positionSeconds = Math.max(0, Math.floor(lastPositionRef.current));
    const watchedDeltaSeconds = Math.min(
      MAX_WATCHED_DELTA_PER_UPDATE,
      Math.max(0, Math.floor(watchedDeltaSecondsRef.current)),
    );
    const requestLessonId = lessonId;
    progressDirtyRef.current = false;
    const request = learningApi.updateProgress(
      lessonId,
      { positionSeconds, watchedDeltaSeconds },
      { keepalive },
    ).then(async (progress) => {
      if (currentLessonIdRef.current === requestLessonId) {
        watchedDeltaSecondsRef.current = Math.max(0, watchedDeltaSecondsRef.current - watchedDeltaSeconds);
        if (watchedDeltaSecondsRef.current >= 1) progressDirtyRef.current = true;
      }
      const reachedThreshold = progress.completionPct >= COMPLETION_THRESHOLD * 100;
      if (currentLessonIdRef.current === requestLessonId && reachedThreshold && !completionRequestedRef.current) {
        completionRequestedRef.current = true;
        await learningApi.completeLesson(lessonId).catch(() => {
          completionRequestedRef.current = false;
        });
      }
    }).catch(() => {
      progressDirtyRef.current = true;
    }).finally(() => {
      progressRequestRef.current = null;
    });
    progressRequestRef.current = request;
    return request;
  }, [lessonId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const position = Math.max(0, video.currentTime || 0);
      const previous = lastTimeUpdateRef.current;
      if (!video.paused && !video.seeking && previous !== null) {
        const delta = position - previous;
        if (delta > 0 && delta <= 5) watchedDeltaSecondsRef.current += delta;
      }
      lastTimeUpdateRef.current = position;
      lastPositionRef.current = position;
      progressDirtyRef.current = true;
    };
    const onSeeking = () => { lastTimeUpdateRef.current = null; };
    const onPause = () => void flushProgress();
    const onEnded = () => void flushProgress();
    const onPageHide = () => void flushProgress(true);
    const interval = window.setInterval(() => void flushProgress(), PROGRESS_INTERVAL_MS);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(interval);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', onPageHide);
      void flushProgress(true);
    };
  }, [flushProgress]);

  const availableQualityLabels = useMemo(
    () => new Set<string>(activeSession?.variants.filter((item) => item.isReady).map((item) => item.resolution) ?? []),
    [activeSession],
  );

  const changeQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    pendingPositionRef.current = videoRef.current?.currentTime || 0;
    hls.currentLevel = levelIndex;
    setSelectedLevel(levelIndex);
  };

  const hasCurrentSession = activeSession?.lessonId === lessonId;

  if (loading && !hasCurrentSession) {
    return <div aria-live="polite" className="flex aspect-video animate-pulse items-center justify-center bg-slate-900 text-slate-300">Đang tạo phiên phát...</div>;
  }

  if (!activeSession || !hasCurrentSession) {
    return <div role="alert" className="flex aspect-video flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-amber-100"><p>{playerError || 'Video chưa sẵn sàng.'}</p><button type="button" onClick={() => void refreshSession().catch(() => undefined)} disabled={refreshing} className="rounded-lg bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-60">{refreshing ? 'Đang thử lại...' : 'Thử lại'}</button></div>;
  }

  return <div className="relative aspect-video bg-black">
    <video ref={videoRef} controls playsInline preload="metadata" className="h-full w-full" aria-label="Video bài học" />
    <div className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/70 p-2 text-sm text-white">
      <label htmlFor={`video-quality-${lessonId}`} className="sr-only">Chất lượng video</label>
      <select id={`video-quality-${lessonId}`} value={selectedLevel} onChange={(event) => changeQuality(Number(event.target.value))} disabled={nativeHls || qualities.length === 0} title={nativeHls ? 'Safari tự động chọn chất lượng phù hợp' : 'Chọn chất lượng video'} className="rounded border border-white/30 bg-slate-950 px-2 py-1 text-white disabled:opacity-70">
        <option value={-1}>Tự động</option>
        {qualities.filter((quality) => availableQualityLabels.size === 0 || availableQualityLabels.has(quality.label)).map((quality) => <option key={quality.levelIndex} value={quality.levelIndex}>{quality.label}</option>)}
      </select>
    </div>
    {refreshing ? <div aria-live="polite" className="absolute left-3 top-3 rounded bg-black/70 px-3 py-2 text-sm text-white">Đang làm mới phiên phát...</div> : null}
    {playerError ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-8 text-center text-amber-100"><p>{playerError}</p><button type="button" onClick={() => void refreshSession().catch(() => undefined)} disabled={refreshing} className="rounded-lg bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-60">Thử lại</button></div> : null}
  </div>;
}
