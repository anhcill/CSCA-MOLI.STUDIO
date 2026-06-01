'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ScopedStudyTopBar from '@/components/layout/ScopedStudyTopBar';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import axios from '@/lib/utils/axios';
import {
  SUBJECT_OPTIONS,
  normalizeContentSubject,
  subjectMatches,
} from '@/lib/utils/subjectScope';
import { useLanguage } from '@/context/LanguageContext';
import { FiBook, FiDownload, FiExternalLink, FiX, FiSearch } from 'react-icons/fi';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  subject: string;
  topic: string;
  created_at: string;
}

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  '': 'common.all',
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

function PDFModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);
  const viewerUrl = useGoogleViewer
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true`
    : material.file_url;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 text-white flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FiBook className="text-emerald-400 shrink-0" size={18} />
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
            <FiExternalLink size={13} /> {t('common.view')}
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
            <p className="text-sm text-gray-300">{t('materials.loadingPdf')}</p>
          </div>
        )}
        <iframe src={viewerUrl} className="w-full h-full border-0" title={material.title} onLoad={() => setLoading(false)} onError={() => setUseGoogleViewer(true)} />
      </div>
    </div>
  );
}

function PDFCard({ m, onView }: { m: Material; onView: (m: Material) => void }) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer" onClick={() => onView(m)}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
          <FiBook className="text-emerald-600" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors">{m.title}</h3>
          {m.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.description}</p>}
          <p className="text-xs text-gray-400 mt-2">{new Date(m.created_at).toLocaleDateString(dateLocale)}</p>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
            onClick={(e) => { e.stopPropagation(); onView(m); }}>
            <FiBook size={11} /> {t('common.view')}
          </button>
          <a href={m.file_url} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
            <FiDownload size={11} /> {t('materials.download')}
          </a>
        </div>
      </div>
    </div>
  );
}

function TopicSection({ topic, materials, onView }: { topic: string; materials: Material[]; onView: (m: Material) => void }) {
  const { t } = useLanguage();

  return (
    <div className="mb-7">
      <div className="w-full flex items-center justify-between py-2 mb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800">{topic || t('materials.commonTopic')}</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">{materials.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {materials.map(m => <PDFCard key={m.id} m={m} onView={onView} />)}
      </div>
    </div>
  );
}

export default function LyThuyetPage() {
  const { t, format } = useLanguage();
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const subjectParam = normalizeContentSubject(searchParams.get('subject'));
  const isStrictSubject = !!subjectParam;
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState(subjectParam);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);

  useEffect(() => {
    setActiveSubject(subjectParam);
  }, [subjectParam]);

  const handleSubjectChange = (subject: string) => {
    const normalizedSubject = normalizeContentSubject(subject);
    setActiveSubject(normalizedSubject);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (normalizedSubject) url.searchParams.set('subject', normalizedSubject);
      else url.searchParams.delete('subject');
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const params = new URLSearchParams({ category: 'ly-thuyet' });
    if (activeSubject) params.set('subject', activeSubject);

    setLoading(true);
    axios.get(`/materials?${params.toString()}`)
      .then(r => setAllMaterials(r.data.data || []))
      .catch(() => setAllMaterials([]))
      .finally(() => setLoading(false));
  }, [activeSubject]);

  const filtered = useMemo(() => allMaterials.filter(m => {
    const matchSubject = subjectMatches(m.subject, activeSubject);
    const q = search.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q) || (m.topic || '').toLowerCase().includes(q);
    return matchSubject && matchSearch;
  }), [allMaterials, activeSubject, search]);

  useEffect(() => {
    if (!viewing && filtered.length > 0) setViewing(filtered[0]);
  }, [filtered, viewing]);

  useEffect(() => {
    setViewerLoaded(false);
    setUseGoogleViewer(false);
  }, [viewing?.id]);

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
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📖</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('course.title.theory')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{format('materials.theoryDesc', { count: allMaterials.length })}</p>
              </div>
            </div>
          </div>

          {!isStrictSubject && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {SUBJECT_OPTIONS.map(s => (
              <button key={s.value} onClick={() => handleSubjectChange(s.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeSubject === s.value
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}>
                <span>{s.emoji}</span> {t(SUBJECT_LABEL_KEYS[s.value] || s.label)}
              </button>
            ))}
          </div>
          )}

          <div className="relative mb-7">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder={t('materials.search')} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </div>

          {viewing && (
            <section className="mb-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gray-900 text-white">
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{viewing.title}</h2>
                  {viewing.topic && <p className="text-xs text-gray-300 truncate">{viewing.topic}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={viewing.file_url} download target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"><FiDownload size={13} /> {t('materials.download')}</a>
                  <a href={viewing.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"><FiExternalLink size={13} /> {t('materials.openFile')}</a>
                </div>
              </div>
              <div className="relative h-[72vh] bg-gray-800">
                {!viewerLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent" />
                    <p className="text-sm text-gray-300">{t('materials.loadingDoc')}</p>
                  </div>
                )}
                <iframe
                  src={useGoogleViewer ? `https://docs.google.com/viewer?url=${encodeURIComponent(viewing.file_url)}&embedded=true` : viewing.file_url}
                  className="w-full h-full border-0"
                  title={viewing.title}
                  onLoad={() => setViewerLoaded(true)}
                  onError={() => setUseGoogleViewer(true)}
                />
              </div>
            </section>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-500">{search ? t('materials.noMatch') : t('materials.none')}</p>
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
          title={t('course.title.theory')}
          subjectSlug={activeSubject}
          activeSection="ly-thuyet"
          searchPlaceholder={t('materials.search')}
        >
          {pageContent}
        </SubjectStudyShell>

      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <ScopedStudyTopBar title={t('course.title.theory')} subject={activeSubject} fallbackIcon="📖" />
        {pageContent}
      </div>

    </>
  );
}
