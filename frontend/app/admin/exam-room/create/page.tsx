'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { examAdminApi } from '@/lib/api/examAdmin';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { FiArrowLeft, FiArrowRight, FiCalendar, FiFileText, FiRefreshCw } from 'react-icons/fi';

interface Subject { id: number; name: string; code: string }

export default function CreateRoomExamPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', subjectId: 0, duration: 90, totalPoints: 100, startTime: '', endTime: '', maxParticipants: 0, description: '' });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token) return router.push('/');
    if (isAuthenticated && !hasPermission(user, 'exams.manage')) return router.push('/admin');
    axios.get('/subjects').then((response) => setSubjects(Array.isArray(response.data) ? response.data : [])).catch(() => setError('Không tải được danh sách môn thi.'));
  }, [isAuthenticated, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.title.trim() || !form.subjectId) return setError('Cần nhập tên kỳ thi và chọn môn.');
    if (!form.startTime || !form.endTime) return setError('Cần chọn đủ giờ bắt đầu và kết thúc.');
    if (new Date(form.endTime) <= new Date(form.startTime)) return setError('Giờ kết thúc phải sau giờ bắt đầu.');
    try {
      setSaving(true);
      const created = await examAdminApi.createExam({
        title: form.title.trim(),
        subjectId: form.subjectId,
        duration: form.duration,
        totalPoints: form.totalPoints,
        description: form.description.trim(),
        shuffle_mode: false,
        is_simulated: false,
        languageMode: 'vi',
        start_time: new Date(form.startTime).toISOString(),
        end_time: new Date(form.endTime).toISOString(),
        maxParticipants: form.maxParticipants,
      });
      router.push(`/admin/exams/${created.exam.id}/official`);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Tạo kỳ thi thất bại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Tạo kỳ thi Phòng thi" description="Bước 1/6: thông tin và lịch thi">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/admin/exam-room" className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-violet-600"><FiArrowLeft /> Quay lại Phòng thi</Link>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800">
          Sau bước này đề vẫn ở trạng thái nháp. Bạn sẽ tải PDF, nhập đáp án rồi bấm <strong>Mở đăng ký</strong>; khi đó user mới nhìn thấy kỳ thi.
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white"><FiFileText className="text-violet-600" /> Thông tin kỳ thi</h2>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2 text-sm font-bold text-gray-700">Tên kỳ thi *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Thi thử CSCA tháng 9" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500" /></label>
            <label className="text-sm font-bold text-gray-700">Môn thi *<select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"><option value={0}>Chọn môn</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="text-sm font-bold text-gray-700">Thời gian làm bài (phút)<input type="number" min={1} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="text-sm font-bold text-gray-700"><span className="inline-flex items-center gap-1"><FiCalendar /> Bắt đầu *</span><input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="text-sm font-bold text-gray-700">Kết thúc *<input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="text-sm font-bold text-gray-700">Tổng điểm<input type="number" min={1} value={form.totalPoints} onChange={(e) => setForm({ ...form, totalPoints: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="text-sm font-bold text-gray-700">Số người tối đa<input type="number" min={0} value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} placeholder="0 = không giới hạn" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
            <label className="md:col-span-2 text-sm font-bold text-gray-700">Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5" /></label>
          </div>
          <div className="mt-6 flex justify-end border-t border-gray-100 pt-5">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-50">{saving ? <FiRefreshCw className="animate-spin" /> : <FiArrowRight />} {saving ? 'Đang tạo...' : 'Tạo và sang bước PDF'}</button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
