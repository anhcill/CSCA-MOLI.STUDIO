'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import {
  FiDollarSign, FiUsers, FiActivity, FiSearch, FiCheckCircle,
  FiXCircle, FiClock, FiPlus, FiChevronLeft, FiChevronRight,
  FiEdit2, FiTrash2, FiRefreshCw
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

type Tab = 'users' | 'transactions' | 'packages';
type Filter = 'all' | 'active' | 'expired';
type TxStatus = '' | 'completed' | 'pending' | 'failed';
type PkgStatus = 'active' | 'inactive';

interface VipStats {
  active_vip: number;
  expired_vip: number;
  total_revenue: number;
  last_30d_revenue: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
  last_30d_count: number;
}

interface VipUser {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_vip: boolean;
  vip_expires_at: string | null;
  total_paid: number | null;
  total_transactions: number;
}

interface Transaction {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  amount: number;
  payment_method: string;
  package_duration: number;
  package_name: string;
  transaction_code: string;
  status: 'completed' | 'pending' | 'failed';
  payment_channel: string | null;
  created_at: string;
  paid_at: string | null;
  vip_expires_at: string | null;
}

interface VipPackage {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminVipPage() {
  const { user, isAuthenticated } = useAuthStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('users');

  // ── Stats ──────────────────────────────────────────────
  const [stats, setStats] = useState<VipStats>({
    active_vip: 0, expired_vip: 0, total_revenue: 0,
    last_30d_revenue: 0, completed_count: 0, pending_count: 0,
    failed_count: 0, last_30d_count: 0,
  });

