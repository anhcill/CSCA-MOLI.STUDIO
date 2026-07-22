import Link from 'next/link';
import type { CourseCatalogItemDto } from '@/lib/types/courses';

const accessLabels = { free: 'Miễn phí', vip: 'VIP', premium: 'PRE', contact: 'Liên hệ', private: 'Riêng tư' };

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function CourseCard({ course }: { course: CourseCatalogItemDto }) {
  return <Link href={`/khoa-hoc/${course.slug}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"><div className="relative aspect-video overflow-hidden bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-700">{course.thumbnailUrl ? <img src={course.thumbnailUrl} alt={`Ảnh bìa ${course.title}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}<div className="absolute left-4 top-4 flex gap-2"><span className="rounded-full bg-white/95 px-3 py-1 text-xs font-black text-indigo-700">{accessLabels[course.accessType]}</span>{course.isNew ? <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-emerald-950">MỚI</span> : null}{course.isHot ? <span className="rounded-full bg-orange-400 px-3 py-1 text-xs font-black text-orange-950">HOT</span> : null}</div></div><div className="space-y-3 p-5"><p className="text-xs font-black uppercase tracking-wider text-indigo-600">{course.subjectCode}</p><h2 className="line-clamp-2 text-xl font-black text-slate-950">{course.title}</h2><p className="line-clamp-2 min-h-10 text-sm text-slate-600">{course.shortDescription}</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500"><span>★ {course.ratingAvg.toFixed(1)} ({course.ratingCount})</span><span>{course.totalLessons} bài</span><span>{durationLabel(course.totalDurationSeconds)}</span></div>{course.progress ? <div><div className="mb-1 flex justify-between text-xs font-semibold text-slate-500"><span>Tiến độ</span><span>{Math.round(course.progress.completionPct)}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, course.progress.completionPct)}%` }} /></div></div> : null}</div></Link>;
}
