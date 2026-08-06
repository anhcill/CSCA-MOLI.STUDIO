'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FiBookOpen,
  FiChevronRight,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiFilter,
  FiSearch,
} from 'react-icons/fi';
import RichMathText from '@/components/common/RichMathText';
import SolidGeometryIllustration, { type SolidGeometryIllustrationKind } from '@/components/formulas/SolidGeometryIllustration';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { useLanguage } from '@/context/LanguageContext';
import type {
  ChineseNaturalCscaFormulaTopic,
  ChineseNaturalFormulaGrade,
  ChineseNaturalFormulaLine,
} from '@/lib/formulas/chineseNaturalCscaFormulas';
import type {
  ChineseSocialCscaFormulaTopic,
  ChineseSocialFormulaGrade,
  ChineseSocialFormulaLine,
} from '@/lib/formulas/chineseSocialCscaFormulas';
import type {
  ChemistryCscaFormulaTopic,
  ChemistryFormulaGrade,
  ChemistryFormulaLine,
} from '@/lib/formulas/chemistryCscaFormulas';
import type {
  MathCscaFormulaTopic,
  MathFormulaGrade,
  MathFormulaLine,
} from '@/lib/formulas/mathCscaFormulas';
import type {
  PhysicsCscaFormulaTopic,
  PhysicsFormulaGrade,
  PhysicsFormulaLine,
} from '@/lib/formulas/physicsCscaFormulas';
import axios from '@/lib/utils/axios';
import {
  SUBJECT_OPTIONS,
  normalizeContentSubject,
  subjectMatches,
} from '@/lib/utils/subjectScope';

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
  allow_download?: boolean;
}

type FormulaGrade = MathFormulaGrade | PhysicsFormulaGrade | ChemistryFormulaGrade | ChineseNaturalFormulaGrade | ChineseSocialFormulaGrade;
type FormulaLine = MathFormulaLine | PhysicsFormulaLine | ChemistryFormulaLine | ChineseNaturalFormulaLine | ChineseSocialFormulaLine;
type FormulaTopic = MathCscaFormulaTopic | PhysicsCscaFormulaTopic | ChemistryCscaFormulaTopic | ChineseNaturalCscaFormulaTopic | ChineseSocialCscaFormulaTopic;
type GradeFilter = FormulaGrade | 'all';

interface FilteredFormulaTopic {
  topic: FormulaTopic;
  formulas: FormulaLine[];
}

interface FormulaRepositoryData {
  topics: FormulaTopic[];
  areas: string[];
  gradeOptions: FormulaGrade[];
}

const FORMULA_CATEGORY = 'cong-thuc-on-thi';
const DEFAULT_FORMULA_SUBJECT = 'toan';
const FORMULA_SUBJECT_OPTIONS = SUBJECT_OPTIONS.filter(subject => subject.value);
const ALL_GRADE: GradeFilter = 'all';
const ALL_AREA = 'all';
const FORMULA_TOPIC_BATCH_SIZE = 8;

const SUBJECT_LABEL_KEYS: Record<string, string> = {
  toan: 'subject.math',
  'vat-ly': 'subject.physics',
  'hoa-hoc': 'subject.chemistry',
  'tieng-trung-xh': 'subject.chineseSoc',
  'tieng-trung-tn': 'subject.chineseSci',
};

function isFormulaSubject(subject: string) {
  return subject === 'toan'
    || subject === 'vat-ly'
    || subject === 'hoa-hoc'
    || subject === 'tieng-trung-tn'
    || subject === 'tieng-trung-xh';
}

