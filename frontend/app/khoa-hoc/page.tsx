import type { Metadata } from 'next';
import { CourseCatalogClient } from '@/components/courses/CourseCatalogClient';

export const metadata: Metadata = { title: 'Khóa học CSCA', description: 'Khóa học video luyện thi CSCA theo từng môn.' };

export default function CoursesPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-7xl"><p className="font-black uppercase tracking-[0.2em] text-indigo-600">CSCA Learning</p><h1 className="mt-3 text-4xl font-black text-slate-950 md:text-6xl">Khóa học CSCA</h1><p className="mb-8 mt-4 max-w-2xl text-slate-600">Học theo lộ trình Toán, Vật lý, Hóa học và Tiếng Trung dành riêng cho kỳ thi CSCA.</p><CourseCatalogClient /></div></main>;
}
