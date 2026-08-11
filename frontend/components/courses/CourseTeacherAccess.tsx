'use client';

import { useEffect, useState } from 'react';
import coursesApi from '@/lib/api/courses';
import type { CourseTeacherDto } from '@/lib/types/courses';

export function CourseTeacherAccess({ courseId }: { courseId: number }) {
  const [options, setOptions] = useState<CourseTeacherDto[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([coursesApi.getTeacherOptions(), coursesApi.getCourseTeachers(courseId)])
      .then(([available, assigned]) => {
        setOptions(available);
        setSelected(assigned.map((teacher) => teacher.id));
      })
      .catch(() => setMessage('Không thể tải danh sách giáo viên.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/30 dark:bg-sky-950/20">
      <h2 className="text-lg font-black text-sky-950 dark:text-sky-200">Phân quyền giáo viên theo khóa học</h2>
      <p className="mt-1 text-sm text-sky-800 dark:text-sky-300">Giáo viên được chọn chỉ xem, sửa nội dung và chấm bài trong khóa này. Admin tổng vẫn quản lý tất cả khóa.</p>
      {loading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-sky-100 dark:bg-sky-900/40" /> : (
        <div className="mt-4 space-y-3">
          {!options.length ? <p className="rounded-xl border border-dashed border-sky-300 p-4 text-sm">Chưa có tài khoản giáo viên. Hãy đặt vai trò người dùng là Giáo viên hoặc Content Admin trước.</p> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((teacher) => (
                <label key={teacher.id} className="flex items-start gap-3 rounded-xl border border-sky-200 bg-white p-3 dark:border-sky-700 dark:bg-slate-900">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={selected.includes(teacher.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, teacher.id] : current.filter((id) => id !== teacher.id))} />
                  <span className="min-w-0"><strong className="block truncate">{teacher.name}</strong><span className="block truncate text-xs text-slate-500">{teacher.email}</span></span>
                </label>
              ))}
            </div>
          )}
          <button type="button" disabled={saving} onClick={async () => {
            try {
              setSaving(true); setMessage('');
              await coursesApi.replaceCourseTeachers(courseId, selected);
              setMessage('Đã lưu phân quyền. Giáo viên mới cần đăng nhập lại để cập nhật menu quản trị.');
            } catch { setMessage('Không thể lưu phân quyền giáo viên.'); }
            finally { setSaving(false); }
          }} className="rounded-xl bg-sky-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu phân quyền giáo viên'}</button>
          {message ? <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
