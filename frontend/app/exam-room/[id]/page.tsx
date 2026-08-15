'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import OfficialExamLeaderboard from '@/components/exam/OfficialExamLeaderboard';
import examApi from '@/lib/api/exams';
import { officialExamApi, ExamRegistration, OfficialExamLeaderboardEntry } from '@/lib/api/officialExams';
import { FiArrowLeft, FiAward, FiCalendar, FiCheckCircle, FiClock, FiMonitor, FiUserCheck, FiUsers, FiXCircle } from 'react-icons/fi';

type ExamDetail = {
  id: number;
  title: string;
  title_cn?: string;
  description?: string;
  subject_name?: string;
  subject_code?: string;
  duration?: number;
  total_questions?: number;
  total_points?: number;
  start_time?: string | null;
  end_time?: string | null;
  max_participants?: number;
  is_premium?: boolean;
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa đặt lịch';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function registrationLabel(status?: string | null) {
  switch (status) {
    case 'registered':
      return 'Đã đăng ký';
    case 'approved':
      return 'Đã duyệt';
    case 'checked_in':
      return 'Đã check-in';
    case 'completed':
      return 'Đã hoàn thành';
    case 'cancelled':
      return 'Đã hủy đăng ký';
    case 'no_show':
      return 'Vắng thi';
    default:
      return 'Chưa đăng ký';
  }
}

export default function ExamRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = useMemo(() => {
    const raw = params?.id;
    const parsed = Number.parseInt(String(raw || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params?.id]);

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [registration, setRegistration] = useState<ExamRegistration | null>(null);
  const [leaderboard, setLeaderboard] = useState<OfficialExamLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  const startMs = exam?.start_time ? new Date(exam.start_time).getTime() : null;
  const endMs = exam?.end_time ? new Date(exam.end_time).getTime() : null;
  const hasStarted = !!startMs && now >= startMs;
  const hasEnded = !!endMs && now > endMs;
  const canEnter = !!registration && ['approved', 'checked_in'].includes(registration.status) && hasStarted && !hasEnded;
  const canRegister = !!exam?.start_time && !hasStarted && (!registration || registration.status === 'cancelled');
  const canCancel = !!registration && ['registered', 'approved'].includes(registration.status) && !hasStarted;

  const loadData = async () => {
    if (!examId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await examApi.getExamDetail(examId);
      setExam(data);
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      if (token) {
        const myRegistration = await officialExamApi.getMyRegistration(examId);
        setRegistration(myRegistration);
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Không thể tải chi tiết kỳ thi');
      router.push('/exam-room');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    if (!examId) return;
    setLeaderboardLoading(true);
    try {
      const data = await officialExamApi.getLeaderboard(examId);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Official exam leaderboard error:', error);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examId]);

  useEffect(() => {
    if (!examId || !hasEnded) {
      setLeaderboard([]);
      setLeaderboardLoading(false);
      return;
    }

    loadLeaderboard();
    const leaderboardTimer = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(leaderboardTimer);
  }, [examId, hasEnded]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleRegister = async () => {
    if (!examId) return;
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token) {
      alert('Vui lòng đăng nhập để đăng ký kỳ thi');
      router.push('/login');
      return;
    }
    try {
      setSaving(true);
      const data = await officialExamApi.register(examId);
      setRegistration(data);
      alert('Đăng ký thành công và đã được tự động duyệt');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!examId || !confirm('Hủy đăng ký kỳ thi này?')) return;
    try {
      setSaving(true);
      const data = await officialExamApi.cancelRegistration(examId);
      setRegistration(data);
      alert('Đã hủy đăng ký');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Hủy đăng ký thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-72 animate-pulse rounded-3xl bg-white border border-slate-100" />
        </main>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <button
          onClick={() => router.push('/exam-room')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"
        >
          <FiArrowLeft /> Quay lại phòng thi
        </button>

        <section className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-xs font-black uppercase">
                {exam.subject_name || exam.subject_code || 'Môn học'}
              </span>
              {exam.is_premium && (
                <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-black uppercase">
                  VIP
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-950">{exam.title}</h1>
            {exam.description && <p className="mt-3 text-slate-600 leading-relaxed">{exam.description}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-6 md:p-8 space-y-4 border-b md:border-b-0 md:border-r border-slate-100">
              <InfoRow icon={FiCalendar} label="Bắt đầu" value={formatDateTime(exam.start_time)} />
              <InfoRow icon={FiClock} label="Kết thúc" value={formatDateTime(exam.end_time)} />
              <InfoRow icon={FiMonitor} label="Thời lượng" value={`${exam.duration || 0} phút`} />
              <InfoRow icon={FiUsers} label="Số câu" value={`${exam.total_questions || 0} câu`} />
            </div>

            <div className="p-6 md:p-8 space-y-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-2">
                  <FiUserCheck /> Trạng thái đăng ký
                </div>
                <div className="text-lg font-black text-slate-950">{registrationLabel(registration?.status)}</div>
              </div>

              {!hasStarted && (
                <div className="flex items-start gap-2 rounded-2xl bg-orange-50 border border-orange-100 p-4 text-sm text-orange-800">
                  <FiClock className="mt-0.5 shrink-0" />
                  Kỳ thi chưa bắt đầu. Bạn có thể vào thi ngay khi đến giờ.
                </div>
              )}

              {hasEnded && (
                <div className="flex items-start gap-2 rounded-2xl bg-slate-100 border border-slate-200 p-4 text-sm text-slate-700">
                  <FiXCircle className="mt-0.5 shrink-0" />
                  Kỳ thi đã kết thúc.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {canRegister && (
                  <button
                    onClick={handleRegister}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-orange-600 px-5 py-3 font-black text-white hover:bg-orange-700 disabled:opacity-60"
                  >
                    Đăng ký
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 font-black text-slate-800 hover:border-slate-900 disabled:opacity-60"
                  >
                    Hủy đăng ký
                  </button>
                )}
                <button
                  onClick={() => router.push(`/exam/${exam.id}`)}
                  disabled={!canEnter}
                  className="flex-1 rounded-xl bg-slate-950 px-5 py-3 font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FiCheckCircle /> Vào thi
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {hasEnded ? (
          <OfficialExamLeaderboard
            entries={leaderboard}
            examTitle={exam.title}
            loading={leaderboardLoading}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <FiAward className="mx-auto mb-3 text-3xl text-amber-500" />
            <h2 className="text-xl font-black text-slate-950">Bảng xếp hạng mở sau khi kỳ thi kết thúc</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Kết quả của riêng kỳ thi này sẽ được tự động cập nhật sau khi hết giờ.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <div className="flex items-center gap-3 text-slate-500">
        <Icon />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <span className="text-sm font-black text-slate-950 text-right">{value}</span>
    </div>
  );
}
