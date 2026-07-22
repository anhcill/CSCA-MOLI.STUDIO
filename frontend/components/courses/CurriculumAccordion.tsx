'use client';

import { useState } from 'react';
import type { CurriculumSectionDto } from '@/lib/types/courses';
import { LessonRow } from './LessonRow';

export function CurriculumAccordion({ sections }: { sections: CurriculumSectionDto[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(sections.slice(0, 1).map((item) => item.id)));
  if (!sections.length) return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Chương trình học đang được cập nhật.</div>;
  const toggle = (id: number) => setOpen((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <div className="space-y-3">{sections.map((section, index) => <section key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button type="button" aria-expanded={open.has(section.id)} onClick={() => toggle(section.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left"><span className="font-black text-slate-900">{index + 1}. {section.title}</span><span className="text-sm text-slate-500">{section.lessons.length} bài {open.has(section.id) ? '−' : '+'}</span></button>{open.has(section.id) ? section.lessons.map((item) => <LessonRow key={item.id} lesson={item} />) : null}</section>)}</div>;
}
