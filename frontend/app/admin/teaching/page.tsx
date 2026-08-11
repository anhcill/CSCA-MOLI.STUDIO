'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import type { CourseCatalogItemDto } from '@/lib/types/courses';

export default function TeachingCoursesPage() {
  const [items, setItems] = useState<CourseCatalogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      setItems((await coursesApi.getTeachingCourses({ pageSize: 100 })).items);
    } catch { setError('Không thể tải danh sách khóa học được phân công.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <AdminLayout title="Giao & chấm bài" description="Đăng đề, xem bài nộp và phản hồi học viên">
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        Bạn chỉ có quyền giao bài và chấm bài trong các khóa được admin tổng phân công. Thông tin khóa học, video và chương trình học không thể chỉnh sửa tại đây.
      </div>
      {loading ? <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" /> : error ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-bold">Thử lại</button></div>
      ) : !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">Bạn chưa được phân công khóa học nào.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((course) => (
            <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wider text-indigo-600">{course.subjectCode}</p>
              <h2 className="mt-2 text-lg font-black text-slate-900 dark:text-white">{course.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{course.totalLessons} bài học</p>
              <Link href={`/admin/teaching/${course.id}`} className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white">Giao & chấm bài</Link>
            </article>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
