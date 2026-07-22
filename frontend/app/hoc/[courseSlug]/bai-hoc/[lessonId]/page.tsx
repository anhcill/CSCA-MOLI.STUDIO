import { LearningRoomClient } from '@/components/learning/LearningRoomClient';
import { notFound } from 'next/navigation';

export default async function LessonPage({ params }: { params: Promise<{ courseSlug: string; lessonId: string }> }) {
  const { courseSlug, lessonId } = await params;
  const numericLessonId = Number(lessonId);
  if (!Number.isSafeInteger(numericLessonId) || numericLessonId <= 0) notFound();
  return <LearningRoomClient courseSlug={courseSlug} lessonId={numericLessonId} />;
}
