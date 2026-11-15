import { LearningRoomClient } from '@/components/learning/LearningRoomClient';
import { notFound } from 'next/navigation';

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
  searchParams?: Promise<{ profileId?: string | string[] }>;
}) {
  const { courseSlug, lessonId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawProfileId = resolvedSearchParams?.profileId;
  const initialProfileId = Array.isArray(rawProfileId) ? (rawProfileId[0] ?? null) : (rawProfileId ?? null);

  if (/^u-\d+$/.test(lessonId)) {
    return (
      <LearningRoomClient
        courseSlug={courseSlug}
        externalUnitId={lessonId}
        initialProfileId={initialProfileId}
      />
    );
  }

  const numericLessonId = Number(lessonId);
  if (!Number.isSafeInteger(numericLessonId) || numericLessonId <= 0) notFound();
  return <LearningRoomClient courseSlug={courseSlug} lessonId={numericLessonId} />;
}
