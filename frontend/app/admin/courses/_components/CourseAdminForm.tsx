'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FiArchive,
  FiArrowLeft,
  FiBookOpen,
  FiCheckCircle,
  FiEdit3,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiGlobe,
  FiLock,
  FiPlayCircle,
  FiRotateCcw,
  FiShield,
  FiUnlock,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import coursesApi, { extractCourseApiError, slugifyVietnamese } from '@/lib/api/courses';
import {
  COURSE_ACCESS_LABELS,
  COURSE_STATUS_LABELS,
  CSCA_SUBJECT_LABELS,
  type CourseAccessType,
  type CourseAdminDto,
  type CourseAdminInput,
  type CourseLevel,
  type CourseStatus,
  type CscaSubjectCode,
  type VipPackageDto,
} from '@/lib/types/courses';

export type CourseWorkspaceTab = 'info' | 'curriculum' | 'students' | 'teachers';

export function statusBadgeStyle(status: CourseStatus): string {
  switch (status) {
    case 'published':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'archived':
      return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
    case 'review':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300';
  }
}

export function subjectBadgeStyle(subject: CscaSubjectCode): string {
  switch (subject) {
    case 'MATH':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60';
    case 'PHYSICS':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800/60';
    case 'CHEMISTRY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';
    case 'CHINESE_SCI':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60';
    case 'CHINESE_SOC':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function CourseWorkspaceHeader({
  course,
  activeTab,
  onSelectTab,
  onCourseUpdated,
  showTeachersTab = false,
}: {
  course: CourseAdminDto;
  activeTab: CourseWorkspaceTab;
  onSelectTab?: (tab: CourseWorkspaceTab) => void;
  onCourseUpdated: (updated: CourseAdminDto) => void;
  showTeachersTab?: boolean;
}) {
  const [busyAction, setBusyAction] = useState<'publish' | 'unpublish' | 'archive' | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handlePublish = async () => {
    if (busyAction) return;
    if (
      !window.confirm(
        `Xuất bản khóa học "${course.title}"?\nHọc viên có quyền truy cập sẽ nhìn thấy khóa học và các chương/bài đã bật hiển thị.`,
      )
    ) {
      return;
    }
    try {
      setBusyAction('publish');
      setActionError('');
      setActionSuccess('');
      const updated = await coursesApi.publishCourse(course.id);
      onCourseUpdated(updated);
      setActionSuccess('🎉 Khóa học đã được xuất bản thành công!');
    } catch (err) {
      setActionError(
        extractCourseApiError(
          err,
          'Chưa thể xuất bản khóa học. Hãy đảm bảo khóa học có ít nhất 1 chương & 1 bài học đã bật hiển thị và các video đã xử lý xong.',
        ),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnpublish = async () => {
    if (busyAction) return;
    if (
      !window.confirm(
        `Gỡ xuất bản khóa học "${course.title}" về trạng thái Bản nháp?\nKhóa học sẽ tạm ẩn khỏi danh sách công khai cho tới khi bạn xuất bản lại.`,
      )
    ) {
      return;
    }
    try {
      setBusyAction('unpublish');
      setActionError('');
      setActionSuccess('');
      const updated = await coursesApi.unpublishCourse(course.id);
      onCourseUpdated(updated);
      setActionSuccess('Đã chuyển khóa học về trạng thái Bản nháp.');
    } catch (err) {
      setActionError(extractCourseApiError(err, 'Không thể gỡ xuất bản khóa học lúc này.'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchive = async () => {
    if (busyAction) return;
    if (
      !window.confirm(
        `Lưu trữ khóa học "${course.title}"?\nKhóa học sẽ được cất vào mục Lưu trữ và không hiển thị ngoài trang học viên.`,
      )
    ) {
      return;
    }
    try {
      setBusyAction('archive');
      setActionError('');
      setActionSuccess('');
      const updated = await coursesApi.archiveCourse(course.id);
      onCourseUpdated(updated);
      setActionSuccess('Đã chuyển khóa học vào mục Lưu trữ.');
    } catch (err) {
      setActionError(extractCourseApiError(err, 'Không thể lưu trữ khóa học lúc này.'));
    } finally {
      setBusyAction(null);
    }
  };

  const tabs: Array<{
    key: CourseWorkspaceTab;
    label: string;
    href: string;
    badge?: string | number;
    icon: React.ReactNode;
  }> = [
    {
      key: 'info',
      label: '1. Thông tin khóa học',
      href: `/admin/courses/${course.id}`,
      icon: <FiBookOpen className="h-4 w-4" />,
    },
    {
      key: 'curriculum',
      label: '2. Chương trình & Đăng Video',
      href: `/admin/courses/${course.id}/curriculum`,
      badge: `${course.totalLessons} bài`,
      icon: <FiPlayCircle className="h-4 w-4" />,
    },
    {
      key: 'students',
      label: '3. Học viên & Cấp quyền',
      href: `/admin/courses/${course.id}?tab=students`,
      badge: course.enrolledCount > 0 ? course.enrolledCount : undefined,
      icon: <FiUsers className="h-4 w-4" />,
    },
    ...(showTeachersTab
      ? [
          {
            key: 'teachers' as const,
            label: '4. Giáo viên phụ trách',
            href: `/admin/courses/${course.id}?tab=teachers`,
            icon: <FiUserCheck className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              <FiArrowLeft className="h-3.5 w-3.5" />
              Danh sách khóa học
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeStyle(course.status)}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {COURSE_STATUS_LABELS[course.status] || course.status}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${subjectBadgeStyle(course.subjectCode)}`}
              >
                {CSCA_SUBJECT_LABELS[course.subjectCode] || course.subjectCode}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Quyền học: {COURSE_ACCESS_LABELS[course.accessType] || course.accessType}
              </span>
            </div>

            <h2 className="truncate text-xl font-black text-slate-900 dark:text-slate-100 sm:text-2xl">
              {course.title}
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Đường dẫn: <span className="font-mono">/khoa-hoc/{course.slug}</span> · {course.totalSections} chương · {course.totalLessons} bài giảng
            </p>
          </div>

          {/* Right status actions */}
          <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
            {course.status === 'published' ? (
              <>
                <Link
                  href={`/khoa-hoc/${course.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                >
                  Xem trang học viên
                  <FiExternalLink className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleUnpublish()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <FiRotateCcw className="h-4 w-4" />
                  {busyAction === 'unpublish' ? 'Đang gỡ...' : 'Gỡ xuất bản (về nháp)'}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleArchive()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <FiArchive className="h-4 w-4" />
                  Lưu trữ
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handlePublish()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyAction === 'publish' ? 'Đang xuất bản...' : '🚀 Xuất bản khóa học'}
                </button>
                {course.status !== 'archived' ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleArchive()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <FiArchive className="h-4 w-4" />
                    {busyAction === 'archive' ? 'Đang lưu trữ...' : 'Lưu trữ'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Unified 4-Tab Bar */}
        <nav
          aria-label="Không gian quản trị khóa học"
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          {tabs.map((tabItem) => {
            const isActive = activeTab === tabItem.key;
            const tabClasses = `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`;

            if (onSelectTab && tabItem.key !== 'curriculum') {
              return (
                <button
                  key={tabItem.key}
                  type="button"
                  onClick={() => onSelectTab(tabItem.key)}
                  className={tabClasses}
                >
                  {tabItem.icon}
                  <span>{tabItem.label}</span>
                  {tabItem.badge !== undefined ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {tabItem.badge}
                    </span>
                  ) : null}
                </button>
              );
            }

            return (
              <Link key={tabItem.key} href={tabItem.href} className={tabClasses}>
                {tabItem.icon}
                <span>{tabItem.label}</span>
                {tabItem.badge !== undefined ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {tabItem.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-semibold">{actionError}</span>
          {activeTab !== 'curriculum' ? (
            <Link
              href={`/admin/courses/${course.id}/curriculum`}
              className="shrink-0 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Mở Chương trình & Đăng Video →
            </Link>
          ) : null}
        </div>
      ) : null}

      {actionSuccess ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <FiCheckCircle className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY: CourseAdminInput = {
  title: '',
  slug: '',
  shortDescription: '',
  descriptionHtml: '',
  subjectCode: 'MATH',
  level: 'basic',
  accessType: 'contact',
  packageIds: [],
  thumbnailUrl: null,
  priceVnd: null,
  compareAtPriceVnd: null,
  certificateEnabled: false,
};

const fieldClass =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20';

const ACCESS_CARDS: Array<{
  value: CourseAccessType;
  title: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'contact',
    title: 'Chỉ học viên được cấp quyền / Mua gói Video',
    badge: 'Khuyên dùng cho lớp Video',
    description:
      'Học viên bên ngoài thấy trang giới thiệu khóa học, nhưng chỉ những ai được Admin cấp quyền (hoặc mua Gói Video) mới xem được bài giảng.',
    icon: <FiLock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
  },
  {
    value: 'private',
    title: 'Nội bộ / Riêng tư',
    description:
      'Ẩn hoặc chỉ dành riêng cho danh sách học viên nội bộ được Admin cấp quyền trực tiếp trong Tab Học viên.',
    icon: <FiShield className="h-5 w-5 text-slate-600 dark:text-slate-300" />,
  },
  {
    value: 'free',
    title: 'Miễn phí cho mọi thành viên',
    description:
      'Bất kỳ học viên nào đăng nhập tài khoản trên hệ thống đều có thể bấm vào học toàn bộ bài giảng miễn phí.',
    icon: <FiUnlock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  },
  {
    value: 'package',
    title: 'Mở theo Gói VIP Luyện đề',
    description:
      'Tự động mở khóa học cho tất cả học viên đang sở hữu gói VIP luyện đề được bạn tick chọn bên dưới.',
    icon: <FaCrown className="h-5 w-5 text-amber-500" />,
  },
];

export function CourseAdminForm({
  initialValue = EMPTY,
  submitLabel,
  onSubmit,
}: {
  initialValue?: CourseAdminInput;
  submitLabel: string;
  onSubmit: (value: CourseAdminInput) => Promise<void>;
}) {
  const isEditingExisting = Boolean(initialValue.slug);
  const [form, setForm] = useState<CourseAdminInput>({
    ...initialValue,
    packageIds: initialValue.packageIds ?? [],
  });
  const [customSlug, setCustomSlug] = useState<boolean>(isEditingExisting);
  const [previewHtml, setPreviewHtml] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const [packages, setPackages] = useState<VipPackageDto[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    coursesApi
      .getActivePackages()
      .then((items) => {
        if (active) setPackages(items);
      })
      .catch(() => {
        if (active) setPackagesError('Không thể tải danh sách gói VIP thanh toán.');
      })
      .finally(() => {
        if (active) setPackagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const set = <K extends keyof CourseAdminInput>(key: K, value: CourseAdminInput[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleTitleChange = (nextTitle: string) => {
    setSaved(false);
    setForm((current) => ({
      ...current,
      title: nextTitle,
      slug: customSlug ? current.slug : slugifyVietnamese(nextTitle),
    }));
  };

  const changeAccessType = (accessType: CourseAccessType) => {
    set('accessType', accessType);
    if (accessType !== 'package') set('packageIds', []);
  };

  const togglePackage = (packageId: number) => {
    set(
      'packageIds',
      form.packageIds.includes(packageId)
        ? form.packageIds.filter((id) => id !== packageId)
        : [...form.packageIds, packageId],
    );
  };

  const insertHtmlFormat = (kind: 'bold' | 'heading' | 'list' | 'paragraph') => {
    const textarea = descriptionRef.current;
    const current = form.descriptionHtml || '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const selected = current.slice(start, end);

    let snippet = '';
    if (kind === 'bold') {
      snippet = `<strong>${selected || 'Nội dung quan trọng'}</strong>`;
    } else if (kind === 'heading') {
      snippet = `\n<h3>${selected || 'Tiêu đề phần học'}</h3>\n`;
    } else if (kind === 'list') {
      if (selected.trim()) {
        const items = selected
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `  <li>${line}</li>`)
          .join('\n');
        snippet = `\n<ul>\n${items}\n</ul>\n`;
      } else {
        snippet = `\n<ul>\n  <li>Điểm nổi bật thứ nhất</li>\n  <li>Điểm nổi bật thứ hai</li>\n</ul>\n`;
      }
    } else {
      snippet = `\n<p>${selected || 'Nội dung đoạn văn giới thiệu khóa học...'}</p>\n`;
    }

    const updated = current.slice(0, start) + snippet + current.slice(end);
    set('descriptionHtml', updated);
    requestAnimationFrame(() => {
      textarea?.focus();
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSlug = slugifyVietnamese(form.slug || form.title);
    if (!form.title.trim() || !normalizedSlug || !form.shortDescription.trim()) {
      setError('Vui lòng nhập đầy đủ Tên khóa học và Mô tả ngắn.');
      return;
    }
    if (form.accessType === 'package' && form.packageIds.length === 0) {
      setError('Hãy chọn ít nhất một Gói VIP được phép mở khóa học này.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setSaved(false);
      await onSubmit({
        ...form,
        title: form.title.trim(),
        slug: normalizedSlug,
        shortDescription: form.shortDescription.trim(),
      });
      setForm((prev) => ({ ...prev, slug: normalizedSlug }));
      setSaved(true);
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể lưu khóa học. Vui lòng kiểm tra lại dữ liệu và thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Block 1: Basic Identity */}
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Phần 1 · Thông tin nhận diện
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            Tên khóa học, Môn học & Ảnh bìa
          </h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Tên khóa học <span className="text-red-500">*</span>
              <input
                required
                placeholder="VD: Khóa Tổng Ôn Toán CSCA Trọng Tâm 2026"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={fieldClass}
              />
            </label>

            {/* Auto-generated URL preview + optional custom edit */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <FiGlobe className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span className="truncate">
                  Đường dẫn trang khóa học:{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    molystudio.online/khoa-hoc/{form.slug || 'tu-dong-tao-tu-ten-khoa-hoc'}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (customSlug && !isEditingExisting) {
                    setCustomSlug(false);
                    set('slug', slugifyVietnamese(form.title));
                  } else {
                    setCustomSlug((prev) => !prev);
                  }
                }}
                className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <FiEdit3 className="h-3.5 w-3.5" />
                {customSlug ? 'Ẩn chỉnh sửa URL' : 'Tùy chỉnh đường dẫn URL'}
              </button>
            </div>

            {customSlug ? (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Đường dẫn URL tùy chỉnh (chỉ gồm chữ thường không dấu, số và dấu gạch ngang)
                  <input
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    value={form.slug}
                    onChange={(e) => set('slug', slugifyVietnamese(e.target.value))}
                    placeholder="vd: toan-csca-trong-tam-2026"
                    className={`${fieldClass} font-mono`}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Môn học CSCA <span className="text-red-500">*</span>
            <select
              value={form.subjectCode}
              onChange={(e) => set('subjectCode', e.target.value as CscaSubjectCode)}
              className={fieldClass}
            >
              <option value="MATH">Toán (Mathematics)</option>
              <option value="PHYSICS">Vật lý (Physics)</option>
              <option value="CHEMISTRY">Hóa học (Chemistry)</option>
              <option value="CHINESE_SCI">Tiếng Trung Tự nhiên</option>
              <option value="CHINESE_SOC">Tiếng Trung Xã hội</option>
            </select>
          </label>

          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Trình độ khóa học
            <select
              value={form.level}
              onChange={(e) => set('level', e.target.value as CourseLevel)}
              className={fieldClass}
            >
              <option value="basic">Cơ bản / Nền tảng</option>
              <option value="intermediate">Trung cấp / Luyện chuyên đề</option>
              <option value="advanced">Nâng cao / Thực chiến đề khó</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
              Ảnh bìa khóa học (URL hình ảnh tùy chọn)
              <input
                type="url"
                placeholder="https://... (để trống hệ thống sẽ tự tạo bìa theo môn học)"
                value={form.thumbnailUrl || ''}
                onChange={(e) => set('thumbnailUrl', e.target.value || null)}
                className={fieldClass}
              />
            </label>
            {form.thumbnailUrl ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.thumbnailUrl}
                  alt="Xem trước ảnh bìa"
                  className="h-16 w-28 rounded-lg object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Xem trước ảnh thu nhỏ hiển thị trên danh mục khóa học
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Block 2: Access Mode Radio Cards */}
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Phần 2 · Chế độ quyền học
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            Ai được phép xem bài giảng trong khóa học này?
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Lưu ý: Dù chọn chế độ nào, Admin vẫn luôn có thể cấp quyền trực tiếp cho từng học viên hoặc cả danh sách lớp ở Tab <strong>“3. Học viên & Cấp quyền”</strong>.
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
          {ACCESS_CARDS.map((card) => {
            const selected = form.accessType === card.value;
            return (
              <label
                key={card.value}
                className={`relative flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition ${
                  selected
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/30'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="courseAccessType"
                  value={card.value}
                  checked={selected}
                  onChange={() => changeAccessType(card.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {card.icon}
                    <span className="font-bold text-slate-900 dark:text-slate-100">{card.title}</span>
                    {card.badge ? (
                      <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        {card.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {card.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {form.accessType === 'package' ? (
          <fieldset className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-800/50 dark:bg-amber-950/20">
            <legend className="px-2 text-sm font-black text-amber-950 dark:text-amber-200">
              Chọn các Gói VIP được phép mở khóa học này
            </legend>
            <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              Học viên đang có bất kỳ gói VIP nào được tick bên dưới sẽ tự động vào học được ngay.
            </p>
            {packagesLoading ? (
              <p className="text-sm text-slate-500">Đang tải danh sách gói VIP...</p>
            ) : packagesError ? (
              <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
                {packagesError}
              </p>
            ) : packages.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Chưa có gói VIP nào đang hoạt động trên hệ thống.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {packages.map((pkg) => (
                  <label
                    key={pkg.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 transition dark:bg-slate-900 ${
                      form.packageIds.includes(pkg.id)
                        ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/25'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.packageIds.includes(pkg.id)}
                      onChange={() => togglePackage(pkg.id)}
                      className="mt-1 h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                        {pkg.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {Number(pkg.price || 0).toLocaleString('vi-VN')} đ · {pkg.duration_days} ngày
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : null}

        <div className="grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Giá hiển thị tham khảo (VND - tùy chọn)
            <input
              type="number"
              min={0}
              placeholder="Để trống nếu không hiển thị giá lẻ"
              value={form.priceVnd ?? ''}
              onChange={(e) => set('priceVnd', e.target.value ? Number(e.target.value) : null)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Giá gốc gạch ngang (VND - tùy chọn)
            <input
              type="number"
              min={0}
              placeholder="VD: 1500000"
              value={form.compareAtPriceVnd ?? ''}
              onChange={(e) => set('compareAtPriceVnd', e.target.value ? Number(e.target.value) : null)}
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      {/* Block 3: Course Descriptions & Quick Formatting */}
      <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Phần 3 · Giới thiệu khóa học
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
            Tóm tắt & Nội dung chi tiết cho học viên
          </h3>
        </div>

        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
          Mô tả ngắn gọn (hiển thị trên thẻ khóa học) <span className="text-red-500">*</span>
          <textarea
            required
            rows={3}
            placeholder="Tóm tắt 1-2 câu về mục tiêu khóa học, đối tượng phù hợp và kết quả đạt được..."
            value={form.shortDescription}
            onChange={(e) => set('shortDescription', e.target.value)}
            className={fieldClass}
          />
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Mô tả chi tiết khóa học
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => insertHtmlFormat('heading')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                + Tiêu đề
              </button>
              <button
                type="button"
                onClick={() => insertHtmlFormat('bold')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <strong>B</strong> In đậm
              </button>
              <button
                type="button"
                onClick={() => insertHtmlFormat('list')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                • Danh sách gạch đầu dòng
              </button>
              <button
                type="button"
                onClick={() => insertHtmlFormat('paragraph')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ¶ Đoạn văn
              </button>
              <button
                type="button"
                onClick={() => setPreviewHtml((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
              >
                {previewHtml ? <FiEyeOff className="h-3.5 w-3.5" /> : <FiEye className="h-3.5 w-3.5" />}
                {previewHtml ? 'Quay lại sửa' : 'Xem trước'}
              </button>
            </div>
          </div>

          {previewHtml ? (
            <div
              className="prose prose-sm dark:prose-invert mt-2 min-h-[180px] max-w-none rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
              dangerouslySetInnerHTML={{
                __html: form.descriptionHtml || '<p class="text-slate-400">Chưa có nội dung mô tả chi tiết.</p>',
              }}
            />
          ) : (
            <textarea
              ref={descriptionRef}
              rows={7}
              placeholder="Bấm các nút chèn nhanh phía trên để tạo tiêu đề, danh sách quyền lợi, lịch học... (hệ thống tự động làm sạch HTML an toàn)."
              value={form.descriptionHtml}
              onChange={(e) => set('descriptionHtml', e.target.value)}
              className={fieldClass}
            />
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(form.certificateEnabled)}
            onChange={(e) => set('certificateEnabled', e.target.checked)}
            className="h-5 w-5 rounded accent-indigo-600"
          />
          <span>Cấp chứng nhận hoàn thành khóa học khi học viên học hết 100% bài bắt buộc</span>
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </div>
        ) : null}

        {saved ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <FiCheckCircle className="h-4 w-4 shrink-0" />
            <span>Đã lưu thông tin khóa học thành công!</span>
          </div>
        ) : null}

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={saving || (form.accessType === 'package' && packagesLoading)}
            className="rounded-xl bg-indigo-600 px-7 py-3 text-sm font-black text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu thông tin...' : submitLabel}
          </button>
        </div>
      </section>
    </form>
  );
}
