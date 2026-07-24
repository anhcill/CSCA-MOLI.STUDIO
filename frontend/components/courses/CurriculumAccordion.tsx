'use client';

import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import type { CurriculumSectionDto } from '@/lib/types/courses';
import { LessonRow } from './LessonRow';

function durationLabel(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}g ${minutes % 60}p` : `${minutes} phút`;
}

export function CurriculumAccordion({ sections }: { sections: CurriculumSectionDto[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(sections.slice(0, 1).map((item) => item.id)));
  if (!sections.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">Chương trình học đang được cập nhật.</div>;
  const toggle = (id: number) => setOpen((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const allOpen = open.size === sections.length;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(sections.map((section) => section.id)));

  return (
    <div>
      <div className="mb-3 flex justify-end"><button type="button" onClick={toggleAll} className="text-sm font-black text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200">{allOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}</button></div>
      <div className="space-y-3">{sections.map((section, index) => {
        const expanded = open.has(section.id);
        return <section key={section.id} className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-slate-950/70 ${expanded ? 'border-indigo-200 shadow-sm dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800'}`}><button type="button" aria-expanded={expanded} onClick={() => toggle(section.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70 sm:p-5"><span className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${expanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{index + 1}</span><span className="min-w-0"><span className="block truncate font-black text-slate-900 dark:text-white">{section.title}</span><span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">{section.lessons.length} bài · {durationLabel(section.totalDurationSeconds)}</span></span></span><FiChevronDown className={`shrink-0 text-xl text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} /></button>{expanded ? <div className="border-t border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/40">{section.description ? <p className="px-5 py-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{section.description}</p> : null}{section.lessons.map((item, lessonIndex) => <LessonRow key={item.id} lesson={item} index={lessonIndex + 1} />)}</div> : null}</section>;
      })}</div>
    </div>
  );
}
