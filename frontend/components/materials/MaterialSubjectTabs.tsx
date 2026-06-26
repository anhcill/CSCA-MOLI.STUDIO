'use client';

import { MATERIAL_SUBJECTS } from './materialLibraryTypes';

interface MaterialSubjectTabsProps {
  value: string;
  counts: Record<string, number>;
  onChange: (value: string) => void;
}

export function MaterialSubjectTabs({ value, counts, onChange }: MaterialSubjectTabsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {MATERIAL_SUBJECTS.map((subject) => {
        const active = value === subject.value;
        return (
          <button
            key={subject.value}
            type="button"
            onClick={() => onChange(subject.value)}
            className={`group flex min-h-[96px] items-center gap-3 rounded-2xl border p-4 text-left transition ${
              active
                ? 'border-transparent bg-white shadow-lg shadow-violet-100 ring-2 ring-violet-400'
                : 'border-slate-200 bg-white/80 shadow-sm hover:border-violet-200 hover:bg-white hover:shadow-md'
            }`}
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${subject.accent} text-2xl text-white shadow-sm`}>
              {subject.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-black text-slate-950 sm:text-base">{subject.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-black ${active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                  {counts[subject.value] || 0}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{subject.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
