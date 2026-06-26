'use client';

import { MATERIAL_TYPES } from './materialLibraryTypes';

interface MaterialTypeTabsProps {
  value: string;
  counts: Record<string, number>;
  onChange: (value: string) => void;
}

export function MaterialTypeTabs({ value, counts, onChange }: MaterialTypeTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {MATERIAL_TYPES.map((type) => {
        const active = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              active
                ? `${type.color} border-transparent text-white shadow-md`
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'
            }`}
          >
            <span>{type.icon}</span>
            <span>{type.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-400'}`}>
              {counts[type.value] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
