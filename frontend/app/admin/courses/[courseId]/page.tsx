'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import coursesApi from '@/lib/api/courses';
import type { CourseAdminDto, CourseAdminInput } from '@/lib/types/courses';
import { CourseAdminForm } from '../_components/CourseAdminForm';

export default function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const id = Number(courseId);
  const [course, setCourse] = useState<CourseAdminDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Mã khóa học không hợp lệ.'); setLoading(false); return; }
    try { setLoading(true); setError(''); setCourse(await coursesApi.getAdminCourse(id)); }
    catch { setError('Không tìm thấy khóa học.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const update = async (input: CourseAdminInput) => setCourse(await coursesApi.updateCourse(id, input));
  const publish = async () => {
    if (!window.confirm('Xuất bản khóa học này? Học viên có quyền truy cập sẽ nhìn thấy nội dung đã xuất bản.')) return;
    try { setPublishing(true); setPublishError(''); setCourse(await coursesApi.publishCourse(id)); }
    catch { setPublishError('Chưa thể xuất bản. Hãy kiểm tra chương trình học và thử lại.'); }
    finally { setPublishing(false); }
  };

  return (
    <AdminLayout title="Chỉnh sửa khóa học" description={course?.title || 'CSCA Learning'}>
      {loading ? <div className="h-96 animate-pulse rounded-3xl bg-slate-200" aria-label="Đang tải khóa học" /> : error || !course ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700"><p>{error || 'Không có dữ liệu.'}</p><button onClick={() => void load()} className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-bold">Thử lại</button></div>
      ) : <>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold uppercase">{course.status}</span>
          <Link href={`/admin/courses/${course.id}/curriculum`} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Xây chương trình học</Link>
          {course.status !== 'published' ? <button type="button" disabled={publishing} onClick={() => void publish()} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">{publishing ? 'Đang xuất bản...' : 'Xuất bản'}</button> : null}
        </div>
        {publishError ? <p role="alert" className="mb-4 text-sm font-semibold text-red-600">{publishError}</p> : null}
        <CourseAdminForm initialValue={{ title: course.title, slug: course.slug, shortDescription: course.shortDescription, descriptionHtml: course.descriptionHtml, subjectCode: course.subjectCode, level: course.level, accessType: course.accessType, packageIds: course.packageIds, thumbnailUrl: course.thumbnailUrl, priceVnd: course.priceVnd, compareAtPriceVnd: course.compareAtPriceVnd, certificateEnabled: course.certificateEnabled }} submitLabel="Lưu thay đổi" onSubmit={update} />
      </>}
    </AdminLayout>
  );
}
