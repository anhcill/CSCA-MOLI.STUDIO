'use client';

import { useEffect, useState } from 'react';
import learningApi from '@/lib/api/learning';
import type { LearningRoomDto, PlaybackSessionDto } from '@/lib/types/courses';
import { HlsPlayerShell } from './HlsPlayerShell';
import { LearningFooter } from './LearningFooter';
import { LearningHeader } from './LearningHeader';
import { LearningSidebar } from './LearningSidebar';

export function LearningRoomClient({ courseSlug, lessonId }: { courseSlug: string; lessonId: number }) {
  const [room, setRoom] = useState<LearningRoomDto | null>(null);
  const [session, setSession] = useState<PlaybackSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRoom(null); setSession(null); setPlaybackError('');
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
          if (active) setPlaybackError('Video chưa sẵn sàng hoặc dịch vụ phát video chưa được bật. Nội dung bài học vẫn có thể xem.');
        } finally {
          if (active) setPlaybackLoading(false);
        }
      })
      .catch(() => active && setError('Không thể mở bài học hoặc bạn chưa có quyền truy cập.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseSlug, lessonId, requestVersion]);

  if (loading && !room) return <div aria-label="Đang tải bài học" className="min-h-screen animate-pulse bg-slate-100" />;
  if (error || !room) return <div className="flex min-h-screen items-center justify-center p-8"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700"><p>{error || 'Không tìm thấy bài học.'}</p><button type="button" onClick={() => setRequestVersion((value) => value + 1)} className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Thử lại</button></div></div>;

  return <div className="flex min-h-screen flex-col bg-slate-100 lg:h-screen lg:overflow-hidden"><LearningHeader courseTitle={room.course.title} progressPct={room.enrollment.progress.completionPct} /><div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]"><main className="min-h-0 lg:overflow-y-auto">{room.lesson.lessonType === 'video' ? <HlsPlayerShell lessonId={lessonId} session={session} loading={playbackLoading} error={playbackError} /> : null}<article className="mx-auto max-w-5xl p-6"><h2 className="text-3xl font-black">{room.lesson.title}</h2>{room.lesson.summary ? <p className="mt-2 text-slate-500">{room.lesson.summary}</p> : null}<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">{room.lesson.contentHtml ? <div className="whitespace-pre-wrap">{room.lesson.contentHtml}</div> : <p>Nội dung bài học đang được cập nhật.</p>}</div></article></main><div className="min-h-0 lg:block"><LearningSidebar courseSlug={courseSlug} sections={room.curriculum} activeLessonId={lessonId} /></div></div><LearningFooter courseSlug={courseSlug} previousLessonId={room.lesson.previousLessonId} nextLessonId={room.lesson.nextLessonId} /></div>;
}
