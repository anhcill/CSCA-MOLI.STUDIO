import { redirect } from 'next/navigation';
import { getExamSubjectSlug, normalizeContentSubject } from '@/lib/utils/subjectScope';

export default async function DeMoPhongPage({
  searchParams,
}: {
  searchParams?: Promise<{ subject?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const subject = normalizeContentSubject(resolvedSearchParams?.subject);
  const examSlug = getExamSubjectSlug(subject) || 'toan';
  redirect(`/${examSlug}/de-mo-phong`);
}
