'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import type { CourseAdminInput } from '@/lib/types/courses';
import { CourseAdminForm } from '../_components/CourseAdminForm';

export default function CreateCoursePage() {
  const router = useRouter();

  const create = async (input: CourseAdminInput) => {
    const course = await coursesApi.createCourse(input);
    router.push(`/admin/courses/${course.id}`);
  };

  return (
    <AdminLayout
      title="Tạo khóa học mới"
      description="Bước 1/4: Thiết lập thông tin khóa học & chế độ quyền học"
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <div>
            <Link
              href="/admin/courses"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline dark:text-indigo-300"
            >
              <FiArrowLeft className="h-3.5 w-3.5" />
              Quay lại danh sách khóa học
            </Link>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              💡 Mẹo: Sau khi bấm <strong>“Tạo khóa học”</strong>, bạn sẽ thêm các chương học, tải video lên Bunny Stream và cấp quyền cho học viên ngay trong không gian khóa học.
            </p>
          </div>
        </div>

        <CourseAdminForm submitLabel="Tạo khóa học & Tiếp tục →" onSubmit={create} />
      </div>
    </AdminLayout>
  );
}
