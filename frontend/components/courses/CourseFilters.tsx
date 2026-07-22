'use client';

import { FiFilter, FiSliders } from 'react-icons/fi';
import type { CourseAccessType, CourseCatalogQuery, CourseLevel, CscaSubjectCode } from '@/lib/types/courses';

const SUBJECTS: Array<{ value: CscaSubjectCode | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'MATH', label: 'Toán' },
  { value: 'PHYSICS', label: 'Vật lý' },
  { value: 'CHEMISTRY', label: 'Hóa học' },
  { value: 'CHINESE_SCI', label: 'Trung văn TN' },
  { value: 'CHINESE_SOC', label: 'Trung văn XH' },
];

const selectClass = 'min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100';

export function CourseFilters({ value, onChange }: { value: CourseCatalogQuery; onChange: (next: CourseCatalogQuery) => void }) {
  const update = (key: keyof CourseCatalogQuery, nextValue: string) => onChange({ ...value, [key]: nextValue || undefined, page: 1 });

  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_14px_45px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900"><FiFilter className="text-indigo-600" /> Chọn môn học</div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {SUBJECTS.map((subject) => {
          const active = (value.subjectCode || '') === subject.value;
          return <button key={subject.value || 'all'} type="button" onClick={() => update('subjectCode', subject.value)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'}`}>{subject.label}</button>;
        })}
      </div>
      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-bold text-slate-500"><span>Quyền truy cập</span><select aria-label="Quyền truy cập" value={value.accessType || ''} onChange={(event) => update('accessType', event.target.value as CourseAccessType)} className={selectClass}><option value="">Tất cả gói học</option><option value="free">Miễn phí</option><option value="vip">VIP</option><option value="premium">Premium</option><option value="contact">Liên hệ</option></select></label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-500"><span>Trình độ</span><select aria-label="Trình độ" value={value.level || ''} onChange={(event) => update('level', event.target.value as CourseLevel)} className={selectClass}><option value="">Mọi trình độ</option><option value="basic">Cơ bản</option><option value="intermediate">Trung cấp</option><option value="advanced">Nâng cao</option></select></label>
        <label className="grid gap-1.5 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><FiSliders /> Sắp xếp</span><select aria-label="Sắp xếp" value={value.sort || 'newest'} onChange={(event) => update('sort', event.target.value)} className={selectClass}><option value="newest">Mới nhất</option><option value="popular">Phổ biến nhất</option><option value="rating">Đánh giá cao</option></select></label>
      </div>
    </div>
  );
}
