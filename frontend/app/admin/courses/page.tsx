'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import type { CourseCatalogItemDto } from '@/lib/types/courses';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';

export default function AdminCoursesPage() {
  const user = useAuthStore((state) => state.user);
  const isGlobalAdmin = hasPermission(user, '*');
  const [items, setItems] = useState<CourseCatalogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      setItems((await coursesApi.getAdminCourses({ pageSize: 50 })).items);
    } catch {
      setError('Không thể tải danh sách khóa học quản trị.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <AdminLayout title="Khóa học CSCA" description="Quản lý thông tin và chương trình học">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{isGlobalAdmin ? 'Bạn đang xem tất cả khóa học.' : 'Bạn chỉ thấy các khóa được admin tổng phân công.'}</p>
        {isGlobalAdmin ? <Link href="/admin/courses/create" className="rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">+ Tạo khóa học</Link> : null}
      </div>
      {loading ? <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" aria-label="Đang tải khóa học" /> : error ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-300"><p>{error}</p><button onClick={() => void load()} className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-bold dark:border-red-700">Thử lại</button></div>
      ) : !items.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">Chưa có khóa học CSCA.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-4">Khóa học</th><th className="p-4">Môn</th><th className="p-4">Quyền</th><th className="p-4">Bài</th><th className="p-4"><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{items.map((course) => <tr key={course.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70"><td className="p-4"><p className="font-bold">{course.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">/{course.slug}</p></td><td className="p-4">{course.subjectCode}</td><td className="p-4 uppercase">{course.accessType}</td><td className="p-4">{course.totalLessons}</td><td className="p-4 text-right"><Link className="font-bold text-indigo-700 dark:text-indigo-400" href={`/admin/courses/${course.id}`}>Chỉnh sửa</Link></td></tr>)}</tbody></table>
        </div>
      )}
    </AdminLayout>
  );
}