  // ── Users tab ──────────────────────────────────────────
  const [users, setUsers] = useState<VipUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersFilter, setUsersFilter] = useState<Filter>('all');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPagination, setUsersPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 1
  });

  // ── Transactions tab ───────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txStatus, setTxStatus] = useState<TxStatus>('');
  const [txSearch, setTxSearch] = useState('');
  const [txPagination, setTxPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 1
  });

  // ── Packages tab ────────────────────────────────────────
  const [packages, setPackages] = useState<VipPackage[]>([]);
  const [pkgsPage, setPkgsPage] = useState(1);
  const [pkgsPagination, setPkgsPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 1
  });

  // ── Grant modal ───────────────────────────────────────
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantDays, setGrantDays] = useState('30');
  const [grantReason, setGrantReason] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);

  // ── Package edit modal ─────────────────────────────────
  const [editingPkg, setEditingPkg] = useState<VipPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', duration_days: '', price: '', description: '', features: '' });
  const [pkgSaving, setPkgSaving] = useState(false);

  // ── Create package modal ────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', duration_days: '', price: '', description: '', features: '' });
  const [createSaving, setCreateSaving] = useState(false);

  // ── Loading ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    else if (activeTab === 'transactions') loadTransactions();
    else if (activeTab === 'packages') loadPackages();
  }, [activeTab, usersPage, usersFilter, usersSearch, txPage, txStatus, txSearch, pkgsPage]);

  const loadStats = async () => {
    try {
      const res = await axios.get('/admin/vip/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Lỗi load stats', err);
    }
  };

  const loadUsers = async (page = usersPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        filter: usersFilter,
        search: usersSearch,
      });
      const res = await axios.get(`/admin/vip/users?${params}`);
      setUsers(res.data.data);
      setUsersPagination(res.data.pagination);
    } catch (err) {
      console.error('Lỗi load users', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (page = txPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (txStatus) params.set('status', txStatus);
      if (txSearch) params.set('search', txSearch);
      const res = await axios.get(`/admin/vip/transactions?${params}`);
      setTransactions(res.data.data);
      setTxPagination(res.data.pagination);
    } catch (err) {
      console.error('Lỗi load transactions', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPackages = async (page = pkgsPage) => {
    setLoading(true);
    try {
      const res = await axios.get('/vip/packages');
      setPackages(res.data.data || []);
    } catch (err) {
      console.error('Lỗi load packages', err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeVip = async (uId: number) => {
    if (!confirm('Chắc chắn thu hồi VIP của user này?')) return;
    try {
      await axios.post(`/admin/vip/users/${uId}/revoke`);
      loadStats();
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi thu hồi VIP');
    }
  };

  const handleGrantVip = async () => {
    if (!grantUserId || !grantDays) return alert('Vui lòng nhập đầy đủ thông tin');
    setGrantLoading(true);
    try {
      await axios.post(`/admin/vip/users/${grantUserId}/grant`, {
        durationDays: parseInt(grantDays),
        reason: grantReason,
      });
      setShowGrantModal(false);
      setGrantUserId('');
      setGrantDays('30');
      setGrantReason('');
      loadStats();
      loadUsers();
      alert('Cấp VIP thành công!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cấp VIP');
    } finally {
      setGrantLoading(false);
    }
  };

  const handleTogglePackage = async (pkg: VipPackage) => {
    try {
      await axios.put(`/vip/packages/${pkg.id}`, { is_active: !pkg.is_active });
      loadPackages();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleDeletePackage = async (pkg: VipPackage) => {
    if (!confirm(`Xóa gói "${pkg.name}"?`)) return;
    try {
      await axios.delete(`/vip/packages/${pkg.id}`);
      loadPackages();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi xóa gói');
    }
  };

  const openEditPkg = (pkg: VipPackage) => {
    setEditingPkg(pkg);
    setPkgForm({
      name: pkg.name,
      duration_days: String(pkg.duration_days),
      price: String(pkg.price),
      description: pkg.description || '',
      features: (pkg.features || []).join('\n'),
    });
  };

  const handleSavePkg = async () => {
    if (!pkgForm.name || !pkgForm.duration_days || !pkgForm.price) return alert('Điền đầy đủ các trường bắt buộc');
    setPkgSaving(true);
    try {
      const features = pkgForm.features.split('\n').map(f => f.trim()).filter(Boolean);
      await axios.put(`/vip/packages/${editingPkg!.id}`, {
        name: pkgForm.name,
        duration_days: parseInt(pkgForm.duration_days),
        price: parseInt(pkgForm.price),
        description: pkgForm.description,
        features,
      });
      setEditingPkg(null);
      loadPackages();
      alert('Đã cập nhật gói VIP!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật');
    } finally {
      setPkgSaving(false);
    }
  };

  const handleCreatePkg = async () => {
    if (!createForm.name || !createForm.duration_days || !createForm.price) return alert('Điền đầy đủ các trường bắt buộc');
    setCreateSaving(true);
    try {
      const features = createForm.features.split('\n').map(f => f.trim()).filter(Boolean);
      await axios.post('/vip/packages', {
        name: createForm.name,
        duration_days: parseInt(createForm.duration_days),
        price: parseInt(createForm.price),
        description: createForm.description,
        features,
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', duration_days: '', price: '', description: '', features: '' });
      loadPackages();
      alert('Đã tạo gói VIP!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi tạo gói');
    } finally {
      setCreateSaving(false);
    }
  };

  const renderPageNav = (
    currentPage: number,
    totalPages: number,
    onChange: (p: number) => void
  ) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 py-3 border-t">
        <button
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
          className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
          <FiChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-500 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onChange(currentPage + 1)}
          className="p-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
          <FiChevronRight size={16} />
        </button>
      </div>
    );
  };

  const fmtCurrency = (n: number | string | null | undefined) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Danh sách VIP' },
    { id: 'transactions', label: 'Lịch sử giao dịch' },
    { id: 'packages', label: 'Quản lý gói VIP' },
  ];

  return (
    <AdminLayout
      title="VIP & Doanh thu"
      description="Quản lý thành viên VIP, giao dịch và cấu hình gói dịch vụ"
    >
      <div className="space-y-5">

        {/* ── Stats Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white mb-3">
              <FaCrown size={16} />
            </div>
            <p className="text-sm text-gray-500 font-medium">VIP Đang hoạt động</p>
            <p className="text-3xl font-black text-gray-900 mt-1">
              {stats.active_vip?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white mb-3">
              <FiDollarSign size={16} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Tổng doanh thu</p>
            <p className="text-2xl font-black text-gray-900 mt-1">
              {fmtCurrency(stats.total_revenue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white mb-3">
              <FiActivity size={16} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Doanh thu 30 ngày</p>
            <p className="text-2xl font-black text-gray-900 mt-1">
              {fmtCurrency(stats.last_30d_revenue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white mb-3">
              <FiCheckCircle size={16} />
            </div>
            <p className="text-sm text-gray-500 font-medium">Giao dịch thành công</p>
            <p className="text-3xl font-black text-gray-900 mt-1">
              {stats.completed_count?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* ── Action bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setShowGrantModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-yellow-500/25 transition-all text-sm">
            <FaCrown size={14} />
            Cấp VIP thủ công
          </button>
          <button
            onClick={loadStats}
            className="inline-flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors">
            <FiRefreshCw size={14} />
            Làm mới
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-violet-600 border-violet-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── Tab: VIP Users ───────────────────────────────── */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm theo email hoặc tên..."
                      value={usersSearch}
                      onChange={e => { setUsersSearch(e.target.value); setUsersPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  </div>
                  <select
                    value={usersFilter}
                    onChange={e => { setUsersFilter(e.target.value as Filter); setUsersPage(1); }}
                    className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                    <option value="all">Tất cả</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="expired">Hết hạn</option>
                  </select>
                  <button
                    onClick={() => loadUsers(1)}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    Tìm kiếm
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-3 font-semibold text-gray-600">#</th>
                        <th className="p-3 font-semibold text-gray-600">User</th>
                        <th className="p-3 font-semibold text-gray-600">Trạng thái</th>
                        <th className="p-3 font-semibold text-gray-600">Ngày hết hạn</th>
                        <th className="p-3 font-semibold text-gray-600">Chi tiêu</th>
                        <th className="p-3 font-semibold text-gray-600 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(6)].map((_, j) => (
                              <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : users.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-400">Chưa có dữ liệu</td></tr>
                      ) : (
                        users.map(u => {
                          const isExpired = u.vip_expires_at && new Date(u.vip_expires_at) < new Date();
                          return (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3 font-mono text-xs text-gray-400">#{u.id}</td>
                              <td className="p-3">
                                <div className="font-bold text-gray-900">{u.full_name || '—'}</div>
                                <div className="text-gray-400 text-xs">{u.email}</div>
                              </td>
                              <td className="p-3">
                                {u.is_vip ? (
                                  isExpired ? (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">Hết hạn</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold flex items-center gap-1 w-max">
                                      <FaCrown size={10} /> Active
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Không VIP</span>
                                )}
                              </td>
                              <td className="p-3 text-gray-600">{fmtDate(u.vip_expires_at)}</td>
                              <td className="p-3 font-bold text-emerald-600">{fmtCurrency(u.total_paid)}</td>
                              <td className="p-3 text-right">
                                {u.is_vip && !isExpired && (
                                  <button
                                    onClick={() => handleRevokeVip(u.id)}
                                    className="px-3 py-1 text-red-500 hover:bg-red-50 hover:text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors">
                                    Thu hồi
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPageNav(usersPagination.page, usersPagination.totalPages, p => {
                  setUsersPage(p);
                  loadUsers(p);
                })}
              </div>
            )}

            {/* ── Tab: Transactions ─────────────────────────────── */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm theo email, mã GD..."
                      value={txSearch}
                      onChange={e => { setTxSearch(e.target.value); setTxPage(1); }}
                      className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  </div>
                  <select
                    value={txStatus}
                    onChange={e => { setTxStatus(e.target.value as TxStatus); setTxPage(1); }}
                    className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                    <option value="">Tất cả</option>
                    <option value="completed">Thành công</option>
                    <option value="pending">Chờ thanh toán</option>
                    <option value="failed">Thất bại</option>
                  </select>
                  <button
                    onClick={() => loadTransactions(1)}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors">
                    Tìm kiếm
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="p-3 font-semibold text-gray-600">Thời gian</th>
                        <th className="p-3 font-semibold text-gray-600">Mã GD</th>
                        <th className="p-3 font-semibold text-gray-600">User</th>
                        <th className="p-3 font-semibold text-gray-600">Gói</th>
                        <th className="p-3 font-semibold text-gray-600">Số tiền</th>
                        <th className="p-3 font-semibold text-gray-600">Phương thức</th>
                        <th className="p-3 font-semibold text-gray-600">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(7)].map((_, j) => (
                              <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                            ))}
                          </tr>
                        ))
                      ) : transactions.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">Chưa có giao dịch nào</td></tr>
                      ) : (
                        transactions.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                            <td className="p-3 font-mono text-xs text-gray-400">{t.transaction_code}</td>
                            <td className="p-3 font-semibold text-gray-900">{t.full_name || t.email || `#${t.user_id}`}</td>
                            <td className="p-3 text-gray-600">{t.package_duration} ngày — {t.package_name}</td>
                            <td className="p-3 font-bold text-gray-900">{fmtCurrency(t.amount)}</td>
                            <td className="p-3">
                              <span className="uppercase text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                {t.payment_method}
                              </span>
                            </td>
                            <td className="p-3">
                              {t.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                                  <FiCheckCircle size={12} /> Thành công
                                </span>
                              ) : t.status === 'failed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold">
                                  <FiXCircle size={12} /> Thất bại
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold">
                                  <FiClock size={12} /> Chờ thanh toán
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPageNav(txPagination.page, txPagination.totalPages, p => {
                  setTxPage(p);
                  loadTransactions(p);
                })}
              </div>
            )}

            {/* ── Tab: Packages ────────────────────────────────── */}
            {activeTab === 'packages' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Cấu hình các gói VIP hiển thị cho người dùng
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
                    <FiPlus size={14} />
                    Thêm gói mới
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
                    ))
                  ) : packages.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <FaCrown size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Chưa có gói VIP nào</p>
                    </div>
                  ) : (
                    packages.map(pkg => (
                      <div key={pkg.id} className={`bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border p-5 ${pkg.is_active ? 'border-violet-200' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FaCrown className={pkg.is_active ? 'text-yellow-500' : 'text-gray-400'} size={18} />
                            <h4 className="font-bold text-gray-900">{pkg.name}</h4>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pkg.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                            {pkg.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-2xl font-black text-violet-600 mb-1">{fmtCurrency(pkg.price)}</p>
                        <p className="text-xs text-gray-500 mb-3">{pkg.duration_days} ngày</p>
                        {pkg.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{pkg.description}</p>
                        )}
                        {pkg.features?.length > 0 && (
                          <ul className="space-y-1 mb-4">
                            {pkg.features.slice(0, 3).map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <FiCheckCircle className="text-emerald-500 shrink-0" size={12} />
                                {f}
                              </li>
                            ))}
                            {pkg.features.length > 3 && (
                              <li className="text-xs text-gray-400">+{pkg.features.length - 3} tính năng khác</li>
                            )}
                          </ul>
                        )}
                        <div className="flex gap-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={() => openEditPkg(pkg)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                            <FiEdit2 size={12} /> Sửa
                          </button>
                          <button
                            onClick={() => handleTogglePackage(pkg)}
                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              pkg.is_active
                                ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            }`}>
                            {pkg.is_active ? 'Tắt' : 'Bật'}
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg)}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Grant VIP Modal ──────────────────────────────────── */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <FaCrown className="text-yellow-500" /> Cấp VIP Thủ công
              </h2>
              <button onClick={() => setShowGrantModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">User ID *</label>
                <input
                  type="number"
                  value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value)}
                  placeholder="VD: 5"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Thời hạn (Ngày) *</label>
                <input
                  type="number"
                  value={grantDays}
                  onChange={e => setGrantDays(e.target.value)}
                  placeholder="30"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Lý do</label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={e => setGrantReason(e.target.value)}
                  placeholder="Event tặng thưởng..."
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 px-4 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors text-sm">
                Hủy
              </button>
              <button
                onClick={handleGrantVip}
                disabled={grantLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded-xl shadow transition-all text-sm disabled:opacity-60">
                {grantLoading ? 'Đang xử lý...' : 'Xác nhận cấp VIP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Package Modal ───────────────────────────────── */}
      {editingPkg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Sửa gói VIP</h2>
              <button onClick={() => setEditingPkg(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên gói *</label>
                <input type="text" value={pkgForm.name} onChange={e => setPkgForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Số ngày *</label>
                  <input type="number" value={pkgForm.duration_days} onChange={e => setPkgForm(f => ({ ...f, duration_days: e.target.value }))}
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Giá (VNĐ) *</label>
                  <input type="number" value={pkgForm.price} onChange={e => setPkgForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả</label>
                <textarea value={pkgForm.description} onChange={e => setPkgForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tính năng (mỗi dòng 1 item)</label>
                <textarea value={pkgForm.features} onChange={e => setPkgForm(f => ({ ...f, features: e.target.value }))}
                  rows={4}
                  placeholder="Truy cập đề thi premium&#10;Giải đề chi tiết&#10;Hỗ trợ ưu tiên"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingPkg(null)}
                className="flex-1 px-4 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors text-sm">Hủy</button>
              <button onClick={handleSavePkg} disabled={pkgSaving}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-60">
                {pkgSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Package Modal ──────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Thêm gói VIP mới</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên gói *</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Gói Xem"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Số ngày *</label>
                  <input type="number" value={createForm.duration_days} onChange={e => setCreateForm(f => ({ ...f, duration_days: e.target.value }))}
                    placeholder="30"
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Giá (VNĐ) *</label>
                  <input type="number" value={createForm.price} onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="199000"
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tính năng (mỗi dòng 1 item)</label>
                <textarea value={createForm.features} onChange={e => setCreateForm(f => ({ ...f, features: e.target.value }))}
                  rows={4}
                  placeholder="Truy cập đề thi premium&#10;Giải đề chi tiết&#10;Hỗ trợ ưu tiên"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors text-sm">Hủy</button>
              <button onClick={handleCreatePkg} disabled={createSaving}
                className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-60">
                {createSaving ? 'Đang tạo...' : 'Tạo gói VIP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
