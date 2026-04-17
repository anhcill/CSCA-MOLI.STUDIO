'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi, AdminRoleOption } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import {
  FiUsers, FiTrash2, FiChevronLeft, FiChevronRight,
  FiSearch, FiEdit2, FiX, FiCheck, FiStar, FiShield
} from 'react-icons/fi';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'student' | 'admin';
  admin_roles?: string[];
  primary_admin_role?: string | null;
  created_at: string;
  total_attempts: number;
  is_vip?: boolean;
  vip_expires_at?: string | null;
  subscription_tier?: string;
}

interface Pagination { currentPage: number; totalPages: number; totalUsers: number; limit: number; }

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [tier, setTier] = useState<'basic' | 'vip' | 'premium'>(
    (user.subscription_tier as any) || (user.is_vip ? 'vip' : 'basic')
  );
  const [vipDays, setVipDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tierLabel = { basic: '🆓 Basic (Miễn phí)', vip: '⭐ VIP', premium: '💎 Premium' };
  const tierColor = { basic: 'border-gray-300', vip: 'border-yellow-400 bg-yellow-50', premium: 'border-purple-400 bg-purple-50' };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.patch(`/admin/users/${user.id}/profile`, {
        full_name: fullName,
        email,
        subscription_tier: tier,
        vip_days: vipDays,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Chỉnh sửa user #{user.id}</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
            <FiX size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{error}</div>
          )}

          {/* Basic Info */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Nhập họ tên..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="email@example.com"
            />
          </div>

          {/* Subscription Tier */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Gói tài khoản</label>
            <div className="grid grid-cols-3 gap-2">
              {(['basic', 'vip', 'premium'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    tier === t
                      ? `${tierColor[t]} border-opacity-100 scale-[1.03]`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {tierLabel[t].split(' ').slice(0, 1).join('')}
                  <br />
                  <span className="font-normal">{tierLabel[t].split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* VIP duration — only when vip/premium */}
          {(tier === 'vip' || tier === 'premium') && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <label className="block text-xs font-semibold text-yellow-700 mb-2">
                ⭐ Thời hạn nâng cấp ({tier === 'premium' ? 'Premium' : 'VIP'})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={vipDays}
                  onChange={e => setVipDays(parseInt(e.target.value) || 30)}
                  className="w-24 px-3 py-2 border border-yellow-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                />
                <span className="text-sm text-yellow-700 font-medium">ngày</span>
                <span className="text-xs text-yellow-600 ml-auto">
                  → hết hạn {new Date(Date.now() + vipDays * 86400000).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {[7, 30, 90, 365].map(d => (
                  <button key={d} onClick={() => setVipDays(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${vipDays === d ? 'bg-yellow-400 text-white' : 'bg-white border border-yellow-200 text-yellow-700 hover:bg-yellow-100'}`}>
                    {d === 365 ? '1 năm' : d < 30 ? `${d}n` : `${d / 30}th`}
                  </button>
                ))}
              </div>
              {user.vip_expires_at && (
                <p className="text-xs text-yellow-600 mt-2">
                  Hiện tại: hết hạn {new Date(user.vip_expires_at).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          )}

          {/* Current status display */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Trạng thái hiện tại:</span>
              <span className={`font-semibold ${user.is_vip ? 'text-yellow-600' : 'text-gray-600'}`}>
                {user.is_vip ? `⭐ VIP (hết ${user.vip_expires_at ? new Date(user.vip_expires_at).toLocaleDateString('vi-VN') : 'N/A'})` : '🆓 Basic'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Lượt thi:</span><span className="font-semibold text-gray-700">{user.total_attempts}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !fullName || !email}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FiCheck size={15} />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ currentPage: 1, totalPages: 1, totalUsers: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleOptions, setRoleOptions] = useState<AdminRoleOption[]>([]);
  const [changingRoleUserId, setChangingRoleUserId] = useState<number | null>(null);
  const [changingTaskUserId, setChangingTaskUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(currentUser, 'users.manage'))) { router.push('/'); return; }
    loadUsers();
    adminApi.getAdminRoleOptions().then(d => setRoleOptions(d.roles || [])).catch(() => {});
  }, [isAuthenticated, currentUser, router, pagination.currentPage]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers(pagination.currentPage, pagination.limit);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Bạn có chắc muốn xóa user này?')) return;
    try { await adminApi.deleteUser(userId); loadUsers(); }
    catch (error: any) { alert(error.response?.data?.message || 'Xóa user thất bại'); }
  };

  const handleChangeRole = async (userId: number, newRole: 'student' | 'admin') => {
    if (!confirm(`Đổi role thành ${newRole}?`)) return;
    try {
      setChangingRoleUserId(userId);
      await adminApi.updateUserRole(userId, newRole);
      loadUsers();
    } catch (error: any) { alert(error.response?.data?.message || 'Đổi role thất bại'); }
    finally { setChangingRoleUserId(null); }
  };

  const handleChangeAdminTasks = async (userId: number, roleCodes: string[]) => {
    if (!confirm('Cập nhật nhiệm vụ admin cho user này?')) return;
    try {
      setChangingTaskUserId(userId);
      await adminApi.updateUserAdminRoles(userId, roleCodes);
      loadUsers();
    } catch (error: any) { alert(error.response?.data?.message || 'Đổi nhiệm vụ admin thất bại'); }
    finally { setChangingTaskUserId(null); }
  };

  const getRoleOptionLabel = (code: string) => {
    return roleOptions.find(opt => opt.code === code)?.name || code;
  };

  const getTierBadge = (user: User) => {
    if (user.subscription_tier === 'premium') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold"><FiShield size={10} />Premium</span>;
    if (user.is_vip || user.subscription_tier === 'vip') return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-semibold"><FiStar size={10} />VIP</span>;
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Basic</span>;
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={loadUsers} />
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Quản lý Users</h1>
              <p className="text-gray-500 mt-0.5 text-sm">Tổng {pagination.totalUsers} người dùng — click ✏️ để chỉnh sửa thông tin & gói tài khoản</p>
            </div>
            <button onClick={() => router.push('/admin')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold text-sm">← Dashboard</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID', 'Tên', 'Email', 'Gói TK', 'Role', 'Nhiệm vụ Admin', 'Lượt thi', 'Ngày tạo', 'Hành động'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">#{user.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{getTierBadge(user)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={e => handleChangeRole(user.id, e.target.value as any)}
                        disabled={user.id === currentUser?.id || changingRoleUserId === user.id}
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'} ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <option value="student">Student</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {user.role !== 'admin' ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="min-w-[220px] space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(user.admin_roles || []).length === 0 ? (
                              <span className="text-xs text-gray-400">Chưa gán</span>
                            ) : (
                              (user.admin_roles || []).map((code) => (
                                <span
                                  key={code}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800"
                                >
                                  {getRoleOptionLabel(code)}
                                </span>
                              ))
                            )}
                          </div>

                          <select
                            multiple
                            value={user.admin_roles || []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                              handleChangeAdminTasks(user.id, selected);
                            }}
                            disabled={user.id === currentUser?.id || changingTaskUserId === user.id}
                            className={`w-full px-2 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            size={Math.min(4, Math.max(2, roleOptions.length))}
                          >
                            {roleOptions.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-center">{user.total_attempts || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa thông tin & gói tài khoản"
                        >
                          <FiEdit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id}
                          className={`p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ${user.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                          title="Xóa user"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {((pagination.currentPage - 1) * pagination.limit) + 1}–{Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)} / {pagination.totalUsers} users
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))} disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronLeft size={16} />
              </button>
              <span className="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-semibold text-sm">{pagination.currentPage}</span>
              <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))} disabled={pagination.currentPage >= pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
