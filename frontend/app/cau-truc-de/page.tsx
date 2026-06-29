'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ScopedStudyTopBar from '@/components/layout/ScopedStudyTopBar';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import axios from '@/lib/utils/axios';
import {
  SUBJECT_OPTIONS,
  normalizeContentSubject,
  subjectMatches,
} from '@/lib/utils/subjectScope';
import { FiFileText, FiExternalLink, FiDownload, FiX, FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useLanguage } from '@/context/LanguageContext';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  subject: string;
  topic: string;
  created_at: string;
  content_meta?: {
    images?: Array<{ url: string; caption?: string; order?: number }>;
  };
}

const materialsCache = new Map<string, Material[]>();
const materialsRequest = new Map<string, Promise<Material[]>>();

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  '': 'common.all',
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

const extractMaterials = (payload: unknown): Material[] => {
  const rows = (payload as { data?: Material[] } | undefined)?.data;
  return Array.isArray(rows) ? rows : [];
};

function getMaterialCoverUrl(material: Material) {
  return getMaterialImages(material)[0]?.url || '';
}

function getMaterialImages(material: Material) {
  const images = Array.isArray(material.content_meta?.images) ? material.content_meta.images : [];
  return images
    .filter((image) => image?.url)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

const fetchCauTrucDeMaterials = async (subject = ''): Promise<Material[]> => {
  const normalizedSubject = normalizeContentSubject(subject);
  const cacheKey = normalizedSubject || '__all__';
  const cached = materialsCache.get(cacheKey);
  if (cached) return cached;

  const pending = materialsRequest.get(cacheKey);
  if (pending) return pending;

  const params = new URLSearchParams({ category: 'cau-truc-de' });
  if (normalizedSubject) params.set('subject', normalizedSubject);

  const request = axios.get(`/materials?${params.toString()}`, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
  })
    .then((response) => {
      if (response.status === 304) return materialsCache.get(cacheKey) || [];
      const rows = extractMaterials(response.data);
      materialsCache.set(cacheKey, rows);
      return rows;
    })
    .catch((error) => {
      if (error?.response?.status === 304) return materialsCache.get(cacheKey) || [];
      throw error;
    })
    .finally(() => {
      materialsRequest.delete(cacheKey);
    });

  materialsRequest.set(cacheKey, request);
  return request;
};

function PDFModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`;
  const materialImages = getMaterialImages(material);

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
            <FiDownload size={13} /> {t('materials.download')}
          </a>
          <a href={material.file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors">
            <FiExternalLink size={13} /> {t('materials.openNewTab')}
          </a>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1">
            <FiX size={18} />
          </button>
        </div>
      </div>
      {materialImages.length > 0 ? (
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {materialImages.map((image, index) => (
              <figure key={image.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <a href={image.url} target="_blank" rel="noreferrer">
                  <img src={image.url} alt={image.caption || `${material.title} - ảnh ${index + 1}`} className="w-full bg-white object-contain" loading="lazy" />
                </a>
                {image.caption && (
                  <figcaption className="border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{image.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex-1 relative bg-gray-800">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />
            <p className="text-sm text-gray-300">{t('materials.loadingPdf')}</p>
          </div>
        )}
        <iframe src={viewerUrl} className="w-full h-full border-0" title={material.title} onLoad={() => setLoading(false)} />
      </div>
      )}
    </div>
  );
}

// ── PDF Card ──────────────────────────────────────────────────────────
function PDFCard({ m, onView }: { m: Material; onView: (m: Material) => void }) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN';
  const coverUrl = getMaterialCoverUrl(m);

  return (
    <div className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md" onClick={() => onView(m)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-purple-100 bg-slate-950">
        {coverUrl ? (
          <img src={coverUrl} alt={m.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col justify-between bg-gradient-to-br from-slate-950 via-purple-900 to-rose-900 p-4 text-white">
            <div className="flex items-center justify-between text-xs font-black uppercase text-white/70">
              <span>CSCA</span>
              <FiFileText size={18} />
            </div>
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/15">
                <FiFileText size={28} />
              </div>
              <p className="line-clamp-4 text-base font-black leading-tight">{m.title}</p>
            </div>
            <div className="h-1.5 rounded-full bg-white/35" />
          </div>
        )}
      </div>
      <div className="pt-3 text-center">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-gray-900 transition-colors group-hover:text-purple-700">{m.title}</h3>
        {m.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{m.description}</p>}
        <p className="mt-2 text-[11px] font-semibold text-gray-400">{new Date(m.created_at).toLocaleDateString(dateLocale)}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
            onClick={(e) => { e.stopPropagation(); onView(m); }}>
            <FiFileText size={11} /> {t('common.view')}
          </button>
          <a href={m.file_url} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200">
            <FiDownload size={11} /> {t('materials.download')}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Topic Section ─────────────────────────────────────────────────────
function TopicSection({ topic, materials, onView }: { topic: string; materials: Material[]; onView: (m: Material) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-7">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between py-2 mb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800">{topic || t('materials.commonTopic')}</span>
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
  const { t, format } = useLanguage();
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const subjectParam = normalizeContentSubject(searchParams.get('subject'));
  const isStrictSubject = !!subjectParam;
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState(subjectParam);
  const [viewing, setViewing] = useState<Material | null>(null);

  useEffect(() => {
    setActiveSubject(subjectParam);
  }, [subjectParam]);

  // Sync activeSubject to URL when it changes
  const handleSubjectChange = (subject: string) => {
    const normalizedSubject = normalizeContentSubject(subject);
    setActiveSubject(normalizedSubject);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (normalizedSubject) {
        url.searchParams.set('subject', normalizedSubject);
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
      const rows = await fetchCauTrucDeMaterials(activeSubject);
      setAllMaterials(rows);
    } catch {
      setLoadError(t('materials.loadError'));
      setAllMaterials(materialsCache.get(activeSubject || '__all__') || []);
    } finally {
      setLoading(false);
    }
  }, [activeSubject, t]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const filtered = useMemo(() => allMaterials.filter(m => {
    const matchSubject = subjectMatches(m.subject, activeSubject);
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

  const pageContent = (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📚</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('course.title.structure')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{format('materials.structureDesc', { count: allMaterials.length })}</p>
              </div>
            </div>
          </div>

          {/* Subject tabs */}
          {!isStrictSubject && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {SUBJECT_OPTIONS.map(s => (
              <button key={s.value} onClick={() => handleSubjectChange(s.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeSubject === s.value
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                }`}>
                <span>{s.emoji}</span> {t(SUBJECT_LABEL_KEYS[s.value] || s.label)}
              </button>
            ))}
          </div>
          )}

          {/* Search */}
          <div className="relative mb-7">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder={t('materials.searchDocs')} value={search} onChange={e => setSearch(e.target.value)}
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
                {t('materials.reload')}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-500">{search ? t('materials.noMatch') : t('materials.noneInSection')}</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([topic, items]) => (
              <TopicSection key={topic} topic={topic} materials={items} onView={setViewing} />
            ))
          )}
    </div>
  );

  if (isStrictSubject) {
    return (
      <>
        <SubjectStudyShell
          title={t('course.title.structure')}
          subjectSlug={activeSubject}
          activeSection="cau-truc-de"
          searchPlaceholder={t('materials.searchDocs')}
        >
          {pageContent}
        </SubjectStudyShell>

        {viewing && <PDFModal material={viewing} onClose={() => setViewing(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <ScopedStudyTopBar title={t('course.title.structure')} subject={activeSubject} fallbackIcon="📚" />
        {pageContent}
      </div>

      {viewing && <PDFModal material={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
