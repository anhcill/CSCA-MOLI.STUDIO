'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasAnyPermission, hasPermission } from '@/lib/utils/permissions';
import {
  adminAnalyticsApi,
  type AdminAnalyticsData,
  type AdminAnalyticsFilters,
  type AdminPerformanceData,
  type ExamReportSummary,
} from '@/lib/api/adminAnalytics';
import {
  FiActivity, FiBarChart2, FiDownload, FiFileText, FiRefreshCw, FiTarget,
  FiTrendingUp, FiUsers,
} from 'react-icons/fi';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

type Preset = '7d' | '30d' | '90d' | 'year' | 'custom';

const emptyData: AdminAnalyticsData = {
  revenue: [],
  completion: { overview: { totalAttempts: 0, completedAttempts: 0, uniqueUsers: 0, completionRate: 0 }, bySubject: [] },
  scoreDistribution: [],
  topWrongQuestions: [],
  examReports: [],
};

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
};

const currency = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const number = (value: number) => Number(value || 0).toLocaleString('vi-VN');

function getPresetRange(preset: Preset): AdminAnalyticsFilters {
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

export default function AdminAnalyticsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<AdminAnalyticsData>(emptyData);
  const [performance, setPerformance] = useState<AdminPerformanceData>(emptyPerformance);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState(getPresetRange('30d').from || '');
  const [to, setTo] = useState(getPresetRange('30d').to || '');
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [exporting, setExporting] = useState<string | null>(null);

  const filters = useMemo<AdminAnalyticsFilters>(() => ({ from, to, granularity }), [from, to, granularity]);

  const canViewFinancial = hasPermission(user, 'admin.super');
  const canViewPerformance = hasAnyPermission(user, ['admin.super', 'exams.manage']);

  const loadAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const [performanceResult, financialResult] = await Promise.all([
        canViewPerformance ? adminAnalyticsApi.getAdminPerformance(nextFilters) : Promise.resolve(emptyPerformance),
        canViewFinancial ? adminAnalyticsApi.getAnalytics(nextFilters) : Promise.resolve(emptyData),
      ]);
      setPerformance(performanceResult);
      setData(financialResult);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPerformance) loadAnalytics();
  }, [canViewPerformance, canViewFinancial]);

  const applyPreset = (value: Preset) => {
    setPreset(value);
    if (value === 'custom') return;
    const range = getPresetRange(value);
    setFrom(range.from || '');
    setTo(range.to || '');
    setGranularity(range.granularity || 'day');
    loadAnalytics(range);
  };

  const exportDataset = async (dataset: 'users' | 'attempts' | 'results' | 'transactions') => {
    try {
      setExporting(dataset);
      await adminAnalyticsApi.downloadExport(dataset, filters);
    } finally {
      setExporting(null);
    }
  };

  const revenueTotal = data.revenue.reduce((sum, item) => sum + item.revenue, 0);
  const transactionTotal = data.revenue.reduce((sum, item) => sum + item.transactions, 0);
  const scoreRows = data.scoreDistribution.map((row) => ({
    subject: row.subjectName,
    ...row.buckets,
  }));

  const financialStatCards = [
    { label: 'Doanh thu VIP', value: currency(revenueTotal), icon: FiTrendingUp, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Giao dịch', value: number(transactionTotal), icon: FiActivity, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Tỉ lệ hoàn thành', value: `${data.completion.overview.completionRate}%`, icon: FiTarget, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Người thi', value: number(data.completion.overview.uniqueUsers), icon: FiUsers, tone: 'bg-amber-50 text-amber-700' },
  ];

  const performanceStatCards = [
    { label: 'Admin theo dõi', value: number(performance.overview.adminsCount), icon: FiUsers, tone: 'bg-indigo-50 text-indigo-700' },
    { label: 'Đề đã tạo', value: number(performance.overview.examsCreated), icon: FiFileText, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Đề đã xuất bản', value: number(performance.overview.publishedExams), icon: FiTarget, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Câu hỏi đã nhập', value: number(performance.overview.questionsCreated), icon: FiBarChart2, tone: 'bg-amber-50 text-amber-700' },
  ];

  if (!canViewPerformance) {
    return (
      <AdminLayout title="Thống kê" description="Báo cáo quản trị">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
          Bạn không có quyền xem báo cáo.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Thống kê quản trị" description="Hiệu suất admin đăng đề, chất lượng đề thi và dữ liệu vận hành">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
          {[
            { key: '7d', label: '7 ngày' },
            { key: '30d', label: '30 ngày' },
            { key: '90d', label: '90 ngày' },
            { key: 'year', label: '12 tháng' },
            { key: 'custom', label: 'Tùy chỉnh' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => applyPreset(item.key as Preset)}
              className={`px-3 py-2 rounded-xl text-sm font-bold ${preset === item.key ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {item.label}
            </button>
          ))}
          <input type="date" value={from} onChange={(e) => { setPreset('custom'); setFrom(e.target.value); }} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          <input type="date" value={to} onChange={(e) => { setPreset('custom'); setTo(e.target.value); }} className="px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as 'day' | 'month')} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
          </select>
          <button onClick={() => loadAnalytics()} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Tải báo cáo
          </button>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {performanceStatCards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}><Icon /></div>
              <p className="text-sm font-semibold text-gray-500 mt-3">{label}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Hiệu suất đăng đề theo thời gian" icon={<FiTrendingUp />}>
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
                <Bar dataKey="softDeletedExams" name="Xóa mềm" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Đề có hiệu quả cao" icon={<FiTarget />}>
            <div className="space-y-3">
              {performance.topExams.slice(0, 8).map((exam) => (
                <div key={exam.examId} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">{exam.examTitle}</p>
                      <p className="text-xs text-gray-500">{exam.subjectName} · {exam.adminName}</p>
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
                  <th className="px-3 py-2 text-right">Điểm TB</th>
                  <th className="px-3 py-2 text-right">Yêu cầu xóa</th>
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
                    <td className="px-3 py-2 text-right">{admin.avgPercentage || 0}%</td>
                    <td className="px-3 py-2 text-right text-amber-700 font-bold">{admin.deleteRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!performance.leaderboard.length && <EmptyText />}
          </div>
        </ChartCard>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Yêu cầu xóa và thùng rác mềm" icon={<FiFileText />}>
            <div className="space-y-3">
              {performance.deletionRequests.map((item) => (
                <div key={`${item.examId}-${item.deleteRequestedAt || item.deletedAt || 'pending'}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-gray-900">#{item.examId} · {item.title}</p>
                      <p className="text-xs text-gray-500">
                        {item.deletionStatus === 'requested' ? `Người yêu cầu: ${item.requestedByName || 'Không rõ'}` : `Người xóa mềm: ${item.deletedByName || 'Không rõ'}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${
                      item.deletionStatus === 'requested' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {item.deletionStatus === 'requested' ? 'Chờ duyệt' : 'Đã xóa mềm'}
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

        {canViewFinancial && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {financialStatCards.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}><Icon /></div>
                  <p className="text-sm font-semibold text-gray-500 mt-3">{label}</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{loading ? '...' : value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Doanh thu VIP theo ngày/tháng" icon={<FiTrendingUp />}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any, name) => name === 'revenue' ? currency(Number(value)) : value} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="transactions" name="Giao dịch" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Phân bố điểm theo môn" icon={<FiBarChart2 />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="0-39" stackId="score" fill="#ef4444" />
                <Bar dataKey="40-59" stackId="score" fill="#f59e0b" />
                <Bar dataKey="60-79" stackId="score" fill="#3b82f6" />
                <Bar dataKey="80-100" stackId="score" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Tỉ lệ hoàn thành theo môn" icon={<FiTarget />}>
            <div className="space-y-3">
              {data.completion.bySubject.map((subject) => (
                <div key={subject.subjectId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-bold text-gray-800">{subject.subjectName}</span>
                    <span className="text-gray-500">{subject.completedAttempts}/{subject.totalAttempts} - {subject.completionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(subject.completionRate, 100)}%` }} />
                  </div>
                </div>
              ))}
              {!data.completion.bySubject.length && <EmptyText />}
            </div>
          </ChartCard>

          <ChartCard title="Export CSV/Excel" icon={<FiDownload />}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'users', label: 'Users' },
                { key: 'attempts', label: 'Attempts' },
                { key: 'results', label: 'Kết quả câu hỏi' },
                { key: 'transactions', label: 'Giao dịch' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => exportDataset(item.key as any)}
                  className="rounded-xl border border-gray-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50 transition-colors"
                >
                  <FiDownload className="text-violet-600" />
                  <p className="mt-2 font-black text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">CSV mở được bằng Excel</p>
                  {exporting === item.key && <p className="text-xs text-violet-600 mt-1">Đang xuất...</p>}
                </button>
              ))}
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Top câu hỏi sai nhiều" icon={<FiFileText />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Câu hỏi</th>
                  <th className="px-3 py-2 text-left">Đề thi</th>
                  <th className="px-3 py-2 text-right">Sai</th>
                  <th className="px-3 py-2 text-right">Tỉ lệ sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.topWrongQuestions.map((q) => (
                  <tr key={q.questionId}>
                    <td className="px-3 py-2 max-w-xl">
                      <p className="font-bold text-gray-900">#{q.questionNumber} - {q.subjectName}</p>
                      <p className="text-gray-500 line-clamp-2">{q.questionText}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{q.examTitle}</td>
                    <td className="px-3 py-2 text-right font-bold text-rose-600">{q.wrongCount}/{q.answeredCount}</td>
                    <td className="px-3 py-2 text-right font-bold">{q.wrongRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.topWrongQuestions.length && <EmptyText />}
          </div>
        </ChartCard>

        <ChartCard title="Báo cáo từng kỳ thi" icon={<FiFileText />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Đề thi</th>
                  <th className="px-3 py-2 text-left">Môn</th>
                  <th className="px-3 py-2 text-right">Thí sinh</th>
                  <th className="px-3 py-2 text-right">Hoàn thành</th>
                  <th className="px-3 py-2 text-right">Điểm TB</th>
                  <th className="px-3 py-2 text-right">Min/Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.examReports.map((exam: ExamReportSummary) => (
                  <tr key={exam.examId}>
                    <td className="px-3 py-2 font-bold text-gray-900">{exam.examTitle}</td>
                    <td className="px-3 py-2 text-gray-600">{exam.subjectName}</td>
                    <td className="px-3 py-2 text-right">{exam.participants}</td>
                    <td className="px-3 py-2 text-right">{exam.completedAttempts}/{exam.totalAttempts} ({exam.completionRate}%)</td>
                    <td className="px-3 py-2 text-right font-bold">{exam.avgPercentage}%</td>
                    <td className="px-3 py-2 text-right text-gray-500">{exam.minPercentage}% / {exam.maxPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.examReports.length && <EmptyText />}
          </div>
        </ChartCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
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

