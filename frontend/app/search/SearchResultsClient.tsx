'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import {
  FiSearch, FiFileText, FiBook, FiClipboard, FiMessageCircle,
  FiChevronLeft, FiChevronRight, FiArrowRight, FiX,
} from 'react-icons/fi';
import axios from '@/lib/utils/axios';

// ── Types ──────────────────────────────────────────────────────────────
interface MaterialResult  { id: number; title: string; description?: string; category: string; subject: string; topic?: string }
interface VocabResult     { id: number; word_cn: string; pinyin: string; word_vn: string; word_en?: string; subject: string; topic?: string }
interface ExamResult      { id: number; title: string; subject_name: string; created_at: string }
interface PostResult      { id: number; content: string; created_at: string; author_name: string; author_avatar: string; like_count: number; comment_count: number }
interface SearchResults   { materials: MaterialResult[]; vocabulary: VocabResult[]; exams: ExamResult[]; posts: PostResult[] }

const TABS = [
  { key: 'all',        label: 'Tất Cả',    icon: FiSearch },
  { key: 'materials',  label: 'Tài Liệu',  icon: FiFileText },
  { key: 'vocabulary', label: 'Từ Vựng',   icon: FiBook },
  { key: 'exams',      label: 'Đề Thi',    icon: FiClipboard },
  { key: 'posts',      label: 'Diễn Đàn',  icon: FiMessageCircle },
] as const;

const CATEGORY_HREF: Record<string, string> = {
  'ly-thuyet': '/ly-thuyet', 'cau-truc-de': '/cau-truc-de',
  'de-mo-phong': '/de-mo-phong', 'tu-vung': '/tu-vung',
};

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5 not-italic font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const PER_PAGE = 20;

