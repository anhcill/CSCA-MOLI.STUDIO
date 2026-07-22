import { CourseDetailClient } from '@/components/courses/CourseDetailClient';

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-7xl"><CourseDetailClient slug={slug} /></div></main>;
}
