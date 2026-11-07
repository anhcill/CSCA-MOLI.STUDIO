'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBookOpen,
  FiBookmark,
  FiCheck,
  FiCheckCircle,
  FiColumns,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiHelpCircle,
  FiList,
  FiLock,
  FiMaximize2,
  FiPlay,
  FiSave,
  FiSend,
} from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type { LearningRoomDto, PlaybackSessionDto } from '@/lib/types/courses';
import { HlsPlayerShell } from './HlsPlayerShell';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningRoomLoading } from './LearningRoomLoading';
import { LearningSidebar } from './LearningSidebar';
import { LessonAssignmentPanel } from './LessonAssignmentPanel';
import { LessonQuestionPanel } from '@/components/courses/LessonQuestionPanel';

type LessonPanel = 'overview' | 'curriculum' | 'notes' | 'resources' | 'assignment' | 'qa';

function updateCompletedLesson(room: LearningRoomDto, lessonId: number): LearningRoomDto {
  const curriculum = room.curriculum.map((section) => ({
    ...section,
    lessons: section.lessons.map((lesson) => lesson.id === lessonId
      ? { ...lesson, progressStatus: 'completed' as const }
      : lesson),
  }));
  const allLessons = curriculum.flatMap((section) => section.lessons);
  const completedLessons = allLessons.filter((lesson) => lesson.progressStatus === 'completed').length;
  const totalLessons = allLessons.length;
  return {
    ...room,
    curriculum,
    lesson: { ...room.lesson, progressStatus: 'completed' },
    enrollment: {
      ...room.enrollment,
      progress: {
        ...room.enrollment.progress,
        completedLessons,
        totalLessons,
        completionPct: totalLessons ? (completedLessons / totalLessons) * 100 : 0,
      },
    },
  };
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function LearningRoomClient({ courseSlug, lessonId }: { courseSlug: string; lessonId: number }) {
  const [room, setRoom] = useState<LearningRoomDto | null>(null);
  const [session, setSession] = useState<PlaybackSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [loadStage, setLoadStage] = useState('Đang kết nối tới lớp học');
  const [error, setError] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const [activePanel, setActivePanel] = useState<LessonPanel>('overview');
  const [theaterMode, setTheaterMode] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const courseId = room?.course.id ?? null;

  useEffect(() => {
    try {
      setTheaterMode(window.localStorage.getItem('csca-learning-theater') === '1');
    } catch { /* ignore */ }
  }, []);

  const toggleTheaterMode = () => {
    setTheaterMode((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('csca-learning-theater', next ? '1' : '0');
      } catch { /* ignore */ }
      if (next && activePanel === 'overview') {
        // Keep overview or let learner switch to curriculum tab right below video
      }
      return next;
    });
  };

  const refreshCourseProgress = useCallback(async () => {
    if (!courseId || (room && room.enrollment.id === 0)) return;
    const progress = await learningApi.getCourseProgress(courseId);
    setRoom((current) => current ? {
      ...current,
      enrollment: { ...current.enrollment, progress },
    } : current);
  }, [courseId, room]);

  const handleLessonCompleted = useCallback(() => {
    setRoom((current) => current ? updateCompletedLesson(current, lessonId) : current);
    void refreshCourseProgress().catch(() => undefined);
  }, [lessonId, refreshCourseProgress]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadProgress(null);
    setLoadStage('Đang tải nội dung bài học');
    setError('');
    setRoom(null);
    setSession(null);
    setPlaybackError('');
    setCompleteError('');
    setActivePanel('overview');
    learningApi.getRoom(courseSlug, lessonId)
      .then(async (nextRoom) => {
        if (!active) return;
        setRoom(nextRoom);
        if (nextRoom.lesson.lessonType !== 'video') {
          setLoadProgress(100);
          setLoadStage('Bài học đã sẵn sàng');
          return;
        }
        setLoadProgress(50);
        setLoadStage('Đang chuẩn bị phiên phát video');
        setPlaybackLoading(true);
        try {
          const nextSession = await learningApi.createPlaybackSession(lessonId);
          if (active) {
            setSession(nextSession);
            setLoadProgress(100);
            setLoadStage('Video đã sẵn sàng');
          }
        } catch {
          if (active) {
            setPlaybackError('Video chưa sẵn sàng hoặc chưa được gắn vào bài học này. Bạn vẫn có thể xem nội dung phía dưới.');
            setLoadProgress(100);
            setLoadStage('Nội dung bài học đã sẵn sàng');
          }
        } finally {
          if (active) setPlaybackLoading(false);
        }
      })
      .catch(() => active && setError('Không thể mở bài học. Quyền truy cập có thể chưa bao gồm khóa học này hoặc đã hết hạn.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseSlug, lessonId, requestVersion]);

  useEffect(() => {
    if (!courseId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshCourseProgress().catch(() => undefined);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [courseId, refreshCourseProgress]);

  useEffect(() => {
    const key = `csca-lesson-note:${lessonId}`;
    setNote(window.localStorage.getItem(key) || '');
    setNoteSaved(false);
  }, [lessonId]);

  const saveNote = () => {
    window.localStorage.setItem(`csca-lesson-note:${lessonId}`, note);
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 1800);
  };

  const openNotes = () => {
    setActivePanel('notes');
    window.setTimeout(() => document.getElementById('lesson-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const markComplete = async () => {
    if (!room || room.lesson.progressStatus === 'completed' || room.enrollment.id === 0) return;
    setCompleting(true);
    setCompleteError('');
    try {
      await learningApi.completeLesson(lessonId);
      setRoom((current) => current ? updateCompletedLesson(current, lessonId) : current);
      await refreshCourseProgress();
    } catch {
      setCompleteError('Chưa thể lưu trạng thái hoàn thành. Vui lòng thử lại.');
    } finally {
      setCompleting(false);
    }
  };

  const lessonContext = useMemo(() => {
    if (!room) return null;
    const flattened = room.curriculum.flatMap((section, sectionIndex) =>
      section.lessons.map((lesson, lessonIndex) => ({ lesson, sectionIndex, lessonIndex })),
    );
    const currentIndex = flattened.findIndex((item) => item.lesson.id === lessonId);
    const current = currentIndex >= 0 ? flattened[currentIndex] : null;
    const completedCount = flattened.filter((item) => item.lesson.progressStatus === 'completed').length;
    return {
      currentLabel: current ? `Bài ${current.sectionIndex + 1}.${current.lessonIndex + 1}` : 'Bài học',
      previousTitle: currentIndex > 0 ? flattened[currentIndex - 1].lesson.title : null,
      nextTitle: currentIndex >= 0 && currentIndex < flattened.length - 1 ? flattened[currentIndex + 1].lesson.title : null,
      totalCount: flattened.length,
      completedCount,
    };
  }, [lessonId, room]);

  if (loading) return <LearningRoomLoading progress={loadProgress} stage={loadStage} />;
  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5efe8] p-8 dark:bg-[#050d1d]">
        <div role="alert" className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
          <p>{error || 'Không tìm thấy bài học.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Thử lại</button>
            <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-lg border border-red-300 px-4 py-2 font-bold dark:border-red-800">Xem khóa học</Link>
          </div>
        </div>
      </div>
    );
  }

  const isFreePreviewOnly = room.enrollment.id === 0;
  const hasBody = Boolean(room.lesson.contentHtml?.trim());
  const isCompleted = room.lesson.progressStatus === 'completed';
  const canManualComplete = !isFreePreviewOnly && (room.lesson.lessonType === 'article' || room.lesson.lessonType === 'document');
  const panelTabs: Array<{ id: LessonPanel; label: string; icon: typeof FiBookOpen }> = [
    { id: 'overview', label: 'Tổng quan', icon: FiBookOpen },
    { id: 'curriculum', label: `Bài giảng (${lessonContext?.completedCount ?? 0}/${lessonContext?.totalCount ?? 0})`, icon: FiList },
    { id: 'notes', label: 'Ghi chú', icon: FiBookmark },
    { id: 'resources', label: `Tài liệu (${room.lesson.resources.length})`, icon: FiFileText },
    ...(!isFreePreviewOnly && room.lesson.assignment ? [{ id: 'assignment' as const, label: 'Nộp bài', icon: FiSend }] : []),
    ...(!isFreePreviewOnly ? [{ id: 'qa' as const, label: 'Hỏi đáp', icon: FiHelpCircle }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#f5efe8] text-[#18243a] transition-colors duration-300 dark:bg-[#050d1d] dark:text-[#f1e5d3]">
      <LearningHeader courseSlug={courseSlug} courseTitle={room.course.title} progressPct={room.enrollment.progress.completionPct} onNotesClick={openNotes} />

      <div className={`relative mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:items-start lg:px-8 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_430px]'}`}>
        <main className="min-w-0 space-y-5">
          {isFreePreviewOnly ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:from-amber-950/50 dark:to-orange-950/30 dark:text-amber-100">
              <div>
                <p className="font-black">🎁 Bạn đang xem bài học thử miễn phí</p>
                <p className="mt-0.5 text-xs opacity-85">Đăng ký khóa học để mở khóa toàn bộ video bài giảng, tài liệu, bài tập và hỏi đáp cùng giảng viên.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-xl border border-amber-400 bg-white/80 px-3.5 py-2 text-xs font-black text-amber-900 hover:bg-white dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                  Chi tiết khóa học
                </Link>
                <Link href="/vip?section=video" className="rounded-xl bg-[#ad2033] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#911a2b]">
                  Đăng ký mở khóa ngay
                </Link>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-[#d6c4b2] bg-[#071329] shadow-[0_22px_55px_-32px_rgba(7,19,41,.75)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#49b6ac]">{lessonContext?.currentLabel}</p>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <FiCheck className="h-3 w-3" /> Đã hoàn thành
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate text-sm font-black sm:text-base">{room.lesson.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheaterMode}
                  className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/15 lg:inline-flex"
                  title={theaterMode ? 'Hiện danh sách bài học bên phải' : 'Mở rộng khung xem video'}
                >
                  {theaterMode ? <FiColumns className="h-3.5 w-3.5" /> : <FiMaximize2 className="h-3.5 w-3.5" />}
                  {theaterMode ? 'Hiện cột lộ trình' : 'Chế độ rộng'}
                </button>
                <span className="hidden rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#efd4b3] sm:inline-block">
                  Nhấn ⛶ để toàn màn hình
                </span>
              </div>
            </div>

            <div className={`aspect-video w-full min-h-0 bg-black ${theaterMode ? 'lg:max-h-[76vh]' : ''}`}>
              {room.lesson.lessonType === 'video' ? (
                <HlsPlayerShell
                  lessonId={lessonId}
                  session={session}
                  loading={playbackLoading}
                  error={playbackError}
                  onProgressSaved={refreshCourseProgress}
                  onLessonCompleted={handleLessonCompleted}
                />
              ) : (
                <div className="grid h-full place-items-center p-8 text-center text-slate-300">
                  <FiFileText className="mx-auto h-10 w-10" />
                  <p className="mt-3 font-bold">Bài học này sử dụng nội dung bên dưới thay cho video.</p>
                </div>
              )}
            </div>
          </section>

          <LearningFooter
            courseSlug={courseSlug}
            previousLessonId={room.lesson.previousLessonId}
            previousLessonTitle={lessonContext?.previousTitle}
            nextLessonId={room.lesson.nextLessonId}
            nextLessonTitle={lessonContext?.nextTitle}
            currentLabel={lessonContext?.currentLabel || 'Bài học'}
            currentTitle={room.lesson.title}
          />

          <article className="overflow-hidden rounded-2xl border border-[#dfd0c2] bg-[#fffaf4] shadow-sm transition-colors dark:border-[#2d3b52] dark:bg-[#0b172b]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5d9ce] px-4 dark:border-[#2d3b52] sm:px-6">
              <div className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]">
                {panelTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActivePanel(id)}
                    className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-bold transition ${activePanel === id ? 'border-[#ad2033] text-[#ad2033] dark:text-[#f08d9c]' : 'border-transparent text-[#6f665f] hover:text-[#29354b] dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                    <Icon /> {label}
                  </button>
                ))}
              </div>
              {canManualComplete ? (
                <button type="button" onClick={markComplete} disabled={completing || isCompleted} className={`my-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-black ${isCompleted ? 'bg-[#e2f2ed] text-[#287d70] dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-[#ad2033] text-white disabled:opacity-60'}`}>
                  <FiCheck /> {isCompleted ? 'Đã hoàn thành' : completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
                </button>
              ) : isCompleted ? (
                <span className="my-2 inline-flex items-center gap-2 rounded-lg bg-[#e2f2ed] px-4 py-2 text-sm font-black text-[#287d70] dark:bg-emerald-950/50 dark:text-emerald-300"><FiCheck /> Đã hoàn thành</span>
              ) : null}
            </div>

            {completeError ? <p role="alert" className="m-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{completeError}</p> : null}

            <div className="min-h-44 p-5 text-sm leading-7 text-[#5d5854] dark:text-slate-300 sm:p-8">
              {activePanel === 'overview' ? (
                <>
                  {room.lesson.summary ? <p className="mb-5 text-base font-semibold text-[#3e4655] dark:text-slate-200">{room.lesson.summary}</p> : null}
                  {hasBody ? (
                    <div className="prose prose-slate max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: room.lesson.contentHtml! }} />
                  ) : (
                    <p>Nội dung chi tiết của bài học đang được cập nhật. Bạn có thể xem video, lưu ghi chú cá nhân hoặc chuyển sang bài tiếp theo.</p>
                  )}
                </>
              ) : null}

              {activePanel === 'curriculum' ? (
                <div className="space-y-4">
                  {room.curriculum.map((section, sectionIndex) => (
                    <div key={section.id} className="overflow-hidden rounded-xl border border-[#ddcbbb] bg-[#fffdf9] dark:border-[#334159] dark:bg-[#0c192d]">
                      <div className="flex items-center justify-between bg-[#fcf7f1] px-4 py-3 dark:bg-[#101e33]">
                        <h3 className="font-black text-[#18243b] dark:text-[#f1e5d3]">{sectionIndex + 1}. {section.title}</h3>
                        <span className="text-xs font-bold text-[#8b8179] dark:text-slate-400">
                          {section.lessons.filter((l) => l.progressStatus === 'completed').length}/{section.lessons.length} bài
                        </span>
                      </div>
                      <div className="divide-y divide-[#eee6df] dark:divide-[#26354b]">
                        {section.lessons.map((item, lessonIndex) => {
                          const active = item.id === lessonId;
                          const completed = item.progressStatus === 'completed';
                          const row = (
                            <>
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${active ? 'bg-white/20 text-white' : completed ? 'bg-[#2f9692] text-white' : 'text-[#9b9188] dark:text-slate-500'}`}>
                                {item.isLocked ? <FiLock /> : completed ? <FiCheckCircle /> : item.lessonType === 'video' ? <FiPlay /> : <FiFileText />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="mr-1.5 font-black">{sectionIndex + 1}.{lessonIndex + 1}</span>
                                {item.title}
                                {item.isFreePreview && isFreePreviewOnly ? (
                                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Học thử</span>
                                ) : null}
                              </span>
                              {item.durationSeconds > 0 ? (
                                <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-white/80' : 'text-[#8f867e] dark:text-slate-500'}`}>
                                  {formatDuration(item.durationSeconds)}
                                </span>
                              ) : null}
                            </>
                          );
                          return item.isLocked ? (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm text-[#aaa098] dark:text-slate-600">{row}</div>
                          ) : (
                            <Link
                              key={item.id}
                              href={`/hoc/${courseSlug}/bai-hoc/${item.id}`}
                              className={`flex items-center gap-3 px-4 py-3 text-sm transition ${active ? 'bg-[#ad2033] font-bold text-white' : 'font-semibold text-[#5e5b5a] hover:bg-[#f7efe7] hover:text-[#902033] dark:text-slate-300 dark:hover:bg-[#13223a]'}`}
                            >
                              {row}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activePanel === 'notes' ? (
                <section id="lesson-notes">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-[#202c43] dark:text-[#f2e4cf]">Ghi chú của tôi</h2>
                      <p className="text-xs text-[#8b8178] dark:text-slate-500">Ghi chú được lưu trên trình duyệt của thiết bị này.</p>
                    </div>
                    <button type="button" onClick={saveNote} className="inline-flex items-center gap-2 rounded-lg bg-[#237e80] px-4 py-2 font-black text-white">
                      <FiSave /> {noteSaved ? 'Đã lưu' : 'Lưu ghi chú'}
                    </button>
                  </div>
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi lại công thức, ý chính hoặc câu hỏi của bạn..." className="mt-4 min-h-44 w-full rounded-xl border border-[#d9cabc] bg-[#fffdf9] p-4 outline-none focus:border-[#258886] focus:ring-4 focus:ring-[#258886]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-200 dark:placeholder:text-slate-600" />
                </section>
              ) : null}

              {activePanel === 'resources' ? (
                room.lesson.resources.length ? (
                  <ul className="grid gap-3">
                    {room.lesson.resources.map((resource) => (
                      <li key={resource.id}>
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-[#ddcfc2] bg-[#fffdf9] px-4 py-3 font-bold text-[#237879] transition hover:bg-[#f2e9df] dark:border-[#34435a] dark:bg-[#101e33] dark:text-[#6ac6bd] dark:hover:bg-[#17263d]">
                          <span>{resource.title}</span>
                          {resource.kind === 'file' ? <FiDownload /> : <FiExternalLink />}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : <p>Chưa có tài liệu đính kèm cho bài học này.</p>
              ) : null}

              {activePanel === 'assignment' && room.lesson.assignment ? (
                <LessonAssignmentPanel lessonId={lessonId} initialAssignment={room.lesson.assignment} />
              ) : null}

              {activePanel === 'qa' ? (
                <LessonQuestionPanel lessonId={lessonId} />
              ) : null}
            </div>
          </article>
        </main>

        {!theaterMode ? (
          <LearningSidebar
            courseSlug={courseSlug}
            sections={room.curriculum}
            activeLessonId={lessonId}
            progressPct={room.enrollment.progress.completionPct}
          />
        ) : null}
      </div>
    </div>
  );
}
