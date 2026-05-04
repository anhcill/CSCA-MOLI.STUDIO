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

const getRoleBadge = (code: string) => {
  const opt = ROLE_OPTIONS.find(r => r.code === code);
  return opt || { code, label: code, color: 'bg-gray-100 text-gray-600 border-gray-200', desc: '' };
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
      setAdmins(prev => prev.map(a => a.id === editingAdmin.id
        ? { ...a, admin_roles: selectedRoles, primary_admin_role: selectedRoles[0] || null }
        : a
      ));
      setEditingAdmin(null);
    } catch { alert('Lỗi cập nhật vai trò'); }
    finally { setSavingRoles(false); }
  };

  const toggleRole = (code: string) => {
    setSelectedRoles(prev => prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]);
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input type="text" placeholder="Tìm admin theo tên, email..."
            value={search} onChange={e => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
          <option value="">Tất cả vai trò</option>
          {ROLE_OPTIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <div className="flex items-center gap-3 text-sm text-gray-500 ml-auto">
          <span>Tổng: <strong className="text-gray-900">{pagination.totalAdmins}</strong> admin</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-5 py-3.5">Admin</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Quyền hạn</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Hoạt động gần đây</th>
                <th className="px-5 py-3.5">Thao tác (30d)</th>
                <th className="px-5 py-3.5">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td className="px-5 py-4" colSpan={7}>
                    <div className="h-6 bg-gray-100 rounded-lg animate-pulse w-2/3" />
                  </td></tr>
                ))
              ) : admins.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-gray-400" colSpan={7}>Không tìm thấy admin nào</td></tr>
              ) : admins.map(admin => (
                <tr key={admin.id} className="hover:bg-violet-50/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {admin.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{admin.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(admin.admin_roles || []).map(code => {
                        const badge = getRoleBadge(code);
                        return <span key={code} className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${badge.color}`}>{badge.label}</span>;
                      })}
                      {(!admin.admin_roles?.length) && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => setPermissionsModal(admin)}
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium">
                      <FiEye size={12} /> {(admin.permissions || []).length} quyền
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                      admin.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {admin.is_active !== false ? 'Hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-gray-600">{timeAgo(admin.last_active_at)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold">
                      <FiActivity size={12} /> {admin.total_actions}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openRoleEditor(admin)} title="Sửa vai trò"
                        className="p-2 rounded-lg hover:bg-violet-100 text-gray-500 hover:text-violet-600 transition-colors">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => onViewLog(admin)} title="Xem nhật ký"
                        className="p-2 rounded-lg hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-colors">
                        <FiActivity size={14} />
                      </button>
                      <button onClick={() => handleToggleStatus(admin)} title={admin.is_active !== false ? 'Khóa' : 'Mở khóa'}
                        className="p-2 rounded-lg hover:bg-amber-100 text-gray-500 hover:text-amber-600 transition-colors">
                        {admin.is_active !== false ? <FiLock size={14} /> : <FiUnlock size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 border-t bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {((pagination.currentPage - 1) * pagination.limit) + 1}–{Math.min(pagination.currentPage * pagination.limit, pagination.totalAdmins)} / {pagination.totalAdmins}
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => loadAdmins(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 transition-colors">
                <FiChevronLeft size={14} />
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-gray-700">{pagination.currentPage}/{pagination.totalPages}</span>
              <button onClick={() => loadAdmins(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-40 transition-colors">
                <FiChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Editor Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Sửa vai trò Admin</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingAdmin.full_name} · {editingAdmin.email}</p>
              </div>
              <button onClick={() => setEditingAdmin(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><FiX size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {ROLE_OPTIONS.map(opt => (
                <label key={opt.code} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-violet-50 transition-colors has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50">
                  <input type="checkbox" checked={selectedRoles.includes(opt.code)} onChange={() => toggleRole(opt.code)}
                    className="w-4 h-4 mt-0.5 rounded accent-violet-600" />
                  <div className="flex-1">
                    <span className={`inline-block px-2 py-0.5 mb-1 rounded-md text-xs font-semibold border ${opt.color}`}>{opt.label}</span>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setEditingAdmin(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
              <button onClick={handleSaveRoles} disabled={savingRoles}
                className="flex-1 px-4 py-2.5 bg-violet-600 rounded-xl text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {savingRoles ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Detail Modal */}
      {permissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><FiShield size={16} /> Chi tiết quyền hạn & Truy cập</h2>
                <p className="text-xs text-gray-400 mt-0.5">{permissionsModal.full_name}</p>
              </div>
              <button onClick={() => setPermissionsModal(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><FiX size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vai trò</p>
                <div className="flex flex-wrap gap-1.5">
                  {(permissionsModal.admin_roles || []).map(code => {
                    const badge = getRoleBadge(code);
                    return <span key={code} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.color}`}>{badge.label}</span>;
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Trang được phép truy cập
                </p>
                <div className="space-y-2">
                  {(() => {
                    const perms = permissionsModal.permissions || [];
                    if (perms.length === 0) return <p className="text-sm text-gray-400">Chưa được phân công quyền truy cập nào</p>;
                    
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
                      : perms.map(p => accessMap[p]).filter(Boolean); // Filter known access mapping

                    // Deduplicate
                    const uniquePages = Array.from(new Set(allowedPages.map(p => p.label)))
                      .map(label => allowedPages.find(p => p.label === label)!);

                    if (uniquePages.length === 0) {
                      return <p className="text-sm text-gray-400">Chỉ có quyền hệ thống hạn chế chưa map giao diện.</p>;
                    }

                    return uniquePages.map((page, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="mt-1 w-2 h-2 bg-violet-500 rounded-full shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{page.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{page.desc}</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Danh sách quyền (System Codes)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(permissionsModal.permissions || []).map(perm => (
                    <span key={perm} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[11px] font-mono">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
