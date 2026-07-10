'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import axios from '@/lib/utils/axios';
import {
  FiBookmark,
  FiBookOpen,
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiDownload,
  FiDroplet,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiGlobe,
  FiGrid,
  FiHash,
  FiLock,
  FiSearch,
  FiSliders,
  FiZap,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import { ProUpgradeModal } from '@/components/common/ProModal';
import { deleteBookmark, saveBookmark } from '@/lib/api/insights';
import MaterialContentViewer from '@/components/materials/MaterialContentViewer';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  category: string;
  subject: string;
  created_at: string;
  is_premium?: boolean;
  content_html?: string;
  content_text?: string;
}

const FORMULA_CATEGORY = 'cong-thuc-on-thi';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const SUBJECTS = [
  { value: '', label: 'Tất cả môn', Icon: FiGrid },
  { value: 'toan', label: 'Toán', Icon: FiHash },
  { value: 'vat-ly', label: 'Vật lý', Icon: FiZap },
  { value: 'hoa-hoc', label: 'Hóa học', Icon: FiDroplet },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH', Icon: FiGlobe },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN', Icon: FiBookOpen },
];

const CATEGORIES = [
  { value: 'all', label: 'Tất cả', Icon: FiFileText },
  { value: 'ly-thuyet', label: 'Lý thuyết', Icon: FiBookOpen },
  { value: 'cau-truc-de', label: 'Cấu trúc đề', Icon: FiClipboard },
  { value: 'de-mo-phong', label: 'Đề mô phỏng', Icon: FiEdit3 },
  { value: 'tu-vung', label: 'Từ vựng', Icon: FiGlobe },
];

function hasWebContent(material: Material) {
  return Boolean(material.content_html || material.content_text);
}

function canUsePdfProxy(fileUrl?: string) {
  return Boolean(fileUrl && /\/upload\/v\d+\//.test(fileUrl));
}

function countBy(items: Material[], key: 'subject' | 'category', value: string) {
  if (!value || value === 'all') return items.length;
  return items.filter((item) => item[key] === value).length;
}

function subjectLabel(value: string) {
  return SUBJECTS.find((item) => item.value === value)?.label || 'Môn học';
}

function categoryLabel(value: string) {
  return CATEGORIES.find((item) => item.value === value)?.label || 'Tài liệu';
}

function MaterialRow({ material }: { material: Material }) {
  const user = useAuthStore((state) => state.user);
  const isVip = isVipActive(user);
  const [expanded, setExpanded] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const hasFile = Boolean(material.file_url);
  const hasContent = hasWebContent(material);
  const hasPdfProxy = canUsePdfProxy(material.file_url);
  const locked = Boolean(material.is_premium && !isVip);
  const pdfUrl = hasPdfProxy ? `${API_URL}/materials/pdf/${material.id}` : material.file_url;
  const downloadUrl = hasPdfProxy ? `${API_URL}/materials/pdf/${material.id}/download` : material.file_url;
  const SubjectIcon = SUBJECTS.find((item) => item.value === material.subject)?.Icon || FiFileText;

  const openProtectedPdf = async (url: string, download = false) => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth';
      return;
    }
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('PDF request failed');
    const objectUrl = URL.createObjectURL(await response.blob());
    if (download) {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${material.title || 'tai-lieu'}.pdf`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      return;
    }
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  };

  const handleOpen = async (event: React.MouseEvent) => {
    if (locked) {
      event.preventDefault();
      setShowVipModal(true);
      return;
    }
    if (hasContent) {
      event.preventDefault();
      setExpanded((value) => !value);
    } else if (hasPdfProxy && pdfUrl) {
      event.preventDefault();
      await openProtectedPdf(pdfUrl);
    }
  };

  const handleDownload = async (event: React.MouseEvent) => {
    if (locked) {
      event.preventDefault();
      setShowVipModal(true);
    } else if (hasPdfProxy && downloadUrl) {
      event.preventDefault();
      await openProtectedPdf(downloadUrl, true);
    }
  };

  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      if (next) {
        await saveBookmark({
          entity_type: 'material',
          entity_id: material.id,
          title: material.title,
          metadata: { category: material.category, subject: material.subject, file_type: material.file_type },
        });
      } else {
        await deleteBookmark('material', material.id);
      }
    } catch {
      setBookmarked(!next);
    }
  };

  return (
    <article className="border-b border-slate-200 last:border-b-0">
      <div className="grid gap-4 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5 lg:grid-cols-[48px_minmax(0,1fr)_190px_110px_44px_128px] lg:items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
          <SubjectIcon size={20} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-bold text-slate-900">{material.title}</h2>
            {material.is_premium && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                <FaCrown size={10} /> PRO
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{material.description || 'Tài liệu học tập và ôn luyện CSCA.'}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{subjectLabel(material.subject)}</span>
          <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{categoryLabel(material.category)}</span>
        </div>

        <time className="text-sm text-slate-500">{new Date(material.created_at).toLocaleDateString('vi-VN')}</time>

        <button
          type="button"
          onClick={toggleBookmark}
          aria-label={bookmarked ? 'Bỏ lưu tài liệu' : 'Lưu tài liệu'}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${bookmarked ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100 hover:text-violet-700'}`}
        >
          <FiBookmark size={18} />
        </button>

        <div className="flex items-center gap-2">
          {locked ? (
            <button type="button" onClick={() => setShowVipModal(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-100">
              <FiLock /> Mở PRO
            </button>
          ) : hasFile || hasContent ? (
            <a href={hasContent ? '#' : pdfUrl} target={hasContent ? undefined : '_blank'} rel="noreferrer" onClick={handleOpen} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50">
              Xem tài liệu {expanded ? <FiChevronUp /> : <FiExternalLink />}
            </a>
          ) : (
            <span className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-slate-100 px-3 text-sm text-slate-400">Chưa có file</span>
          )}
          {!locked && hasFile && (
            <a href={downloadUrl} onClick={handleDownload} aria-label="Tải tài liệu" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-violet-700">
              <FiDownload />
            </a>
          )}
        </div>
      </div>

      {expanded && !locked && hasContent && (
        <MaterialContentViewer contentHtml={material.content_html} contentText={material.content_text} className="border-t border-slate-200 bg-slate-50" />
      )}
      {expanded && !locked && !hasContent && hasFile && !hasPdfProxy && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <iframe src={pdfUrl} className="h-[600px] w-full rounded-xl border border-slate-200 bg-white" title={material.title} loading="lazy" />
        </div>
      )}

      {showVipModal && <ProUpgradeModal isOpen onClose={() => setShowVipModal(false)} title={`“${material.title}” chỉ dành cho VIP`} />}
    </article>
  );
}

