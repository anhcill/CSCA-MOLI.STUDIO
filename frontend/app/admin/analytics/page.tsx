'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasAnyPermission, hasPermission } from '@/lib/utils/permissions';
import {
  adminAnalyticsApi,
  type AdminAnalyticsFilters,
  type AdminPerformanceData,
} from '@/lib/api/adminAnalytics';
import {
  FiActivity, FiBarChart2, FiCalendar, FiFileText, FiRefreshCw, FiTarget,
  FiTrendingUp, FiUsers,
} from 'react-icons/fi';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Preset = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom';

const emptyPerformance: AdminPerformanceData = {
  overview: {
    adminsCount: 0,
    examsCreated: 0,
    publishedExams: 0,
    draftExams: 0,
    archivedExams: 0,
    softDeletedExams: 0,
    deleteRequests: 0,
    unattributedExams: 0,
    questionsCreated: 0,
    completedAttempts: 0,
  },
  leaderboard: [],
  timeline: [],
  recentActivity: [],
  deletionRequests: [],
  topExams: [],
  adminSubjects: [],
};

const number = (value: number) => Number(value || 0).toLocaleString('vi-VN');

function getPresetRange(preset: Preset): AdminAnalyticsFilters {
  if (preset === 'all') return { granularity: 'day' };

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  if (preset === '7d') fromDate.setDate(now.getDate() - 7);
  if (preset === '30d') fromDate.setDate(now.getDate() - 30);
  if (preset === '90d') fromDate.setDate(now.getDate() - 90);
  if (preset === 'year') fromDate.setFullYear(now.getFullYear() - 1);

  return {
    from: fromDate.toISOString().slice(0, 10),
    to,
    granularity: preset === 'year' ? 'month' : 'day',
  };
}

