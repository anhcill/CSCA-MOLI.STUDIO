'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { adminApi, AdminRoleOption } from '@/lib/api/admin';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import {
  FiUsers, FiTrash2, FiChevronLeft, FiChevronRight,
  FiSearch, FiEdit2, FiX, FiCheck, FiStar, FiShield,
  FiEye, FiLock, FiUnlock, FiActivity
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
  is_active?: boolean;
  vip_expires_at?: string | null;
  subscription_tier?: string;
}

interface Pagination { currentPage: number; totalPages: number; totalUsers: number; limit: number; }
interface UserActivity {
  id: number;
  user_id: number;
  action: string;
  metadata: Record<string, any>;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}
interface ActivityPagination { currentPage: number; totalPages: number; totalActivities: number; limit: number; }

const ACTION_LABELS: Record<string, string> = {
  login: 'Đăng nhập', logout: 'Đăng xuất', register: 'Đăng ký',
  google_login: 'Đăng nhập Google', exam_start: 'Bắt đầu thi',
  exam_submit: 'Nộp bài thi', 'admin.change_user_status': 'Đổi trạng thái',
  'admin.delete_user': 'Xóa user',
};
const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-100 text-blue-700', logout: 'bg-gray-100 text-gray-600',
  register: 'bg-green-100 text-green-700', google_login: 'bg-red-100 text-red-700',
  exam_start: 'bg-yellow-100 text-yellow-700', exam_submit: 'bg-purple-100 text-purple-700',
  'admin.change_user_status': 'bg-orange-100 text-orange-700',
  'admin.delete_user': 'bg-red-100 text-red-700',
};

