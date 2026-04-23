'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import axios from '@/lib/utils/axios';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { useRouter } from 'next/navigation';
import {
  FiGift, FiPlus, FiEdit2, FiTrash2, FiSearch, FiRefreshCw,
  FiPercent, FiDollarSign, FiUsers, FiActivity, FiChevronLeft,
  FiChevronRight, FiX, FiCheck, FiAlertCircle, FiClock, FiTag
} from 'react-icons/fi';

type Tab = 'list' | 'form';
type Filter = 'all' | 'active' | 'expired';

interface CouponStats {
  total_coupons: number;
  active_coupons: number;
  total_discount_given: number;
  total_usages: number;
  last_30d_usages: number;
  last_30d_discount: number;
}

interface Coupon {
  id: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  user_limit: number;
  remaining_uses: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  applicable_packages: string[] | null;
  applicable_tiers: string[] | null;
  created_by_name: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CreateForm {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  max_uses: string;
  user_limit: string;
  valid_from: string;
  valid_until: string;
  applicable_tiers: string[];
}

export default function AdminCouponsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [stats, setStats] = useState<CouponStats | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('list');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Create form
  const [form, setForm] = useState<CreateForm>({
    code: '', description: '',
    discount_type: 'percentage', discount_value: '',
    min_order_amount: '', max_uses: '', user_limit: '1',
    valid_from: '', valid_until: '',
    applicable_tiers: ['all'],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Permissions check ──────────────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!token && (!isAuthenticated || !hasPermission(user, 'users.manage'))) {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // ── Load data ────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await axios.get('/admin/coupons/stats');
      setStats(res.data.data);
    } catch (err) {
      console.error('Error loading stats', err);
    }
  };

