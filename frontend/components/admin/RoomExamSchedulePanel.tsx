'use client';

import { useEffect, useState } from 'react';
import { FiCalendar, FiClock, FiRefreshCw, FiSave, FiUsers } from 'react-icons/fi';
import { examAdminApi, RoomExamSchedule } from '@/lib/api/examAdmin';

function toLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RoomExamSchedulePanel({
  examId,
  onScheduleChange,
}: {
  examId: number;
  onScheduleChange?: (schedule: RoomExamSchedule) => void;
}) {
  const [schedule, setSchedule] = useState<RoomExamSchedule | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await examAdminApi.getSchedule(examId);
      setSchedule(data);
      setStartTime(toLocalValue(data.start_time));
      setEndTime(toLocalValue(data.end_time));
      setMaxParticipants(data.max_participants ? String(data.max_participants) : '');
      onScheduleChange?.(data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không tải được lịch thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) load();
  }, [examId]);

  const save = async () => {
    setError('');
    if (!startTime || !endTime) return setError('Cần chọn đủ giờ bắt đầu và kết thúc.');
    if (new Date(endTime) <= new Date(startTime)) return setError('Giờ kết thúc phải sau giờ bắt đầu.');
    try {
      setSaving(true);
      await examAdminApi.setSchedule(examId, {
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        maxParticipants: Number(maxParticipants) || 0,
        reason: reason.trim() || undefined,
      });
      setReason('');
      await load();
      alert('Đã lưu lịch thi.');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Lưu lịch thi thất bại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !schedule) {
    return <div className="flex min-h-52 items-center justify-center rounded-2xl border bg-white"><FiRefreshCw className="animate-spin text-violet-600" size={26} /></div>;
  }

  const scheduledWindowMinutes = startTime && endTime
    ? Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000))
    : 0;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white"><FiCalendar className="text-violet-600" /> Lịch và giới hạn đăng ký</h2>
        <p className="mt-1 text-sm text-gray-500">Cài riêng thời lượng của đề và khung giờ mở phòng. Mọi thí sinh đều bị dừng tại cùng giờ kết thúc.</p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-violet-600"><FiClock /> Thời lượng đề</p>
          <p className="mt-1 text-lg font-black text-violet-950">{schedule?.duration || 0} phút</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${scheduledWindowMinutes && scheduledWindowMinutes !== Number(schedule?.duration || 0) ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
          <p className={`text-xs font-bold uppercase tracking-wide ${scheduledWindowMinutes && scheduledWindowMinutes !== Number(schedule?.duration || 0) ? 'text-amber-700' : 'text-emerald-700'}`}>Khung giờ phòng thi</p>
          <p className="mt-1 text-lg font-black text-gray-950">{scheduledWindowMinutes ? `${scheduledWindowMinutes} phút` : 'Chưa đặt'}</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
        Học sinh vào muộn sẽ chỉ còn thời gian đến mốc <strong>Thời gian kết thúc</strong>. Ví dụ phòng 08:00–09:00, vào lúc 08:10 thì còn 50 phút.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
          Thời gian bắt đầu *
          <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500" />
        </label>
        <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
          Thời gian kết thúc *
          <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500" />
        </label>
        <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
          <span className="inline-flex items-center gap-1"><FiUsers /> Số thí sinh tối đa</span>
          <input type="number" min={0} value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} placeholder="0 = không giới hạn" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500" />
        </label>
        <label className="text-sm font-bold text-gray-700 dark:text-slate-200">
          Ghi chú thay đổi
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Không bắt buộc" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-violet-500" />
        </label>
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-100 pt-5 dark:border-slate-800">
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />} {saving ? 'Đang lưu...' : 'Lưu lịch thi'}
        </button>
      </div>
    </section>
  );
}
