import { FiBookOpen } from 'react-icons/fi';
import type { CourseCatalogItemDto } from '@/lib/types/courses';
import { CourseCard } from './CourseCard';

export function CourseGrid({ courses }: { courses: CourseCatalogItemDto[] }) {
  if (!courses.length) return <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"><FiBookOpen /></span><h3 className="mt-5 text-xl font-black text-slate-900 dark:text-white">Chưa tìm thấy khóa học phù hợp</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Thử chọn một môn học hoặc quyền truy cập khác để xem thêm nội dung.</p></div>;
  return <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>;
}

export function CourseGridSkeleton() {
  return <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="aspect-video animate-pulse bg-slate-200 dark:bg-slate-800" /><div className="space-y-4 p-6"><div className="h-5 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" /><div className="h-7 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" /><div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" /><div className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" /></div></div>)}</div>;
}
