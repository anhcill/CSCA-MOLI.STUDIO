'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBookOpen,
  FiBookmark,
  FiCheck,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiHelpCircle,
  FiSave,
} from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type { LearningRoomDto, PlaybackSessionDto } from '@/lib/types/courses';
import { HlsPlayerShell } from './HlsPlayerShell';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningRoomLoading } from './LearningRoomLoading';
import { LearningSidebar } from './LearningSidebar';

type LessonPanel = 'overview' | 'notes' | 'resources' | 'qa';

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

export function LearningRoomClient({ courseSlug, lessonId }: { courseSlug: string; lessonId: number }) {
  const [room, setRoom] = useState<LearningRoomDto | null>(null);
  const [session, setSession] = useState<PlaybackSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const [activePanel, setActivePanel] = useState<LessonPanel>('overview');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const courseId = room?.course.id ?? null;

  const refreshCourseProgress = useCallback(async () => {
    if (!courseId) return;
    const progress = await learningApi.getCourseProgress(courseId);
    setRoom((current) => current ? {
      ...current,
      enrollment: { ...current.enrollment, progress },
    } : current);
  }, [courseId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
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
        if (nextRoom.lesson.lessonType !== 'video') return;
        setPlaybackLoading(true);
        try {
          const nextSession = await learningApi.createPlaybackSession(lessonId);
          if (active) setSession(nextSession);
        } catch {
          if (active) setPlaybackError('Video chưa sẵn sàng hoặc chưa được gắn vào bài học này. Bạn vẫn có thể xem nội dung phía dưới.');
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
    if (!room || room.lesson.progressStatus === 'completed') return;
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
    return {
      currentLabel: current ? `Bài ${current.sectionIndex + 1}.${current.lessonIndex + 1}` : 'Bài học',
      previousTitle: currentIndex > 0 ? flattened[currentIndex - 1].lesson.title : null,
      nextTitle: currentIndex >= 0 && currentIndex < flattened.length - 1 ? flattened[currentIndex + 1].lesson.title : null,
    };
  }, [lessonId, room]);

  if (loading && !room) return <LearningRoomLoading />;
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

  const hasBody = Boolean(room.lesson.contentHtml?.trim());
  const isCompleted = room.lesson.progressStatus === 'completed';
  const canManualComplete = room.lesson.lessonType === 'article' || room.lesson.lessonType === 'document';
  const panelTabs: Array<{ id: LessonPanel; label: string; icon: typeof FiBookOpen }> = [
    { id: 'overview', label: 'Tổng quan', icon: FiBookOpen },
    { id: 'notes', label: 'Ghi chú của tôi', icon: FiBookmark },
    { id: 'resources', label: `Tài liệu (${room.lesson.resources.length})`, icon: FiFileText },
    { id: 'qa', label: 'Hỏi đáp', icon: FiHelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#f5efe8] text-[#18243a] transition-colors duration-300 dark:bg-[#050d1d] dark:text-[#f1e5d3]">
      <LearningHeader courseSlug={courseSlug} courseTitle={room.course.title} progressPct={room.enrollment.progress.completionPct} onNotesClick={openNotes} />

      <div className="relative mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start lg:px-8">
        <main className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[#d6c4b2] bg-[#071329] shadow-[0_22px_55px_-32px_rgba(7,19,41,.75)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-white">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#49b6ac]">{lessonContext?.currentLabel}</p>
                <h1 className="mt-1 truncate text-sm font-black sm:text-base">{room.lesson.title}</h1>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#efd4b3]">Nhấn ⛶ để xem toàn màn hình</span>
            </div>

            <div className="aspect-video w-full min-h-0 bg-black">
              {room.lesson.lessonType === 'video' ? (
                <HlsPlayerShell lessonId={lessonId} session={session} loading={playbackLoading} error={playbackError} onProgressSaved={refreshCourseProgress} />
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

            <div className="min-h-44 p-6 text-sm leading-7 text-[#5d5854] dark:text-slate-300 sm:p-8">
              {activePanel === 'overview' ? (
                <>
                  {room.lesson.summary ? <p className="mb-5 text-base font-semibold text-[#3e4655] dark:text-slate-200">{room.lesson.summary}</p> : null}
                  {hasBody ? (
                    <div className="prose prose-slate max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: room.lesson.contentHtml! }} />
                  ) : (
                    <p>Nội dung chi tiết của bài học đang được cập nhật. Bạn có thể xem video và chuyển sang bài tiếp theo.</p>
                  )}
                </>
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

              {activePanel === 'qa' ? (
                <div className="rounded-xl border border-dashed border-[#d7c6b5] bg-[#fffdf9] p-8 text-center dark:border-[#3b4a61] dark:bg-[#101e33]">
                  <FiHelpCircle className="mx-auto h-8 w-8 text-[#a42034]" />
                  <h2 className="mt-3 text-lg font-black text-[#202c43] dark:text-[#f2e4cf]">Hỏi đáp bài học</h2>
                  <p className="mt-1">Khu vực trao đổi với giảng viên sẽ được cập nhật trong giai đoạn tiếp theo.</p>
                </div>
              ) : null}
            </div>
          </article>
        </main>

        <LearningSidebar
          courseSlug={courseSlug}
          sections={room.curriculum}
          activeLessonId={lessonId}
          progressPct={room.enrollment.progress.completionPct}
        />
      </div>
    </div>
  );
}
