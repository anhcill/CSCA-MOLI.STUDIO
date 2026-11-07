'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBookOpen,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit3,
  FiFilm,
  FiLayers,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import {
  COURSE_ACCESS_LABELS,
  COURSE_STATUS_LABELS,
  CSCA_SUBJECT_CODES,
  CSCA_SUBJECT_LABELS,
  type CourseAdminDto,
  type CourseStatus,
  type CscaSubjectCode,
} from '@/lib/types/courses';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { statusBadgeStyle, subjectBadgeStyle } from './_components/CourseAdminForm';

const SUBJECT_AVATAR_GRADIENT: Record<CscaSubjectCode, string> = {
  MATH: 'from-indigo-500 to-violet-600',
  PHYSICS: 'from-cyan-500 to-blue-600',
  CHEMISTRY: 'from-emerald-500 to-teal-600',
  CHINESE_SCI: 'from-rose-500 to-orange-500',
  CHINESE_SOC: 'from-amber-500 to-rose-500',
};

const WORKFLOW_STEPS = [
  {
    step: 'Bước 1',
    title: 'Tạo khóa học',
    desc: 'Chọn môn học & chế độ quyền học (khuyên dùng "Chỉ học viên được cấp quyền" cho lớp Video).',
  },
  {
    step: 'Bước 2',
    title: 'Thêm chương & Đăng Video',
    desc: 'Tạo các chương học và tải video bài giảng trực tiếp lên Bunny Stream ngay trên trình duyệt.',
  },
  {
    step: 'Bước 3',
    title: 'Xuất bản khóa học',
    desc: 'Bấm 1 chạm bật hiển thị tất cả chương/bài sẵn sàng rồi bấm Xuất bản khóa học.',
  },
  {
    step: 'Bước 4',
    title: 'Cấp quyền học viên',
    desc: 'Cấp quyền từng người, dán danh sách Email cả lớp hoặc đóng thành Gói Video mở bán tự động.',
  },
];

