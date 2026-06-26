'use client';

import { MaterialCard } from './MaterialCard';
import { getMaterialSubject, MATERIAL_TYPES, type Material, type MaterialSubjectOption } from './materialLibraryTypes';

interface MaterialSectionProps {
  subject: MaterialSubjectOption;
  materials: Material[];
}

export function MaterialSection({ subject, materials }: MaterialSectionProps) {
  const typeCounts = MATERIAL_TYPES
    .filter((type) => type.value !== 'all')
    .map((type) => ({ type, count: materials.filter((material) => material.category === type.value).length }))
    .filter((item) => item.count > 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${subject.accent} text-2xl text-white shadow-sm`}>
            {subject.emoji}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-slate-950">{subject.label}</h2>
            <p className="text-sm font-semibold text-slate-500">{subject.desc}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{materials.length} tài liệu</span>
          {typeCounts.map(({ type, count }) => (
            <span key={type.value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {type.icon} {count}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {materials.map((material) => (
          <MaterialCard key={material.id} material={material} />
        ))}
      </div>
    </section>
  );
}

export function UnknownSubjectSection({ materials }: { materials: Material[] }) {
  return (
    <MaterialSection
      subject={getMaterialSubject('all')!}
      materials={materials}
    />
  );
}
