'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import axios from '@/lib/utils/axios';
import { FiFileText, FiExternalLink, FiDownload, FiX, FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  subject: string;
  topic: string;
  created_at: string;
}

let materialsCache: Material[] | null = null;
let materialsRequest: Promise<Material[]> | null = null;

const extractMaterials = (payload: unknown): Material[] => {
  const rows = (payload as { data?: Material[] } | undefined)?.data;
  return Array.isArray(rows) ? rows : [];
};

const fetchCauTrucDeMaterials = async (): Promise<Material[]> => {
  if (materialsCache) return materialsCache;
  if (materialsRequest) return materialsRequest;

  materialsRequest = axios.get('/materials?category=cau-truc-de', {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
  })
    .then((response) => {
      if (response.status === 304) return materialsCache || [];
      const rows = extractMaterials(response.data);
      materialsCache = rows;
      return rows;
    })
    .catch((error) => {
      if (error?.response?.status === 304) return materialsCache || [];
      throw error;
    })
    .finally(() => {
      materialsRequest = null;
    });

  return materialsRequest;
};

const SUBJECTS = [
  { value: '', label: 'Tất cả', emoji: '📋' },
  { value: 'toan', label: 'Toán', emoji: '📐' },
  { value: 'vat-ly', label: 'Vật Lý', emoji: '⚡' },
  { value: 'hoa-hoc', label: 'Hóa Học', emoji: '🧪' },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH', emoji: '📖' },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN', emoji: '🔬' },
];

// ── PDF Viewer Modal ──────────────────────────────────────────────────
function PDFModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 text-white flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FiFileText className="text-red-400 shrink-0" size={18} />
          <span className="text-sm font-semibold truncate">{material.title}</span>
          {material.topic && (
            <span className="hidden sm:block px-2 py-0.5 bg-white/10 rounded text-xs text-gray-300 shrink-0">{material.topic}</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <a href={material.file_url} download target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors">
            <FiDownload size={13} /> Tải về
          </a>
          <a href={material.file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors">
            <FiExternalLink size={13} /> Mở tab mới
          </a>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1">
            <FiX size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 relative bg-gray-800">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />
            <p className="text-sm text-gray-300">Đang tải PDF...</p>
          </div>
        )}
        <iframe src={viewerUrl} className="w-full h-full border-0" title={material.title} onLoad={() => setLoading(false)} />
      </div>
    </div>
  );
}

// ── PDF Card ──────────────────────────────────────────────────────────
function PDFCard({ m, onView }: { m: Material; onView: (m: Material) => void }) {
  return (
    <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer" onClick={() => onView(m)}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
          <FiFileText className="text-red-500" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-purple-700 transition-colors">{m.title}</h3>
          {m.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.description}</p>}
          <p className="text-xs text-gray-400 mt-2">{new Date(m.created_at).toLocaleDateString('vi-VN')}</p>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
            onClick={(e) => { e.stopPropagation(); onView(m); }}>
            <FiFileText size={11} /> Xem
          </button>
          <a href={m.file_url} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
            <FiDownload size={11} /> Tải
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Topic Section ─────────────────────────────────────────────────────
function TopicSection({ topic, materials, onView }: { topic: string; materials: Material[]; onView: (m: Material) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-7">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-2 mb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800">{topic || 'Tài liệu chung'}</span>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">{materials.length}</span>
        </div>
        {open ? <FiChevronUp className="text-gray-400" size={16} /> : <FiChevronDown className="text-gray-400" size={16} />}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {materials.map(m => <PDFCard key={m.id} m={m} onView={onView} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function CauTrucDePage() {
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const initialSubject = searchParams.get('subject') ?? '';
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState(initialSubject);
  const [viewing, setViewing] = useState<Material | null>(null);

  // Sync activeSubject to URL when it changes
  const handleSubjectChange = (subject: string) => {
    setActiveSubject(subject);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (subject) {
        url.searchParams.set('subject', subject);
      } else {
        url.searchParams.delete('subject');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchCauTrucDeMaterials();
      setAllMaterials(rows);
    } catch {
      setLoadError('Tải tài liệu chưa thành công. Bạn thử lại giúp mình nhé.');
      setAllMaterials(materialsCache || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const filtered = useMemo(() => allMaterials.filter(m => {
    const matchSubject = !activeSubject || m.subject === activeSubject;
    const q = search.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q) || (m.topic || '').toLowerCase().includes(q);
    return matchSubject && matchSearch;
  }), [allMaterials, activeSubject, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    filtered.forEach(m => {
      const key = m.topic || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [filtered]);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📚</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cấu Trúc Đề</h1>
                <p className="text-sm text-gray-500 mt-0.5">Phân tích cấu trúc đề thi chính thức · {allMaterials.length} tài liệu</p>
              </div>
            </div>
          </div>

          {/* Subject tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {SUBJECTS.map(s => (
              <button key={s.value} onClick={() => handleSubjectChange(s.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeSubject === s.value
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                }`}>
                <span>{s.emoji}</span> {s.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-7">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm kiếm tài liệu..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
            </div>
          ) : loadError && allMaterials.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-gray-600 mb-4">{loadError}</p>
              <button
                onClick={loadMaterials}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                Tải lại
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-500">{search ? 'Không tìm thấy tài liệu phù hợp' : 'Chưa có tài liệu nào cho mục này'}</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([topic, items]) => (
              <TopicSection key={topic} topic={topic} materials={items} onView={setViewing} />
            ))
          )}
        </main>
      </div>

      {viewing && <PDFModal material={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
