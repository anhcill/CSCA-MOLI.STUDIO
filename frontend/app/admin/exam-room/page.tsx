'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { examAdminApi } from '@/lib/api/examAdmin';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { FiArrowRight, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiMonitor, FiPlus, FiRefreshCw, FiUsers } from 'react-icons/fi';

interface RoomExamItem {
  id: number;
  title: string;
  subject_name?: string;
  status: 'draft' | 'published' | 'archived';
  start_time?: string | null;
  end_time?: string | null;
  questions_count?: number;
  attempts_count?: number;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa đặt';
}

export default function AdminExamRoomPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [exams, setExams] = useState<RoomExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const response = await examAdminApi.getAllExams(1, 100, 'phong-thi');
      setExams(response.exams || []);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không tải được danh sách phòng thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token) return router.push('/');
    if (isAuthenticated && !hasPermission(user, 'exams.manage')) return router.push('/admin');
    load();
  }, [isAuthenticated, user]);

  const now = Date.now();
  const upcoming = exams.filter((exam) => !exam.end_time || new Date(exam.end_time).getTime() >= now);
  const finished = exams.filter((exam) => exam.end_time && new Date(exam.end_time).getTime() < now);

  return (
    <AdminLayout title="Phòng thi" description="Một luồng riêng cho kỳ thi PDF có đăng ký tự động và giám sát">
      <div className="space-y-6">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black">Quản lý Phòng thi</h1>
              <p className="mt-1 text-sm font-semibold text-violet-100">Tạo kỳ thi → PDF & đáp án → lịch thi → mở đăng ký → giám sát → kết quả.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white/10"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới</button>
              <Link href="/admin/exam-room/create" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-violet-700 hover:bg-violet-50"><FiPlus /> Tạo kỳ thi mới</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [FiMonitor, 'Tổng phòng thi', exams.length],
            [FiCalendar, 'Sắp tới / đang thi', upcoming.length],
            [FiCheckCircle, 'Đang mở đăng ký', exams.filter((exam) => exam.status === 'published' && exam.start_time && new Date(exam.start_time).getTime() > now).length],
            [FiUsers, 'Đã kết thúc', finished.length],
          ].map(([Icon, label, value]: any) => (
            <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-500"><Icon /> {label}</div>
              <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 p-4 dark:border-slate-800"><h2 className="font-black text-gray-900 dark:text-white">Các kỳ thi theo lịch</h2></div>
          {loading ? (
            <div className="flex min-h-52 items-center justify-center"><FiRefreshCw className="animate-spin text-violet-600" size={28} /></div>
          ) : exams.length === 0 ? (
            <div className="p-10 text-center">
              <FiFileText className="mx-auto text-gray-300" size={42} />
              <p className="mt-3 font-bold text-gray-700">Chưa có kỳ thi nào</p>
              <Link href="/admin/exam-room/create" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white"><FiPlus /> Tạo kỳ thi đầu tiên</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {exams.map((exam) => {
                const starts = exam.start_time ? new Date(exam.start_time).getTime() : 0;
                const ends = exam.end_time ? new Date(exam.end_time).getTime() : 0;
                const phase = exam.status !== 'published' ? 'Đang thiết lập' : now < starts ? 'Đang mở đăng ký' : now <= ends ? 'Đang thi' : 'Đã kết thúc';
                const phaseClass = exam.status !== 'published' ? 'bg-amber-50 text-amber-700' : now < starts ? 'bg-blue-50 text-blue-700' : now <= ends ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-600';
                return (
                  <div key={exam.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-black text-gray-900 dark:text-white">{exam.title}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${phaseClass}`}>{phase}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{exam.subject_name || 'Môn thi'} · {exam.questions_count || 0} câu · {exam.attempts_count || 0} lượt thi</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500"><FiClock /> {formatDate(exam.start_time)} → {formatDate(exam.end_time)}</p>
                    </div>
                    <Link href={`/admin/exams/${exam.id}/official`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-600">Mở luồng quản trị <FiArrowRight /></Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