  const loadCoupons = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('active', filter);
      const res = await axios.get(`/admin/coupons?${params}`);
      setCoupons(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error loading coupons', err);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadCoupons();
  }, []);

  const handleSearch = () => {
    setPagination(p => ({ ...p, page: 1 }));
    loadCoupons(1);
  };

  const handlePageChange = (page: number) => {
    setPagination(p => ({ ...p, page }));
    loadCoupons(page);
  };

  // ── Create coupon ────────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError('');
    if (!form.code || !form.discount_value) {
      setFormError('Mã coupon và giá trị giảm là bắt buộc');
      return;
    }
    if (form.discount_type === 'percentage' && (parseInt(form.discount_value) < 1 || parseInt(form.discount_value) > 100)) {
      setFormError('Phần trăm giảm phải từ 1 đến 100');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: parseInt(form.discount_value),
        min_order_amount: form.min_order_amount ? parseInt(form.min_order_amount) : 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        user_limit: parseInt(form.user_limit) || 1,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        is_active: true,
        applicable_tiers: form.applicable_tiers,
      };
      await axios.post('/admin/coupons', payload);
      setTab('list');
      setEditingCoupon(null);
      setForm({
        code: '', description: '',
        discount_type: 'percentage', discount_value: '',
        min_order_amount: '', max_uses: '', user_limit: '1',
        valid_from: '', valid_until: '',
        applicable_tiers: ['all'],
      });
      loadStats();
      loadCoupons();
      alert('Tạo mã giảm giá thành công!');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi tạo coupon');
    } finally {
      setSaving(false);
    }
  };

  // ── Update coupon ────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!editingCoupon) return;
    setFormError('');
    if (!form.code || !form.discount_value) {
      setFormError('Mã coupon và giá trị giảm là bắt buộc');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: parseInt(form.discount_value),
        min_order_amount: form.min_order_amount ? parseInt(form.min_order_amount) : 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        user_limit: parseInt(form.user_limit) || 1,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        applicable_tiers: form.applicable_tiers,
      };
      await axios.put(`/admin/coupons/${editingCoupon.id}`, payload);
      setTab('list');
      setEditingCoupon(null);
      setForm({
        code: '', description: '',
        discount_type: 'percentage', discount_value: '',
        min_order_amount: '', max_uses: '', user_limit: '1',
        valid_from: '', valid_until: '',
        applicable_tiers: ['all'],
      });
      loadStats();
      loadCoupons(pagination.page);
      alert('Cập nhật thành công!');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setTab('form');
    setForm({
      code: c.code,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order_amount: String(c.min_order_amount || ''),
      max_uses: c.max_uses !== null ? String(c.max_uses) : '',
      user_limit: String(c.user_limit),
      valid_from: c.valid_from ? c.valid_from.split('T')[0] : '',
      valid_until: c.valid_until ? c.valid_until.split('T')[0] : '',
      applicable_tiers: c.applicable_tiers || ['all'],
    });
  };

  const handleToggleActive = async (c: Coupon) => {
    try {
      await axios.put(`/admin/coupons/${c.id}`, { is_active: !c.is_active });
      loadStats();
      loadCoupons(pagination.page);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Xóa mã "${c.code}"?`)) return;
    try {
      await axios.delete(`/admin/coupons/${c.id}`);
      loadStats();
      loadCoupons(pagination.page);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi xóa');
    }
  };

  const fmtCurrency = (n: number) => `${(n || 0).toLocaleString('vi-VN')} đ`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  const isExpired = (c: Coupon) =>
    (c.valid_until && new Date(c.valid_until) < new Date()) ||
    (c.max_uses !== null && c.used_count >= c.max_uses);

  return (
    <AdminLayout
      title="Mã Giảm Giá"
      description="Quản lý mã coupon giảm giá cho gói VIP"
    >
      <div className="space-y-5">

        {/* ── Stats ─────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-violet-100">
                  <FiTag className="text-violet-600" size={16} />
                </div>
                <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                  {stats.active_coupons} đang hoạt động
                </span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stats.total_coupons}</p>
              <p className="text-xs text-gray-500 mt-1">Tổng mã đã tạo</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-100">
                  <FiActivity className="text-emerald-600" size={16} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  30 ngày
                </span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stats.last_30d_usages}</p>
              <p className="text-xs text-gray-500 mt-1">Lượt sử dụng gần đây</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-amber-100">
                  <FiPercent className="text-amber-600" size={16} />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900">{fmtCurrency(stats.last_30d_discount)}</p>
              <p className="text-xs text-gray-500 mt-1">Tổng giảm giá (30 ngày)</p>
            </div>
          </div>
        )}

        {/* ── Action bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTab('list'); setEditingCoupon(null); setForm({
                code: '', description: '',
                discount_type: 'percentage', discount_value: '',
                min_order_amount: '', max_uses: '', user_limit: '1',
                valid_from: '', valid_until: '',
                applicable_tiers: ['all'],
              }); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'list' ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Danh sách
            </button>
            <button
              onClick={() => { setTab('form'); setEditingCoupon(null); setForm({
                code: '', description: '',
                discount_type: 'percentage', discount_value: '',
                min_order_amount: '', max_uses: '', user_limit: '1',
                valid_from: '', valid_until: '',
                applicable_tiers: ['all'],
              }); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === 'form' && !editingCoupon ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiPlus size={14} className="inline mr-1" /> Tạo mã mới
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadStats(); loadCoupons(pagination.page); }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Làm mới">
              <FiRefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* ── List Tab ──────────────────────────────────────────── */}
        {tab === 'list' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Search */}
            <div className="p-4 flex flex-wrap items-center gap-3 border-b">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm theo mã, mô tả..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>
              <select
                value={filter}
                onChange={e => { setFilter(e.target.value as Filter); setPagination(p => ({ ...p, page: 1 })); loadCoupons(1); }}
                className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none">
                <option value="all">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="expired">Hết hạn</option>
              </select>
              <button onClick={handleSearch}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors">
                Tìm kiếm
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 font-semibold text-gray-600">Mã</th>
                    <th className="p-3 font-semibold text-gray-600">Loại giảm</th>
                    <th className="p-3 font-semibold text-gray-600">Số lần dùng</th>
                    <th className="p-3 font-semibold text-gray-600">Hiệu lực</th>
                    <th className="p-3 font-semibold text-gray-600">Cấp bậc</th>
                    <th className="p-3 font-semibold text-gray-600">Trạng thái</th>
                    <th className="p-3 font-semibold text-gray-600 text-right">Hành động</th>
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
                  ) : coupons.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-gray-400">
                      <FiGift size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Chưa có mã giảm giá nào</p>
                    </td></tr>
                  ) : coupons.map(c => {
                    const expired = isExpired(c);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="font-mono font-bold text-gray-900 text-base">{c.code}</div>
                          {c.description && <div className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">{c.description}</div>}
                        </td>
                        <td className="p-3">
                          {c.discount_type === 'percentage' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold">
                              <FiPercent size={11} /> {c.discount_value}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                              <FiDollarSign size={11} /> {c.discount_value.toLocaleString('vi-VN')}đ
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          <span className="font-bold text-gray-900">{c.used_count}</span>
                          {c.max_uses !== null && (
                            <span className="text-gray-400"> / {c.max_uses}</span>
                          )}
                          {c.user_limit > 1 && (
                            <div className="text-xs text-gray-400">mỗi user: {c.user_limit}x</div>
                          )}
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          <div>Từ: {fmtDate(c.valid_from)}</div>
                          <div>Đến: {fmtDate(c.valid_until)}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-semibold">
                            {(c.applicable_tiers || ['all']).join(', ')}
                          </span>
                        </td>
                        <td className="p-3">
                          {!c.is_active ? (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">Tắt</span>
                          ) : expired ? (
                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 w-max">
                              <FiAlertCircle size={11} /> Hết hạn
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 w-max">
                              <FiCheck size={11} /> Hoạt động
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(c)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Sửa">
                              <FiEdit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(c)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                c.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={c.is_active ? 'Tắt' : 'Bật'}>
                              {c.is_active ? <FiX size={15} /> : <FiCheck size={15} />}
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Xóa">
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Hiển thị {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} trong {pagination.total} mã
                </div>
                <div className="flex gap-2">
                  <button disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <FiChevronLeft size={16} />
                  </button>
                  <span className="px-4 py-1.5 bg-violet-600 text-white rounded-lg font-semibold text-sm">
                    {pagination.page}
                  </span>
                  <button disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    className="px-3 py-1.5 border rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <FiChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Create / Edit Form ─────────────────────────────────── */}
        {(tab === 'form' || editingCoupon) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <FiPlus size={18} className="text-violet-600" />
              {editingCoupon ? `Sửa mã: ${editingCoupon.code}` : 'Tạo mã giảm giá mới'}
            </h3>

            {formError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                <FiAlertCircle size={16} />
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Mã coupon */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Mã coupon <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                  placeholder="VD: SUMMER2025, GIAM50K"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono uppercase" />
                <p className="text-xs text-gray-400 mt-1">Chỉ chứa chữ cái và số, tự động viết hoa</p>
              </div>

              {/* Loại giảm */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loại giảm giá <span className="text-red-500">*</span></label>
                <div className="flex gap-3">
                  {(['percentage', 'fixed'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, discount_type: t }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        form.discount_type === t
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {t === 'percentage' ? <><FiPercent size={14} /> Phần trăm</> : <><FiDollarSign size={14} /> Cố định</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Giá trị giảm */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Giá trị giảm <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percentage' ? 'VD: 20' : 'VD: 50000'}
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">
                    {form.discount_type === 'percentage' ? '%' : 'đ'}
                  </span>
                </div>
              </div>

              {/* Đơn hàng tối thiểu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Đơn hàng tối thiểu (đ)</label>
                <input
                  type="number"
                  value={form.min_order_amount}
                  onChange={e => setForm(f => ({ ...f, min_order_amount: e.target.value }))}
                  placeholder="0 = không giới hạn"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>

              {/* Số lần dùng tối đa */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tổng lượt dùng tối đa</label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Để trống = không giới hạn"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>

              {/* Mỗi user dùng mấy lần */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mỗi user dùng tối đa</label>
                <input
                  type="number"
                  value={form.user_limit}
                  onChange={e => setForm(f => ({ ...f, user_limit: e.target.value }))}
                  min="1"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
              </div>

              {/* Hiệu lực */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Thời gian hiệu lực</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
                    <input
                      type="datetime-local"
                      value={form.valid_from}
                      onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                      className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
                    <input
                      type="datetime-local"
                      value={form.valid_until}
                      onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                      className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* Áp dụng cho cấp bậc */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Áp dụng cho cấp bậc</label>
                <div className="flex flex-wrap gap-2">
                  {[['all', 'Tất cả'], ['vip', 'VIP'], ['premium', 'Premium']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setForm(f => ({ ...f, applicable_tiers: [val as string] }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.applicable_tiers.includes(val)
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mô tả */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="VD: Giảm 20% nhân dịp mùa hè..."
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-5 border-t">
              {editingCoupon && (
                <button
                  onClick={() => { setEditingCoupon(null); setForm({
                    code: '', description: '',
                    discount_type: 'percentage', discount_value: '',
                    min_order_amount: '', max_uses: '', user_limit: '1',
                    valid_from: '', valid_until: '',
                    applicable_tiers: ['all'],
                  }); }}
                  className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors text-sm">
                  Hủy sửa
                </button>
              )}
              <button
                onClick={editingCoupon ? handleUpdate : handleCreate}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold rounded-xl shadow-lg shadow-violet-500/25 transition-all text-sm disabled:opacity-60">
                {saving ? 'Đang lưu...' : (editingCoupon ? 'Lưu thay đổi' : 'Tạo mã giảm giá')}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
