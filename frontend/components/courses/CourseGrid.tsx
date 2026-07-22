import type { CourseCatalogItemDto } from '@/lib/types/courses';
import { CourseCard } from './CourseCard';

export function CourseGrid({ courses }: { courses: CourseCatalogItemDto[] }) {
  if (!courses.length) return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Chưa có khóa học CSCA phù hợp.</div>;
  return <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>;
}

export function CourseGridSkeleton() {
  return <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-96 animate-pulse rounded-3xl bg-slate-200" />)}</div>;
}
