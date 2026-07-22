import type { CourseDetailDto } from '@/lib/types/courses';

export function CourseHero({ course }: { course: CourseDetailDto }) {
  return <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-8 text-white md:p-12"><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">CSCA · {course.subjectCode}</p><h1 className="mt-4 max-w-4xl text-4xl font-black md:text-6xl">{course.title}</h1><p className="mt-5 max-w-3xl text-lg text-slate-200">{course.shortDescription}</p><div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-slate-200"><span>★ {course.ratingAvg.toFixed(1)} ({course.ratingCount} đánh giá)</span><span>{course.enrolledCount.toLocaleString('vi-VN')} học viên</span><span>{course.totalLessons} bài học</span></div></section>;
}