function ActivityLogModal({ user, activities, pagination, loading, onClose, onLoadMore }: {
  user: User; activities: UserActivity[]; pagination: ActivityPagination;
  loading: boolean; onClose: () => void; onLoadMore: (page: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Lịch sử hành vi — {user.full_name}</h2>
              <p className="text-xs text-gray-400">{pagination.totalActivities} hoạt động</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
            <FiX size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Chưa có hoạt động nào</p>
          ) : (
            activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <span className={`mt-0.5 px-2 py-1 rounded-lg text-xs font-semibold shrink-0 ${ACTION_COLORS[a.action] || 'bg-gray-100 text-gray-600'}`}>
                  {ACTION_LABELS[a.action] || a.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium">{a.metadata?.examTitle || a.metadata?.details || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(a.created_at).toLocaleString('vi-VN')}
                    {a.ip_address && ` · ${a.ip_address}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="border-t px-6 py-3 flex justify-center gap-2 flex-shrink-0">
            {pagination.currentPage > 1 && (
              <button onClick={() => onLoadMore(pagination.currentPage - 1)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">←</button>
            )}
            <span className="px-3 py-1.5 text-sm text-gray-500">{pagination.currentPage}/{pagination.totalPages}</span>
            {pagination.currentPage < pagination.totalPages && (
              <button onClick={() => onLoadMore(pagination.currentPage + 1)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">→</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ROLE_OPTIONS: AdminRoleOption[] = [
  { code: 'super_admin', label: 'Admin Tổng', color: 'red' },
  { code: 'user_admin', label: 'User Admin', color: 'blue' },
  { code: 'exam_admin', label: 'Exam Admin', color: 'purple' },
  { code: 'content_admin', label: 'Content Admin', color: 'green' },
  { code: 'forum_admin', label: 'Forum Admin', color: 'orange' },
  { code: 'roadmap_admin', label: 'Roadmap Admin', color: 'cyan' },
];

export default function AdminUsersPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ currentPage: 1, totalPages: 1, totalUsers: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [editingRoles, setEditingRoles] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [activityUser, setActivityUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPagination, setActivityPagination] = useState<ActivityPagination>({ currentPage: 1, totalPages: 1, totalActivities: 0, limit: 20 });

  useEffect(() => {
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!_token && (!isAuthenticated || !hasPermission(user, 'users.manage'))) {
      router.push('/');
      return;
    }
    loadUsers(1);
  }, [isAuthenticated, user, router]);

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers({ page, limit: 20, search: search || undefined });
      setUsers(data.users || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1, totalUsers: 0, limit: 20 });
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    loadUsersWithDelay(q);
  };

  let searchTimeout: ReturnType<typeof setTimeout>;
  const loadUsersWithDelay = (q: string) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadUsers(1), 400);
  };

  const handleToggleStatus = async (u: User) => {
    if (!confirm(`${u.is_active ? 'Khóa' : 'Mở khóa'} tài khoản "${u.full_name}"?`)) return;
    try {
      await adminApi.updateUserStatus(u.id, u.is_active ? 'blocked' : 'active');
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    } catch { alert('Lỗi cập nhật trạng thái'); }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Xóa vĩnh viễn "${u.full_name}"?\nHành động này KHÔNG THỂ hoàn tác.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch { alert('Lỗi xóa user'); }
  };

  const handleViewActivity = async (u: User) => {
    setActivityUser(u);
    setActivityPage(1);
    setActivityLoading(true);
    try {
      const res = await axios.get(`/admin/users/${u.id}/activities`, { params: { page: 1, limit: 20 } });
      setActivities(res.data.data || []);
      setActivityPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalActivities: 0, limit: 20 });
    } catch { setActivities([]); }
    finally { setActivityLoading(false); }
  };

  const handleLoadMoreActivity = async (page: number) => {
    if (!activityUser) return;
    setActivityLoading(true);
    try {
      const res = await axios.get(`/admin/users/${activityUser.id}/activities`, { params: { page, limit: 20 } });
      setActivities(prev => page === 1 ? (res.data.data || []) : [...prev, ...(res.data.data || [])]);
      setActivityPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalActivities: 0, limit: 20 });
      setActivityPage(page);
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  };

  const getRoleColor = (code: string) => {
    const c = ROLE_OPTIONS.find(r => r.code === code);
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-700', blue: 'bg-blue-100 text-blue-700',
      purple: 'bg-purple-100 text-purple-700', green: 'bg-green-100 text-green-700',
      orange: 'bg-orange-100 text-orange-700', cyan: 'bg-cyan-100 text-cyan-700',
    };
    return c?.color ? (colorMap[c.color] || 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-600';
  };

  const getRoleLabel = (code: string) => ROLE_OPTIONS.find(r => r.code === code)?.label || code;

  const openRoleEditor = (u: User) => {
    setEditingRoles(u);
    setSelectedRoles(u.admin_roles || []);
  };

  const handleSaveRoles = async () => {
    if (!editingRoles) return;
    setSavingRoles(true);
    try {
      await adminApi.updateUserAdminRoles(editingRoles.id, selectedRoles);
      setUsers(prev => prev.map(x => x.id === editingRoles.id ? { ...x, admin_roles: selectedRoles } : x));
      setEditingRoles(null);
    } catch { alert('Lỗi cập nhật vai trò'); }
    finally { setSavingRoles(false); }
  };

  const toggleRole = (code: string) => {
    setSelectedRoles(prev =>
      prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]
    );
  };

  return (
    <AdminLayout title="Quản lý Users" description={`${pagination.totalUsers} thành viên`}>
      {/* Search + Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input type="text" placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Tổng: <strong className="text-gray-900">{pagination.totalUsers}</strong></span>
          <span>Đang hoạt động: <strong className="text-green-600">{users.filter(u => u.is_active !== false).length}</strong></span>
          <span>VIP: <strong className="text-amber-600">{users.filter(u => u.is_vip).length}</strong></span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-5 py-3.5">Thành viên</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">VIP</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Ngày tham gia</th>
                <th className="px-5 py-3.5">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={6}>
                      <div className="h-6 bg-gray-100 rounded-lg animate-pulse w-1/2" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-gray-400" colSpan={6}>Không tìm thấy thành viên</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-violet-50/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {u.admin_roles?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {u.admin_roles.map(code => (
                          <span key={code} className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getRoleColor(code)}`}>
                            {getRoleLabel(code)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">User</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u.is_vip ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-bold">
                        {u.subscription_tier === 'vip_pro' ? 'VIP Pro' : u.subscription_tier === 'vip_thong_minh' ? 'VIP TM' : 'VIP'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                      u.is_active !== false
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {u.is_active !== false ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openRoleEditor(u)} title="Sửa vai trò"
                        className="p-2 rounded-lg hover:bg-violet-100 text-gray-500 hover:text-violet-600 transition-colors">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => handleViewActivity(u)} title="Xem hoạt động"
                        className="p-2 rounded-lg hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors">
                        <FiActivity size={14} />
                      </button>
                      <button onClick={() => handleToggleStatus(u)} title={u.is_active !== false ? 'Khóa' : 'Mở khóa'}
                        className="p-2 rounded-lg hover:bg-amber-100 text-gray-500 hover:text-amber-600 transition-colors">
                        {u.is_active !== false ? <FiLock size={14} /> : <FiUnlock size={14} />}
                      </button>
                      <button onClick={() => handleDelete(u)} title="Xóa"
                        className="p-2 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {((pagination.currentPage - 1) * pagination.limit) + 1}–{Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)} / {pagination.totalUsers}
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => loadUsers(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronLeft size={14} />
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-gray-700">{pagination.currentPage}/{pagination.totalPages}</span>
              <button onClick={() => loadUsers(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Editor Modal */}
      {editingRoles && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Sửa vai trò</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingRoles.full_name}</p>
              </div>
              <button onClick={() => setEditingRoles(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {ROLE_OPTIONS.map(opt => (
                <label key={opt.code} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-violet-50 transition-colors has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(opt.code)}
                    onChange={() => toggleRole(opt.code)}
                    className="w-4 h-4 rounded accent-violet-600"
                  />
                  <div className="flex-1">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${getRoleColor(opt.code)}`}>
                      {opt.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setEditingRoles(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleSaveRoles} disabled={savingRoles} className="flex-1 px-4 py-2.5 bg-violet-600 rounded-xl text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {savingRoles ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityUser && (
        <ActivityLogModal
          user={activityUser}
          activities={activities}
          pagination={activityPagination}
          loading={activityLoading}
          onClose={() => setActivityUser(null)}
          onLoadMore={handleLoadMoreActivity}
        />
      )}
    </AdminLayout>
  );
}
