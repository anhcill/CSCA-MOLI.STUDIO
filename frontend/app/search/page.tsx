import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchResultsClient from './SearchResultsClient';

export const metadata: Metadata = {
  title: 'Tìm Kiếm',
  description: 'Tìm kiếm tài liệu, từ vựng, đề thi trên CSCA.',
  robots: { index: false }, // search pages shouldn't be indexed
};

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchResultsClient />
    </Suspense>
  );
}
