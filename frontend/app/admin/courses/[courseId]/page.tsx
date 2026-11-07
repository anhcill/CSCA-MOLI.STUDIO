'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiArrowRight, FiFilm } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import type { CourseAdminDto, CourseAdminInput } from '@/lib/types/courses';
import {
  CourseAdminForm,
  CourseWorkspaceHeader,
  type CourseWorkspaceTab,
} from '../_components/CourseAdminForm';
import { CourseStudentAccessPanel } from '../_components/CourseStudentAccessPanel';
import { CourseTeacherAccess } from '@/components/courses/CourseTeacherAccess';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';

export default function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const id = Number(courseId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isGlobalAdmin = hasPermission(user, '*');

  const requestedTab = searchParams.get('tab');
  const activeTab: CourseWorkspaceTab =
    requestedTab === 'students'
      ? 'students'
      : requestedTab === 'teachers' && isGlobalAdmin
        ? 'teachers'
        : 'info';

  const [course, setCourse] = useState<CourseAdminDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('Mã khóa học không hợp lệ.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      setCourse(await coursesApi.getAdminCourse(id));
    } catch {
      setError('Không tìm thấy khóa học hoặc bạn chưa được phân quyền quản lý khóa học này.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSilently = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    try {
      setCourse(await coursesApi.getAdminCourse(id));
    } catch {
      /* Keep current snapshot on silent refresh error */
    }
  }, [id]);

  const update = async (input: CourseAdminInput) => {
    const updated = await coursesApi.updateCourse(id, input);
    setCourse(updated);
  };

  const handleSelectTab = (tab: CourseWorkspaceTab) => {
    if (tab === 'curriculum') {
      router.push(`/admin/courses/${id}/curriculum`);
      return;
    }
    if (tab === 'info') {
      router.replace(`/admin/courses/${id}`, { scroll: false });
      return;
    }
    router.replace(`/admin/courses/${id}?tab=${tab}`, { scroll: false });
  };

  return (
    <AdminLayout
      title={course ? `Quản trị: ${course.title}` : 'Quản trị khóa học'}
      description="Thông tin khóa học, chương trình video và cấp quyền học viên"
    >
      {loading ? (
        <div
          className="h-96 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
          aria-label="Đang tải khóa học"
        />
      ) : error || !course ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <p className="font-semibold">{error || 'Không có dữ liệu khóa học.'}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold dark:border-red-700 dark:bg-slate-900"
          >
            Thử lại
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <CourseWorkspaceHeader
            course={course}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            onCourseUpdated={setCourse}
            showTeachersTab={isGlobalAdmin}
          />

          {/* Helpful next-step prompt when course has 0 lessons */}
          {activeTab === 'info' && course.totalLessons === 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-teal-200 bg-teal-50/80 p-5 dark:border-teal-800/60 dark:bg-teal-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <FiFilm className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-teal-950 dark:text-teal-200">
                    Bước tiếp theo: Xây dựng Chương trình & Tải Video bài giảng
                  </p>
                  <p className="mt-0.5 text-xs text-teal-800 dark:text-teal-300">
                    Khóa học này chưa có chương hay bài giảng nào. Hãy mở tab Chương trình & Đăng Video để thêm bài giảng lên Bunny Stream!
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/courses/${course.id}/curriculum`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
              >
                Thêm chương & Đăng Video
                <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}

          {activeTab === 'info' ? (
            <CourseAdminForm
              initialValue={{
                title: course.title,
                slug: course.slug,
                shortDescription: course.shortDescription,
                descriptionHtml: course.descriptionHtml,
                subjectCode: course.subjectCode,
                level: course.level,
                accessType: course.accessType,
                packageIds: course.packageIds,
                thumbnailUrl: course.thumbnailUrl,
                priceVnd: course.priceVnd,
                compareAtPriceVnd: course.compareAtPriceVnd,
                certificateEnabled: course.certificateEnabled,
              }}
              submitLabel="Lưu thay đổi thông tin"
              onSubmit={update}
            />
          ) : null}

          {activeTab === 'students' ? (
            <CourseStudentAccessPanel
              courseId={course.id}
              onEnrollmentChanged={() => void refreshSilently()}
            />
          ) : null}

          {activeTab === 'teachers' && isGlobalAdmin ? (
            <CourseTeacherAccess courseId={course.id} />
          ) : null}
        </div>
      )}
    </AdminLayout>
  );
}
