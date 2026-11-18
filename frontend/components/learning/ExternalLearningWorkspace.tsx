'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiAlertTriangle,
  FiBookmark,
  FiCheck,
  FiClock,
  FiColumns,
  FiLayers,
  FiLock,
  FiMaximize2,
  FiPlayCircle,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey } from '@/lib/api/learning';
import type {
  CurriculumSectionDto,
  ExternalCourseWorkspaceDto,
  ExternalQuizSubmitResponseDto,
  ExternalVideoPartDto,
  ExternalVideoPlaybackTokenDto,
  ExternalWorkspaceProgressDto,
  ExternalWorkspaceUnitSummaryDto,
} from '@/lib/types/courses';
import { publicCourseModeLabel, publicCourseProfileLabel } from '@/lib/coursePresentation';
import { ExternalUnitContentTabs, type ExternalTabId } from './ExternalUnitContentTabs';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningRoomLoading } from './LearningRoomLoading';
import { LearningSidebar } from './LearningSidebar';

const ALLOWED_BUNNY_ORIGINS = new Set([
  'https://iframe.mediadelivery.net',
  'https://player.mediadelivery.net',
]);

function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function getSafeBunnyEmbedUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (!ALLOWED_BUNNY_ORIGINS.has(parsed.origin) || !parsed.pathname.startsWith('/embed/')) return null;
    parsed.searchParams.set('autoplay', 'false');
    parsed.searchParams.set('playsinline', 'true');
    parsed.searchParams.set('disableIosPlayer', 'true');
    parsed.searchParams.set('chromecast', 'false');
    parsed.searchParams.set('disableAirPlay', 'true');
    return parsed.toString();
  } catch {
    return null;
  }
}

