'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiClock, FiUsers, FiSave, FiTrash2, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';

interface ScheduleLog {
  changed_by_name: string;
  old_start_time: string | null;
  old_end_time: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  reason: string | null;
  changed_at: string;
}

interface ExamSchedule {
  id: number;
  title: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  max_participants: number;
  change_log: ScheduleLog[] | null;
}

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('vi-VN');
}

export default function ExamSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const examId = params?.id as string;

  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'exams.manage'))) {
      router.push('/');
      return;
    }
    loadSchedule();
  }, [isAuthenticated, user]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/admin/exams/${examId}/schedule`);
      const data: ExamSchedule = res.data.data;
      setSchedule(data);
      setStartTime(toLocalDatetimeValue(data.start_time));
      setEndTime(toLocalDatetimeValue(data.end_time));
      setMaxParticipants(String(data.max_participants || ''));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không tải được lịch thi');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!startTime || !endTime) { setError('Vui lòng chọn thời gian bắt đầu và kết thúc'); return; }
    if (new Date(endTime) <= new Date(startTime)) { setError('Thời gian kết thúc phải sau thời gian bắt đầu'); return; }
    try {
      setSaving(true);
      await axios.put(`/admin/exams/${examId}/schedule`, {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        maxParticipants: parseInt(maxParticipants) || 0,
        reason: reason.trim() || undefined,
      });
      setReason('');
      await loadSchedule();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Lưu lịch thi thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Xóa lịch thi này? Đề thi sẽ chuyển thành đề thi tự do.')) return;
    try {
      setClearing(true);
      await axios.delete(`/admin/exams/${examId}/schedule`, { data: { reason: 'Xóa lịch thủ công' } });
      setStartTime('');
      setEndTime('');
      setMaxParticipants('');
      await loadSchedule();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Xóa lịch thi thất bại');
    } finally {
      setClearing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" /><p className="mt-4 text-gray-600">Đang tải...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Quản lý Lịch Thi</h1>
            {schedule && <p className="text-sm text-gray-500 mt-0.5">{schedule.title}</p>}
          </div>
          <button onClick={() => router.push('/admin/exams')} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <FiArrowLeft /> Quay lại
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
            <FiAlertCircle className="shrink-0" /> {error}
          </div>
        )}

        {/* Current status */}
        {schedule && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">Trạng thái hiện tại</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Bắt đầu</p>
                <p className="font-semibold text-gray-900">{formatDateTime(schedule.start_time)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Kết thúc</p>
                <p className="font-semibold text-gray-900">{formatDateTime(schedule.end_time)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Số thí sinh tối đa</p>
                <p className="font-semibold text-gray-900">{schedule.max_participants?.toLocaleString() || 'Không giới hạn'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Schedule form */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-5 text-lg flex items-center gap-2">
            <FiClock className="text-indigo-500" /> Cập nhật Lịch Thi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian bắt đầu *</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc *</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiUsers className="inline mr-1" />Số thí sinh tối đa (0 = không giới hạn)
              </label>
              <input
                type="number"
                min="0"
                value={maxParticipants}
                onChange={e => setMaxParticipants(e.target.value)}
                placeholder="VD: 5000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lý do thay đổi (ghi vào log)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="VD: Lùi lịch do sự cố kỹ thuật"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <FiSave /> {saving ? 'Đang lưu...' : 'Lưu lịch thi'}
            </button>
            {schedule?.start_time && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 rounded-lg font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                <FiTrash2 /> {clearing ? 'Đang xóa...' : 'Xóa lịch thi'}
              </button>
            )}
          </div>
        </div>

        {/* Change log */}
        {schedule?.change_log && schedule.change_log.length > 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4 text-lg">Lịch sử thay đổi</h2>
            <div className="divide-y divide-gray-100">
              {schedule.change_log.map((log, i) => (
                <div key={i} className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{log.changed_by_name}</span>
                    <span className="text-xs text-gray-400">{formatDateTime(log.changed_at)}</span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <p>Trước: {formatDateTime(log.old_start_time)} → {formatDateTime(log.old_end_time)}</p>
                    <p>Sau: {formatDateTime(log.new_start_time)} → {formatDateTime(log.new_end_time)}</p>
                    {log.reason && <p className="text-indigo-600 italic">"{log.reason}"</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
