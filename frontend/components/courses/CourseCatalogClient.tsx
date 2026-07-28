'use client';

import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiGrid, FiRefreshCw } from 'react-icons/fi';
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-red-200 bg-red-50 text-xl text-[#a9182b] transition-colors dark:border-[#61303a] dark:bg-[#251523] dark:text-[#f28fa0]">
            <FiBookOpen />
          </span>
          <div>
            <p className="font-sans text-sm font-black uppercase tracking-[.15em] text-[#8f2633] dark:text-[#ef9eaa]">Thư viện bài giảng</p>
            <h2 className="mt-1 text-sm font-medium text-[#746b64] dark:text-slate-400">Tiếp tục hành trình học tập của bạn</h2>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dccdbf] bg-[#fffaf5] px-4 py-2 text-sm font-bold text-[#594b41] transition-colors dark:border-[#33425b] dark:bg-[#0b172b] dark:text-[#dfc9ae]">
          <FiGrid /> {loading ? 'Đang cập nhật...' : `${catalog?.totalItems ?? 0} khóa học`}
        </div>
      </div>

      <CourseFilters value={query} onChange={setQuery} />

      {error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300">
          <p className="font-bold">{error}</p>
          <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#a9182b] px-4 py-2 font-bold text-white" onClick={() => setRequestVersion((value) => value + 1)}>
            <FiRefreshCw /> Thử lại
          </button>
        </div>
      ) : (
        <div className="mt-4" aria-live="polite" aria-busy={loading}>
          {loading ? <CourseGridSkeleton /> : <CourseGrid courses={catalog?.items ?? []} />}
        </div>
      )}

      {!loading && !error && catalog && catalog.totalPages > 1 ? (
        <nav aria-label="Phân trang khóa học" className="mt-8 flex items-center justify-center gap-3">
          <button type="button" disabled={catalog.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: catalog.page - 1 }))} className="inline-flex items-center gap-2 rounded-xl border border-[#d9c9ba] bg-[#fffaf4] px-4 py-2.5 font-bold text-[#4b3a30] transition-colors disabled:opacity-40 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200">
            <FiArrowLeft /> Trang trước
          </button>
          <span className="rounded-xl bg-[#071228] px-4 py-2.5 text-sm font-black text-white">{catalog.page} / {catalog.totalPages}</span>
          <button type="button" disabled={catalog.page >= catalog.totalPages} onClick={() => setQuery((value) => ({ ...value, page: catalog.page + 1 }))} className="inline-flex items-center gap-2 rounded-xl border border-[#d9c9ba] bg-[#fffaf4] px-4 py-2.5 font-bold text-[#4b3a30] transition-colors disabled:opacity-40 dark:border-[#34435a] dark:bg-[#0b172b] dark:text-slate-200">
            Trang sau <FiArrowRight />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