export default function TaiLieuPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    axios.get('/materials')
      .then((response) => setMaterials((response.data.data || []).filter((item: Material) => item.category !== FORMULA_CATEGORY)))
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return materials
      .filter((item) => {
        const matchesSearch = !keyword || item.title.toLocaleLowerCase('vi').includes(keyword) || (item.description || '').toLocaleLowerCase('vi').includes(keyword);
        return matchesSearch && (!subject || item.subject === subject) && (category === 'all' || item.category === category);
      })
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'vi') : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [materials, search, subject, category, sort]);

  const clearFilters = () => {
    setSearch('');
    setSubject('');
    setCategory('all');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Kho học liệu CSCA</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Thư viện tài liệu</h1>
            <p className="mt-2 text-sm text-slate-500">Tìm kiếm và khám phá tài liệu học tập chất lượng.</p>
          </div>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-violet-200 hover:text-violet-700">
            <FiBookmark /> Tài liệu đã lưu
          </button>
        </div>

        <div className="mb-6 flex rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100">
          <div className="relative min-w-0 flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tài liệu, chủ đề hoặc từ khóa…" className="h-12 w-full rounded-lg border-0 bg-transparent pl-12 pr-4 text-sm outline-none placeholder:text-slate-400" />
          </div>
          <button type="button" className="hidden h-12 rounded-lg bg-violet-600 px-7 text-sm font-bold text-white shadow-sm hover:bg-violet-700 sm:block">Tìm kiếm</button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
            <FilterGroup title="Môn học" Icon={FiBookOpen} items={SUBJECTS} value={subject} onChange={setSubject} counts={(value) => countBy(materials, 'subject', value)} />
            <FilterGroup title="Loại tài liệu" Icon={FiSliders} items={CATEGORIES} value={category} onChange={setCategory} counts={(value) => countBy(materials, 'category', value)} />
            <div className="border-t border-slate-200 p-3">
              <button type="button" onClick={clearFilters} className="h-10 w-full rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Xóa bộ lọc</button>
            </div>
          </aside>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-800">{filtered.length} tài liệu</p>
              <div className="relative">
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 min-w-44 appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400">
                  <option value="newest">Mới cập nhật</option>
                  <option value="title">Tên A–Z</option>
                </select>
                <FiSliders className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-200">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-[92px] animate-pulse bg-gradient-to-r from-white via-slate-50 to-white" />)}</div>
            ) : filtered.length ? (
              <div>{filtered.map((material) => <MaterialRow key={material.id} material={material} />)}</div>
            ) : (
              <div className="px-6 py-24 text-center">
                <FiSearch className="mx-auto mb-4 text-slate-300" size={36} />
                <h2 className="font-bold text-slate-800">Không tìm thấy tài liệu phù hợp</h2>
                <p className="mt-2 text-sm text-slate-500">Thử từ khóa khác hoặc xóa bớt bộ lọc.</p>
                <button type="button" onClick={clearFilters} className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Xóa bộ lọc</button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function FilterGroup({ title, Icon, items, value, onChange, counts }: {
  title: string;
  Icon: typeof FiBookOpen;
  items: { value: string; label: string; Icon: typeof FiBookOpen }[];
  value: string;
  onChange: (value: string) => void;
  counts: (value: string) => number;
}) {
  return (
    <div className="border-b border-slate-200 p-3 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 px-2 py-1 text-sm font-bold text-slate-900"><Icon className="text-violet-600" /> {title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const ActiveIcon = item.Icon;
          const active = value === item.value;
          return (
            <button key={item.value || 'all'} type="button" onClick={() => onChange(item.value)} className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${active ? 'bg-violet-50 font-bold text-violet-700' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <ActiveIcon className={active ? 'text-violet-600' : 'text-slate-400'} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{counts(item.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
