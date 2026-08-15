'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import RoomExamPaperPanel from '@/components/admin/RoomExamPaperPanel';
import RoomExamSchedulePanel from '@/components/admin/RoomExamSchedulePanel';
import OfficialExamLeaderboard from '@/components/exam/OfficialExamLeaderboard';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { examAdminApi } from '@/lib/api/examAdmin';
import { adminApi, AdminUser } from '@/lib/api/admin';
import {
  officialExamApi,
  officialExamAdminApi,
  ExamRegistration,
  ExamRoom,
  ExamViolation,
  ExamCertificate,
  OfficialExamLeaderboardEntry,
} from '@/lib/api/officialExams';
import { initSocket, getSocket } from '@/lib/socket';
import {
  FiActivity, FiAward, FiCalendar, FiCheck, FiChevronLeft, FiClock,
  FiFileText, FiMonitor, FiRefreshCw, FiShield, FiTrash2, FiUserCheck,
  FiTrendingUp, FiUsers, FiX,
} from 'react-icons/fi';

type TabId = 'schedule' | 'paper' | 'registrations' | 'rooms' | 'proctors' | 'monitor' | 'leaderboard' | 'violations' | 'certificates';

interface ExamMeta {
  id: number;
  title: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  max_participants?: number;
}

interface MonitorData {
  overview?: {
    registrations?: number;
    checked_in?: number;
    in_progress?: number;
    completed?: number;
    violations?: number;
  };
  rooms?: Array<{
    id: number;
    room_name: string;
    location?: string | null;
    capacity: number;
    assigned_count: number;
    checked_in: number;
    violations: number;
  }>;
  recentViolations?: Array<{
    id: number;
    violation_type: string;
    severity: string;
    created_at: string;
    full_name?: string;
    email?: string;
    room_name?: string | null;
  }>;
}

const tabs: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'schedule', label: '1. Lịch thi', icon: FiCalendar },
  { id: 'paper', label: '2. PDF & đáp án', icon: FiFileText },
  { id: 'registrations', label: '3. Đăng ký', icon: FiUsers },
  { id: 'monitor', label: '4. Giám sát', icon: FiActivity },
  { id: 'violations', label: 'Vi phạm', icon: FiShield },
  { id: 'leaderboard', label: 'Kết quả', icon: FiTrendingUp },
  { id: 'certificates', label: 'Chứng nhận', icon: FiAward },
];

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString('vi-VN');
}