export default function AdminPerformanceAnalyticsPage() {
  const { user } = useAuthStore();
  const [performance, setPerformance] = useState<AdminPerformanceData>(emptyPerformance);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');

  const filters = useMemo<AdminAnalyticsFilters>(
    () => ({ from, to, granularity }),
    [from, to, granularity],
  );

  const canViewPerformance = hasAnyPermission(user, ['admin.super', 'exams.manage']);
  const canViewSystem = hasPermission(user, 'admin.super');

  const loadAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await adminAnalyticsApi.getAdminPerformance(nextFilters);
      setPerformance(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPerformance) loadAnalytics();
  }, [canViewPerformance]);

  const applyPreset = (value: Preset) => {
    setPreset(value);
    if (value === 'custom') return;
    const range = getPresetRange(value);
    setFrom(range.from || '');
    setTo(range.to || '');
    setGranularity(range.granularity || 'day');
    loadAnalytics(range);
  };

  const statCards = [
    { label: 'Admin theo dõi', value: number(performance.overview.adminsCount), icon: FiUsers, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Đề đã tạo', value: number(performance.overview.examsCreated), icon: FiFileText, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Đề đã xuất bản', value: number(performance.overview.publishedExams), icon: FiTarget, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Câu hỏi đã nhập', value: number(performance.overview.questionsCreated), icon: FiBarChart2, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Lượt thi hoàn thành', value: number(performance.overview.completedAttempts), icon: FiActivity, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Chưa gán admin', value: number(performance.overview.unattributedExams), icon: FiCalendar, tone: 'bg-rose-50 text-rose-700' },
  ];

  const adminSubjectGroups = useMemo(() => {
    const groups = new Map<number, {
      adminId: number;
      adminName: string;
      email: string;
      subjects: AdminPerformanceData['adminSubjects'];
    }>();

    for (const row of performance.adminSubjects || []) {
      if (!groups.has(row.adminId)) {
        groups.set(row.adminId, {
          adminId: row.adminId,
          adminName: row.adminName,
          email: row.email,
          subjects: [],
        });
      }
      groups.get(row.adminId)?.subjects.push(row);
    }

    return Array.from(groups.values());
  }, [performance.adminSubjects]);

  if (!canViewPerformance) {
    return (
      <AdminLayout title="Hiệu suất admin" description="Báo cáo đăng đề và chất lượng đề thi">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Bạn không có quyền xem báo cáo.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Hiệu suất admin">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RangeToolbar
            preset={preset}
            from={from}
            to={to}
            granularity={granularity}
            loading={loading}
            onPreset={applyPreset}
            onFrom={(value) => { setPreset('custom'); setFrom(value); }}
            onTo={(value) => { setPreset('custom'); setTo(value); }}
            onGranularity={setGranularity}
            onReload={() => loadAnalytics()}
          />
          {canViewSystem && (
            <Link href="/admin/analytics/system" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-violet-300 hover:text-violet-700">
              Xem thống kê hệ thống
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          {statCards.map(({ label, value, icon: Icon, tone }) => (
            <StatCard key={label} label={label} value={loading ? '...' : value} icon={<Icon />} tone={tone} />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Số đề theo thời gian" icon={<FiTrendingUp />}>
            {performance.timeline.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performance.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="examsCreated" name="Đề đã tạo" fill="#7c3aed" />
                  <Bar dataKey="publishedExams" name="Đề xuất bản" fill="#10b981" />
                  <Bar dataKey="deleteRequests" name="Yêu cầu xóa" fill="#f59e0b" />
                  <Bar dataKey="softDeletedExams" name="Xóa tạm" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyText />}
          </ChartCard>

          <ChartCard title="Đề có hiệu quả cao" icon={<FiTarget />}>
            <div className="space-y-3">
              {performance.topExams.slice(0, 8).map((exam) => (
                <div key={exam.examId} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{exam.examTitle}</p>
                      <p className="text-xs text-gray-500">{exam.subjectName || 'Chưa rõ môn'} · {exam.adminName}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">
                      {exam.totalAttempts} lượt
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <span>Hoàn thành: <b className="text-gray-800">{exam.completedAttempts}</b></span>
                    <span>Học viên: <b className="text-gray-800">{exam.uniqueStudents}</b></span>
                    <span>Điểm TB: <b className="text-gray-800">{exam.avgPercentage || 0}%</b></span>
                  </div>
                </div>
              ))}
              {!performance.topExams.length && <EmptyText />}
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Admin đã đăng đề theo môn" icon={<FiFileText />}>
          <div className="space-y-4">
            {adminSubjectGroups.map((group) => (
              <div key={group.adminId} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-gray-900">{group.adminName}</p>
                    <p className="text-xs text-gray-500">{group.email}</p>
                  </div>
                  <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">
                    {number(group.subjects.reduce((sum, item) => sum + item.examsCount, 0))} đề
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.subjects.map((subject) => (
                    <div key={`${group.adminId}-${subject.subjectId || subject.subjectName}`} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900">{subject.subjectName}</p>
                          <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                            {subject.examTitles.slice(0, 5).join(', ')}
                            {subject.examTitles.length > 5 ? ` và ${subject.examTitles.length - 5} đề khác` : ''}
                          </p>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-right text-xs text-gray-500">
                          <span><b className="block text-sm text-gray-900">{subject.examsCount}</b>Đề</span>
                          <span><b className="block text-sm text-emerald-700">{subject.publishedExams}</b>Xuất bản</span>
                          <span><b className="block text-sm text-amber-700">{subject.draftExams}</b>Nháp</span>
                          <span><b className="block text-sm text-blue-700">{subject.totalQuestions}</b>Câu hỏi</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!adminSubjectGroups.length && <EmptyText />}
          </div>
        </ChartCard>

        <ChartCard title="Bảng hiệu suất admin đăng đề" icon={<FiUsers />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Admin</th>
                  <th className="px-3 py-2 text-right">Điểm hiệu suất</th>
                  <th className="px-3 py-2 text-right">Đề tạo</th>
                  <th className="px-3 py-2 text-right">Xuất bản</th>
                  <th className="px-3 py-2 text-right">Câu hỏi</th>
                  <th className="px-3 py-2 text-right">Lượt thi</th>
                  <th className="px-3 py-2 text-right">Học viên</th>
                  <th className="px-3 py-2 text-right">Điểm TB</th>
                  <th className="px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {performance.leaderboard.map((admin) => (
                  <tr key={admin.adminId}>
                    <td className="px-3 py-2">
                      <p className="font-black text-gray-900">{admin.adminName}</p>
                      <p className="text-xs text-gray-500">{admin.email}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-violet-700">{number(admin.impactScore)}</td>
                    <td className="px-3 py-2 text-right">{admin.examsCreated}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-bold">{admin.publishedExams}</td>
                    <td className="px-3 py-2 text-right">{admin.questionsCreated}</td>
                    <td className="px-3 py-2 text-right">{admin.completedAttempts}/{admin.totalAttempts}</td>
                    <td className="px-3 py-2 text-right">{admin.uniqueStudents}</td>
                    <td className="px-3 py-2 text-right">{admin.avgPercentage || 0}%</td>
                    <td className="px-3 py-2 text-right text-gray-500">{admin.createActions + admin.updateActions + admin.deleteActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!performance.leaderboard.length && <EmptyText />}
          </div>
        </ChartCard>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Yêu cầu xóa và xóa tạm" icon={<FiFileText />}>
            <div className="space-y-3">
              {performance.deletionRequests.map((item) => (
                <div key={`${item.examId}-${item.deleteRequestedAt || item.deletedAt || 'pending'}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">#{item.examId} · {item.title}</p>
                      <p className="text-xs text-gray-500">
                        {item.deletionStatus === 'requested' ? `Người yêu cầu: ${item.requestedByName || 'Không rõ'}` : `Người xóa tạm: ${item.deletedByName || 'Không rõ'}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${
                      item.deletionStatus === 'requested' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {item.deletionStatus === 'requested' ? 'Chờ duyệt' : 'Đã xóa tạm'}
                    </span>
                  </div>
                  {(item.deleteRequestReason || item.deleteReason) && (
                    <p className="mt-2 text-xs text-gray-600">{item.deleteRequestReason || item.deleteReason}</p>
                  )}
                </div>
              ))}
              {!performance.deletionRequests.length && <EmptyText />}
            </div>
          </ChartCard>

          <ChartCard title="Nhật ký thao tác gần đây" icon={<FiActivity />}>
            <div className="space-y-3">
              {performance.recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-gray-900">{activity.adminName}</p>
                    <span className="text-xs text-gray-400">{new Date(activity.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-violet-700">{activity.action}</p>
                  {activity.metadata?.examTitle && (
                    <p className="mt-1 text-xs text-gray-500">{activity.metadata.examTitle}</p>
                  )}
                </div>
              ))}
              {!performance.recentActivity.length && <EmptyText />}
            </div>
          </ChartCard>
        </div>
      </div>
    </AdminLayout>
  );
}

function RangeToolbar({
  preset,
  from,
  to,
  granularity,
  loading,
  onPreset,
  onFrom,
  onTo,
  onGranularity,
  onReload,
}: {
  preset: Preset;
  from: string;
  to: string;
  granularity: 'day' | 'month';
  loading: boolean;
  onPreset: (value: Preset) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onGranularity: (value: 'day' | 'month') => void;
  onReload: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
      {[
        { key: 'all', label: 'Tất cả' },
        { key: '7d', label: '7 ngày' },
        { key: '30d', label: '30 ngày' },
        { key: '90d', label: '90 ngày' },
        { key: 'year', label: '12 tháng' },
        { key: 'custom', label: 'Tùy chỉnh' },
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => onPreset(item.key as Preset)}
          className={`px-3 py-2 rounded-xl text-sm font-bold ${preset === item.key ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          {item.label}
        </button>
      ))}
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
      <select value={granularity} onChange={(e) => onGranularity(e.target.value as 'day' | 'month')} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
        <option value="day">Theo ngày</option>
        <option value="month">Theo tháng</option>
      </select>
      <button onClick={onReload} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
        <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Tải báo cáo
      </button>
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
      <p className="text-sm font-semibold text-gray-500 mt-3">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h2 className="font-black text-gray-900 flex items-center gap-2 mb-4">
        <span className="text-violet-600">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyText() {
  return <p className="py-10 text-center text-sm text-gray-400">Chưa có dữ liệu trong khoảng này.</p>;
}
