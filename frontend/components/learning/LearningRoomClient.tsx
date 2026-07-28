'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiCheck, FiDownload, FiExternalLink } from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type { LearningRoomDto, PlaybackSessionDto } from '@/lib/types/courses';
import { HlsPlayerShell } from './HlsPlayerShell';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningSidebar } from './LearningSidebar';

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
  const courseId = room?.course.id ?? null;

  const refreshCourseProgress = useCallback(async () => {
    if (!courseId) return;
    const progress = await learningApi.getCourseProgress(courseId);
    setRoom((current) => current ? {
      ...current,
      enrollment: {
        ...current.enrollment,
        progress,
      },
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
          if (active) setPlaybackError('Video chưa sẵn sàng hoặc chưa được gắn vào bài học này. Bạn vẫn có thể xem phần nội dung bên dưới.');
        } finally {
          if (active) setPlaybackLoading(false);
        }
      })
      .catch(() => active && setError('Không thể mở bài học. Quyền truy cập của bạn có thể chưa bao gồm khóa học này hoặc đã hết hạn.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseSlug, lessonId, requestVersion]);

  useEffect(() => {
    if (!courseId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshCourseProgress().catch(() => undefined);
      }
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [courseId, refreshCourseProgress]);

  const markComplete = async () => {
    if (!room || room.lesson.progressStatus === 'completed') return;
    setCompleting(true);
    setCompleteError('');
    try {
      await learningApi.completeLesson(lessonId);
      setRoom((current) => current ? updateCompletedLesson(current, lessonId) : current);
    } catch {
      setCompleteError('Chưa thể lưu trạng thái hoàn thành. Vui lòng thử lại.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading && !room) return <div aria-label="Đang tải bài học" className="min-h-screen animate-pulse bg-slate-100 dark:bg-slate-950" />;
  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 dark:bg-slate-950">
        <div role="alert" className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
          <p>{error || 'Không tìm thấy bài học.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700">Thử lại</button>
            <Link href={`/khoa-hoc/${courseSlug}`} className="rounded-lg border border-red-300 px-4 py-2 font-bold">Xem khóa học</Link>
            <Link href={`/vip?course=${encodeURIComponent(courseSlug)}`} className="rounded-lg border border-red-300 px-4 py-2 font-bold">Xem gói mở khóa</Link>
          </div>
        </div>
      </div>
    );
  }

  const hasBody = Boolean(room.lesson.contentHtml?.trim());
  const isCompleted = room.lesson.progressStatus === 'completed';
  const canManualComplete = room.lesson.lessonType === 'article' || room.lesson.lessonType === 'document';

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 lg:h-screen lg:overflow-hidden">
      <LearningHeader courseSlug={courseSlug} courseTitle={room.course.title} progressPct={room.enrollment.progress.completionPct} />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-h-0 lg:overflow-y-auto">
          {room.lesson.lessonType === 'video' ? <HlsPlayerShell lessonId={lessonId} session={session} loading={playbackLoading} error={playbackError} onProgressSaved={refreshCourseProgress} /> : null}
          <article className="mx-auto max-w-5xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {room.lesson.lessonType === 'video' ? 'Video bài giảng' : room.lesson.lessonType === 'article' ? 'Bài đọc' : room.lesson.lessonType === 'document' ? 'Tài liệu' : 'Bài kiểm tra'}
                </p>
                <h2 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{room.lesson.title}</h2>
                {room.lesson.summary ? <p className="mt-2 text-slate-500 dark:text-slate-400">{room.lesson.summary}</p> : null}
              </div>
              {canManualComplete ? (
                <button
                  type="button"
                  onClick={markComplete}
                  disabled={completing || isCompleted}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60'}`}
                >
                  <FiCheck /> {isCompleted ? 'Đã hoàn thành' : completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
                </button>
              ) : isCompleted ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><FiCheck /> Đã hoàn thành</span>
              ) : null}
            </div>

            {completeError ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{completeError}</p> : null}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {hasBody ? (
                <div className="prose prose-slate max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: room.lesson.contentHtml! }} />
              ) : room.lesson.lessonType === 'quiz' ? (
                <p>Nội dung bài kiểm tra đang được cập nhật. Hãy quay lại sau hoặc chuyển sang bài tiếp theo.</p>
              ) : room.lesson.lessonType === 'document' ? (
                <p>Tài liệu của bài học nằm trong danh sách đính kèm bên dưới.</p>
              ) : (
                <p>Nội dung bài học đang được cập nhật.</p>
              )}
            </div>

            {room.lesson.resources.length ? (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="font-black text-slate-950 dark:text-white">Tài liệu đính kèm</h3>
                <ul className="mt-4 grid gap-3">
                  {room.lesson.resources.map((resource) => (
                    <li key={resource.id}>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 font-bold text-indigo-700 transition hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40">
                        <span>{resource.title}</span>
                        {resource.kind === 'file' ? <FiDownload /> : <FiExternalLink />}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        </main>
        <div className="min-h-0 lg:block">
          <LearningSidebar courseSlug={courseSlug} sections={room.curriculum} activeLessonId={lessonId} />
        </div>
      </div>
      <LearningFooter courseSlug={courseSlug} previousLessonId={room.lesson.previousLessonId} nextLessonId={room.lesson.nextLessonId} />
    </div>
  );
}