export default function AdminCoursesPage() {
  const user = useAuthStore((state) => state.user);
  const canCreateCourse = hasPermission(user, '*') || hasPermission(user, 'content.manage');

  const [items, setItems] = useState<CourseAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'ALL' | CscaSubjectCode>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CourseStatus>('ALL');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await coursesApi.getAdminCourses({ pageSize: 100 });
      setItems(response.items);
    } catch {
      setError('Không thể tải danh sách khóa học quản trị. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((c) => c.status === 'published').length;
    const draft = items.filter((c) => c.status === 'draft' || c.status === 'review').length;
    const totalLessons = items.reduce((sum, c) => sum + (c.totalLessons || 0), 0);
    return { total, published, draft, totalLessons };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((course) => {
      if (subjectFilter !== 'ALL' && course.subjectCode !== subjectFilter) return false;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'draft') {
          if (course.status !== 'draft' && course.status !== 'review') return false;
        } else if (course.status !== statusFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${course.title} ${course.slug} ${CSCA_SUBJECT_LABELS[course.subjectCode] || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, subjectFilter, statusFilter]);

  return (
    <AdminLayout
      title="Khóa học & Video bài giảng"
      description="Tạo khóa học, đăng tải bài giảng Bunny Stream và cấp quyền trực tiếp cho học viên"
    >
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {canCreateCourse
              ? 'Quản lý toàn bộ khóa học video recorded, chương trình giảng dạy và danh sách học viên.'
              : 'Bạn đang xem các khóa học được phân công phụ trách.'}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/video-commerce"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              📦 Gói Video & Combo
            </Link>
            {canCreateCourse ? (
              <Link
                href="/admin/courses/create"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
              >
                <FiPlus className="h-4 w-4" />
                Tạo khóa học mới
              </Link>
            ) : null}
          </div>
        </div>

        {/* Collapsible 4-Step Workflow Banner */}
        <section className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-teal-50/60 p-5 shadow-sm dark:border-indigo-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-black uppercase text-white">
                Hướng dẫn nhanh
              </span>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 sm:text-base">
                Quy trình 4 bước đăng khóa học Video & mở khóa cho học viên
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {showGuide ? (
                <>
                  Thu gọn <FiChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Xem quy trình <FiChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {showGuide ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {WORKFLOW_STEPS.map((item, idx) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.title}</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* 4 KPI Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <FiLayers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tổng số khóa học
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{stats.total}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FiCheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Đang xuất bản
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.published}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <FiClock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bản nháp đang soạn
              </p>
              <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{stats.draft}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <FiBookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tổng số bài giảng
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                {stats.totalLessons}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên khóa học hoặc đường dẫn slug..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Lọc theo môn học"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value as 'ALL' | CscaSubjectCode)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="ALL">Tất cả môn học</option>
              {CSCA_SUBJECT_CODES.map((code) => (
                <option key={code} value={code}>
                  {CSCA_SUBJECT_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'published', label: 'Đã xuất bản' },
                { key: 'draft', label: 'Bản nháp' },
                { key: 'archived', label: 'Lưu trữ' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  statusFilter === item.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Course List / Table */}
        {loading ? (
          <div
            className="h-72 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
            aria-label="Đang tải khóa học"
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold dark:border-red-700 dark:bg-slate-900"
            >
              Thử lại
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-base font-bold text-slate-700 dark:text-slate-200">
              {items.length === 0
                ? 'Chưa có khóa học CSCA nào trên hệ thống.'
                : 'Không tìm thấy khóa học nào khớp bộ lọc hiện tại.'}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {items.length === 0
                ? 'Bấm nút "+ Tạo khóa học mới" ở góc trên để bắt đầu xây dựng khóa học đầu tiên!'
                : 'Hãy thử xóa từ khóa tìm kiếm hoặc chọn "Tất cả" ở bộ lọc trạng thái.'}
            </p>
            {items.length === 0 && canCreateCourse ? (
              <Link
                href="/admin/courses/create"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white"
              >
                <FiPlus className="h-4 w-4" />
                Tạo khóa học đầu tiên
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4">Khóa học</th>
                  <th className="px-4 py-4">Môn học</th>
                  <th className="px-4 py-4">Chế độ quyền học</th>
                  <th className="px-4 py-4">Trạng thái</th>
                  <th className="px-4 py-4">Bài giảng</th>
                  <th className="px-5 py-4 text-right">Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((course) => {
                  const gradient =
                    SUBJECT_AVATAR_GRADIENT[course.subjectCode] || 'from-indigo-500 to-violet-600';
                  return (
                    <tr
                      key={course.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3.5">
                          {course.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={course.thumbnailUrl}
                              alt=""
                              className="h-12 w-20 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                            />
                          ) : (
                            <div
                              className={`flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xs font-black text-white shadow-sm`}
                            >
                              {CSCA_SUBJECT_LABELS[course.subjectCode]?.split(' ')[0] || 'CSCA'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/admin/courses/${course.id}`}
                              className="block truncate font-black text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                            >
                              {course.title}
                            </Link>
                            <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                              /khoa-hoc/{course.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${subjectBadgeStyle(course.subjectCode)}`}
                        >
                          {CSCA_SUBJECT_LABELS[course.subjectCode] || course.subjectCode}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {COURSE_ACCESS_LABELS[course.accessType] || course.accessType}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeStyle(course.status)}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {COURSE_STATUS_LABELS[course.status] || course.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {course.totalLessons} bài
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {course.totalSections} chương
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/courses/${course.id}/curriculum`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                          >
                            <FiFilm className="h-3.5 w-3.5" />
                            Chương trình & Video
                          </Link>
                          <Link
                            href={`/admin/courses/${course.id}?tab=students`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                          >
                            <FiUsers className="h-3.5 w-3.5" />
                            Cấp quyền học viên
                          </Link>
                          <Link
                            href={`/admin/courses/${course.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <FiSettings className="h-3.5 w-3.5" />
                            Cài đặt
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