async function loadFormulaRepositoryData(subject: string): Promise<FormulaRepositoryData> {
  if (subject === 'vat-ly') {
    const module = await import('@/lib/formulas/physicsCscaFormulas');
    return {
      topics: module.PHYSICS_CSCA_FORMULA_TOPICS,
      areas: module.PHYSICS_FORMULA_AREAS,
      gradeOptions: module.PHYSICS_FORMULA_GRADE_OPTIONS,
    };
  }
  if (subject === 'hoa-hoc') {
    const module = await import('@/lib/formulas/chemistryCscaFormulas');
    return {
      topics: module.CHEMISTRY_CSCA_FORMULA_TOPICS,
      areas: module.CHEMISTRY_FORMULA_AREAS,
      gradeOptions: module.CHEMISTRY_FORMULA_GRADE_OPTIONS,
    };
  }
  if (subject === 'tieng-trung-tn') {
    const module = await import('@/lib/formulas/chineseNaturalCscaFormulas');
    return {
      topics: module.CHINESE_NATURAL_CSCA_FORMULA_TOPICS,
      areas: module.CHINESE_NATURAL_FORMULA_AREAS,
      gradeOptions: module.CHINESE_NATURAL_FORMULA_GRADE_OPTIONS,
    };
  }
  if (subject === 'tieng-trung-xh') {
    const module = await import('@/lib/formulas/chineseSocialCscaFormulas');
    return {
      topics: module.CHINESE_SOCIAL_CSCA_FORMULA_TOPICS,
      areas: module.CHINESE_SOCIAL_FORMULA_AREAS,
      gradeOptions: module.CHINESE_SOCIAL_FORMULA_GRADE_OPTIONS,
    };
  }

  const module = await import('@/lib/formulas/mathCscaFormulas');
  return {
    topics: module.MATH_CSCA_FORMULA_TOPICS,
    areas: module.MATH_FORMULA_AREAS,
    gradeOptions: module.MATH_FORMULA_GRADE_OPTIONS,
  };
}

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

