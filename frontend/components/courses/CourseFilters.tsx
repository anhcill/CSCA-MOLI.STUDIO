'use client';

import { FiBookOpen, FiLayers, FiSliders } from 'react-icons/fi';
import type { CourseAccessType, CourseCatalogQuery, CourseLevel, CscaSubjectCode } from '@/lib/types/courses';

const SUBJECTS: Array<{ value: CscaSubjectCode | ''; label: string }> = [
  { value: '', label: 'Tất cả môn học' },
  { value: 'MATH', label: 'Toán CSCA' },
  { value: 'PHYSICS', label: 'Vật lý CSCA' },
  { value: 'CHEMISTRY', label: 'Hóa học CSCA' },
  { value: 'CHINESE_SCI', label: 'Trung văn Tự nhiên' },
  { value: 'CHINESE_SOC', label: 'Trung văn Xã hội' },
];

const selectClass =
  'min-h-12 w-full rounded-xl border border-[#ded2c7] bg-[#fffdf9] px-4 text-sm font-bold text-[#382f2a] outline-none transition focus:border-[#a87955] focus:ring-4 focus:ring-[#b78a68]/10 dark:border-[#34435a] dark:bg-[#091426] dark:text-slate-200 dark:focus:border-[#b78a68] dark:focus:ring-[#b78a68]/15';

export function CourseFilters({ value, onChange }: { value: CourseCatalogQuery; onChange: (next: CourseCatalogQuery) => void }) {
  const update = (key: keyof CourseCatalogQuery, nextValue: string) =>
    onChange({ ...value, [key]: nextValue || undefined, page: 1 });

  return (
    <div className="rounded-2xl border border-[#ddcfc0] bg-[#fffaf5]/95 p-4 shadow-[0_16px_36px_-28px_rgba(67,46,30,.55)] backdrop-blur transition-colors dark:border-[#2d3a50] dark:bg-[#0b172b]/95 dark:shadow-[0_18px_40px_-25px_rgba(0,0,0,.8)] sm:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-bold text-[#786a60] dark:text-slate-400">
          <span className="inline-flex items-center gap-2"><FiBookOpen className="text-[#a46b45] dark:text-[#d0a27a]" /> Môn học</span>
          <select aria-label="Môn học" value={value.subjectCode || ''} onChange={(event) => update('subjectCode', event.target.value as CscaSubjectCode)} className={selectClass}>
            {SUBJECTS.map((subject) => <option key={subject.value || 'all'} value={subject.value}>{subject.label}</option>)}
          </select>
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-[#786a60] dark:text-slate-400">
          <span className="inline-flex items-center gap-2"><FiLayers className="text-[#a46b45] dark:text-[#d0a27a]" /> Hình thức truy cập</span>
          <select aria-label="Hình thức truy cập" value={value.accessType || ''} onChange={(event) => update('accessType', event.target.value as CourseAccessType)} className={selectClass}>
            <option value="">Tất cả khóa học</option>
            <option value="free">Miễn phí</option>
            <option value="package">Mở khóa theo gói</option>
            <option value="contact">Liên hệ đăng ký</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-[#786a60] dark:text-slate-400">
          <span>Trình độ</span>
          <select aria-label="Trình độ" value={value.level || ''} onChange={(event) => update('level', event.target.value as CourseLevel)} className={selectClass}>
            <option value="">Mọi trình độ</option>
            <option value="basic">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-[#786a60] dark:text-slate-400">
          <span className="inline-flex items-center gap-2"><FiSliders className="text-[#a46b45] dark:text-[#d0a27a]" /> Sắp xếp</span>
          <select aria-label="Sắp xếp" value={value.sort || 'newest'} onChange={(event) => update('sort', event.target.value)} className={selectClass}>
            <option value="newest">Mới nhất</option>
            <option value="popular">Phổ biến nhất</option>
            <option value="rating">Đánh giá cao</option>
          </select>
        </label>
      </div>
    </div>
  );
}
