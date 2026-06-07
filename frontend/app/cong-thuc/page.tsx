'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import axios from '@/lib/utils/axios';
import {
  SUBJECT_OPTIONS,
  normalizeContentSubject,
  subjectMatches,
} from '@/lib/utils/subjectScope';
import { useLanguage } from '@/context/LanguageContext';
import { FiDownload, FiExternalLink, FiFileText, FiSearch } from 'react-icons/fi';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type?: string;
  subject: string;
  topic: string;
  created_at: string;
  content_html?: string;
  content_text?: string;
}

const FORMULA_CATEGORY = 'cong-thuc-on-thi';

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  '': 'common.all',
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(value?: string) {
  return (value || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function hasWebContent(material?: Material | null) {
  return Boolean(material?.content_html || material?.content_text);
}

function FormulaCard({ material, active, onView }: { material: Material; active: boolean; onView: (material: Material) => void }) {
  return (
    <button
      type="button"
      onClick={() => onView(material)}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        active
          ? 'border-emerald-300 bg-emerald-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-emerald-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          active ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
        }`}>
          <FiFileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-gray-950">{material.title}</h3>
          {material.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{material.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
            {material.topic && <span className="rounded-full bg-white px-2 py-0.5 text-emerald-700">{material.topic}</span>}
            {hasWebContent(material) && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">OCR</span>}
            <span>{new Date(material.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function TopicSection({
  topic,
  materials,
  activeId,
  onView,
}: {
  topic: string;
  materials: Material[];
  activeId?: number;
  onView: (material: Material) => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 py-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800">{topic || t('materials.commonTopic')}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{materials.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {materials.map(material => (
          <FormulaCard
            key={material.id}
            material={material}
            active={activeId === material.id}
            onView={onView}
          />
        ))}
      </div>
    </section>
  );
}

export default function CongThucPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const subjectParam = normalizeContentSubject(searchParams.get('subject'));
  const [materials, setMaterials] = useState<Material[]>([]);
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
    const params = new URLSearchParams({ category: FORMULA_CATEGORY });
    if (activeSubject) params.set('subject', activeSubject);

    setLoading(true);
    axios.get(`/materials?${params.toString()}`)
      .then(response => setMaterials(response.data.data || []))
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, [activeSubject]);

  const filtered = useMemo(() => materials.filter(material => {
    const query = search.toLowerCase();
    const matchSubject = subjectMatches(material.subject, activeSubject);
    const matchSearch = !query ||
      material.title.toLowerCase().includes(query) ||
      (material.description || '').toLowerCase().includes(query) ||
      (material.topic || '').toLowerCase().includes(query) ||
      (material.content_text || '').toLowerCase().includes(query);
    return matchSubject && matchSearch;
  }), [materials, activeSubject, search]);

  useEffect(() => {
    if (filtered.length === 0) {
      setViewing(null);
      return;
    }
    if (!viewing || !filtered.some(material => material.id === viewing.id)) {
      setViewing(filtered[0]);
    }
  }, [filtered, viewing]);

  useEffect(() => {
    setViewerLoaded(false);
    setUseGoogleViewer(false);
  }, [viewing?.id]);

  const grouped = useMemo(() => {
    const map = new Map<string, Material[]>();
    filtered.forEach(material => {
      const key = material.topic || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(material);
    });
    return map;
  }, [filtered]);
  const formulaTitle = t('course.title.formulas');

  return (
    <SubjectStudyShell
      title={formulaTitle}
      subjectSlug={activeSubject}
      activeSection="cong-thuc"
      searchPlaceholder="Tìm công thức..."
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-black text-emerald-700">∑</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{formulaTitle}</h1>
              <p className="mt-0.5 text-sm text-gray-500">Tổng hợp công thức theo môn, trích từ PDF admin upload.</p>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {SUBJECT_OPTIONS.map(subject => (
            <button
              key={subject.value}
              type="button"
              onClick={() => handleSubjectChange(subject.value)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeSubject === subject.value
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <span>{subject.emoji}</span> {t(SUBJECT_LABEL_KEYS[subject.value] || subject.label)}
            </button>
          ))}
        </div>

        <div className="relative mb-7">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Tìm công thức, chủ đề, từ khóa..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {viewing && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b bg-gray-900 px-4 py-3 text-white">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{viewing.title}</h2>
                {viewing.topic && <p className="truncate text-xs text-gray-300">{viewing.topic}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {viewing.file_url && (
                  <>
                    <a href={viewing.file_url} download target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"><FiDownload size={13} /> {t('materials.download')}</a>
                    <a href={viewing.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"><FiExternalLink size={13} /> {t('materials.openFile')}</a>
                  </>
                )}
              </div>
            </div>
            {hasWebContent(viewing) ? (
              <article
                className="max-h-[72vh] overflow-y-auto bg-white px-5 py-6 text-sm leading-7 text-gray-700 sm:px-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-950 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_p]:mb-4 [&_li]:mb-2 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: viewing.content_html || textToHtml(viewing.content_text) }}
              />
            ) : viewing.file_url ? (
              <div className="relative h-[72vh] bg-gray-800">
                {!viewerLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <p className="text-sm text-gray-300">{t('materials.loadingDoc')}</p>
                  </div>
                )}
                <iframe
                  src={useGoogleViewer ? `https://docs.google.com/viewer?url=${encodeURIComponent(viewing.file_url)}&embedded=true` : viewing.file_url}
                  className="h-full w-full border-0"
                  title={viewing.title}
                  onLoad={() => setViewerLoaded(true)}
                  onError={() => setUseGoogleViewer(true)}
                />
              </div>
            ) : (
              <div className="bg-white px-5 py-12 text-center text-sm text-gray-500">
                {t('materials.none')}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-gray-200" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mb-4 text-6xl">∑</div>
            <p className="text-gray-500">{search ? t('materials.noMatch') : t('materials.none')}</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([topic, items]) => (
            <TopicSection key={topic} topic={topic} materials={items} activeId={viewing?.id} onView={setViewing} />
          ))
        )}
      </div>
    </SubjectStudyShell>
  );
}
