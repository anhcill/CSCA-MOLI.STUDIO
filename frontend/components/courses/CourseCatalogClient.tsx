'use client';

import { useEffect, useState } from 'react';
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
      <CourseFilters value={query} onChange={setQuery} />
      {error ? (
        <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
          <button type="button" className="ml-4 font-bold underline" onClick={() => setRequestVersion((value) => value + 1)}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="mt-8" aria-live="polite" aria-busy={loading}>
          {loading ? <CourseGridSkeleton /> : <CourseGrid courses={catalog?.items ?? []} />}
        </div>
      )}
      {!loading && !error && catalog && catalog.totalPages > 1 ? (
        <nav aria-label="Phân trang khóa học" className="mt-8 flex items-center justify-center gap-4">
          <button type="button" disabled={catalog.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: catalog.page - 1 }))} className="rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-40">
            Trang trước
          </button>
          <span className="text-sm text-slate-600">Trang {catalog.page}/{catalog.totalPages}</span>
          <button type="button" disabled={catalog.page >= catalog.totalPages} onClick={() => setQuery((value) => ({ ...value, page: catalog.page + 1 }))} className="rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-40">
            Trang sau
          </button>
        </nav>
      ) : null}
    </section>
  );
}
