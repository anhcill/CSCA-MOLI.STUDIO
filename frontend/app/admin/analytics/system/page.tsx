'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import {
  adminAnalyticsApi,
  type AdminAnalyticsData,
  type AdminAnalyticsFilters,
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

type Preset = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom';

const emptyData: AdminAnalyticsData = {
  revenue: [],
  completion: {
    overview: { totalAttempts: 0, completedAttempts: 0, uniqueUsers: 0, completionRate: 0 },
    bySubject: [],
  },
  scoreDistribution: [],
  topWrongQuestions: [],
  examReports: [],
};

const currency = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
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

export default function AdminSystemAnalyticsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<AdminAnalyticsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [exporting, setExporting] = useState<string | null>(null);

  const filters = useMemo<AdminAnalyticsFilters>(
    () => ({ from, to, granularity }),
    [from, to, granularity],
  );

  const canViewSystem = hasPermission(user, 'admin.super');

  const loadAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      const result = await adminAnalyticsApi.getAnalytics(nextFilters);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewSystem) loadAnalytics();
  }, [canViewSystem]);

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

  const statCards = [
    { label: 'Doanh thu VIP', value: currency(revenueTotal), icon: FiTrendingUp, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Giao dịch', value: number(transactionTotal), icon: FiActivity, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Tỉ lệ hoàn thành', value: `${data.completion.overview.completionRate}%`, icon: FiTarget, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Người thi', value: number(data.completion.overview.uniqueUsers), icon: FiUsers, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Lượt thi', value: number(data.completion.overview.totalAttempts), icon: FiFileText, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Hoàn thành', value: number(data.completion.overview.completedAttempts), icon: FiBarChart2, tone: 'bg-teal-50 text-teal-700' },
  ];

  if (!canViewSystem) {
    return (
      <AdminLayout title="Thống kê hệ thống" description="Báo cáo vận hành và doanh thu">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Bạn không có quyền xem báo cáo hệ thống.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Thống kê hệ thống" description="Doanh thu, lượt thi, chất lượng câu hỏi và xuất dữ liệu">
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
          <Link href="/admin/analytics" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-violet-300 hover:text-violet-700">
            Xem hiệu suất admin
          </Link>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          {statCards.map(({ label, value, icon: Icon, tone }) => (
            <StatCard key={label} label={label} value={loading ? '...' : value} icon={<Icon />} tone={tone} />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ChartCard title="Doanh thu VIP theo thời gian" icon={<FiTrendingUp />}>
            {data.revenue.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any, name) => name === 'revenue' ? currency(Number(value)) : value} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="transactions" name="Giao dịch" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyText />}
          </ChartCard>

          <ChartCard title="Phân bố điểm theo môn" icon={<FiBarChart2 />}>
            {scoreRows.length ? (
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
            ) : <EmptyText />}
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

          <ChartCard title="Xuất dữ liệu" icon={<FiDownload />}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'users', label: 'Người dùng' },
                { key: 'attempts', label: 'Lượt thi' },
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

        <ChartCard title="Báo cáo từng đề thi" icon={<FiFileText />}>
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
