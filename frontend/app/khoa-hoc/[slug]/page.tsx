import { CourseDetailClient } from '@/components/courses/CourseDetailClient';

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 pb-20 pt-8 text-slate-950 transition-colors dark:bg-[#020817] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <CourseDetailClient slug={slug} />
      </div>
    </main>
  );
}
