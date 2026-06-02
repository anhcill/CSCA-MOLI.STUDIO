import { redirect } from 'next/navigation';
import { getExamSubjectSlug, normalizeContentSubject } from '@/lib/utils/subjectScope';

export default function DeMoPhongPage({
  searchParams,
}: {
  searchParams?: { subject?: string };
}) {
  const subject = normalizeContentSubject(searchParams?.subject);
  const examSlug = getExamSubjectSlug(subject) || 'toan';
  redirect(`/${examSlug}/de-mo-phong`);
}