export default function SearchResultsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [inputVal, setInputVal] = useState(searchParams.get('q') || '');
  const [tab, setTab] = useState<string>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalByTab, setTotalByTab] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, activeTab: string, pg: number) => {
    if (!q.trim() || q.trim().length < 2) { setResults(null); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const offset = pg * PER_PAGE;
      const type = activeTab === 'all' ? 'all' : activeTab;
      const res = await axios.get(
        `/search?q=${encodeURIComponent(q)}&limit=${PER_PAGE}&offset=${offset}&type=${type}`,
        { signal: abortRef.current.signal }
      );
      const r: SearchResults = res.data.results;
      setResults(r);
      if (pg === 0) {
        setTotalByTab({
          all:        (r.materials?.length || 0) + (r.vocabulary?.length || 0) + (r.exams?.length || 0) + (r.posts?.length || 0),
          materials:  r.materials?.length || 0,
          vocabulary: r.vocabulary?.length || 0,
          exams:      r.exams?.length || 0,
          posts:      r.posts?.length || 0,
        });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'CanceledError') setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search whenever query/tab/page changes
  useEffect(() => {
    doSearch(query, tab, page);
  }, [query, tab, page, doSearch]);

  // Sync URL → state
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    setInputVal(q);
    setPage(0);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    router.push(`/search?q=${encodeURIComponent(inputVal.trim())}`);
  };

  const handleTabChange = (key: string) => {
    setTab(key);
    setPage(0);
  };

  const totalCount = results
    ? (tab === 'all'
      ? (results.materials?.length || 0) + (results.vocabulary?.length || 0) + (results.exams?.length || 0) + (results.posts?.length || 0)
      : (results[tab as keyof SearchResults] as unknown[])?.length || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Search bar */}
      <div className="bg-white border-b border-gray-100 sticky top-[68px] z-40">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
              <FiSearch size={18} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Tìm kiếm tài liệu, từ vựng, đề thi..."
                className="flex-1 bg-transparent text-gray-800 text-sm outline-none"
                autoFocus
              />
              {inputVal && (
                <button type="button" onClick={() => { setInputVal(''); router.push('/search'); }}
                  className="text-gray-400 hover:text-gray-600">
                  <FiX size={16} />
                </button>
              )}
              <button type="submit"
                className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
                Tìm
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {query && (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
              {TABS.map(t => {
                const count = totalByTab[t.key] || 0;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => handleTabChange(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      tab === t.key
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        tab === t.key ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status */}
            {!loading && results && (
              <p className="text-sm text-gray-500 mb-4">
                Tìm thấy <span className="font-semibold text-gray-800">{totalCount}</span> kết quả cho{' '}
                <span className="font-semibold text-violet-700">"{query}"</span>
              </p>
            )}
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Đang tìm kiếm...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && query && results && totalCount === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">Không tìm thấy kết quả</p>
            <p className="text-sm text-gray-500">Thử tìm với từ khóa khác hoặc kiểm tra chính tả</p>
          </div>
        )}

        {/* No query */}
        {!query && !loading && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">Nhập từ khóa để tìm kiếm</p>
            <p className="text-sm text-gray-500">Tìm tài liệu, từ vựng, đề thi, bài viết diễn đàn...</p>
          </div>
        )}

        {/* Results */}
        {!loading && results && totalCount > 0 && (
          <div className="space-y-6">

            {/* Materials */}
            {(tab === 'all' || tab === 'materials') && results.materials?.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FiFileText size={13} /> Tài Liệu ({results.materials.length})
                </h2>
                <div className="space-y-2">
                  {results.materials.map(m => (
                    <Link key={m.id}
                      href={CATEGORY_HREF[m.category] || '/tailieu'}
                      className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all group">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiFileText size={16} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                          <Highlight text={m.title} query={query} />
                        </p>
                        {m.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            <Highlight text={m.description} query={query} />
                          </p>
                        )}
                        <p className="text-xs text-violet-500 mt-1">{m.category}{m.topic && ` · ${m.topic}`}</p>
                      </div>
                      <FiArrowRight size={14} className="text-gray-300 group-hover:text-violet-500 flex-shrink-0 mt-1 transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Vocabulary */}
            {(tab === 'all' || tab === 'vocabulary') && results.vocabulary?.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FiBook size={13} /> Từ Vựng ({results.vocabulary.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.vocabulary.map(v => (
                    <Link key={v.id} href="/tu-vung"
                      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all group">
                      <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiBook size={16} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-purple-700">
                          <Highlight text={v.word_cn} query={query} />
                          <span className="text-xs font-normal text-gray-400 ml-2">{v.pinyin}</span>
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          <Highlight text={v.word_vn} query={query} />
                          {v.word_en && <span className="text-gray-400 ml-2">· {v.word_en}</span>}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Exams */}
            {(tab === 'all' || tab === 'exams') && results.exams?.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FiClipboard size={13} /> Đề Thi ({results.exams.length})
                </h2>
                <div className="space-y-2">
                  {results.exams.map(e => (
                    <Link key={e.id} href={`/exam/${e.id}`}
                      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all group">
                      <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FiClipboard size={16} className="text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                          <Highlight text={e.title} query={query} />
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.subject_name}</p>
                      </div>
                      <FiArrowRight size={14} className="text-gray-300 group-hover:text-violet-500 flex-shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Posts */}
            {(tab === 'all' || tab === 'posts') && results.posts?.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FiMessageCircle size={13} /> Diễn Đàn ({results.posts.length})
                </h2>
                <div className="space-y-2">
                  {results.posts.map(p => (
                    <Link key={p.id} href="/forum"
                      className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all group">
                      <img
                        src={p.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.author_name || 'U')}&size=36`}
                        alt={p.author_name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{p.author_name}</p>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          <Highlight text={p.content} query={query} />
                        </p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                          <span>❤️ {p.like_count}</span>
                          <span>💬 {p.comment_count}</span>
                        </div>
                      </div>
                      <FiArrowRight size={14} className="text-gray-300 group-hover:text-violet-500 flex-shrink-0 mt-1 transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Pagination */}
            {totalCount >= PER_PAGE && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-violet-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <FiChevronLeft size={14} /> Trước
                </button>
                <span className="text-sm text-gray-500 font-medium">Trang {page + 1}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={totalCount < PER_PAGE}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-violet-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Tiếp <FiChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
