'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiSearch, FiShield, FiUserCheck } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import type { CourseTeacherDto } from '@/lib/types/courses';

export function CourseTeacherAccess({ courseId }: { courseId: number }) {
  const [options, setOptions] = useState<CourseTeacherDto[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([coursesApi.getTeacherOptions(), coursesApi.getCourseTeachers(courseId)])
      .then(([available, assigned]) => {
        if (!active) return;
        setOptions(available);
        setSelected(assigned.map((teacher) => teacher.id));
      })
      .catch(() => {
        if (active) setStatus({ type: 'error', text: 'Không thể tải danh sách tài khoản giáo viên.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q),
    );
  }, [options, search]);

  const toggleTeacher = (id: number) => {
    setStatus(null);
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatus(null);
      await coursesApi.replaceCourseTeachers(courseId, selected);
      setStatus({
        type: 'success',
        text: 'Đã lưu phân quyền giáo viên phụ trách! (Giáo viên mới được thêm vui lòng đăng nhập lại để thấy menu Giao & chấm bài).',
      });
    } catch {
      setStatus({ type: 'error', text: 'Không thể lưu phân quyền giáo viên. Vui lòng thử lại.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
            <FiUserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              Giáo viên & Trợ giảng phụ trách khóa học
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Giáo viên được chọn sẽ có quyền giao bài tập, chấm điểm và giải đáp thắc mắc học viên trong khóa học này. Admin tổng mặc định có toàn quyền trên mọi khóa.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
          <FiShield className="h-3.5 w-3.5" />
          Đã chọn {selected.length} giáo viên
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : !options.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950/50">
          <p className="font-bold text-slate-700 dark:text-slate-200">
            Chưa có tài khoản Giáo viên hoặc Content Admin nào
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vui lòng vào mục Quản lý Users để gán vai trò Giáo viên / Content Admin trước khi phân công vào khóa học.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {options.length > 5 ? (
            <div className="relative max-w-md">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm giáo viên theo tên hoặc email..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOptions.map((teacher) => {
              const isChecked = selected.includes(teacher.id);
              const initial = (teacher.name || teacher.email || 'T').trim().charAt(0).toUpperCase();
              return (
                <label
                  key={teacher.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition ${
                    isChecked
                      ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 dark:border-sky-500 dark:bg-sky-950/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggleTeacher(teacher.id)}
                  />
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      isChecked
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {isChecked ? <FiCheck className="h-5 w-5" /> : initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {teacher.name || 'Chưa đặt tên'}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{teacher.email}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {status ? (
            <div
              role={status.type === 'error' ? 'alert' : 'status'}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                status.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {status.text}
            </div>
          ) : null}

          <div className="flex items-center justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu phân quyền...' : 'Lưu phân quyền giáo viên'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
