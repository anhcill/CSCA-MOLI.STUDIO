import Link from 'next/link';
import { FiArrowLeft, FiHome } from 'react-icons/fi';
import { CourseDetailClient } from '@/components/courses/CourseDetailClient';

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 pb-20 pt-6 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400" aria-label="Điều hướng khóa học">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition hover:bg-white hover:text-indigo-700 dark:hover:bg-slate-900 dark:hover:text-indigo-300"><FiHome /> Trang chủ</Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <Link href="/khoa-hoc" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:text-indigo-700 dark:border dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-indigo-300"><FiArrowLeft /> Tất cả khóa học</Link>
        </nav>
        <CourseDetailClient slug={slug} />
      </div>
    </main>
  );
}
