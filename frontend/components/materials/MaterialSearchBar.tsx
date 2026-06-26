'use client';

import { FiSearch, FiX } from 'react-icons/fi';

interface MaterialSearchBarProps {
  value: string;
  resultCount: number;
  activeLabel: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function MaterialSearchBar({ value, resultCount, activeLabel, onChange, onClear }: MaterialSearchBarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm tài liệu theo tên hoặc mô tả..."
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-base font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:text-sm"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Xóa tìm kiếm"
            >
              <FiX size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
          <span className="text-sm font-bold text-slate-500">
            <strong className="text-violet-600">{resultCount}</strong> tài liệu trong {activeLabel}
          </span>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
