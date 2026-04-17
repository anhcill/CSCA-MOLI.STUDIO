'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiClock, FiFileText, FiBook, FiClipboard, FiX, FiArrowRight } from 'react-icons/fi';
import axios from '@/lib/utils/axios';

// ── Types ────────────────────────────────────────────────────────────
interface MaterialResult {
  id: number;
  title: string;
  description?: string;
  category: string;
  subject: string;
  topic?: string;
}

interface VocabResult {
  id: number;
  word_cn: string;
  pinyin: string;
  word_vn: string;
  word_en?: string;
  subject: string;
  topic?: string;
}

interface ExamResult {
  id: number;
  title: string;
  subject_name: string;
}

interface SearchResults {
  materials: MaterialResult[];
  vocabulary: VocabResult[];
  exams: ExamResult[];
}

const CATEGORY_LABEL: Record<string, string> = {
  'ly-thuyet': 'Lý Thuyết',
  'cau-truc-de': 'Cấu Trúc Đề',
  'de-mo-phong': 'Đề Mô Phỏng',
  'tu-vung': 'Từ Vựng',
};

const CATEGORY_HREF: Record<string, string> = {
  'ly-thuyet': '/ly-thuyet',
  'cau-truc-de': '/cau-truc-de',
  'de-mo-phong': '/de-mo-phong',
  'tu-vung': '/tu-vung',
};

const RECENT_KEY = 'csca_recent_searches';
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function addRecent(q: string) {
  if (!q.trim()) return;
  const prev = getRecent().filter(r => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

function removeRecent(q: string) {
  const prev = getRecent().filter(r => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(prev));
}

// ── Highlight matching text ──────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent on open
  useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    const currentDebounce = debounceRef.current;
    if (currentDebounce) {
      clearTimeout(currentDebounce);
    }
    if (!q.trim()) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(res.data.results);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build flat list for keyboard nav
  const allItems = results ? [
    ...results.materials.map(m => ({ type: 'material' as const, data: m })),
    ...results.vocabulary.map(v => ({ type: 'vocab' as const, data: v })),
    ...results.exams.map(e => ({ type: 'exam' as const, data: e })),
  ] : [];

  const navigate = (item: typeof allItems[0]) => {
    if (item.type === 'material') {
      const href = CATEGORY_HREF[(item.data as MaterialResult).category] || '/tailieu';
      addRecent(query);
      setOpen(false);
      setQuery('');
      router.push(href);
    } else if (item.type === 'vocab') {
      addRecent(query);
      setOpen(false);
      setQuery('');
      router.push('/tu-vung');
    } else {
      addRecent(query);
      setOpen(false);
      setQuery('');
      router.push(`/exam/${(item.data as ExamResult).id}`);
    }
  };

  const handleSearch = (q?: string) => {
    const finalQ = q ?? query;
    if (!finalQ.trim()) return;
    addRecent(finalQ);
    setOpen(false);
    setQuery('');
    router.push(`/search?q=${encodeURIComponent(finalQ)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); inputRef.current?.blur(); return; }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && allItems[activeIdx]) navigate(allItems[activeIdx]);
      else handleSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(v => Math.min(v + 1, allItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(v => Math.max(v - 1, -1));
    }
  };

  const totalResults = results ? results.materials.length + results.vocabulary.length + results.exams.length : 0;
  const showDropdown = open;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${open ? 'border-purple-400 ring-2 ring-purple-100 bg-white' : 'border-gray-200 bg-gray-50 hover:border-gray-300'} w-56 lg:w-72`}>
        {loading
          ? <div className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
          : <FiSearch size={15} className="text-gray-400 shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Tìm kiếm..."
          onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null); setActiveIdx(-1); inputRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600 shrink-0">
            <FiX size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[95vw] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]">
          {/* No query → recent searches */}
          {!query.trim() ? (
            <div className="p-3">
              {recent.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Tìm kiếm gần đây</p>
                  {recent.map(r => (
                    <div key={r} className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 cursor-pointer group">
                      <FiClock size={13} className="text-gray-400 shrink-0" />
                      <span className="flex-1 text-sm text-gray-700" onClick={() => { setQuery(r); inputRef.current?.focus(); }}>{r}</span>
                      <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                        onClick={(e) => { e.stopPropagation(); removeRecent(r); setRecent(getRecent()); }}>
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-center text-sm text-gray-400 py-6">Nhập để tìm kiếm tài liệu, từ vựng, đề thi...</p>
              )}
            </div>
          ) : loading ? (
            <div className="py-8 text-center">
              <div className="inline-block w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400 mt-2">Đang tìm...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm text-gray-500">Không tìm thấy kết quả cho <span className="font-semibold">"{query}"</span></p>
            </div>
          ) : (
            <div className="py-2">
              {/* Materials */}
              {results!.materials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase px-4 py-2">
                    📄 Tài Liệu ({results!.materials.length})
                  </p>
                  {results!.materials.map((m, i) => {
                    const globalIdx = i;
                    const isActive = activeIdx === globalIdx;
                    return (
                      <button key={m.id} onClick={() => navigate({ type: 'material', data: m })}
                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                          <FiFileText size={13} className={isActive ? 'text-purple-600' : 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            <Highlight text={m.title} query={query} />
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {CATEGORY_LABEL[m.category] || m.category}
                            {m.topic && <> · <span className="text-purple-500">{m.topic}</span></>}
                          </p>
                        </div>
                        <FiArrowRight size={13} className="text-gray-300 shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Vocabulary */}
              {results!.vocabulary.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase px-4 py-2">
                    📖 Từ Vựng ({results!.vocabulary.length})
                  </p>
                  {results!.vocabulary.map((v, i) => {
                    const globalIdx = results!.materials.length + i;
                    const isActive = activeIdx === globalIdx;
                    return (
                      <button key={v.id} onClick={() => navigate({ type: 'vocab', data: v })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                          <FiBook size={13} className={isActive ? 'text-purple-600' : 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            <span className="text-purple-700"><Highlight text={v.word_cn} query={query} /></span>
                            <span className="text-gray-400 text-xs ml-1.5">{v.pinyin}</span>
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            <Highlight text={v.word_vn} query={query} />
                            {v.word_en && <span className="text-gray-400 ml-2">· {v.word_en}</span>}
                          </p>
                        </div>
                        <FiArrowRight size={13} className="text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Exams */}
              {results!.exams.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase px-4 py-2">
                    📝 Đề Thi ({results!.exams.length})
                  </p>
                  {results!.exams.map((e, i) => {
                    const globalIdx = results!.materials.length + results!.vocabulary.length + i;
                    const isActive = activeIdx === globalIdx;
                    return (
                      <button key={e.id} onClick={() => navigate({ type: 'exam', data: e })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                          <FiClipboard size={13} className={isActive ? 'text-purple-600' : 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            <Highlight text={e.title} query={query} />
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{e.subject_name}</p>
                        </div>
                        <FiArrowRight size={13} className="text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* See all */}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button onClick={() => handleSearch()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-purple-600 font-medium hover:bg-purple-50 transition-colors">
                  <FiSearch size={14} />
                  Xem tất cả kết quả cho "{query}"
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
