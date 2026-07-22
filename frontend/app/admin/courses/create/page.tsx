'use client';

import { useRouter } from 'next/navigation';
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
  return <AdminLayout title="Tạo khóa học CSCA" description="Tạo thông tin khóa học, sau đó xây dựng chương trình."><CourseAdminForm submitLabel="Tạo khóa học" onSubmit={create} /></AdminLayout>;
}
