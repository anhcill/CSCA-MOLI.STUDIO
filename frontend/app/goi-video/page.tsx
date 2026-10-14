import { redirect } from 'next/navigation';

export default async function Page({ searchParams }: {
  searchParams: Promise<{ courseId?: string; type?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ section: params.type === 'combo' ? 'combo' : 'video' });
  if (params.courseId && /^\d+$/.test(params.courseId)) query.set('courseId', params.courseId);
  redirect(`/vip?${query}`);
}
