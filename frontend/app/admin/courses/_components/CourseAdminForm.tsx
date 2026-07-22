'use client';

import { useState } from 'react';
import type { CourseAdminInput, CourseAccessType, CourseLevel, CscaSubjectCode } from '@/lib/types/courses';

const EMPTY: CourseAdminInput = {
  title: '', slug: '', shortDescription: '', descriptionHtml: '', subjectCode: 'MATH',
  level: 'basic', accessType: 'free', thumbnailUrl: null, priceVnd: null,
  compareAtPriceVnd: null, certificateEnabled: false,
};

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function CourseAdminForm({ initialValue = EMPTY, submitLabel, onSubmit }: {
  initialValue?: CourseAdminInput;
  submitLabel: string;
  onSubmit: (value: CourseAdminInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof CourseAdminInput>(key: K, value: CourseAdminInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.slug.trim() || !form.shortDescription.trim()) {
      setError('Vui lòng nhập tên, slug và mô tả ngắn.');
      return;
    }
    try {
      setSaving(true); setError(''); setSaved(false);
      await onSubmit({ ...form, title: form.title.trim(), slug: form.slug.trim(), shortDescription: form.shortDescription.trim() });
      setSaved(true);
    } catch {
      setError('Không thể lưu khóa học. Kiểm tra dữ liệu và thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="font-bold text-slate-700">Tên khóa học<input required value={form.title} onChange={(e) => set('title', e.target.value)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} className={fieldClass} /></label>
        <label className="font-bold text-slate-700">Môn học<select value={form.subjectCode} onChange={(e) => set('subjectCode', e.target.value as CscaSubjectCode)} className={fieldClass}><option value="MATH">Toán</option><option value="PHYSICS">Vật lý</option><option value="CHEMISTRY">Hóa học</option><option value="CHINESE_SCI">Tiếng Trung Tự nhiên</option><option value="CHINESE_SOC">Tiếng Trung Xã hội</option></select></label>
        <label className="font-bold text-slate-700">Quyền truy cập<select value={form.accessType} onChange={(e) => set('accessType', e.target.value as CourseAccessType)} className={fieldClass}><option value="free">Miễn phí</option><option value="vip">VIP</option><option value="premium">Premium</option><option value="contact">Liên hệ</option><option value="private">Riêng tư</option></select></label>
        <label className="font-bold text-slate-700">Trình độ<select value={form.level} onChange={(e) => set('level', e.target.value as CourseLevel)} className={fieldClass}><option value="basic">Cơ bản</option><option value="intermediate">Trung cấp</option><option value="advanced">Nâng cao</option></select></label>
        <label className="font-bold text-slate-700">Ảnh bìa URL<input type="url" value={form.thumbnailUrl || ''} onChange={(e) => set('thumbnailUrl', e.target.value || null)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700">Giá (VND)<input type="number" min={0} value={form.priceVnd ?? ''} onChange={(e) => set('priceVnd', e.target.value ? Number(e.target.value) : null)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700">Giá gốc (VND)<input type="number" min={0} value={form.compareAtPriceVnd ?? ''} onChange={(e) => set('compareAtPriceVnd', e.target.value ? Number(e.target.value) : null)} className={fieldClass} /></label>
      </div>
      <label className="block font-bold text-slate-700">Mô tả ngắn<textarea required rows={3} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} className={fieldClass} /></label>
      <label className="block font-bold text-slate-700">Nội dung giới thiệu (HTML được backend làm sạch)<textarea rows={8} value={form.descriptionHtml} onChange={(e) => set('descriptionHtml', e.target.value)} className={`${fieldClass} font-mono text-sm`} /></label>
      <label className="flex items-center gap-3 font-bold text-slate-700"><input type="checkbox" checked={form.certificateEnabled} onChange={(e) => set('certificateEnabled', e.target.checked)} className="h-5 w-5 rounded" />Cấp chứng chỉ hoàn thành</label>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      {saved ? <p role="status" className="text-sm font-semibold text-emerald-700">Đã lưu thay đổi.</p> : null}
      <button disabled={saving} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : submitLabel}</button>
    </form>
  );
}
