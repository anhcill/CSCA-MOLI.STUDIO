'use client';

import { useEffect, useState } from 'react';
import { adminControlApi, adminApi, AdminUser } from '@/lib/api/admin';
import {
  FiSearch, FiEdit2, FiActivity, FiLock, FiUnlock,
  FiX, FiChevronLeft, FiChevronRight, FiShield, FiEye
} from 'react-icons/fi';

const ROLE_OPTIONS = [
  { code: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-700 border-red-200', desc: 'Toàn quyền truy cập hệ thống' },
  { code: 'user_admin', label: 'User Admin', color: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Quản lý người dùng, phản hồi, VIP' },
  { code: 'exam_admin', label: 'Exam Admin', color: 'bg-purple-100 text-purple-700 border-purple-200', desc: 'Quản lý kho đề thi, số liệu thi' },
  { code: 'content_admin', label: 'Content Admin', color: 'bg-green-100 text-green-700 border-green-200', desc: 'Sửa nội dung học, từ vựng' },
  { code: 'forum_admin', label: 'Forum Admin', color: 'bg-orange-100 text-orange-700 border-orange-200', desc: 'Kiểm duyệt bài viết diễn đàn' },
  { code: 'roadmap_admin', label: 'Roadmap Admin', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', desc: 'Quản lý các trạng thái lộ trình' },
];

type AdminAccessOption = {
  code: string;
  label: string;
  color: string;
  desc: string;
  pages: string[];
  permissions: string[];
};

const ACCESS_OPTIONS: AdminAccessOption[] = [
  {
    code: 'super_admin',
    label: 'Toàn quyền Admin',
    color: 'bg-red-100 text-red-700 border-red-200',
    desc: 'Vào và chỉnh sửa toàn bộ khu vực admin, bao gồm phân quyền admin khác.',
    pages: ['Tất cả trang admin'],
    permissions: ['admin.super', 'system.manage', 'users.manage', 'exams.manage', 'content.manage', 'forum.manage', 'forum.post_as_admin', 'roadmap.manage', 'admin.dashboard.view'],
  },
  {
    code: 'user_admin',
    label: 'Users, VIP, mã giảm giá',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    desc: 'Quản lý tài khoản, VIP, doanh thu và coupon. Không được phân quyền admin khác.',
    pages: ['Users', 'VIP & Doanh thu', 'Mã giảm giá'],
    permissions: ['users.manage', 'admin.dashboard.view'],
  },
  {
    code: 'exam_admin',
    label: 'Đề thi, câu hỏi',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    desc: 'Quản lý đề thi, tạo/sửa đề, câu hỏi, lịch thi và dữ liệu thi.',
    pages: ['Đề thi', 'Tạo đề', 'Câu hỏi', 'Lịch thi'],
    permissions: ['exams.manage', 'admin.dashboard.view'],
  },
  {
    code: 'content_admin',
    label: 'Nội dung học',
    color: 'bg-green-100 text-green-700 border-green-200',
    desc: 'Quản lý tài liệu, từ vựng và kho hình ảnh/media nội dung.',
    pages: ['Tài liệu', 'Từ vựng', 'Hình ảnh'],
    permissions: ['content.manage', 'admin.dashboard.view'],
  },
  {
    code: 'forum_admin',
    label: 'Cộng đồng, báo cáo',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    desc: 'Kiểm duyệt forum, báo cáo, hỏi đáp VIP và đăng bài dưới danh nghĩa admin.',
    pages: ['Forum', 'Báo cáo', 'Hỏi-Đáp VIP'],
    permissions: ['forum.manage', 'forum.post_as_admin', 'admin.dashboard.view'],
  },
  {
    code: 'roadmap_admin',
    label: 'Lộ trình học',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    desc: 'Quản lý các trạng thái, mốc và nội dung lộ trình học.',
    pages: ['Lộ trình'],
    permissions: ['roadmap.manage', 'admin.dashboard.view'],
  },
];

const getRoleBadge = (code: string) => {
  const opt = ACCESS_OPTIONS.find(r => r.code === code) || ROLE_OPTIONS.find(r => r.code === code);
  return opt || { code, label: code, color: 'bg-gray-100 text-gray-600 border-gray-200', desc: '' };
};

const getPermissionsForRoles = (roleCodes: string[]) => {
  const permissionSet = new Set<string>();
  roleCodes.forEach((code) => {
    ACCESS_OPTIONS.find((option) => option.code === code)?.permissions.forEach((permission) => {
      permissionSet.add(permission);
    });
  });
  return Array.from(permissionSet);
};

interface Props {
  onViewLog: (admin: AdminUser) => void;
}

export default function AdminListTab({ onViewLog }: Props) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalAdmins: 0, limit: 20 });
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [permissionsModal, setPermissionsModal] = useState<AdminUser | null>(null);

  useEffect(() => { loadAdmins(1); }, [roleFilter]);

  const loadAdmins = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminControlApi.getAdmins({
        page, limit: 20,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      setAdmins(data.admins || []);
      setPagination(data.pagination);
    } catch { setAdmins([]); }
    finally { setLoading(false); }
  };

  let searchTimer: ReturnType<typeof setTimeout>;
  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadAdmins(1), 400);
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    if (!confirm(`${admin.is_active ? 'Khóa' : 'Mở khóa'} admin "${admin.full_name}"?`)) return;
    try {
      await adminApi.updateUserStatus(admin.id, admin.is_active ? 'blocked' : 'active');
      setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: !a.is_active } : a));
    } catch { alert('Lỗi cập nhật trạng thái'); }
  };

  const openRoleEditor = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setSelectedRoles(admin.admin_roles || []);
  };

  const handleSaveRoles = async () => {
    if (!editingAdmin) return;
    setSavingRoles(true);
    try {
      await adminApi.updateUserAdminRoles(editingAdmin.id, selectedRoles);
      const nextPermissions = getPermissionsForRoles(selectedRoles);
      setAdmins(prev => prev.map(a => a.id === editingAdmin.id
        ? { ...a, admin_roles: selectedRoles, primary_admin_role: selectedRoles[0] || null, permissions: nextPermissions }
        : a
      ));
      setEditingAdmin(null);
    } catch { alert('Lỗi cập nhật vai trò'); }
    finally { setSavingRoles(false); }
  };

  const toggleRole = (code: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(code)) return prev.filter(r => r !== code);
      if (code === 'super_admin') return ['super_admin'];
      return [...prev.filter(r => r !== 'super_admin'), code];
    });
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Chưa hoạt động';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input type="text" placeholder="Tìm admin theo tên, email..."
              value={search} onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-colors" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-colors">
            <option value="">Tất cả vai trò</option>
            {ROLE_OPTIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <div className="flex items-center gap-3 text-sm text-gray-500 ml-auto">
            <span className="px-3 py-2 bg-violet-50 text-violet-700 rounded-xl font-semibold">
              {pagination.totalAdmins} admin
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="px-6 py-4"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-violet-500 rounded-full" />Admin</span></th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Quyền hạn</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Hoạt động</th>
                <th className="px-6 py-4">Thao tác</th>
                <th className="px-6 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td className="px-6 py-5" colSpan={7}>
                    <div className="h-6 bg-gray-100 rounded animate-pulse w-2/3" />
                  </td></tr>
                ))
              ) : admins.length === 0 ? (
                <tr><td className="px-6 py-16 text-center text-gray-400" colSpan={7}>
                  <div className="flex flex-col items-center gap-2">
                    <FiShield size={32} className="opacity-30" />
                    <span>Không tìm thấy admin nào</span>
                  </div>
                </td></tr>
              ) : admins.map(admin => (
                <tr key={admin.id} className="hover:bg-violet-50/40 transition-all duration-200">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-violet-200 shrink-0">
                        {admin.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{admin.full_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1.5">
                      {(admin.admin_roles || []).map(code => {
                        const badge = getRoleBadge(code);
                        return <span key={code} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.color}`}>{badge.label}</span>;
                      })}
                      {(!admin.admin_roles?.length) && <span className="text-xs text-gray-400 italic">Chưa phân vai trò</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <button onClick={() => setPermissionsModal(admin)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 hover:text-violet-800 rounded-lg text-xs font-semibold transition-colors">
                      <FiEye size={13} /> {(admin.permissions || []).length} quyền
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                      admin.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${admin.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {admin.is_active !== false ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm text-gray-600 font-medium">{timeAgo(admin.last_active_at)}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <FiActivity size={11} /> {admin.total_actions} thao tác
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openRoleEditor(admin)} title="Sửa vai trò"
                        className="p-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 hover:text-violet-800 transition-all shadow-sm hover:shadow">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => onViewLog(admin)} title="Xem nhật ký"
                        className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-all shadow-sm hover:shadow">
                        <FiActivity size={15} />
                      </button>
                      <button onClick={() => handleToggleStatus(admin)} title={admin.is_active !== false ? 'Khóa' : 'Mở khóa'}
                        className={`p-2 rounded-xl transition-all shadow-sm hover:shadow ${
                          admin.is_active !== false
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800'
                        }`}>
                        {admin.is_active !== false ? <FiLock size={15} /> : <FiUnlock size={15} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-xs text-gray-400 font-mono">#{admin.id}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Hiển thị <span className="font-semibold text-gray-700">{((pagination.currentPage - 1) * pagination.limit) + 1}–{Math.min(pagination.currentPage * pagination.limit, pagination.totalAdmins)}</span> trong <span className="font-semibold text-gray-700">{pagination.totalAdmins}</span>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => loadAdmins(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-400 transition-all shadow-sm">
                <FiChevronLeft size={16} />
              </button>
              <span className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-bold shadow-sm">{pagination.currentPage} / {pagination.totalPages}</span>
              <button onClick={() => loadAdmins(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-400 transition-all shadow-sm">
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Editor Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-200">
                  {editingAdmin.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Phân quyền Admin</h2>
                  <p className="text-xs text-gray-400">{editingAdmin.full_name}</p>
                </div>
              </div>
              <button onClick={() => setEditingAdmin(null)} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-gray-400 mb-4">Chọn các trang admin mà người dùng này được phép truy cập:</p>
              {ACCESS_OPTIONS.map(opt => (
                <label key={opt.code} className="flex items-start gap-4 p-4 rounded-2xl border-2 border-gray-100 cursor-pointer hover:border-violet-200 hover:bg-violet-50/30 transition-all has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50/50">
                  <input type="checkbox" checked={selectedRoles.includes(opt.code)} onChange={() => toggleRole(opt.code)}
                    className="w-5 h-5 mt-0.5 rounded accent-violet-600" />
                  <div className="flex-1">
                    <span className={`inline-block px-2.5 py-1 mb-2 rounded-lg text-xs font-bold border ${opt.color}`}>{opt.label}</span>
                    <p className="text-xs text-gray-500 leading-relaxed">{opt.desc}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {opt.pages.map(page => (
                        <span key={page} className="px-2 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-medium text-gray-600">
                          {page}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditingAdmin(null)} className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Hủy bỏ</button>
              <button onClick={handleSaveRoles} disabled={savingRoles}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl text-sm font-bold text-white hover:shadow-lg hover:shadow-violet-200 disabled:opacity-50 transition-all">
                {savingRoles ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Detail Modal */}
      {permissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-200">
                  {permissionsModal.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2"><FiShield size={16} className="text-violet-500" /> Chi tiết quyền hạn</h2>
                  <p className="text-xs text-gray-400">{permissionsModal.full_name}</p>
                </div>
              </div>
              <button onClick={() => setPermissionsModal(null)} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vai trò</p>
                <div className="flex flex-wrap gap-2">
                  {(permissionsModal.admin_roles || []).map(code => {
                    const badge = getRoleBadge(code);
                    return <span key={code} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${badge.color}`}>{badge.label}</span>;
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Trang được phép truy cập</p>
                <div className="space-y-2.5">
                  {(() => {
                    const perms = permissionsModal.permissions || [];
                    if (perms.length === 0) return <p className="text-sm text-gray-400 italic">Chưa được phân công quyền truy cập nào</p>;

                    const isSuperAdmin = perms.includes('*') || perms.includes('system.manage');

                    const accessMap: Record<string, { label: string, desc: string }> = {
                      'users.manage': { label: 'Người dùng & VIP', desc: 'Quản lý tài khoản, nâng cấp VIP' },
                      'exams.manage': { label: 'Đề thi & Câu hỏi', desc: 'Quản lý đề, câu hỏi, điểm thi' },
                      'content.manage': { label: 'Từ vựng & Tài liệu', desc: 'Sửa đổi từ vựng, ngữ pháp, tài liệu' },
                      'forum.manage': { label: 'Diễn đàn & Hỏi đáp', desc: 'Kiểm duyệt bài viết, bình luận, QA' },
                      'roadmap.manage': { label: 'Lộ trình học', desc: 'Quản lý các mốc lộ trình, bài học' },
                      'admin.dashboard.view': { label: 'Trang chủ Admin', desc: 'Xem thống kê trên Dashboard' }
                    };

                    const allowedPages = isSuperAdmin
                      ? [{ label: 'Toàn quyền hệ thống', desc: 'Truy cập và sửa đổi tất cả các trang' }]
                      : perms.map(p => accessMap[p]).filter(Boolean);

                    const uniquePages = Array.from(new Set(allowedPages.map(p => p.label)))
                      .map(label => allowedPages.find(p => p.label === label)!);

                    if (uniquePages.length === 0) {
                      return <p className="text-sm text-gray-400 italic">Chỉ có quyền hệ thống hạn chế chưa map giao diện.</p>;
                    }

                    return uniquePages.map((page, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-violet-100">
                        <div className="mt-1 w-2.5 h-2.5 bg-violet-500 rounded-full shrink-0 shadow-sm" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{page.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{page.desc}</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Danh sách quyền</p>
                <div className="flex flex-wrap gap-2">
                  {(permissionsModal.permissions || []).map(perm => (
                    <span key={perm} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-mono font-medium">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
