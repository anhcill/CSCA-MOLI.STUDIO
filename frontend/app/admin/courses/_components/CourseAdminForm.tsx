'use client';

import { useEffect, useState } from 'react';
import coursesApi from '@/lib/api/courses';
import type {
  CourseAdminInput,
  CourseAccessType,
  CourseLevel,
  CscaSubjectCode,
  VipPackageDto,
} from '@/lib/types/courses';

const EMPTY: CourseAdminInput = {
  title: '',
  slug: '',
  shortDescription: '',
  descriptionHtml: '',
  subjectCode: 'MATH',
  level: 'basic',
  accessType: 'free',
  packageIds: [],
  thumbnailUrl: null,
  priceVnd: null,
  compareAtPriceVnd: null,
  certificateEnabled: false,
};

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20';

export function CourseAdminForm({ initialValue = EMPTY, submitLabel, onSubmit }: {
  initialValue?: CourseAdminInput;
  submitLabel: string;
  onSubmit: (value: CourseAdminInput) => Promise<void>;
}) {
  const [form, setForm] = useState<CourseAdminInput>({
    ...initialValue,
    packageIds: initialValue.packageIds ?? [],
  });
  const [packages, setPackages] = useState<VipPackageDto[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    coursesApi.getActivePackages()
      .then((items) => {
        if (active) setPackages(items);
      })
      .catch(() => {
        if (active) setPackagesError('Không thể tải danh sách gói thanh toán.');
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const set = <K extends keyof CourseAdminInput>(key: K, value: CourseAdminInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changeAccessType = (accessType: CourseAccessType) => {
    set('accessType', accessType);
    if (accessType !== 'package') set('packageIds', []);
  };

  const togglePackage = (packageId: number) => {
    set('packageIds', form.packageIds.includes(packageId)
      ? form.packageIds.filter((id) => id !== packageId)
      : [...form.packageIds, packageId]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.slug.trim() || !form.shortDescription.trim()) {
      setError('Vui lòng nhập tên, slug và mô tả ngắn.');
      return;
    }
    if (form.accessType === 'package' && form.packageIds.length === 0) {
      setError('Hãy chọn ít nhất một gói thanh toán được phép mở khóa học này.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSaved(false);
      await onSubmit({
        ...form,
        title: form.title.trim(),
        slug: form.slug.trim(),
        shortDescription: form.shortDescription.trim(),
      });
      setSaved(true);
    } catch {
      setError('Không thể lưu khóa học. Kiểm tra dữ liệu và thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="font-bold text-slate-700 dark:text-slate-200">Tên khóa học<input required value={form.title} onChange={(e) => set('title', e.target.value)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} className={fieldClass} /></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Môn học<select value={form.subjectCode} onChange={(e) => set('subjectCode', e.target.value as CscaSubjectCode)} className={fieldClass}><option value="MATH">Toán</option><option value="PHYSICS">Vật lý</option><option value="CHEMISTRY">Hóa học</option><option value="CHINESE_SCI">Tiếng Trung Tự nhiên</option><option value="CHINESE_SOC">Tiếng Trung Xã hội</option></select></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">
          Quyền truy cập
          <select value={form.accessType} onChange={(e) => changeAccessType(e.target.value as CourseAccessType)} className={fieldClass}>
            <option value="free">Miễn phí</option>
            <option value="package">Theo gói thanh toán</option>
            <option value="contact">Liên hệ</option>
            <option value="private">Riêng tư</option>
          </select>
        </label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Trình độ<select value={form.level} onChange={(e) => set('level', e.target.value as CourseLevel)} className={fieldClass}><option value="basic">Cơ bản</option><option value="intermediate">Trung cấp</option><option value="advanced">Nâng cao</option></select></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Ảnh bìa URL<input type="url" value={form.thumbnailUrl || ''} onChange={(e) => set('thumbnailUrl', e.target.value || null)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Giá (VND)<input type="number" min={0} value={form.priceVnd ?? ''} onChange={(e) => set('priceVnd', e.target.value ? Number(e.target.value) : null)} className={fieldClass} /></label>
        <label className="font-bold text-slate-700 dark:text-slate-200">Giá gốc (VND)<input type="number" min={0} value={form.compareAtPriceVnd ?? ''} onChange={(e) => set('compareAtPriceVnd', e.target.value ? Number(e.target.value) : null)} className={fieldClass} /></label>
      </div>

      {form.accessType === 'package' ? (
        <fieldset className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/70">
          <legend className="px-2 font-black text-indigo-950 dark:text-indigo-200">Gói thanh toán mở khóa học</legend>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Học viên mua bất kỳ gói nào được chọn bên dưới sẽ được truy cập khóa học.</p>
          {packagesLoading ? <p className="text-sm text-slate-500">Đang tải danh sách gói...</p> : packagesError ? <p role="alert" className="text-sm font-semibold text-red-600">{packagesError}</p> : packages.length === 0 ? <p className="text-sm text-amber-700">Chưa có gói thanh toán đang hoạt động.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {packages.map((pkg) => (
                <label key={pkg.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900 ${form.packageIds.includes(pkg.id) ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-500/25' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="checkbox" checked={form.packageIds.includes(pkg.id)} onChange={() => togglePackage(pkg.id)} className="mt-1 h-5 w-5 rounded" />
                  <span>
                    <span className="block font-bold text-slate-800 dark:text-slate-100">{pkg.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{Number(pkg.price || 0).toLocaleString('vi-VN')}đ · {pkg.duration_days} ngày</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}

      <label className="block font-bold text-slate-700 dark:text-slate-200">Mô tả ngắn<textarea required rows={3} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} className={fieldClass} /></label>
      <label className="block font-bold text-slate-700 dark:text-slate-200">Nội dung giới thiệu (HTML được backend làm sạch)<textarea rows={8} value={form.descriptionHtml} onChange={(e) => set('descriptionHtml', e.target.value)} className={`${fieldClass} font-mono text-sm`} /></label>
      <label className="flex items-center gap-3 font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.certificateEnabled} onChange={(e) => set('certificateEnabled', e.target.checked)} className="h-5 w-5 rounded" />Cấp chứng chỉ hoàn thành</label>
      {error ? <p role="alert" className="text-sm font-semibold text-red-600">{error}</p> : null}
      {saved ? <p role="status" className="text-sm font-semibold text-emerald-700">Đã lưu thay đổi.</p> : null}
      <button disabled={saving || (form.accessType === 'package' && packagesLoading)} className="rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : submitLabel}</button>
    </form>
  );
}