function statusBadge(status?: string) {
  const map: Record<string, string> = {
    registered: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    checked_in: 'bg-violet-50 text-violet-700 border-violet-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-200',
    no_show: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    issued: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${map[status || ''] || 'bg-gray-50 text-gray-600 border-gray-200'}`;
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-slate-400">
        <Icon size={16} />
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function OfficialExamAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const examId = Number(params?.id);

  const [activeTab, setActiveTab] = useState<TabId>('paper');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [violations, setViolations] = useState<ExamViolation[]>([]);
  const [certificates, setCertificates] = useState<ExamCertificate[]>([]);
  const [leaderboard, setLeaderboard] = useState<OfficialExamLeaderboardEntry[]>([]);
  const [monitor, setMonitor] = useState<MonitorData>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [paperReady, setPaperReady] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [newRoom, setNewRoom] = useState({ room_name: '', location: '', capacity: 30 });
  const [assignment, setAssignment] = useState({ roomId: '', registrationId: '', seatNumber: '' });
  const [proctorAssignment, setProctorAssignment] = useState({ roomId: '', proctorId: '', role: 'proctor' });
  const [passScore, setPassScore] = useState(60);

  const unassignedRegistrations = useMemo(
    () => registrations.filter((reg) => !reg.room_id && reg.status !== 'cancelled'),
    [registrations],
  );

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token) {
      router.push('/');
      return;
    }
    if (isAuthenticated && !hasPermission(user, 'exams.manage')) {
      router.push('/admin');
      return;
    }
    loadAll();
  }, [examId, isAuthenticated, user]);

  useEffect(() => {
    if (!examId) return;
    const socket = initSocket();
    socket?.emit('join_exam_monitor', examId);

    const reload = () => loadOperationalData(false);
    socket?.on('exam_registration_changed', reload);
    socket?.on('exam_room_changed', reload);
    socket?.on('exam_room_assignment_changed', reload);
    socket?.on('exam_proctor_assignment_changed', reload);
    socket?.on('exam_violation_logged', reload);

    return () => {
      const current = getSocket();
      current?.emit('leave_exam_monitor', examId);
      current?.off('exam_registration_changed', reload);
      current?.off('exam_room_changed', reload);
      current?.off('exam_room_assignment_changed', reload);
      current?.off('exam_proctor_assignment_changed', reload);
      current?.off('exam_violation_logged', reload);
    };
  }, [examId]);

  const loadOperationalData = async (showSpinner = true) => {
    try {
      if (showSpinner) setRefreshing(true);
      const [regs, roomList, monitorData, violationList, certList, leaderboardData] = await Promise.all([
        officialExamAdminApi.getRegistrations(examId),
        officialExamAdminApi.getRooms(examId),
        officialExamAdminApi.getMonitor(examId),
        officialExamAdminApi.getViolations(examId),
        officialExamAdminApi.getCertificates(examId),
        officialExamApi.getLeaderboard(examId).catch(() => ({ leaderboard: [] })),
      ]);
      setRegistrations(regs || []);
      setRooms(roomList || []);
      setMonitor(monitorData || {});
      setViolations(violationList || []);
      setCertificates(certList || []);
      setLeaderboard(leaderboardData.leaderboard || []);
    } finally {
      setRefreshing(false);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [examData, userData, paperConfig] = await Promise.all([
        examAdminApi.getExamForEdit(examId),
        adminApi.getUsers({ page: 1, limit: 100 }),
        examAdminApi.getRoomPaperConfig(examId),
      ]);
      setExam(examData.exam);
      setUsers(userData.users || []);
      setPaperReady(Boolean(paperConfig.ready));
      await loadOperationalData(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể tải dữ liệu kỳ thi chính thức');
      router.push('/admin/exam-room');
    } finally {
      setLoading(false);
    }
  };

  const updateRegistration = async (registrationId: number, status: string) => {
    try {
      await officialExamAdminApi.updateRegistrationStatus(examId, registrationId, { status });
      await loadOperationalData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể cập nhật trạng thái đăng ký');
    }
  };

  const createRoom = async () => {
    if (!newRoom.room_name.trim()) return alert('Nhập tên phòng thi');
    await officialExamAdminApi.createRoom(examId, newRoom);
    setNewRoom({ room_name: '', location: '', capacity: 30 });
    await loadOperationalData();
  };

  const deleteRoom = async (roomId: number) => {
    if (!confirm('Xóa phòng thi này? Thí sinh và giám thị đã phân công sẽ bị gỡ khỏi phòng.')) return;
    await officialExamAdminApi.deleteRoom(examId, roomId);
    await loadOperationalData();
  };

  const assignStudent = async () => {
    const roomId = Number(assignment.roomId);
    const registrationId = Number(assignment.registrationId);
    if (!roomId || !registrationId) return alert('Chọn phòng và thí sinh cần phân phòng');
    await officialExamAdminApi.assignStudentToRoom(examId, roomId, {
      registration_id: registrationId,
      seat_number: assignment.seatNumber ? Number(assignment.seatNumber) : undefined,
    });
    setAssignment({ roomId: '', registrationId: '', seatNumber: '' });
    await loadOperationalData();
  };

  const autoAssign = async () => {
    const result = await officialExamAdminApi.autoAssignRooms(examId);
    alert(`Đã phân ${result.assignedCount} thí sinh. Còn lại: ${result.remaining}`);
    await loadOperationalData();
  };

  const assignProctor = async () => {
    const roomId = Number(proctorAssignment.roomId);
    const proctorId = Number(proctorAssignment.proctorId);
    if (!roomId || !proctorId) return alert('Chọn phòng và giám thị');
    await officialExamAdminApi.assignProctor(examId, roomId, {
      proctor_id: proctorId,
      role: proctorAssignment.role || 'proctor',
    });
    setProctorAssignment({ roomId: '', proctorId: '', role: 'proctor' });
    await loadOperationalData();
  };

  const generateCertificates = async () => {
    const created = await officialExamAdminApi.generateCertificates(examId, { pass_score: passScore });
    alert(`Đã cấp ${created.length} chứng nhận mới`);
    await loadOperationalData();
  };

  const toggleRegistration = async () => {
    if (!exam) return;
    if (exam.status !== 'published') {
      if (!exam.start_time || !exam.end_time) {
        setActiveTab('schedule');
        return alert('Bước 1 chưa xong: cần lưu đủ lịch thi.');
      }
      if (!paperReady) {
        setActiveTab('paper');
        return alert('Bước 2 chưa xong: cần tải PDF và nhập đủ đáp án.');
      }
    }
    try {
      setPublishing(true);
      const nextStatus = exam.status === 'published' ? 'draft' : 'published';
      const result = await examAdminApi.updateExamStatus(examId, nextStatus);
      setExam((current) => current ? { ...current, status: result.exam?.status || nextStatus } : current);
      alert(nextStatus === 'published'
        ? 'Đã mở đăng ký. Kỳ thi hiện đang hiển thị ở trang Phòng thi của user.'
        : 'Đã đóng đăng ký và ẩn kỳ thi khỏi trang user.');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không đổi được trạng thái đăng ký.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Kỳ thi chính thức">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      </AdminLayout>
    );
  }

  const overview = monitor.overview || {};

  return (
    <AdminLayout title="Kỳ thi chính thức" description={exam?.title || `Exam #${examId}`}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/admin/exam-room" className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-violet-600">
              <FiChevronLeft /> Quay lại Phòng thi
            </Link>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{exam?.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1"><FiCalendar /> {formatDateTime(exam?.start_time)}</span>
              <span>→</span>
              <span>{formatDateTime(exam?.end_time)}</span>
              <span className={statusBadge(exam?.status)}>{exam?.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={toggleRegistration} disabled={publishing} className={`rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50 ${exam?.status === 'published' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {publishing ? 'Đang xử lý...' : exam?.status === 'published' ? 'Đóng đăng ký' : 'Mở đăng ký cho user'}
            </button>
            <button onClick={() => loadOperationalData()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
              <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> Làm mới
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile icon={FiUsers} label="Đăng ký" value={overview.registrations || registrations.length} />
          <StatTile icon={FiUserCheck} label="Check-in" value={overview.checked_in || 0} />
          <StatTile icon={FiClock} label="Đang thi" value={overview.in_progress || 0} />
          <StatTile icon={FiCheck} label="Hoàn tất" value={overview.completed || 0} />
          <StatTile icon={FiShield} label="Vi phạm" value={overview.violations || violations.length} />
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
          {[
            ['1', 'Lịch thi', Boolean(exam?.start_time && exam?.end_time), 'schedule' as TabId],
            ['2', 'PDF & đáp án', paperReady, 'paper' as TabId],
            ['3', 'Mở đăng ký', exam?.status === 'published', 'registrations' as TabId],
          ].map(([number, label, done, target]: any) => (
            <button key={number} onClick={() => setActiveTab(target)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}>{done ? '✓' : number}</span>
              <span className={`text-sm font-black ${done ? 'text-emerald-800' : 'text-amber-800'}`}>{label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'schedule' && (
          <RoomExamSchedulePanel
            examId={examId}
            onScheduleChange={(schedule) => setExam((current) => current ? { ...current, start_time: schedule.start_time, end_time: schedule.end_time, max_participants: schedule.max_participants } : current)}
          />
        )}

        {activeTab === 'paper' && <RoomExamPaperPanel examId={examId} onConfigChange={(config) => setPaperReady(Boolean(config.ready))} />}

        {activeTab === 'registrations' && (
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-gray-100 p-4 dark:border-slate-800">
              <h2 className="font-black text-gray-900 dark:text-white">Danh sách thí sinh đăng ký</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-slate-800">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3">Thí sinh</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Đăng ký lúc</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {registrations.map((reg: any) => (
                    <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900 dark:text-white">{reg.full_name || reg.username || `User #${reg.user_id}`}</p>
                        <p className="text-xs text-gray-500">{reg.email}</p>
                      </td>
                      <td className="px-4 py-3"><span className={statusBadge(reg.status)}>{reg.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(reg.registered_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {reg.status === 'registered' && (
                            <button onClick={() => updateRegistration(reg.id, 'approved')} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Duyệt</button>
                          )}
                          <button
                            onClick={() => updateRegistration(reg.id, 'checked_in')}
                            className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Check-in
                          </button>
                          <button onClick={() => updateRegistration(reg.id, 'no_show')} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">Vắng</button>
                          <button onClick={() => updateRegistration(reg.id, 'cancelled')} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">Hủy</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Chưa có thí sinh đăng ký.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'rooms' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 font-black text-gray-900 dark:text-white">Tạo phòng thi</h2>
              <div className="space-y-3">
                <input value={newRoom.room_name} onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })} placeholder="Tên phòng, VD: A101" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                <input value={newRoom.location} onChange={(e) => setNewRoom({ ...newRoom, location: e.target.value })} placeholder="Địa điểm" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                <input type="number" min={1} value={newRoom.capacity} onChange={(e) => setNewRoom({ ...newRoom, capacity: Number(e.target.value) })} placeholder="Sức chứa" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                <button onClick={createRoom} className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">Tạo phòng</button>
              </div>

              <div className="mt-6 border-t pt-4">
                <h3 className="mb-3 font-bold text-gray-800">Phân phòng</h3>
                <div className="space-y-3">
                  <select value={assignment.roomId} onChange={(e) => setAssignment({ ...assignment, roomId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Chọn phòng</option>
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.room_name}</option>)}
                  </select>
                  <select value={assignment.registrationId} onChange={(e) => setAssignment({ ...assignment, registrationId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Chọn thí sinh chưa phân phòng</option>
                    {unassignedRegistrations.map((reg: any) => <option key={reg.id} value={reg.id}>{reg.full_name || reg.email || `User #${reg.user_id}`}</option>)}
                  </select>
                  <input type="number" min={1} value={assignment.seatNumber} onChange={(e) => setAssignment({ ...assignment, seatNumber: e.target.value })} placeholder="Số ghế (tùy chọn)" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <button onClick={assignStudent} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Phân thủ công</button>
                  <button onClick={autoAssign} className="w-full rounded-xl border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50">Phân phòng tự động</button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {rooms.map((room) => (
                <div key={room.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white">{room.room_name}</h3>
                      <p className="text-sm text-gray-500">{room.location || 'Chưa có địa điểm'}</p>
                    </div>
                    <button onClick={() => deleteRoom(room.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><FiTrash2 /></button>
                  </div>
                  <div className="mb-3 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min(100, ((room.assigned_count || 0) / room.capacity) * 100)}%` }} />
                  </div>
                  <p className="text-sm font-bold text-gray-700">{room.assigned_count || 0}/{room.capacity} thí sinh</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(room.proctors || []).filter((p) => p.id).map((p) => (
                      <span key={p.id} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{p.full_name || p.email || `#${p.proctor_id}`}</span>
                    ))}
                  </div>
                </div>
              ))}
              {rooms.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">Chưa có phòng thi.</div>}
            </div>
          </section>
        )}

        {activeTab === 'proctors' && (
          <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 font-black text-gray-900 dark:text-white">Gán giám thị</h2>
              <div className="space-y-3">
                <select value={proctorAssignment.roomId} onChange={(e) => setProctorAssignment({ ...proctorAssignment, roomId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Chọn phòng</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.room_name}</option>)}
                </select>
                <select value={proctorAssignment.proctorId} onChange={(e) => setProctorAssignment({ ...proctorAssignment, proctorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Chọn user làm giám thị</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}
                </select>
                <select value={proctorAssignment.role} onChange={(e) => setProctorAssignment({ ...proctorAssignment, role: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="proctor">Giám thị</option>
                  <option value="chief_proctor">Trưởng phòng</option>
                  <option value="support">Hỗ trợ kỹ thuật</option>
                </select>
                <button onClick={assignProctor} className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">Gán giám thị</button>
              </div>
            </div>

            <div className="space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-3 font-black text-gray-900 dark:text-white">{room.room_name}</h3>
                  <div className="space-y-2">
                    {(room.proctors || []).filter((p) => p.id).map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                        <div>
                          <p className="font-bold text-gray-900">{p.full_name || p.email || `User #${p.proctor_id}`}</p>
                          <p className="text-xs text-gray-500">{p.role}</p>
                        </div>
                        <button onClick={async () => { await officialExamAdminApi.removeProctor(examId, room.id, p.id); await loadOperationalData(); }} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><FiX /></button>
                      </div>
                    ))}
                    {(!room.proctors || room.proctors.filter((p) => p.id).length === 0) && <p className="text-sm text-gray-500">Chưa có giám thị.</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'monitor' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 font-black text-gray-900 dark:text-white">Giám sát kỳ thi · Vi phạm gần đây</h2>
              <div className="space-y-2">
                {(monitor.recentViolations || []).map((v) => (
                  <div key={v.id} className="rounded-xl bg-red-50 px-3 py-2">
                    <p className="font-bold text-red-800">{v.full_name || v.email} - {v.violation_type}</p>
                    <p className="text-xs text-red-600">{formatDateTime(v.created_at)}</p>
                  </div>
                ))}
                {(!monitor.recentViolations || monitor.recentViolations.length === 0) && <p className="text-sm text-gray-500">Chưa có vi phạm.</p>}
              </div>
            </div>
        )}

        {activeTab === 'leaderboard' && (
          <OfficialExamLeaderboard
            entries={leaderboard}
            examTitle={exam?.title}
            loading={refreshing}
          />
        )}

        {activeTab === 'violations' && (
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-gray-100 p-4 dark:border-slate-800">
              <h2 className="font-black text-gray-900 dark:text-white">Biên bản vi phạm</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {violations.map((v: any) => (
                <div key={v.id} className="grid gap-2 p-4 md:grid-cols-[1fr_160px_180px] md:items-center">
                  <div>
                    <p className="font-black text-gray-900 dark:text-white">{v.full_name || v.email || `User #${v.user_id}`}</p>
                    <p className="text-sm text-gray-500">{v.violation_type} · {v.notes || 'Không có ghi chú'}</p>
                  </div>
                  <span className={statusBadge(v.severity)}>{v.severity}</span>
                  <p className="text-sm text-gray-500">{formatDateTime(v.created_at)}</p>
                </div>
              ))}
              {violations.length === 0 && <p className="p-8 text-center text-gray-500">Chưa có biên bản vi phạm.</p>}
            </div>
          </section>
        )}

        {activeTab === 'certificates' && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">Điểm đạt chứng nhận</label>
                <input type="number" value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} className="w-40 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <button onClick={generateCertificates} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                <FiAward /> Cấp chứng nhận hàng loạt
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {certificates.map((cert: any) => (
                  <div key={cert.id} className="grid gap-2 p-4 md:grid-cols-[1fr_160px_180px] md:items-center">
                    <div>
                      <p className="font-black text-gray-900 dark:text-white">{cert.full_name || cert.email || `User #${cert.user_id}`}</p>
                      <p className="font-mono text-sm text-emerald-700">{cert.certificate_code}</p>
                    </div>
                    <span className={statusBadge(cert.status)}>{cert.status}</span>
                    <div className="text-sm text-gray-500">
                      <p>{Number(cert.total_score).toFixed(1)} điểm</p>
                      <p>{formatDateTime(cert.issued_at)}</p>
                    </div>
                  </div>
                ))}
                {certificates.length === 0 && <p className="p-8 text-center text-gray-500">Chưa cấp chứng nhận.</p>}
              </div>
            </div>
          </section>
        )}

        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/40">
          <FiFileText className="mr-2 inline" />
          Luồng này dùng dữ liệu thật từ các bảng official exam workflow. Nút đăng ký cho học viên có thể nối vào trang sảnh thi ở bước tiếp theo.
        </div>
      </div>
    </AdminLayout>
  );
}
