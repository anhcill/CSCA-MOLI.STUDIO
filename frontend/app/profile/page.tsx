'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { updateProfile, updateAvatar, getUserStats, changePassword, UserStats } from '@/lib/api/users';
import axios from '@/lib/utils/axios';
import Header from '@/components/layout/Header';
import { AIInsights } from '@/components/ai/AIInsights';
import {
  FiEdit2, FiSave, FiX, FiUser, FiMail, FiBook,
  FiAward, FiTarget, FiMessageSquare, FiUpload,
  FiCheckCircle, FiLock, FiCalendar, FiEye, FiEyeOff,
  FiBell, FiShield, FiLogOut, FiAlertTriangle,
} from 'react-icons/fi';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="text-white" size={20} />
    </div>
    <div>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
    </div>
  </div>
);

// ─── Info Row ────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

// ─── Password Field ───────────────────────────────────────────────────────────
function PwField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'right-0.5' : 'left-0.5'}`} />
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? <FiCheckCircle size={15} /> : <FiAlertTriangle size={15} />}
      {message}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user: authUser, updateUser, logout } = useAuthStore();

  const [localUser, setLocalUser] = useState(authUser);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'settings'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Info form
  const [formData, setFormData] = useState({
    full_name: authUser?.full_name || '',
    bio: authUser?.bio || '',
    target_score: authUser?.target_score?.toString() || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(authUser?.avatar || '');

  // Settings - password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  // Settings - toggles (local state, extendable to backend)
  const [notifEmail, setNotifEmail] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  // Load stats non-blocking
  useEffect(() => {
    if (!authUser?.id) return;
    getUserStats(authUser.id)
      .then(r => setStats(r.data))
      .catch(() => { })
      .finally(() => setStatsLoading(false));
  }, [authUser?.id]);

  useEffect(() => {
    setLocalUser(authUser);
    setAvatarPreview(authUser?.avatar || '');
  }, [authUser]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const initEdit = () => {
    setFormData({
      full_name: localUser?.full_name || '',
      bio: localUser?.bio || '',
      target_score: localUser?.target_score?.toString() || '',
    });
    setAvatarFile(null);
    setAvatarPreview(localUser?.avatar || '');
    setIsEditing(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showToast(`Ảnh quá lớn! Tối đa 10MB (File của bạn: ${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'error');
      return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WEBP)', 'error');
      return;
    }
    
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveInfo = useCallback(async () => {
    if (!localUser?.id) return;
    setSaving(true);
    try {
      const upd: Record<string, any> = {};
      if (formData.full_name) upd.full_name = formData.full_name;
      if (formData.bio !== undefined) upd.bio = formData.bio;
      if (formData.target_score) upd.target_score = Number(formData.target_score);

      const res = await updateProfile(localUser.id, upd);
      let updated = res.data.user;

      // Upload avatar to Cloudinary if user selected a file
      if (avatarFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('avatar', avatarFile);
        
        const uploadRes = await axios.post('/users/upload-avatar', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        const avatarUrl = uploadRes.data.data.url;
        const avatarRes = await updateAvatar(localUser.id, avatarUrl);
        updated = avatarRes.data.user;
      }

      updateUser(updated);
      setLocalUser(updated);
      setIsEditing(false);
      setAvatarFile(null);
      showToast('Cập nhật thành công!');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  }, [localUser, formData, avatarFile, updateUser]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!localUser?.id) return;
    if (pwForm.next !== pwForm.confirm) { setPwError('Mật khẩu xác nhận không khớp'); return; }
    if (pwForm.next.length < 8) { setPwError('Mật khẩu mới phải có ít nhất 8 ký tự'); return; }
    setPwSaving(true);
    try {
      await changePassword(localUser.id, pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Đổi mật khẩu thành công!');
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setPwSaving(false);
    }
  };

  const displayName = localUser?.full_name || localUser?.display_name || localUser?.username || 'U';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const joinDate = localUser?.created_at
    ? new Date(localUser.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
    : '';

  if (!localUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Vui lòng đăng nhập để xem trang này</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <main className="container mx-auto px-4 py-8 max-w-3xl">

        {/* ── Profile Card ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt={displayName} className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gray-900 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{avatarLetter}</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              {/* Info */}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                <p className="text-sm text-gray-400">@{localUser.username}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                  <FiMail size={11} /><span>{localUser.email}</span>
                </div>
                {joinDate && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                    <FiCalendar size={11} /><span>Tham gia {joinDate}</span>
                  </div>
                )}
                {localUser.bio && <p className="mt-2 text-sm text-gray-600 max-w-sm">{localUser.bio}</p>}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={isEditing ? () => setIsEditing(false) : initEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isEditing ? <><FiX size={14} />Hủy</> : <><FiEdit2 size={14} />Chỉnh sửa</>}
              </button>
              {localUser.target_score && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600">
                  <FiTarget size={12} className="text-gray-400" />
                  Mục tiêu: <span className="font-semibold text-gray-800">{localUser.target_score} điểm</span>
                </div>
              )}
              {localUser.role === 'admin' && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">Admin</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {([
              { key: 'info', label: 'Thông tin', icon: FiUser },
              { key: 'stats', label: 'Thống kê & AI 🤖', icon: FiAward },
              { key: 'settings', label: 'Cài đặt', icon: FiShield },
            ] as const).map(tab => {
              const I = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${activeTab === tab.key
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <I size={14} />{tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab: Thông tin ───────────────────────────────── */}
          {activeTab === 'info' && (
            <div className="p-6">
              {isEditing ? (
                <div className="space-y-5">
                  {/* Avatar upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ảnh đại diện</label>
                    <div className="flex items-center gap-4">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-900 flex items-center justify-center text-white text-xl font-bold">{avatarLetter}</div>
                      )}
                      <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                        <FiUpload size={14} />Chọn ảnh
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </label>
                      <span className="text-xs text-gray-500">
                        <span className="font-medium">JPG, PNG, GIF, WEBP</span> · Tối đa <span className="font-semibold text-purple-600">10MB</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Nguyễn Văn A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Giới thiệu</label>
                    <textarea
                      value={formData.bio}
                      onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                      placeholder="Viết vài dòng về bản thân..."
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{formData.bio.length}/500</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Điểm mục tiêu (0–100)</label>
                    <input
                      type="number" min="0" max="100"
                      value={formData.target_score}
                      onChange={e => setFormData(p => ({ ...p, target_score: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ví dụ: 85"
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleSaveInfo}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      <FiSave size={14} />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-xl transition-colors">
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  <InfoRow icon={FiUser} label="Họ và tên" value={localUser.full_name || '—'} />
                  <InfoRow icon={FiMail} label="Email" value={localUser.email} />
                  <InfoRow icon={FiUser} label="Tên đăng nhập" value={`@${localUser.username}`} />
                  <InfoRow icon={FiBook} label="Giới thiệu" value={localUser.bio || 'Chưa có giới thiệu'} />
                  <InfoRow icon={FiTarget} label="Điểm mục tiêu" value={localUser.target_score ? `${localUser.target_score} điểm` : 'Chưa đặt'} />
                  <InfoRow icon={FiCalendar} label="Tham gia" value={joinDate} />
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Thống kê & Lộ trình AI ────────────────── */}
          {activeTab === 'stats' && (
            <div className="p-6">
              {/* Basic Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {statsLoading ? (
                  <><Sk className="h-20" /><Sk className="h-20" /><Sk className="h-20" /><Sk className="h-20" /></>
                ) : (
                  <>
                    <StatCard icon={FiBook} label="Đề thi đã làm" value={stats?.total_exams ?? 0} color="bg-blue-500" />
                    <StatCard icon={FiAward} label="Điểm trung bình" value={stats?.avg_score ?? 0} color="bg-emerald-500" />
                    <StatCard icon={FiTarget} label="Điểm cao nhất" value={stats?.highest_score ?? 0} color="bg-amber-500" />
                    <StatCard icon={FiMessageSquare} label="Bài viết" value={stats?.total_posts ?? 0} color="bg-purple-500" />
                  </>
                )}
              </div>

              {!statsLoading && stats && localUser.target_score && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Tiến độ đến mục tiêu</span>
                    <span className="text-sm font-semibold text-gray-800">{stats.avg_score}/{localUser.target_score}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min((stats.avg_score / localUser.target_score) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {Math.round((stats.avg_score / localUser.target_score) * 100)}% đạt mục tiêu
                  </p>
                </div>
              )}

              {/* AI Insights */}
              <div className="border-t border-gray-100 pt-6">
                <AIInsights userId={localUser.id} />
              </div>
            </div>
          )}

          {/* ── Tab: Cài đặt ─────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="p-6 space-y-6">

              {/* ── Đổi mật khẩu ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FiLock size={13} className="text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Đổi mật khẩu</h3>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  {pwError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                      <FiAlertTriangle size={13} className="shrink-0" />{pwError}
                    </div>
                  )}
                  <PwField label="Mật khẩu hiện tại" value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} placeholder="••••••••" />
                  <div className="grid grid-cols-2 gap-3">
                    <PwField label="Mật khẩu mới" value={pwForm.next} onChange={v => setPwForm(p => ({ ...p, next: v }))} placeholder="Tối thiểu 8 ký tự" />
                    <PwField label="Xác nhận mật khẩu" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} placeholder="Nhập lại mật khẩu" />
                  </div>
                  <p className="text-xs text-gray-400">Mật khẩu cần tối thiểu 8 ký tự, bao gồm chữ cái và số.</p>
                  <button
                    type="submit"
                    disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
                  >
                    <FiSave size={13} />{pwSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </section>

              <div className="border-t border-gray-100" />

              {/* ── Thông báo ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FiBell size={13} className="text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Thông báo</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Thông báo qua email</p>
                      <p className="text-xs text-gray-400">Nhận email về kết quả thi và cập nhật</p>
                    </div>
                    <Toggle on={notifEmail} onToggle={() => setNotifEmail(p => !p)} />
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* ── Quyền riêng tư ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FiShield size={13} className="text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Quyền riêng tư</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Hồ sơ công khai</p>
                      <p className="text-xs text-gray-400">Cho phép người khác xem trang cá nhân của bạn</p>
                    </div>
                    <Toggle on={publicProfile} onToggle={() => setPublicProfile(p => !p)} />
                  </div>
                </div>
              </section>

              <div className="border-t border-gray-100" />

              {/* ── Nguy hiểm ── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                    <FiAlertTriangle size={13} className="text-red-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Tài khoản</h3>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (confirm('Đăng xuất khỏi tất cả thiết bị?')) {
                        logout?.();
                        window.location.href = '/login';
                      }
                    }}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <FiLogOut size={14} />Đăng xuất khỏi tất cả thiết bị
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
