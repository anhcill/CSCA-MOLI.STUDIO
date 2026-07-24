'use client';

import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseCatalogDto, CourseCatalogQuery } from '@/lib/types/courses';
import { CourseFilters } from './CourseFilters';
import { CourseGrid, CourseGridSkeleton } from './CourseGrid';

const INITIAL_QUERY: CourseCatalogQuery = { page: 1, pageSize: 12, sort: 'newest' };

export function CourseCatalogClient() {
  const [query, setQuery] = useState<CourseCatalogQuery>(INITIAL_QUERY);
  const [catalog, setCatalog] = useState<CourseCatalogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    coursesApi.getCatalog(query)
      .then((data) => active && setCatalog(data))
      .catch(() => active && setError('Không thể tải danh sách khóa học.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query, requestVersion]);

  return (
    <section aria-label="Danh sách khóa học">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Thư viện bài giảng</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Khóa học dành cho bạn</h2></div>
        <p className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{loading ? 'Đang cập nhật...' : `${catalog?.totalItems ?? 0} khóa học`}</p>
      </div>
      <CourseFilters value={query} onChange={setQuery} />
      {error ? (
        <div role="alert" className="mt-8 rounded-[1.75rem] border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><p className="font-bold">{error}</p><button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600" onClick={() => setRequestVersion((value) => value + 1)}><FiRefreshCw /> Thử lại</button></div>
      ) : (
        <div className="mt-8" aria-live="polite" aria-busy={loading}>{loading ? <CourseGridSkeleton /> : <CourseGrid courses={catalog?.items ?? []} />}</div>
      )}
      {!loading && !error && catalog && catalog.totalPages > 1 ? (
        <nav aria-label="Phân trang khóa học" className="mt-10 flex items-center justify-center gap-3">
          <button type="button" disabled={catalog.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: catalog.page - 1 }))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FiArrowLeft /> Trang trước</button>
          <span className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">{catalog.page} / {catalog.totalPages}</span>
          <button type="button" disabled={catalog.page >= catalog.totalPages} onClick={() => setQuery((value) => ({ ...value, page: catalog.page + 1 }))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Trang sau <FiArrowRight /></button>
        </nav>
      ) : null}
    </section>
  );
}
