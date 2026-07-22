import Link from 'next/link';
import { CourseDetailClient } from '@/components/courses/CourseDetailClient';

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-7xl"><Link href="/khoa-hoc" className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">← Tất cả khóa học</Link><CourseDetailClient slug={slug} /></div></main>;
}
