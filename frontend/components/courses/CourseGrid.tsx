import { FiBookOpen } from 'react-icons/fi';
import type { CourseCatalogItemDto } from '@/lib/types/courses';
import { CourseCard } from './CourseCard';

export function CourseGrid({ courses }: { courses: CourseCatalogItemDto[] }) {
  if (!courses.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d6c5b5] bg-[#fffaf5] px-6 py-16 text-center shadow-sm">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f4e8db] text-3xl text-[#9f2535]"><FiBookOpen /></span>
        <h3 className="mt-5 font-sans text-xl font-black text-[#17243d]">Chưa tìm thấy khóa học phù hợp</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#786e67]">Thử thay đổi bộ lọc để xem thêm nội dung.</p>
      </div>
    );
  }

  if (courses.length === 1) {
    return <CourseCard course={courses[0]} variant="wide" />;
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {courses.map((course, index) => (
        <CourseCard key={course.id} course={course} variant={index === 0 ? 'featured' : 'compact'} />
      ))}
    </div>
  );
}

export function CourseGridSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dfd2c7] bg-[#fffaf5]">
      <div className="grid min-h-72 animate-pulse lg:grid-cols-[42%_1fr]">
        <div className="bg-[#e9dfd5]" />
        <div className="space-y-5 p-7">
          <div className="h-5 w-28 rounded-full bg-[#e9dfd5]" />
          <div className="h-9 max-w-xl rounded-lg bg-[#e9dfd5]" />
          <div className="h-14 max-w-2xl rounded-lg bg-[#f0e8e0]" />
          <div className="h-20 max-w-2xl rounded-xl bg-[#f0e8e0]" />
        </div>
      </div>
    </div>
  );
}