function groupUnitsIntoSections(
  units: ExternalWorkspaceUnitSummaryDto[],
): CurriculumSectionDto[] {
  const map = new Map<string, CurriculumSectionDto>();
  for (const unit of units) {
    const secKey = unit.sectionId || 'default';
    let sec = map.get(secKey);
    if (!sec) {
      sec = {
        id: secKey,
        title: unit.sectionTitle || 'Nội dung khóa học',
        description: null,
        sortOrder: unit.sectionSortOrder ?? 0,
        totalDurationSeconds: 0,
        lessons: [],
      };
      map.set(secKey, sec);
    }
    sec.totalDurationSeconds += Number(unit.durationSeconds || 0);
    sec.lessons.push({
      id: unit.id || `u-${unit.unitProjectionId}`,
      externalKey: unit.unitKey,
      slug: `u-${unit.unitProjectionId}`,
      title: unit.title,
      summary: unit.summary,
      lessonType: unit.videoPartCount > 0 || unit.unitType === 'class_session' ? 'video' : 'article',
      sortOrder: unit.sortOrder,
      durationSeconds: unit.durationSeconds,
      isFreePreview: unit.isPublicPreview,
      isRequired: true,
      isLocked: unit.isLocked,
      progressStatus: unit.isCompleted ? 'completed' : unit.watchedPercent > 0 ? 'in_progress' : 'not_started',
      unitProjectionId: unit.unitProjectionId,
      unitType: unit.unitType,
      remoteUnitId: unit.remoteUnitId,
      href: unit.href,
      isPublicPreview: unit.isPublicPreview,
      videoPartCount: unit.videoPartCount,
      hasTheory: unit.hasTheory,
      vocabCount: unit.vocabCount,
      formulaCount: unit.formulaCount,
      fileCount: unit.fileCount,
      quizCount: unit.quizCount,
      assignmentCount: unit.assignmentCount,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

function parseErrorMessage(err: unknown): { code: string | null; message: string } {
  if (err && typeof err === 'object') {
    const ax = err as {
      response?: { status?: number; data?: { code?: string; errorCode?: string; message?: string } };
      message?: string;
    };
    const rawCode = ax.response?.data?.code || ax.response?.data?.errorCode || null;
    const code = rawCode ? String(rawCode).toUpperCase() : null;
    const msg = ax.response?.data?.message || ax.message || '';

    if (code === 'DEVICE_LIMIT_LOCKED') {
      return {
        code,
        message: 'Tài khoản đã bị khóa tạm thời do vượt quá giới hạn thiết bị tin cậy. Vui lòng liên hệ quản trị viên để mở khóa.',
      };
    }
    if (code === 'DEVICE_SLOT_LIMIT_REACHED') {
      return {
        code,
        message: 'Tài khoản đã đạt giới hạn thiết bị tin cậy. Vui lòng đăng xuất thiết bị cũ hoặc liên hệ hỗ trợ trước khi học ở trình duyệt mới.',
      };
    }
    if (code === 'DEVICE_BINDING_REVOKED' || code === 'UNTRUSTED_DEVICE_PROOF') {
      return {
        code,
        message: 'Phiên thiết bị của trình duyệt này đã bị thu hồi hoặc hết hạn. Vui lòng đăng nhập lại để cấp lại phiên tin cậy.',
      };
    }
    if (code === 'UNIT_LOCKED') {
      return {
        code,
        message: msg || 'Bài học đang bị khóa theo trình tự tiến độ. Hãy hoàn thành bài học trước đó để mở khóa.',
      };
    }
    if (code === 'VIDEO_NOT_READY' || code === 'VIDEO_URL_UNAVAILABLE') {
      return {
        code,
        message: msg || 'Video đang được xử lý hoặc tạm thời chưa sẵn sàng để phát.',
      };
    }
    if (code === 'DELEGATED_LEARNING_DISABLED') {
      return {
        code,
        message: 'Không gian học đang được chuẩn bị. Bạn vẫn có thể mở khóa học bằng luồng CSCA-Course hiện tại trong mục Khóa học của tôi.',
      };
    }
    if (code === 'PROFILE_SCOPE_MISMATCH') {
      return { code, message: 'Hồ sơ hoặc bài học không thuộc phạm vi khóa học này.' };
    }
    if (code === 'COURSE_ACCESS_REVOKED' || code === 'COURSE_ENTITLEMENT_REQUIRED' || code === 'ENTITLEMENT_REQUIRED' || ax.response?.status === 403) {
      return { code, message: msg || 'Quyền truy cập khóa học đã hết hạn, bị thu hồi hoặc cần hoàn thành bài trước đó.' };
    }
    if (msg) return { code, message: msg };
  }
  return { code: null, message: 'Không thể mở không gian học. Vui lòng thử lại hoặc đăng nhập lại.' };
}

export function ExternalLearningWorkspace({
  courseSlug,
  externalUnitId,
  initialProfileId = null,
}: {
  courseSlug: string;
  externalUnitId: string;
  initialProfileId?: string | null;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<ExternalCourseWorkspaceDto | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialProfileId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [selectedPartIndex, setSelectedPartIndex] = useState(0);
  const [seekTargetSeconds, setSeekTargetSeconds] = useState<number | null>(null);

  const [playbackToken, setPlaybackToken] = useState<ExternalVideoPlaybackTokenDto | null>(null);
  const [iframeEmbedUrl, setIframeEmbedUrl] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenRefreshing, setTokenRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string>('');
  const [playbackErrorCode, setPlaybackErrorCode] = useState<string | null>(null);
  const [tokenRetryNonce, setTokenRetryNonce] = useState(0);
  const [liveCourseProgress, setLiveCourseProgress] = useState<ExternalWorkspaceProgressDto | null>(null);
  const [liveUnitPercent, setLiveUnitPercent] = useState<number | null>(null);
  const [liveUnitCompleted, setLiveUnitCompleted] = useState(false);
  const [syncBadge, setSyncBadge] = useState('');
  const [livePositionSeconds, setLivePositionSeconds] = useState(0);
  const [requestedTab, setRequestedTab] = useState<ExternalTabId | null>(null);
  const [requestedTabNonce, setRequestedTabNonce] = useState(0);
  const [bookmarkRefreshNonce, setBookmarkRefreshNonce] = useState(0);
  const [savingQuickBookmark, setSavingQuickBookmark] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeEmbedUrlRef = useRef<string | null>(null);
  const deferredEmbedUrlRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const prevSampleRef = useRef<{ seconds: number; time: number } | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const unackedWatchedRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const initialResumeSeededForRef = useRef<string | null>(null);
  const lastSentPosRef = useRef(-1);
  const clientSeqRef = useRef(0);
  const flushingRef = useRef(false);
  const tokenRequestPendingRef = useRef(false);
  const unitCompletedNotifiedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    setSelectedProfileId(initialProfileId);
  }, [initialProfileId, externalUnitId]);

  useEffect(() => {
    try {
      setTheaterMode(window.localStorage.getItem('csca-learning-theater') === '1');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setErrorCode(null);
    setSelectedPartIndex(0);
    setSeekTargetSeconds(null);
    setPlaybackToken(null);
    setIframeEmbedUrl(null);
    iframeEmbedUrlRef.current = null;
    deferredEmbedUrlRef.current = null;
    setPlaybackError('');
    setPlaybackErrorCode(null);
    setLiveCourseProgress(null);
    setLiveUnitPercent(null);
    setLiveUnitCompleted(false);
    setSyncBadge('');
    setLivePositionSeconds(0);
    setRequestedTab(null);
    setBookmarkRefreshNonce(0);
    playingRef.current = false;
    prevSampleRef.current = null;
    positionRef.current = 0;
    durationRef.current = 0;
    unackedWatchedRef.current = 0;
    pendingSeekRef.current = null;
    initialResumeSeededForRef.current = null;
    lastSentPosRef.current = -1;
    unitCompletedNotifiedRef.current = false;

    learningApi.getExternalCourseWorkspace({
      courseSlugOrId: courseSlug,
      profileId: selectedProfileId,
      unitId: externalUnitId,
    })
      .then((data) => {
        if (!active) return;
        setWorkspace(data);
        setLiveCourseProgress(data.progress ?? null);
        setLiveUnitCompleted(Boolean(data.activeUnit?.watchProgress?.isCompleted));
        if (typeof data.activeUnit?.watchProgress?.completionPercent === 'number') {
          setLiveUnitPercent(data.activeUnit.watchProgress.completionPercent);
        }
        if (data.activeUnit?.watchProgress?.isCompleted) {
          unitCompletedNotifiedRef.current = true;
        }
      })
      .catch((err) => {
        if (!active) return;
        const parsed = parseErrorMessage(err);
        setErrorCode(parsed.code);
        setError(parsed.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [courseSlug, externalUnitId, selectedProfileId, requestVersion]);

  const toggleTheaterMode = () => {
    setTheaterMode((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('csca-learning-theater', next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  };

  const handleProfileSwitch = (nextProfileId: string) => {
    setSelectedProfileId(nextProfileId);
    router.push(`/hoc/${courseSlug}/bai-hoc/${externalUnitId}?profileId=${encodeURIComponent(nextProfileId)}`);
  };

  const sections = useMemo(
    () => groupUnitsIntoSections(workspace?.units ?? []),
    [workspace?.units],
  );

  const navContext = useMemo(() => {
    const units = workspace?.units ?? [];
    const numericTarget = Number(externalUnitId.replace(/^u-/, ''));
    const activeIdx = units.findIndex((u) => u.unitProjectionId === numericTarget || u.id === externalUnitId);
    const activeUnitSummary = activeIdx >= 0 ? units[activeIdx] : units[0] ?? null;
    const prev = activeIdx > 0 ? units[activeIdx - 1] : null;
    const next = activeIdx >= 0 && activeIdx < units.length - 1 ? units[activeIdx + 1] : null;
    const firstUnlocked = units.find((u) => !u.isLocked) ?? null;
    return {
      activeIdx,
      activeUnitSummary,
      prev,
      next,
      firstUnlocked,
      currentLabel: activeIdx >= 0 ? `Bài ${activeIdx + 1}/${units.length}` : 'Bài học',
    };
  }, [workspace?.units, externalUnitId]);

  const activeUnit = workspace?.activeUnit ?? null;
  const videoParts: ExternalVideoPartDto[] = useMemo(() => {
    if (activeUnit?.videos && activeUnit.videos.length > 0) return activeUnit.videos;
    if (activeUnit?.video) return [activeUnit.video];
    return [];
  }, [activeUnit]);

  const activeVideo = videoParts[selectedPartIndex] ?? videoParts[0] ?? null;
  const activeVideoId = activeVideo ? (activeVideo.assetId || activeVideo.id || activeVideo.partId || null) : null;
  const isUnitLocked = Boolean(workspace?.selectedUnitLock?.locked || activeUnit?.isLocked);
  const remoteProfileId = workspace?.profile?.remoteProfileId || null;
  const unitParamId = activeUnit?.id || externalUnitId;
  const canUseDelegatedPlayback = Boolean(
    workspace
    && !workspace.isPublicPreviewAccess
    && !isUnitLocked
    && remoteProfileId
    && activeVideoId,
  );

  const sendPlayerCommand = useCallback((method: string, value?: string | number, listener?: string) => {
    const urlStr = iframeEmbedUrlRef.current;
    if (!urlStr || !iframeRef.current?.contentWindow) return;
    try {
      const origin = new URL(urlStr).origin;
      if (!ALLOWED_BUNNY_ORIGINS.has(origin)) return;
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          context: 'player.js',
          version: '0.0.11',
          method,
          ...(value !== undefined ? { value } : {}),
          ...(listener ? { listener } : {}),
        }),
        origin,
      );
    } catch { /* ignore */ }
  }, []);

  const applyDeferredEmbedIfIdle = useCallback(() => {
    if (deferredEmbedUrlRef.current && !playingRef.current && !document.fullscreenElement) {
      if (positionRef.current > 0 && pendingSeekRef.current == null) {
        pendingSeekRef.current = Math.floor(positionRef.current);
      }
      const nextUrl = deferredEmbedUrlRef.current;
      deferredEmbedUrlRef.current = null;
      iframeEmbedUrlRef.current = nextUrl;
      setIframeEmbedUrl(nextUrl);
    }
  }, []);

  const silentRefreshWorkspace = useCallback(async () => {
    if (!workspace) return;
    try {
      const refreshed = await learningApi.getExternalCourseWorkspace({
        courseSlugOrId: courseSlug,
        profileId: selectedProfileId || workspace.profile.remoteProfileId,
        unitId: externalUnitId,
      });
      if (!aliveRef.current) return;
      setWorkspace(refreshed);
      if (refreshed.progress) setLiveCourseProgress(refreshed.progress);
    } catch { /* silent background sync retryable on next action */ }
  }, [courseSlug, externalUnitId, selectedProfileId, workspace]);

  const flushProgress = useCallback(async (keepalive = false, forceOnEnd = false) => {
    if (!canUseDelegatedPlayback || !remoteProfileId || !activeVideoId) return;
    if (flushingRef.current) return;

    const wholeDelta = forceOnEnd
      ? Math.min(60, Math.round(unackedWatchedRef.current))
      : Math.min(60, Math.floor(unackedWatchedRef.current));
    const currentPos = Math.max(0, Math.floor(positionRef.current));
    if (!forceOnEnd && wholeDelta <= 0 && currentPos === lastSentPosRef.current) {
      return;
    }

    flushingRef.current = true;
    const nextSeq = ++clientSeqRef.current;
    try {
      const res = await learningApi.updateExternalVideoProgress({
        profileId: remoteProfileId,
        unitId: unitParamId,
        videoId: String(activeVideoId),
        payload: {
          currentTimeSeconds: currentPos,
          watchedDeltaSeconds: Math.max(0, wholeDelta),
          durationSeconds: durationRef.current > 0
            ? Math.round(durationRef.current)
            : (playbackToken?.durationSeconds ?? activeVideo?.durationSeconds ?? null),
          clientSequence: nextSeq,
          eventTimestamp: new Date().toISOString(),
        },
        keepalive,
      });

      unackedWatchedRef.current = Math.max(0, unackedWatchedRef.current - wholeDelta);
      if (!aliveRef.current) return;

      if (!res.stale) {
        lastSentPosRef.current = Math.floor(res.lastPositionSeconds ?? currentPos);
        const unitPct = res.unitProgress?.completionPercent ?? res.completionPercent;
        if (typeof unitPct === 'number') setLiveUnitPercent(unitPct);
        if (res.courseProgress) setLiveCourseProgress(res.courseProgress);
        if (res.isUnitCompleted) {
          setLiveUnitCompleted(true);
          setSyncBadge('Đã đạt mốc hoàn thành bài học');
          if (!unitCompletedNotifiedRef.current) {
            unitCompletedNotifiedRef.current = true;
            void silentRefreshWorkspace();
          }
        } else if (wholeDelta > 0) {
          setSyncBadge(`Đã đồng bộ tiến độ (${Math.round(unitPct ?? 0)}%)`);
        }
      }
    } catch (err) {
      // Never fake completion on network/server failure; preserve unacked watch time and inspect hard locks.
      if (!aliveRef.current) return;
      const parsed = parseErrorMessage(err);
      if (
        parsed.code === 'DEVICE_LIMIT_LOCKED'
        || parsed.code === 'DEVICE_SLOT_LIMIT_REACHED'
        || parsed.code === 'DEVICE_BINDING_REVOKED'
        || parsed.code === 'UNTRUSTED_DEVICE_PROOF'
      ) {
        sendPlayerCommand('pause');
        playingRef.current = false;
        setPlaybackErrorCode(parsed.code);
        setPlaybackError(parsed.message);
      }
    } finally {
      flushingRef.current = false;
    }
  }, [
    activeVideo?.durationSeconds,
    activeVideoId,
    canUseDelegatedPlayback,
    playbackToken?.durationSeconds,
    remoteProfileId,
    sendPlayerCommand,
    silentRefreshWorkspace,
    unitParamId,
  ]);

  const requestPlaybackToken = useCallback(async (forceSwap = false) => {
    if (!canUseDelegatedPlayback || !remoteProfileId || !activeVideoId) return;
    if (tokenRequestPendingRef.current) return;
    tokenRequestPendingRef.current = true;
    const isInitialLoad = !iframeEmbedUrlRef.current || forceSwap;
    if (isInitialLoad) setTokenLoading(true);
    else setTokenRefreshing(true);

    try {
      const nextToken = await learningApi.createExternalPlaybackToken({
        profileId: remoteProfileId,
        unitId: unitParamId,
        videoId: String(activeVideoId),
        ttlSeconds: 60,
      });
      if (!aliveRef.current) return;

      const safeNextUrl = getSafeBunnyEmbedUrl(nextToken.embedUrl);
      if (!safeNextUrl) {
        setPlaybackErrorCode('VIDEO_URL_UNAVAILABLE');
        setPlaybackError('Địa chỉ video phát không hợp lệ hoặc ngoài nguồn Bunny được phép.');
        return;
      }

      setPlaybackToken(nextToken);
      setPlaybackError('');
      setPlaybackErrorCode(null);

      const videoKey = `${remoteProfileId}:${unitParamId}:${String(activeVideoId)}`;
      if (initialResumeSeededForRef.current !== videoKey) {
        initialResumeSeededForRef.current = videoKey;
        const resumeSec = Math.max(0, Math.floor(Number(nextToken.resumePositionSeconds || 0)));
        if (pendingSeekRef.current === null && resumeSec > 0) {
          pendingSeekRef.current = resumeSec;
          positionRef.current = resumeSec;
          setLivePositionSeconds(resumeSec);
        }
        durationRef.current = Number(nextToken.durationSeconds || activeVideo?.durationSeconds || 0);
        if (nextToken.unitProgress) {
          setLiveUnitPercent(nextToken.unitProgress.completionPercent);
          if (nextToken.unitProgress.isCompleted) {
            setLiveUnitCompleted(true);
            unitCompletedNotifiedRef.current = true;
          }
        }
      }

      if (forceSwap || !iframeEmbedUrlRef.current || (!playingRef.current && !document.fullscreenElement)) {
        if (iframeEmbedUrlRef.current && positionRef.current > 0 && pendingSeekRef.current === null) {
          pendingSeekRef.current = Math.floor(positionRef.current);
        }
        deferredEmbedUrlRef.current = null;
        iframeEmbedUrlRef.current = safeNextUrl;
        setIframeEmbedUrl(safeNextUrl);
      } else {
        deferredEmbedUrlRef.current = safeNextUrl;
      }
    } catch (err) {
      if (!aliveRef.current) return;
      sendPlayerCommand('pause');
      playingRef.current = false;
      const parsed = parseErrorMessage(err);
      setPlaybackErrorCode(parsed.code);
      setPlaybackError(parsed.message);
    } finally {
      tokenRequestPendingRef.current = false;
      if (aliveRef.current) {
        setTokenLoading(false);
        setTokenRefreshing(false);
      }
    }
  }, [activeVideo?.durationSeconds, activeVideoId, canUseDelegatedPlayback, remoteProfileId, sendPlayerCommand, unitParamId]);

  useEffect(() => {
    if (!canUseDelegatedPlayback || !activeVideoId) return undefined;
    // Reset per-part tracking state when switching video parts within a unit
    playingRef.current = false;
    prevSampleRef.current = null;
    unackedWatchedRef.current = 0;
    lastSentPosRef.current = -1;
    iframeEmbedUrlRef.current = null;
    deferredEmbedUrlRef.current = null;
    setIframeEmbedUrl(null);
    setPlaybackToken(null);
    setPlaybackError('');
    setPlaybackErrorCode(null);

    void requestPlaybackToken(true);
    return () => {
      void flushProgress(true);
    };
  }, [activeVideoId, canUseDelegatedPlayback, tokenRetryNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canUseDelegatedPlayback || !playbackToken?.expiresAt || playbackErrorCode) return undefined;
    const expiresAtMs = Date.parse(playbackToken.expiresAt);
    const delayMs = Number.isFinite(expiresAtMs)
      ? Math.max(8000, Math.min(48000, expiresAtMs - Date.now() - 12000))
      : 45000;
    const timer = window.setTimeout(() => {
      void requestPlaybackToken(false);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [canUseDelegatedPlayback, playbackErrorCode, playbackToken?.expiresAt, requestPlaybackToken]);

  useEffect(() => {
    if (!canUseDelegatedPlayback || !iframeEmbedUrl) return undefined;
    let readyHandled = false;

    const receive = (event: MessageEvent) => {
      if (!ALLOWED_BUNNY_ORIGINS.has(event.origin)) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      let data: { context?: string; event?: string; value?: { seconds?: number; duration?: number } } | null = null;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || data.context !== 'player.js') return;

      if (data.event === 'ready' && !readyHandled) {
        readyHandled = true;
        for (const name of ['play', 'pause', 'ended', 'timeupdate', 'seek', 'error']) {
          sendPlayerCommand('addEventListener', name, `ext-${String(activeVideoId)}-${name}`);
        }
        if (pendingSeekRef.current !== null && pendingSeekRef.current > 0) {
          sendPlayerCommand('setCurrentTime', pendingSeekRef.current);
          positionRef.current = pendingSeekRef.current;
          pendingSeekRef.current = null;
        }
        if (playingRef.current && !document.hidden) {
          sendPlayerCommand('play');
        }
      } else if (data.event === 'play') {
        playingRef.current = !document.hidden;
        prevSampleRef.current = null;
        if (document.hidden) sendPlayerCommand('pause');
      } else if (data.event === 'pause') {
        playingRef.current = false;
        prevSampleRef.current = null;
        void flushProgress(false);
        applyDeferredEmbedIfIdle();
      } else if (data.event === 'ended') {
        playingRef.current = false;
        prevSampleRef.current = null;
        void flushProgress(false, true);
        applyDeferredEmbedIfIdle();
      } else if (data.event === 'seek') {
        prevSampleRef.current = null;
      } else if (data.event === 'error') {
        playingRef.current = false;
        prevSampleRef.current = null;
        setPlaybackErrorCode('BUNNY_PLAYER_ERROR');
        setPlaybackError('Trình phát video tạm thời gặp lỗi. Hãy thử tải lại phiên phát.');
      } else if (data.event === 'timeupdate') {
        const seconds = Number(data.value?.seconds);
        const duration = Number(data.value?.duration);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(duration) || duration <= 0 || seconds > duration + 1) {
          return;
        }
        durationRef.current = duration;
        const nowPerf = performance.now();
        const last = prevSampleRef.current;
        if (playingRef.current && last) {
          const delta = seconds - last.seconds;
          const elapsed = (nowPerf - last.time) / 1000;
          if (delta > 0 && delta <= 5 && delta <= elapsed * 2.1 + 0.25) {
            unackedWatchedRef.current += delta;
          }
        }
        const roundedSec = Math.floor(seconds);
        positionRef.current = seconds;
        setLivePositionSeconds((prev) => (prev === roundedSec ? prev : roundedSec));
        prevSampleRef.current = { seconds, time: nowPerf };
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden && playingRef.current) {
        sendPlayerCommand('pause');
        playingRef.current = false;
        prevSampleRef.current = null;
        void flushProgress(true);
      }
    };
    const onFullscreenChange = () => applyDeferredEmbedIfIdle();
    const onPageHide = () => {
      void flushProgress(true);
    };
    const interval = window.setInterval(() => {
      void flushProgress(false);
    }, 15000);

    window.addEventListener('message', receive);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('message', receive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('pagehide', onPageHide);
      window.clearInterval(interval);
    };
  }, [activeVideoId, applyDeferredEmbedIfIdle, canUseDelegatedPlayback, flushProgress, iframeEmbedUrl, sendPlayerCommand]);

  const handleSeekVideo = (seconds: number) => {
    const clean = Math.max(0, Math.floor(seconds));
    setSeekTargetSeconds(clean);
    setLivePositionSeconds(clean);
    positionRef.current = clean;
    pendingSeekRef.current = clean;
    prevSampleRef.current = null;
    sendPlayerCommand('setCurrentTime', clean);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickBookmark = async () => {
    if (!workspace || workspace.isPublicPreviewAccess || !remoteProfileId || savingQuickBookmark) return;
    const sec = Math.max(0, Math.floor(positionRef.current || livePositionSeconds));
    try {
      setSavingQuickBookmark(true);
      await learningApi.createExternalUnitBookmark({
        profileId: remoteProfileId,
        unitId: unitParamId,
        timestampSeconds: sec,
        label: `Mốc ${formatClock(sec)}`,
        videoAssetId: activeVideoId ? String(activeVideoId) : null,
        idempotencyKey: generateIdempotencyKey(),
      });
      setBookmarkRefreshNonce((n) => n + 1);
      setSyncBadge(`Đã lưu mốc ${formatClock(sec)}`);
    } catch {
      setSyncBadge('Chưa thể lưu mốc video');
    } finally {
      setSavingQuickBookmark(false);
    }
  };

  const handleQuizSubmitted = useCallback((response: ExternalQuizSubmitResponseDto) => {
    if (response.courseProgress) {
      setLiveCourseProgress(response.courseProgress);
    }
    if (response.unitProgress) {
      setLiveUnitPercent(response.unitProgress.completionPercent);
      if (response.unitProgress.isCompleted) {
        setLiveUnitCompleted(true);
        setSyncBadge('Đã đạt mốc hoàn thành bài học');
      }
    }
    if (Array.isArray(response.units) && response.units.length > 0) {
      const updatedMap = new Map(response.units.map((u) => [String(u.id), u]));
      setWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: response.courseProgress ?? prev.progress,
          units: prev.units.map((u) => {
            const matched = updatedMap.get(String(u.remoteUnitId));
            if (!matched) return u;
            return {
              ...u,
              isLocked: matched.isLocked,
              isCompleted: matched.isCompleted,
              watchedPercent: matched.progressPercent,
            };
          }),
        };
      });
    }
    void silentRefreshWorkspace();
  }, [silentRefreshWorkspace]);

  if (loading) return <LearningRoomLoading progress={null} stage="Đang kết nối không gian học CSCA-Course" />;

  if (error || !workspace) {
    if (errorCode === 'DELEGATED_LEARNING_DISABLED') {
      return (
        <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center px-5 py-12">
          <section className="w-full rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center shadow-sm dark:border-amber-900/70 dark:bg-amber-950/30">
            <FiLock className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" />
            <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Không gian học đang được chuẩn bị</h1>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Bạn vẫn có thể mở khóa học bằng luồng CSCA-Course hiện tại trong mục Khóa học của tôi.
            </p>
            <Link href="/hoc" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900">
              Về khóa học của tôi
            </Link>
          </section>
        </main>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5efe8] p-8 dark:bg-[#050d1d]">
        <div role="alert" className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
          <FiAlertTriangle className="mx-auto mb-3 h-10 w-10" />
          <p className="font-bold">{error || 'Không tìm thấy không gian học.'}</p>
          {errorCode ? <p className="mt-1 text-xs opacity-75">Mã trạng thái: {errorCode}</p> : null}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {errorCode === 'DEVICE_BINDING_REVOKED' || errorCode === 'UNTRUSTED_DEVICE_PROOF' ? (
              <Link href="/login" className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">
                Đăng nhập lại
              </Link>
            ) : (
              <button type="button" onClick={() => setRequestVersion((v) => v + 1)} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">
                Thử lại
              </button>
            )}
            <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-lg border border-red-300 px-4 py-2 font-bold dark:border-red-800">
              Về trang khóa học
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isMirror = workspace.profile.mode === 'MIRROR';
  const modeLabel = publicCourseModeLabel(workspace.profile.mode);
  const isLocked = isUnitLocked;
  const lockReason = workspace.selectedUnitLock?.reason
    || activeUnit?.lockReason
    || 'Hãy hoàn thành bài học và bài kiểm tra bắt buộc trước đó để mở khóa nội dung này.';
  const activeUnitProjectionId = activeUnit?.unitProjectionId
    ?? navContext.activeUnitSummary?.unitProjectionId
    ?? (Number(externalUnitId.replace(/^u-/, '')) || 0);
  const activeSidebarId = navContext.activeUnitSummary?.id || externalUnitId;
  const progressPct = liveCourseProgress?.overallPercent ?? workspace.progress?.overallPercent ?? 0;
  const deviceLimit = workspace.profile.capabilities?.deviceLimit ?? workspace.profile.deviceLimit;

  const previewEmbedUrl = workspace.isPublicPreviewAccess
    ? getSafeBunnyEmbedUrl(activeVideo?.embedUrl)
    : null;
  const activeIframeSrc = workspace.isPublicPreviewAccess ? previewEmbedUrl : iframeEmbedUrl;
  const unitDisplayPct = liveUnitPercent
    ?? activeUnit?.watchProgress?.completionPercent
    ?? navContext.activeUnitSummary?.watchedPercent
    ?? null;
  const isUnitMarkedCompleted = liveUnitCompleted || Boolean(navContext.activeUnitSummary?.isCompleted);

  return (
    <div className="min-h-screen bg-[#f5efe8] text-[#18243a] transition-colors duration-300 dark:bg-[#050d1d] dark:text-[#f1e5d3]">
      <LearningHeader
        courseSlug={courseSlug}
        courseTitle={workspace.course.title}
        progressPct={progressPct}
        badgeLabel={modeLabel}
        onNotesClick={() => {
          setRequestedTab('notes');
          setRequestedTabNonce((n) => n + 1);
          document.getElementById('external-workspace-tabs')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <div className={`relative mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:items-start lg:px-8 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_430px]'}`}>
        <main className="min-w-0 space-y-5">
          {workspace.isPublicPreviewAccess ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:from-amber-950/50 dark:to-orange-950/30 dark:text-amber-100">
              <div>
                <p className="font-black">Bạn đang xem thử miễn phí (Public Preview)</p>
                <p className="mt-0.5 text-xs opacity-85">Mở khóa khóa học để xem toàn bộ bài giảng, bài tập và tải tài liệu.</p>
              </div>
              <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#911a2b]">
                Xem gói mở khóa
              </Link>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfd0c2] bg-[#fffaf4] px-4 py-3 text-xs shadow-sm dark:border-[#2d3b52] dark:bg-[#0b172b]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-black ${
                isMirror
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
              }`}>
                <FiLayers /> {modeLabel}
              </span>
              {workspace.profile.capabilities?.canReviewFreely ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                  Lớp Live · Mở tự do toàn bộ buổi & BTVN
                </span>
              ) : null}
              {deviceLimit ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <FiShield /> Tối đa {deviceLimit} thiết bị
                </span>
              ) : null}
              {syncBadge ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-bold text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
                  {syncBadge}
                </span>
              ) : null}
            </div>

            {workspace.profiles.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {workspace.profiles.map((p) => {
                  const active = p.remoteProfileId === workspace.profile.remoteProfileId;
                  return (
                    <button
                      key={p.remoteProfileId}
                      type="button"
                      onClick={() => handleProfileSwitch(p.remoteProfileId)}
                      className={`rounded-lg border px-2.5 py-1 font-bold transition ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-[#d8c8b9] bg-white text-[#414c61] hover:border-indigo-400 dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200'
                      }`}
                    >
                      {publicCourseProfileLabel(p.title, p.mode)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <section className="overflow-hidden rounded-2xl border border-[#d6c4b2] bg-[#071329] shadow-[0_22px_55px_-32px_rgba(7,19,41,.75)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#49b6ac]">
                    {navContext.currentLabel}
                  </p>
                  {isUnitMarkedCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <FiCheck className="h-3 w-3" /> Đã hoàn thành
                    </span>
                  ) : unitDisplayPct !== null && !workspace.isPublicPreviewAccess ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                      Đã xem {Math.round(unitDisplayPct)}%
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-sm font-black sm:text-base">
                  {activeUnit?.title || navContext.activeUnitSummary?.title || 'Bài học'}
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!isLocked && !workspace.isPublicPreviewAccess && remoteProfileId && activeVideo ? (
                  <button
                    type="button"
                    disabled={savingQuickBookmark}
                    onClick={() => void handleQuickBookmark()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#49b6ac]/40 bg-[#49b6ac]/15 px-3 py-1.5 text-xs font-bold text-[#7ee3d8] transition hover:bg-[#49b6ac]/25 disabled:opacity-50"
                  >
                    <FiBookmark className="h-3.5 w-3.5" />
                    {savingQuickBookmark ? 'Đang lưu...' : `Lưu mốc (${formatClock(livePositionSeconds)})`}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleTheaterMode}
                  className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/15 lg:inline-flex"
                >
                  {theaterMode ? <FiColumns className="h-3.5 w-3.5" /> : <FiMaximize2 className="h-3.5 w-3.5" />}
                  {theaterMode ? 'Hiện cột lộ trình' : 'Chế độ rộng'}
                </button>
              </div>
            </div>

            {videoParts.length > 1 && !isLocked ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0b1b38] px-4 py-2">
                {videoParts.map((part, idx) => (
                  <button
                    key={part.id || part.assetId || idx}
                    type="button"
                    onClick={() => {
                      setSelectedPartIndex(idx);
                      setSeekTargetSeconds(null);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      idx === selectedPartIndex
                        ? 'bg-[#49b6ac] text-[#061126]'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    Phần {part.partNumber || idx + 1}: {part.title}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={`relative aspect-video w-full min-h-0 bg-black ${theaterMode ? 'lg:max-h-[76vh]' : ''}`}>
              {isLocked ? (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#08152b] to-[#13223e] p-6 text-center text-white">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-3xl text-amber-300">
                    <FiLock />
                  </span>
                  <h2 className="mt-4 text-lg font-black sm:text-xl">Bài học đang bị khóa theo trình tự</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">{lockReason}</p>
                  {workspace.selectedUnitLock?.requiredPrevUnitTitle ? (
                    <p className="mt-1 text-xs font-bold text-[#6ac6bd]">
                      Bài cần hoàn thành trước: {workspace.selectedUnitLock.requiredPrevUnitTitle}
                    </p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {navContext.firstUnlocked?.href ? (
                      <Link
                        href={navContext.firstUnlocked.href}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-black text-white hover:bg-white/20"
                      >
                        <FiPlayCircle /> Quay lại bài đang mở
                      </Link>
                    ) : null}
                    {!navContext.firstUnlocked?.href ? (
                      <p className="max-w-sm text-xs font-semibold text-slate-300">Hãy hoàn thành bài học trước ngay trên Moly rồi tải lại trang.</p>
                    ) : null}
                  </div>
                </div>
              ) : playbackError ? (
                <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 bg-[#08152b] p-6 text-center text-white">
                  <FiAlertTriangle className="h-10 w-10 text-amber-300" />
                  <p className="max-w-lg text-sm font-bold leading-6">{playbackError}</p>
                  {playbackErrorCode ? (
                    <p className="text-xs text-slate-400">Mã lỗi: {playbackErrorCode}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    {playbackErrorCode === 'DEVICE_BINDING_REVOKED' || playbackErrorCode === 'UNTRUSTED_DEVICE_PROOF' ? (
                      <Link href="/login" className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-black text-white hover:bg-teal-500">
                        Đăng nhập lại
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPlaybackError('');
                          setPlaybackErrorCode(null);
                          setTokenRetryNonce((n) => n + 1);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black text-white hover:bg-teal-500"
                      >
                        <FiRefreshCw className="h-3.5 w-3.5" /> Tải lại trình phát
                      </button>
                    )}
                    {playbackErrorCode === 'DEVICE_SLOT_LIMIT_REACHED' || playbackErrorCode === 'DEVICE_LIMIT_LOCKED' ? (
                      <p className="max-w-xs text-xs font-semibold text-amber-200">Tài khoản đã đạt giới hạn thiết bị. Vui lòng đăng xuất thiết bị cũ hoặc liên hệ hỗ trợ.</p>
                    ) : null}
                  </div>
                </div>
              ) : activeIframeSrc ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={activeIframeSrc}
                    title={playbackToken?.title || activeVideo?.title || activeUnit?.title || 'Video bài học'}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture 'none'; display-capture 'none'; remote-playback 'none'"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                  {playbackToken?.watermark?.label ? (
                    <div
                      aria-hidden="true"
                      data-video-watermark
                      className="pointer-events-none absolute left-3 top-2 z-20 max-w-[calc(100%-6rem)] select-none truncate rounded bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/60"
                      style={{ textShadow: '0 1px 2px #000' }}
                    >
                      {playbackToken.watermark.label}
                    </div>
                  ) : null}
                  {tokenRefreshing ? (
                    <p role="status" className="pointer-events-none absolute right-3 top-2 z-20 rounded bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white/90">
                      Đang gia hạn phiên phát...
                    </p>
                  ) : null}
                </>
              ) : tokenLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  <FiRefreshCw className="h-8 w-8 animate-spin text-[#49b6ac]" />
                  <p className="text-sm font-bold">Đang xác thực trình duyệt & cấp phiên phát video bảo mật...</p>
                </div>
              ) : activeVideo ? (
                <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-6 text-center text-white">
                  {activeVideo.thumbnailUrl ? (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-30"
                    />
                  ) : null}
                  <div className="relative z-10 max-w-lg space-y-3 rounded-2xl border border-white/15 bg-[#061126]/85 p-6 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-wider text-[#49b6ac]">
                      {activeVideo.provider || 'Video bài học'}
                      {activeVideo.durationSeconds ? ` · ${formatClock(activeVideo.durationSeconds)}` : ''}
                    </p>
                    <h2 className="text-lg font-black">{activeVideo.title}</h2>
                    {activeVideo.availableResolutions?.length ? (
                      <p className="text-xs text-slate-300">Chất lượng: {activeVideo.availableResolutions.join(' / ')}</p>
                    ) : null}
                    {seekTargetSeconds !== null ? (
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/25 px-3 py-1 text-xs font-bold text-indigo-200">
                        <FiClock /> Mốc đã chọn: {formatClock(seekTargetSeconds)}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setTokenRetryNonce((n) => n + 1)}
                      className="mx-auto inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white hover:bg-teal-500"
                    >
                      <FiRefreshCw /> Tải lại video trên Moly
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-300">
                  <FiPlayCircle className="h-10 w-10 text-[#49b6ac]" />
                  <p className="mt-3 font-bold">Bài học này tập trung vào lý thuyết, từ vựng, công thức và tài liệu bên dưới.</p>
                </div>
              )}
            </div>
          </section>

          <LearningFooter
            courseSlug={courseSlug}
            previousLessonId={navContext.prev?.id ?? null}
            previousLessonTitle={navContext.prev?.title ?? null}
            previousHref={navContext.prev?.href ?? null}
            nextLessonId={navContext.next?.id ?? null}
            nextLessonTitle={navContext.next?.title ?? null}
            nextHref={navContext.next?.href ?? null}
            currentLabel={navContext.currentLabel}
            currentTitle={activeUnit?.title || navContext.activeUnitSummary?.title || 'Bài học'}
          />

          <div id="external-workspace-tabs">
            <ExternalUnitContentTabs
              courseId={workspace.course.id}
              courseSlug={courseSlug}
              profileId={remoteProfileId}
              unitParamId={unitParamId}
              ssoTargetPath={workspace.course.ssoTargetPath}
              unit={activeUnit}
              unitSummary={navContext.activeUnitSummary ?? null}
              capabilities={workspace.profile.capabilities || {}}
              isPublicPreviewAccess={workspace.isPublicPreviewAccess}
              units={workspace.units}
              activeUnitProjectionId={activeUnitProjectionId}
              currentPositionSeconds={livePositionSeconds}
              activeVideoAssetId={activeVideoId ? String(activeVideoId) : null}
              bookmarkRefreshNonce={bookmarkRefreshNonce}
              requestedTab={requestedTab}
              requestedTabNonce={requestedTabNonce}
              onSeekVideo={handleSeekVideo}
              onQuizSubmitted={handleQuizSubmitted}
              onAssignmentSubmitted={() => { void silentRefreshWorkspace(); }}
            />
          </div>
        </main>

        {!theaterMode ? (
          <LearningSidebar
            courseSlug={courseSlug}
            sections={sections}
            activeLessonId={activeSidebarId}
            progressPct={progressPct}
          />
        ) : null}
      </div>
    </div>
  );
}
