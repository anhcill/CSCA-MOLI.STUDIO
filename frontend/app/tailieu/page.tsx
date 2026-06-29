'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import BackButton from '@/components/layout/BackButton';
import axios from '@/lib/utils/axios';
import { MaterialSearchBar } from '@/components/materials/MaterialSearchBar';
import { MaterialSection } from '@/components/materials/MaterialSection';
import { MaterialSubjectTabs } from '@/components/materials/MaterialSubjectTabs';
import { MaterialTypeTabs } from '@/components/materials/MaterialTypeTabs';
import {
  FORMULA_CATEGORY,
  MATERIAL_SUBJECTS,
  MATERIAL_TYPES,
  getMaterialSubject,
  type Material,
} from '@/components/materials/materialLibraryTypes';

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(material: Material, keyword: string) {
  if (!keyword) return true;
  return normalizeText(`${material.title} ${material.description || ''}`).includes(keyword);
}

function buildCounts(materials: Material[], key: 'subject' | 'category') {
  const counts: Record<string, number> = { all: materials.length };
  materials.forEach((material) => {
    const value = key === 'subject' ? material.subject || 'unknown' : material.category || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

export default function TaiLieuPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState('all');
  const [activeType, setActiveType] = useState('all');

  useEffect(() => {
    axios.get('/materials')
      .then((response) => {
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        setMaterials(rows.filter((material: Material) => material.category !== FORMULA_CATEGORY));
      })
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleMaterials = useMemo(() => {
    const keyword = normalizeText(search);
    return materials.filter((material) => {
      if (material.category === FORMULA_CATEGORY) return false;
      if (activeSubject !== 'all' && material.subject !== activeSubject) return false;
      if (activeType !== 'all' && material.category !== activeType) return false;
      return matchesSearch(material, keyword);
    });
  }, [activeSubject, activeType, materials, search]);

  const subjectCounts = useMemo(() => buildCounts(materials, 'subject'), [materials]);
  const typeCounts = useMemo(() => {
    const bySubject = activeSubject === 'all'
      ? materials
      : materials.filter((material) => material.subject === activeSubject);
    return buildCounts(bySubject, 'category');
  }, [activeSubject, materials]);

  const sections = useMemo(() => {
    const subjects = activeSubject === 'all'
      ? MATERIAL_SUBJECTS.filter((subject) => subject.value !== 'all')
      : MATERIAL_SUBJECTS.filter((subject) => subject.value === activeSubject);

    return subjects
      .map((subject) => ({
        subject,
        materials: visibleMaterials.filter((material) => material.subject === subject.value),
      }))
      .filter((section) => section.materials.length > 0);
  }, [activeSubject, visibleMaterials]);

  const unknownMaterials = useMemo(
    () => visibleMaterials.filter((material) => !getMaterialSubject(material.subject)),
    [visibleMaterials],
  );

  const activeSubjectData = getMaterialSubject(activeSubject) || MATERIAL_SUBJECTS[0];
  const activeTypeData = MATERIAL_TYPES.find((type) => type.value === activeType) || MATERIAL_TYPES[0];
  const activeLabel = activeSubject === 'all'
    ? `${activeSubjectData.label} · ${activeTypeData.label}`
    : `${activeSubjectData.label} · ${activeTypeData.label}`;

  const resetFilters = () => {
    setSearch('');
    setActiveSubject('all');
    setActiveType('all');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center sm:p-8">
            <div>
              <BackButton fallbackHref="/" className="mb-4" />
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 text-3xl text-white shadow-sm">
                📚
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tài liệu học tập</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600 sm:text-base">
                Chọn môn trước, sau đó chọn loại tài liệu. Mỗi môn được tách thành khu riêng để không bị lẫn nội dung.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-center sm:min-w-[260px]">
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-2xl font-black text-violet-600">{materials.length}</p>
                <p className="text-xs font-bold text-slate-500">Tài liệu</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-2xl font-black text-pink-600">{MATERIAL_SUBJECTS.length - 1}</p>
                <p className="text-xs font-bold text-slate-500">Nhóm môn</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-500">Bước 1</p>
                <h2 className="text-lg font-black text-slate-950">Chọn môn cần học</h2>
              </div>
              {(activeSubject !== 'all' || activeType !== 'all' || search) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  Xóa lọc
                </button>
              )}
            </div>
            <MaterialSubjectTabs value={activeSubject} counts={subjectCounts} onChange={setActiveSubject} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-500">Bước 2</p>
              <h2 className="text-lg font-black text-slate-950">Chọn loại tài liệu</h2>
            </div>
            <MaterialTypeTabs value={activeType} counts={typeCounts} onChange={setActiveType} />
          </div>

          <MaterialSearchBar
            value={search}
            resultCount={visibleMaterials.length}
            activeLabel={activeLabel}
            onChange={setSearch}
            onClear={resetFilters}
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-3xl bg-white shadow-sm" />
            ))}
          </div>
        ) : visibleMaterials.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <div className="mb-4 text-5xl">📭</div>
            <p className="text-lg font-black text-slate-700">Chưa có tài liệu phù hợp</p>
            <p className="mt-2 text-sm font-medium text-slate-500">Thử đổi môn, đổi loại tài liệu hoặc xóa từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <MaterialSection key={section.subject.value} subject={section.subject} materials={section.materials} />
            ))}
            {unknownMaterials.length > 0 && (
              <MaterialSection subject={MATERIAL_SUBJECTS[0]} materials={unknownMaterials} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