function normalizeSearchText(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

function getFormulaText(line: FormulaLine) {
  return `${line.label} ${line.value} ${line.note || ''}`;
}

function getTopicMetaText(topic: FormulaTopic) {
  return [
    topic.title,
    topic.grade,
    topic.area,
    topic.chinese,
    topic.summary,
    topic.keywords.join(' '),
    topic.notes?.join(' '),
  ].filter(Boolean).join(' ');
}

function topicMatchesSearch(topic: FormulaTopic, query: string) {
  if (!query) return true;
  const metaMatch = normalizeSearchText(getTopicMetaText(topic)).includes(query);
  const formulaMatch = topic.formulas.some(line => normalizeSearchText(getFormulaText(line)).includes(query));
  return metaMatch || formulaMatch;
}

function getVisibleFormulas(topic: FormulaTopic, query: string) {
  if (!query) return topic.formulas;
  const metaMatch = normalizeSearchText(getTopicMetaText(topic)).includes(query);
  if (metaMatch) return topic.formulas;
  return topic.formulas.filter(line => normalizeSearchText(getFormulaText(line)).includes(query));
}

function getGradeLabel(grade: GradeFilter) {
  if (grade === 'all') return 'Tất cả';
  if (grade === 'Chung') return 'Chung';
  return `Lớp ${grade}`;
}

function FormulaValue({ line }: { line: FormulaLine }) {
  return (
    <div className="min-w-0 rounded-lg border border-sky-100 bg-sky-50/80 p-4 shadow-sm dark:border-sky-400/30 dark:bg-slate-900/95 dark:shadow-none">
      <div className="mb-2 text-sm font-black uppercase tracking-wide text-sky-700 dark:text-sky-300">{line.label}</div>
      <RichMathText
        value={line.value}
        className="min-w-0 overflow-x-auto text-base font-semibold leading-8 text-slate-950 dark:text-slate-50 [&_.katex-display]:overflow-x-auto [&_.katex]:text-[1.12em] dark:[&_.katex]:text-slate-50"
      />
      {line.note && (
        <RichMathText
          value={line.note}
          className="mt-3 border-t border-sky-100 pt-3 text-[15px] leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:[&_.katex]:text-slate-100"
        />
      )}
    </div>
  );
}

function FormulaTopicSection({ item }: { item: FilteredFormulaTopic }) {
  const { topic, formulas } = item;
  const illustration = 'illustration' in topic
    ? topic.illustration as SolidGeometryIllustrationKind | undefined
    : undefined;

  return (
    <section id={`formula-${topic.id}`} className="scroll-mt-5 border-t border-slate-200 pt-6 dark:border-slate-700">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">{getGradeLabel(topic.grade)}</span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">{topic.area}</span>
            {topic.chinese && <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">{topic.chinese}</span>}
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{topic.title}</h2>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">{topic.summary}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {formulas.length} công thức
        </div>
      </div>

      {illustration ? <SolidGeometryIllustration kind={illustration} /> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {formulas.map(line => (
          <FormulaValue key={`${topic.id}-${line.label}`} line={line} />
        ))}
      </div>

      {topic.notes?.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/40 dark:bg-amber-400/10">
          {topic.notes.map(note => (
            <RichMathText key={note} value={note} className="text-sm font-medium leading-6 text-amber-900 dark:text-amber-100 dark:[&_.katex]:text-amber-50" />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FormulaRepository({
  search,
  setSearch,
  topics,
  areas,
  gradeOptions,
  loading,
}: {
  search: string;
  setSearch: (value: string) => void;
  topics: FormulaTopic[];
  areas: string[];
  gradeOptions: FormulaGrade[];
  loading: boolean;
}) {
  const [grade, setGrade] = useState<GradeFilter>(ALL_GRADE);
  const [area, setArea] = useState(ALL_AREA);
  const [visibleTopicCount, setVisibleTopicCount] = useState(FORMULA_TOPIC_BATCH_SIZE);
  const deferredSearch = useDeferredValue(search);
  const query = normalizeSearchText(deferredSearch);

  const filteredTopics = useMemo<FilteredFormulaTopic[]>(() => (
    topics
      .filter(topic => {
        const gradeMatch = grade === ALL_GRADE || topic.grade === grade || (grade !== 'Chung' && topic.grade === 'Chung');
        const areaMatch = area === ALL_AREA || topic.area === area;
        return gradeMatch && areaMatch && topicMatchesSearch(topic, query);
      })
      .map(topic => ({ topic, formulas: getVisibleFormulas(topic, query) }))
      .filter(item => item.formulas.length > 0)
  ), [area, grade, query, topics]);

  const totalFormulaCount = useMemo(
    () => topics.reduce((sum, topic) => sum + topic.formulas.length, 0),
    [topics],
  );
  const visibleFormulaCount = filteredTopics.reduce((sum, item) => sum + item.formulas.length, 0);
  const visibleTopics = filteredTopics.slice(0, visibleTopicCount);
  const hiddenTopicCount = Math.max(filteredTopics.length - visibleTopics.length, 0);

  useEffect(() => {
    setVisibleTopicCount(FORMULA_TOPIC_BATCH_SIZE);
  }, [area, grade, query, topics]);

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(9)].map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Tìm công thức, chủ đề, từ khóa tiếng Trung..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-950 dark:focus:ring-sky-400/20"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
            <div className="rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-400/15">
              <div className="text-lg font-black text-sky-700 dark:text-sky-200">{filteredTopics.length}</div>
              <div className="text-[11px] font-bold uppercase text-sky-500 dark:text-sky-300">chủ đề</div>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-400/15">
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-200">{visibleFormulaCount}</div>
              <div className="text-[11px] font-bold uppercase text-emerald-500 dark:text-emerald-300">đang hiện</div>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-400/15">
              <div className="text-lg font-black text-amber-700 dark:text-amber-200">{totalFormulaCount}</div>
              <div className="text-[11px] font-bold uppercase text-amber-500 dark:text-amber-300">tổng</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FiFilter />
            Lớp
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[ALL_GRADE, ...gradeOptions].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setGrade(option)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black transition ${
                  grade === option
                    ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-sky-400 dark:hover:text-sky-200'
                }`}
              >
                {getGradeLabel(option)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FiBookOpen />
            Mảng kiến thức
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[ALL_AREA, ...areas].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setArea(option)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black transition ${
                  area === option
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-400 dark:hover:text-emerald-200'
                }`}
              >
                {option === ALL_AREA ? 'Tất cả' : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredTopics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 text-5xl">∑</div>
          <p className="font-semibold text-slate-500 dark:text-slate-300">Không thấy công thức phù hợp.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Chủ đề</div>
              <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                {filteredTopics.map(({ topic }) => (
                  <a
                    key={topic.id}
                    href={`#formula-${topic.id}`}
                    className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs font-bold leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <FiChevronRight className="mt-0.5 shrink-0" />
                    <span>{topic.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>
          <div className="space-y-7">
            {visibleTopics.map(item => (
              <FormulaTopicSection key={item.topic.id} item={item} />
            ))}
            {hiddenTopicCount > 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sky-200 bg-sky-50/70 px-4 py-6 text-center dark:border-sky-400/30 dark:bg-sky-400/10">
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Còn {hiddenTopicCount} chủ đề chưa render để trang mở nhanh hơn.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleTopicCount(prev => Math.min(prev + FORMULA_TOPIC_BATCH_SIZE, filteredTopics.length))}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700"
                  >
                    Tải thêm {Math.min(FORMULA_TOPIC_BATCH_SIZE, hiddenTopicCount)} chủ đề
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleTopicCount(filteredTopics.length)}
                    className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-700 hover:bg-sky-50 dark:border-sky-400/40 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
                  >
                    Hiện hết
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MaterialCard({
  material,
  active,
  onView,
}: {
  material: Material;
  active: boolean;
  onView: (material: Material) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onView(material)}
      className={`w-full rounded-lg border p-4 text-left transition-all ${
        active
          ? 'border-sky-300 bg-sky-50 shadow-sm'
          : 'border-sky-100 bg-sky-50/60 hover:border-sky-300 hover:bg-white hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-sky-600 text-white' : 'bg-white text-sky-700'
        }`}>
          <FiFileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-snug text-slate-950">{material.title}</h3>
          {material.description && <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{material.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
            {material.topic && <span className="rounded-lg bg-white px-2 py-0.5 text-sky-700">{material.topic}</span>}
            {hasWebContent(material) && <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-sky-700">OCR</span>}
            <span>{new Date(material.created_at).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MaterialViewer({
  material,
  viewerLoaded,
  useGoogleViewer,
  setViewerLoaded,
  setUseGoogleViewer,
}: {
  material: Material;
  viewerLoaded: boolean;
  useGoogleViewer: boolean;
  setViewerLoaded: (value: boolean) => void;
  setUseGoogleViewer: (value: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-slate-950 px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{material.title}</h2>
          {material.topic && <p className="truncate text-xs text-slate-300">{material.topic}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {material.file_url && (
            <>
              {material.allow_download !== false && <a href={material.file_url} download target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/20"><FiDownload size={13} /> {t('materials.download')}</a>}
              <a href={material.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/20"><FiExternalLink size={13} /> {t('materials.openFile')}</a>
            </>
          )}
        </div>
      </div>
      {hasWebContent(material) ? (
        <article
          className="max-h-[72vh] overflow-y-auto bg-white px-5 py-6 text-sm leading-7 text-slate-700 sm:px-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-900 [&_li]:mb-2 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: material.content_html || textToHtml(material.content_text) }}
        />
      ) : material.file_url ? (
        <div className="relative h-[72vh] bg-slate-800">
          {!viewerLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <p className="text-sm text-slate-300">{t('materials.loadingDoc')}</p>
            </div>
          )}
          <iframe
            src={useGoogleViewer ? `https://docs.google.com/viewer?url=${encodeURIComponent(material.file_url)}&embedded=true` : material.file_url}
            className="h-full w-full border-0"
            title={material.title}
            onLoad={() => setViewerLoaded(true)}
            onError={() => setUseGoogleViewer(true)}
          />
        </div>
      ) : (
        <div className="bg-white px-5 py-12 text-center text-sm text-slate-500">
          {t('materials.none')}
        </div>
      )}
    </section>
  );
}

function MaterialLibrary({
  title,
  materials,
  grouped,
  loading,
  viewing,
  setViewing,
  viewerLoaded,
  useGoogleViewer,
  setViewerLoaded,
  setUseGoogleViewer,
  emptyText,
}: {
  title: string;
  materials: Material[];
  grouped: Map<string, Material[]>;
  loading: boolean;
  viewing: Material | null;
  setViewing: (material: Material) => void;
  viewerLoaded: boolean;
  useGoogleViewer: boolean;
  setViewerLoaded: (value: boolean) => void;
  setUseGoogleViewer: (value: boolean) => void;
  emptyText: string;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-200" />)}
        </div>
      </section>
    );
  }

  if (materials.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
        <div className="mb-3 text-5xl">∑</div>
        <p className="font-semibold text-slate-500">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="text-sm font-medium text-slate-500">{materials.length} tài liệu</p>
        </div>
      </div>

      {viewing && (
        <MaterialViewer
          material={viewing}
          viewerLoaded={viewerLoaded}
          useGoogleViewer={useGoogleViewer}
          setViewerLoaded={setViewerLoaded}
          setUseGoogleViewer={setUseGoogleViewer}
        />
      )}

      {Array.from(grouped.entries()).map(([topic, items]) => (
        <div key={topic || 'common'} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-800">{topic || 'Chủ đề chung'}</span>
            <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(material => (
              <MaterialCard
                key={material.id}
                material={material}
                active={viewing?.id === material.id}
                onView={setViewing}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function CongThucPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const subjectParam = normalizeContentSubject(searchParams.get('subject')) || DEFAULT_FORMULA_SUBJECT;
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState(subjectParam);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);
  const [formulaRepositoryData, setFormulaRepositoryData] = useState<FormulaRepositoryData | null>(null);
  const [formulaRepositoryLoading, setFormulaRepositoryLoading] = useState(isFormulaSubject(subjectParam));
  const deferredSearch = useDeferredValue(search);
  const isFormulaRepositorySubject = isFormulaSubject(activeSubject);

  useEffect(() => {
    setActiveSubject(subjectParam);
  }, [subjectParam]);

  useEffect(() => {
    if (!isFormulaRepositorySubject) {
      setFormulaRepositoryData(null);
      setFormulaRepositoryLoading(false);
      return;
    }

    let cancelled = false;
    setFormulaRepositoryLoading(true);
    setFormulaRepositoryData(null);
    loadFormulaRepositoryData(activeSubject)
      .then(data => {
        if (!cancelled) setFormulaRepositoryData(data);
      })
      .catch(() => {
        if (!cancelled) setFormulaRepositoryData({ topics: [], areas: [], gradeOptions: [] });
      })
      .finally(() => {
        if (!cancelled) setFormulaRepositoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSubject, isFormulaRepositorySubject]);

  const handleSubjectChange = (subject: string) => {
    const normalizedSubject = normalizeContentSubject(subject) || DEFAULT_FORMULA_SUBJECT;
    setActiveSubject(normalizedSubject);
    setViewing(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('subject', normalizedSubject);
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const params = new URLSearchParams({ category: FORMULA_CATEGORY });
    params.set('subject', activeSubject || DEFAULT_FORMULA_SUBJECT);

    setLoading(true);
    axios.get(`/materials?${params.toString()}`)
      .then(response => {
        const data = response.data?.data;
        setMaterials(Array.isArray(data) ? data : []);
      })
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, [activeSubject]);

  const filteredMaterials = useMemo(() => materials.filter(material => {
    const query = normalizeSearchText(deferredSearch);
    const matchSubject = subjectMatches(material.subject, activeSubject);
    const matchSearch = !query ||
      normalizeSearchText(material.title).includes(query) ||
      normalizeSearchText(material.description).includes(query) ||
      normalizeSearchText(material.topic).includes(query) ||
      normalizeSearchText(material.content_text).includes(query);
    return matchSubject && matchSearch;
  }), [materials, activeSubject, deferredSearch]);

  useEffect(() => {
    if (isFormulaRepositorySubject) {
      if (viewing && !filteredMaterials.some(material => material.id === viewing.id)) {
        setViewing(null);
      }
      return;
    }

    if (filteredMaterials.length === 0) {
      setViewing(null);
      return;
    }
    if (!viewing || !filteredMaterials.some(material => material.id === viewing.id)) {
      setViewing(filteredMaterials[0]);
    }
  }, [filteredMaterials, isFormulaRepositorySubject, viewing]);

  useEffect(() => {
    setViewerLoaded(false);
    setUseGoogleViewer(false);
  }, [viewing?.id]);

  const groupedMaterials = useMemo(() => {
    const map = new Map<string, Material[]>();
    filteredMaterials.forEach(material => {
      const key = material.topic || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(material);
    });
    return map;
  }, [filteredMaterials]);

  const formulaTitle = t('course.title.formulas');

  return (
    <SubjectStudyShell
      title={formulaTitle}
      subjectSlug={activeSubject}
      activeSection="cong-thuc"
      searchPlaceholder="Tìm công thức..."
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {FORMULA_SUBJECT_OPTIONS.map(subject => (
            <button
              key={subject.value}
              type="button"
              onClick={() => handleSubjectChange(subject.value)}
              className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-black transition-all ${
                activeSubject === subject.value
                  ? 'border-slate-950 bg-slate-950 text-white shadow-sm dark:border-sky-400 dark:bg-sky-500 dark:text-slate-950'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-400 dark:hover:text-white'
              }`}
            >
              <span>{subject.emoji}</span> {t(SUBJECT_LABEL_KEYS[subject.value] || subject.label)}
            </button>
          ))}
        </div>

        {isFormulaRepositorySubject ? (
          <div className="space-y-8">
            <FormulaRepository
              key={activeSubject}
              search={search}
              setSearch={setSearch}
              topics={formulaRepositoryData?.topics || []}
              areas={formulaRepositoryData?.areas || []}
              gradeOptions={formulaRepositoryData?.gradeOptions || []}
              loading={formulaRepositoryLoading}
            />
            <MaterialLibrary
              title="Tài liệu bổ sung từ admin"
              materials={filteredMaterials}
              grouped={groupedMaterials}
              loading={loading}
              viewing={viewing}
              setViewing={setViewing}
              viewerLoaded={viewerLoaded}
              useGoogleViewer={useGoogleViewer}
              setViewerLoaded={setViewerLoaded}
              setUseGoogleViewer={setUseGoogleViewer}
              emptyText="Chưa có tài liệu bổ sung cho môn này."
            />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm tài liệu, chủ đề, từ khóa..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <MaterialLibrary
              title="Công thức đã upload"
              materials={filteredMaterials}
              grouped={groupedMaterials}
              loading={loading}
              viewing={viewing}
              setViewing={setViewing}
              viewerLoaded={viewerLoaded}
              useGoogleViewer={useGoogleViewer}
              setViewerLoaded={setViewerLoaded}
              setUseGoogleViewer={setUseGoogleViewer}
              emptyText={search ? t('materials.noMatch') : t('materials.none')}
            />
          </div>
        )}
      </div>
    </SubjectStudyShell>
  );
}
