'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiCheck,
  FiClock,
  FiColumns,
  FiLayers,
  FiLock,
  FiMaximize2,
  FiPlayCircle,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type {
  CurriculumSectionDto,
  ExternalCourseWorkspaceDto,
  ExternalVideoPartDto,
  ExternalWorkspaceUnitSummaryDto,
} from '@/lib/types/courses';
import { CourseSsoLaunchButton } from '@/components/courses/CourseSsoLaunchButton';
import { ExternalUnitContentTabs } from './ExternalUnitContentTabs';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningRoomLoading } from './LearningRoomLoading';
import { LearningSidebar } from './LearningSidebar';

const BUNNY_ORIGIN = 'https://player.mediadelivery.net';

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
    if (parsed.origin !== BUNNY_ORIGIN || !parsed.pathname.startsWith('/embed/')) return null;
    parsed.searchParams.set('autoplay', 'false');
    parsed.searchParams.set('playsinline', 'true');
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
    const ax = err as { response?: { status?: number; data?: { code?: string; errorCode?: string; message?: string } }; message?: string };
    const code = ax.response?.data?.code || ax.response?.data?.errorCode || null;
    const msg = ax.response?.data?.message || ax.message || '';
    if (code === 'PROFILE_SCOPE_MISMATCH') {
      return { code, message: 'Hồ sơ hoặc bài học không thuộc phạm vi khóa học này.' };
    }
    if (code === 'COURSE_ACCESS_REVOKED' || code === 'COURSE_ENTITLEMENT_REQUIRED' || ax.response?.status === 403) {
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
  const [requestVersion, setRequestVersion] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [selectedPartIndex, setSelectedPartIndex] = useState(0);
  const [seekTargetSeconds, setSeekTargetSeconds] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    setSelectedPartIndex(0);
    setSeekTargetSeconds(null);
    learningApi.getExternalCourseWorkspace({
      courseSlugOrId: courseSlug,
      profileId: selectedProfileId,
      unitId: externalUnitId,
    })
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(parseErrorMessage(err).message);
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
  const safeEmbedUrl = getSafeBunnyEmbedUrl(activeVideo?.embedUrl);

  const handleSeekVideo = (seconds: number) => {
    const clean = Math.max(0, Math.floor(seconds));
    setSeekTargetSeconds(clean);
    if (safeEmbedUrl && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'setCurrentTime', value: clean }),
        BUNNY_ORIGIN,
      );
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <LearningRoomLoading progress={null} stage="Đang kết nối không gian học CSCA-Course" />;

  if (error || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5efe8] p-8 dark:bg-[#050d1d]">
        <div role="alert" className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
          <p className="font-bold">{error || 'Không tìm thấy không gian học.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setRequestVersion((v) => v + 1)} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">
              Thử lại
            </button>
            <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-lg border border-red-300 px-4 py-2 font-bold dark:border-red-800">
              Về trang khóa học
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isMirror = workspace.profile.mode === 'MIRROR';
  const modeLabel = isMirror ? 'Live Mirror' : 'Tự học Độc lập';
  const isLocked = Boolean(workspace.selectedUnitLock?.locked || activeUnit?.isLocked);
  const lockReason = workspace.selectedUnitLock?.reason
    || activeUnit?.lockReason
    || 'Hãy hoàn thành bài học và bài kiểm tra bắt buộc trước đó để mở khóa nội dung này.';
  const activeUnitProjectionId = activeUnit?.unitProjectionId
    ?? navContext.activeUnitSummary?.unitProjectionId
    ?? (Number(externalUnitId.replace(/^u-/, '')) || 0);
  const activeSidebarId = navContext.activeUnitSummary?.id || externalUnitId;
  const progressPct = workspace.progress?.overallPercent ?? 0;
  const deviceLimit = workspace.profile.capabilities?.deviceLimit ?? workspace.profile.deviceLimit;

  return (
    <div className="min-h-screen bg-[#f5efe8] text-[#18243a] transition-colors duration-300 dark:bg-[#050d1d] dark:text-[#f1e5d3]">
      <LearningHeader
        courseSlug={courseSlug}
        courseTitle={workspace.course.title}
        progressPct={progressPct}
        badgeLabel={modeLabel}
        onNotesClick={() => document.getElementById('external-workspace-tabs')?.scrollIntoView({ behavior: 'smooth' })}
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
              {isMirror && workspace.sourceClass ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                  <FiUser /> Lớp: {workspace.sourceClass.title}
                  {workspace.sourceClass.instructorName ? ` · GV: ${workspace.sourceClass.instructorName}` : ''}
                </span>
              ) : null}
              {deviceLimit ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <FiShield /> Tối đa {deviceLimit} thiết bị
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
                      {p.title || (p.mode === 'MIRROR' ? 'Live Mirror' : 'Tự học')}
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
                  {navContext.activeUnitSummary?.isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <FiCheck className="h-3 w-3" /> Đã hoàn thành
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-sm font-black sm:text-base">
                  {activeUnit?.title || navContext.activeUnitSummary?.title || 'Bài học'}
                </h1>
              </div>

              <button
                type="button"
                onClick={toggleTheaterMode}
                className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/15 lg:inline-flex"
              >
                {theaterMode ? <FiColumns className="h-3.5 w-3.5" /> : <FiMaximize2 className="h-3.5 w-3.5" />}
                {theaterMode ? 'Hiện cột lộ trình' : 'Chế độ rộng'}
              </button>
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
                    <div className="w-60">
                      <CourseSsoLaunchButton
                        courseId={workspace.course.id}
                        targetPath={workspace.course.ssoTargetPath}
                        label="Hoàn thành trên CSCA-Course"
                      />
                    </div>
                  </div>
                </div>
              ) : safeEmbedUrl ? (
                <iframe
                  ref={iframeRef}
                  src={safeEmbedUrl}
                  title={activeVideo?.title || activeUnit?.title || 'Video bài học'}
                  allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
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
                      {activeVideo.provider || 'CSCA-Course Video'}
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
                    <div className="mx-auto max-w-xs pt-2">
                      <CourseSsoLaunchButton
                        courseId={workspace.course.id}
                        targetPath={workspace.course.ssoTargetPath}
                        label="Phát video đầy đủ trên CSCA-Course"
                      />
                    </div>
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
              ssoTargetPath={workspace.course.ssoTargetPath}
              unit={activeUnit}
              capabilities={workspace.profile.capabilities || {}}
              isPublicPreviewAccess={workspace.isPublicPreviewAccess}
              units={workspace.units}
              activeUnitProjectionId={activeUnitProjectionId}
              onSeekVideo={handleSeekVideo}
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
