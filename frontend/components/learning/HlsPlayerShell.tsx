'use client';

import Hls, { ErrorTypes, Events, type ErrorData, type Level } from 'hls.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiMaximize,
  FiMinimize,
  FiMonitor,
  FiPause,
  FiPlay,
  FiRotateCcw,
  FiRotateCw,
  FiVolume2,
  FiVolumeX,
} from 'react-icons/fi';
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

function formatPlaybackTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function HlsPlayerShell({ lessonId, session, loading = false, error = '' }: PlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const syncPlayback = () => {
      setIsPlaying(!video.paused && !video.ended);
      setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setVolume(video.volume);
      setMuted(video.muted);
      setPlaybackRate(video.playbackRate);
    };
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    const events = ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'ratechange'] as const;
    events.forEach((eventName) => video.addEventListener(eventName, syncPlayback));
    const enterPictureInPicture = () => setIsPictureInPicture(true);
    const leavePictureInPicture = () => setIsPictureInPicture(false);
    video.addEventListener('enterpictureinpicture', enterPictureInPicture);
    video.addEventListener('leavepictureinpicture', leavePictureInPicture);
    document.addEventListener('fullscreenchange', syncFullscreen);
    setPictureInPictureSupported(
      document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function',
    );
    syncPlayback();
    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, syncPlayback));
      video.removeEventListener('enterpictureinpicture', enterPictureInPicture);
      video.removeEventListener('leavepictureinpicture', leavePictureInPicture);
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, [activeSession, lessonId]);

  const availableQualityLabels = useMemo(
    () => new Set<string>(activeSession?.variants.filter((item) => item.isReady).map((item) => item.resolution) ?? []),
    [activeSession],
  );

  const changeQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    // Switch on the next HLS segment boundary. `currentLevel` flushes the
    // existing buffer and visibly stalls playback, while `nextLevel` keeps the
    // currently playing fragment intact and changes quality without pausing.
    hls.nextLevel = levelIndex;
    setSelectedLevel(levelIndex);
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => setPlayerError('Trình duyệt chưa cho phép phát video. Hãy bấm phát lại.'));
    } else {
      video.pause();
    }
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
  };

  const seekTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, seconds));
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  };

  const changeVolume = (nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
  };

  const changePlaybackRate = (nextRate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.defaultPlaybackRate = nextRate;
    video.playbackRate = nextRate;
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !pictureInPictureSupported) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (player.requestFullscreen) {
      await player.requestFullscreen();
      return;
    }
    const safariVideo = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    safariVideo?.webkitEnterFullscreen?.();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    if ('MediaMetadata' in window) {
      mediaSession.metadata = new MediaMetadata({
        title: 'Video bài học',
        artist: 'CSCA',
        album: 'CSCA Learning',
      });
    }
    const safeAction = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try { mediaSession.setActionHandler(action, handler); } catch { /* Unsupported action. */ }
    };
    safeAction('play', () => void video.play());
    safeAction('pause', () => video.pause());
    safeAction('seekbackward', (details) => seekBy(-(details.seekOffset || 10)));
    safeAction('seekforward', (details) => seekBy(details.seekOffset || 10));
    safeAction('seekto', (details) => {
      if (details.seekTime === undefined) return;
      if (details.fastSeek && typeof video.fastSeek === 'function') video.fastSeek(details.seekTime);
      else seekTo(details.seekTime);
    });
    const syncMediaSession = () => {
      mediaSession.playbackState = video.paused ? 'paused' : 'playing';
      if (Number.isFinite(video.duration) && video.duration > 0) {
        try {
          mediaSession.setPositionState({
            duration: video.duration,
            playbackRate: video.playbackRate,
            position: Math.min(video.currentTime, video.duration),
          });
        } catch { /* Position state is optional. */ }
      }
    };
    video.addEventListener('play', syncMediaSession);
    video.addEventListener('pause', syncMediaSession);
    video.addEventListener('timeupdate', syncMediaSession);
    video.addEventListener('ratechange', syncMediaSession);
    syncMediaSession();
    return () => {
      video.removeEventListener('play', syncMediaSession);
      video.removeEventListener('pause', syncMediaSession);
      video.removeEventListener('timeupdate', syncMediaSession);
      video.removeEventListener('ratechange', syncMediaSession);
      safeAction('play', null);
      safeAction('pause', null);
      safeAction('seekbackward', null);
      safeAction('seekforward', null);
      safeAction('seekto', null);
      mediaSession.metadata = null;
    };
  }, [activeSession, lessonId]);

  const hasCurrentSession = activeSession?.lessonId === lessonId;

  if (loading && !hasCurrentSession) {
    return <div aria-live="polite" className="flex aspect-video w-full animate-pulse items-center justify-center bg-slate-900 text-slate-300 lg:h-full lg:aspect-auto">Đang tạo phiên phát...</div>;
  }

  if (!activeSession || !hasCurrentSession) {
    return <div role="alert" className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-amber-100 lg:h-full lg:aspect-auto"><p>{playerError || 'Video chưa sẵn sàng.'}</p><button type="button" onClick={() => void refreshSession().catch(() => undefined)} disabled={refreshing} className="rounded-lg bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-60">{refreshing ? 'Đang thử lại...' : 'Thử lại'}</button></div>;
  }

  return <div ref={playerRef} className="group relative aspect-video w-full overflow-hidden bg-black lg:h-full lg:aspect-auto">
    <video
      ref={videoRef}
      playsInline
      preload="metadata"
      className="h-full w-full cursor-pointer object-contain"
      aria-label="Video bài học"
      onClick={togglePlayback}
    />
    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-10 text-white sm:px-4">
      <label htmlFor={`video-progress-${lessonId}`} className="sr-only">Vị trí phát video</label>
      <input
        id={`video-progress-${lessonId}`}
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => seekTo(Number(event.target.value))}
        className="mb-2 h-1.5 w-full cursor-pointer accent-indigo-500"
      />
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Tạm dừng' : 'Phát video'} title={isPlaying ? 'Tạm dừng' : 'Phát video'} className="rounded-lg p-2 hover:bg-white/15">
          {isPlaying ? <FiPause className="h-5 w-5" /> : <FiPlay className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => seekBy(-10)} aria-label="Tua lùi 10 giây" title="Tua lùi 10 giây" className="relative rounded-lg p-2 hover:bg-white/15">
          <FiRotateCcw className="h-5 w-5" /><span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[8px] font-black">10</span>
        </button>
        <button type="button" onClick={() => seekBy(10)} aria-label="Tua tới 10 giây" title="Tua tới 10 giây" className="relative rounded-lg p-2 hover:bg-white/15">
          <FiRotateCw className="h-5 w-5" /><span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[8px] font-black">10</span>
        </button>
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} className="rounded-lg p-2 hover:bg-white/15">
          {muted || volume === 0 ? <FiVolumeX className="h-5 w-5" /> : <FiVolume2 className="h-5 w-5" />}
        </button>
        <label htmlFor={`video-volume-${lessonId}`} className="sr-only">Âm lượng</label>
        <input
          id={`video-volume-${lessonId}`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
        />
        <span className="hidden min-w-24 whitespace-nowrap text-xs font-semibold tabular-nums text-white/90 sm:inline">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
        </span>
        <div className="min-w-0 flex-1" />
        <label htmlFor={`video-quality-${lessonId}`} className="sr-only">Chất lượng video</label>
        <select id={`video-quality-${lessonId}`} value={selectedLevel} onChange={(event) => changeQuality(Number(event.target.value))} disabled={nativeHls || qualities.length === 0} title={nativeHls ? 'Safari tự động chọn chất lượng phù hợp' : 'Chọn chất lượng video'} className="max-w-24 rounded-lg border border-white/30 bg-black/70 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-70">
          <option value={-1}>Tự động</option>
          {qualities.filter((quality) => availableQualityLabels.size === 0 || availableQualityLabels.has(quality.label)).map((quality) => <option key={quality.levelIndex} value={quality.levelIndex}>{quality.label}</option>)}
        </select>
        <label htmlFor={`video-speed-${lessonId}`} className="sr-only">Tốc độ phát</label>
        <select
          id={`video-speed-${lessonId}`}
          value={playbackRate}
          onChange={(event) => changePlaybackRate(Number(event.target.value))}
          title="Tốc độ phát"
          className="rounded-lg border border-white/30 bg-black/70 px-2 py-1.5 text-xs font-bold text-white"
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
        <button
          type="button"
          onClick={() => void togglePictureInPicture()}
          disabled={!pictureInPictureSupported}
          aria-label={isPictureInPicture ? 'Đóng cửa sổ nổi' : 'Phát nền trong cửa sổ nổi'}
          title={pictureInPictureSupported ? (isPictureInPicture ? 'Đóng cửa sổ nổi' : 'Phát nền / cửa sổ nổi') : 'Trình duyệt không hỗ trợ cửa sổ nổi'}
          className={`rounded-lg p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 ${isPictureInPicture ? 'bg-indigo-600' : ''}`}
        >
          <FiMonitor className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'} title={isFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'} className="rounded-lg p-2 hover:bg-white/15">
          {isFullscreen ? <FiMinimize className="h-5 w-5" /> : <FiMaximize className="h-5 w-5" />}
        </button>
      </div>
    </div>
    {!isPlaying && currentTime === 0 && !playerError ? (
      <button type="button" onClick={togglePlayback} aria-label="Phát video" className="absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/65 p-5 text-white shadow-xl transition hover:scale-105 hover:bg-indigo-600">
        <FiPlay className="h-8 w-8 translate-x-0.5" />
      </button>
    ) : null}
    {refreshing ? <div aria-live="polite" className="absolute left-3 top-3 rounded bg-black/70 px-3 py-2 text-sm text-white">Đang làm mới phiên phát...</div> : null}
    {playerError ? <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-8 text-center text-amber-100"><p>{playerError}</p><button type="button" onClick={() => void refreshSession().catch(() => undefined)} disabled={refreshing} className="rounded-lg bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-60">Thử lại</button></div> : null}
  </div>;
}
