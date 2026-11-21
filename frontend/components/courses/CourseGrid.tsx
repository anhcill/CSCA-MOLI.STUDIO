import { FiBookOpen } from 'react-icons/fi';
import type { CourseCatalogItemDto } from '@/lib/types/courses';
import { CourseCard } from './CourseCard';

export function CourseGrid({ courses }: { courses: CourseCatalogItemDto[] }) {
  if (!courses.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d6c5b5] bg-[#fffaf5] px-6 py-16 text-center shadow-sm transition-colors dark:border-[#3a465b] dark:bg-[#0b172b]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f4e8db] text-3xl text-[#9f2535] dark:bg-[#251523] dark:text-[#ef8d9d]"><FiBookOpen /></span>
        <h3 className="mt-5 font-sans text-xl font-black text-[#17243d] dark:text-[#f2e5d2]">Chưa tìm thấy khóa học phù hợp</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#786e67] dark:text-slate-400">Thử thay đổi bộ lọc để xem thêm nội dung.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} variant="compact" />
      ))}
    </div>
  );
}

export function CourseGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse overflow-hidden rounded-2xl border border-[#dfd2c7] bg-[#fffaf5] dark:border-[#2d3a50] dark:bg-[#0b172b]">
          <div className="aspect-[16/9] bg-[#e9dfd5] dark:bg-[#14243a]" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-24 rounded-full bg-[#e9dfd5] dark:bg-[#1b2c43]" />
            <div className="h-7 rounded-lg bg-[#e9dfd5] dark:bg-[#1b2c43]" />
            <div className="h-10 rounded-lg bg-[#f0e8e0] dark:bg-[#14243a]" />
            <div className="h-10 rounded-xl bg-[#f0e8e0] dark:bg-[#14243a]" />
          </div>
        </div>
      ))}
    </div>
  );
}
