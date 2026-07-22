import Link from 'next/link';
import { FiArrowLeft, FiHome } from 'react-icons/fi';
import { CourseDetailClient } from '@/components/courses/CourseDetailClient';

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500" aria-label="Điều hướng khóa học">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 transition hover:bg-white hover:text-indigo-700"><FiHome /> Trang chủ</Link>
          <span className="text-slate-300">/</span>
          <Link href="/khoa-hoc" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:text-indigo-700"><FiArrowLeft /> Tất cả khóa học</Link>
        </nav>
      </div>
      <CourseDetailClient slug={slug} />
    </main>
  );
}
