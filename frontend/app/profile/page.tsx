'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { updateProfile, updateAvatar, getUserStats, changePassword, UserStats } from '@/lib/api/users';
import axios from '@/lib/utils/axios';
import { canAccessAdminPanel } from '@/lib/utils/permissions';
import { getCurrentUser } from '@/lib/api/auth';
import Header from '@/components/layout/Header';
import { AIInsights } from '@/components/ai/AIInsights';
import {
  FiEdit2, FiSave, FiX, FiUser, FiMail, FiBook,
  FiAward, FiTarget, FiMessageSquare, FiUpload,
  FiCheckCircle, FiLock, FiCalendar, FiEye, FiEyeOff,
  FiBell, FiShield, FiLogOut, FiAlertTriangle,
  FiStar, FiZap, FiMonitor,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

function derivePackageUI(pkg: any) {
  const isPremium = pkg.name.toLowerCase().includes('premium');
  return {
    tier: isPremium ? 'premium' : 'vip',
    color: isPremium ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-purple-600',
    iconColor: isPremium ? 'text-amber-600' : 'text-indigo-600',
    iconBg: isPremium ? 'bg-amber-50' : 'bg-indigo-50',
    border: isPremium ? 'border-amber-200' : 'border-indigo-200',
    btnHover: isPremium ? 'hover:bg-amber-50' : 'hover:bg-indigo-50',
  };
}

const Sk = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

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

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
      {type === 'success' ? <FiCheckCircle size={15} /> : <FiAlertTriangle size={15} />}
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser, updateUser, logout } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [profileUser, setProfileUser] = useState(authUser);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'vip' | 'settings' | 'devices'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [packages, setPackages] = useState<any[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(false);

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [sessionMaxDevices, setSessionMaxDevices] = useState(1);
  const [sessionCurrentJti, setSessionCurrentJti] = useState('');

  const [formData, setFormData] = useState({
    full_name: authUser?.full_name || '',
    bio: authUser?.bio || '',
    target_score: authUser?.target_score?.toString() || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(authUser?.avatar || '');

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  // Hydration guard
  useEffect(() => { setMounted(true); }, []);

  // Keep profileUser in sync with authUser
  useEffect(() => {
    if (authUser) setProfileUser(authUser);
  }, [authUser]);

  // Keep formData and avatarPreview in sync when authUser changes
  useEffect(() => {
    if (authUser) {
      setFormData({
        full_name: authUser.full_name || '',
        bio: authUser.bio || '',
        target_score: authUser.target_score?.toString() || '',
      });
      setAvatarPreview(authUser.avatar || '');
    }
  }, [authUser]);

  // Fetch fresh user data on mount
  useEffect(() => {
    if (!mounted) return;
    getCurrentUser()
      .then(res => {
        if (res?.success && res?.data?.user) {
          const fresh = res.data.user;
          setProfileUser(fresh);
          updateUser(fresh);
        }
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [mounted]);

  useEffect(() => {
    if (!authUser?.id) return;
    getUserStats(authUser.id)
      .then(r => setStats(r.data))
      .catch(() => { })
      .finally(() => setStatsLoading(false));
  }, [authUser?.id]);

  useEffect(() => {
    if (activeTab === 'vip' && packages.length === 0) {
      setPkgsLoading(true);
      axios.get('/vip/packages')
        .then(res => setPackages(res.data.data || []))
        .catch(() => {})
        .finally(() => setPkgsLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'devices') {
      setSessionsFetched(false);
      setSessions([]);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!mounted || activeTab !== 'devices' || sessionsFetched) return;
    setSessionsLoading(true);
    setSessionsError('');
    axios.get('/auth/sessions')
      .then(res => {
        const data = res.data.data;
        setSessions(data?.sessions || []);
        setSessionMaxDevices(data?.maxDevices || 1);
        setSessionCurrentJti(data?.currentJti || '');
        setSessionsFetched(true);
      })
      .catch(() => setSessionsError('Không thể tải danh sách thiết bị'))
      .finally(() => setSessionsLoading(false));
  }, [activeTab, mounted, sessionsFetched]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const initEdit = () => {
    setFormData({
      full_name: profileUser?.full_name || '',
      bio: profileUser?.bio || '',
      target_score: profileUser?.target_score?.toString() || '',
    });
    setAvatarFile(null);
    setAvatarPreview(profileUser?.avatar || '');
    setIsEditing(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) { showToast('Ảnh quá lớn! Tối đa 10MB', 'error'); return; }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { showToast('Chỉ chấp nhận file ảnh (JPG, PNG, GIF, WEBP)', 'error'); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveInfo = useCallback(async () => {
    if (!profileUser?.id) return;
    setSaving(true);
    try {
      const upd: Record<string, any> = {};
      if (formData.full_name) upd.full_name = formData.full_name;
      if (formData.bio !== undefined) upd.bio = formData.bio;
      if (formData.target_score) upd.target_score = Number(formData.target_score);

      const res = await updateProfile(profileUser.id, upd);
      let updated = res.data.user;

      if (avatarFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('avatar', avatarFile);
        const uploadRes = await axios.post('/users/upload-avatar', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const avatarUrl = uploadRes.data.data.url;
        const avatarRes = await updateAvatar(profileUser.id, avatarUrl);
        updated = avatarRes.data.user;
      }

      updateUser(updated);
      setProfileUser(updated);
      setIsEditing(false);
      setAvatarFile(null);
      showToast('Cập nhật thành công!');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lưu thất bại', 'error');
    } finally {
      setSaving(false);
    }
  }, [profileUser, formData, avatarFile, updateUser]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!profileUser?.id) return;
    if (pwForm.next !== pwForm.confirm) { setPwError('Mật khẩu không khớp'); return; }
    if (pwForm.next.length < 8) { setPwError('Mật khẩu phải có ít nhất 8 ký tự'); return; }
    setPwSaving(true);
    try {
      await changePassword(profileUser.id, pwForm.current, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Đổi mật khẩu thành công!');
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setPwSaving(false);
    }
  };

  const displayName = profileUser?.full_name || (profileUser as any)?.display_name || profileUser?.username || 'U';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const joinDate = profileUser?.created_at
    ? new Date(profileUser.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
    : '';

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Vui lòng đăng nhập để xem trang này</p>
        </div>
      </div>
    );
  }

  const vipDaysLeft = profileUser?.is_vip && profileUser?.vip_expires_at
    ? Math.max(0, Math.ceil((new Date(profileUser.vip_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <main className="container mx-auto px-4 py-8 max-w-3xl">

        {/* ── Profile Card ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-5">
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
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                  {profileUser?.is_vip && (
                    <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                      <FaCrown size={10} /> PRO
                      {vipDaysLeft !== null && vipDaysLeft > 0 && (
                        <span className="ml-1 bg-white/30 px-1 rounded text-[10px]">{vipDaysLeft}d</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">@{profileUser.username}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                  <FiMail size={11} /><span>{profileUser.email}</span>
                </div>
                {joinDate && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                    <FiCalendar size={11} /><span>Tham gia {joinDate}</span>
                  </div>
                )}
                {profileUser.bio && <p className="mt-2 text-sm text-gray-600 max-w-sm">{profileUser.bio}</p>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={isEditing ? () => setIsEditing(false) : initEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isEditing ? <><FiX size={14} />Hủy</> : <><FiEdit2 size={14} />Chỉnh sửa</>}
              </button>
              {profileUser.target_score && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600">
                  <FiTarget size={12} className="text-gray-400" />
                  Mục tiêu: <span className="font-semibold text-gray-800">{profileUser.target_score} điểm</span>
                </div>
              )}
              {canAccessAdminPanel(profileUser) && (
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
              { key: 'stats', label: 'Thống kê', icon: FiAward },
              { key: 'vip', label: 'VIP', icon: FaCrown },
              { key: 'devices', label: 'Thiết bị', icon: FiMonitor },
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
                      <span className="text-xs text-gray-500">JPG, PNG, GIF, WEBP · Tối đa 10MB</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
                    <input type="text" value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900" placeholder="Nguyễn Văn A" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Giới thiệu bản thân</label>
                    <textarea value={formData.bio} rows={3} maxLength={500}
                      onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                      placeholder="Viết vài dòng về bản thân..." />
                    <p className="text-xs text-gray-400 mt-1 text-right">{formData.bio.length}/500</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Điểm mục tiêu (0–100)</label>
                    <input type="number" min="0" max="100" value={formData.target_score}
                      onChange={e => setFormData(p => ({ ...p, target_score: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ví dụ: 85" />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={handleSaveInfo} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                      <FiSave size={14} />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm rounded-xl transition-colors">
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  <InfoRow icon={FiUser} label="Họ và tên" value={profileUser.full_name || '—'} />
                  <InfoRow icon={FiMail} label="Email" value={profileUser.email} />
                  <InfoRow icon={FiUser} label="Tên đăng nhập" value={`@${profileUser.username}`} />
                  <InfoRow icon={FiBook} label="Giới thiệu" value={profileUser.bio || 'Chưa có giới thiệu'} />
                  <InfoRow icon={FiTarget} label="Điểm mục tiêu" value={profileUser.target_score ? `${profileUser.target_score} điểm` : 'Chưa đặt'} />
                  <InfoRow icon={FiCalendar} label="Tham gia" value={joinDate} />
                  {profileUser.is_vip && profileUser.vip_expires_at && (
                    <InfoRow icon={FaCrown} label="Hạn VIP" value={new Date(profileUser.vip_expires_at).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Thống kê ────────────────────────────── */}
          {activeTab === 'stats' && (
            <div className="p-6">
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
              {!statsLoading && stats && profileUser.target_score && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Tiến độ đến mục tiêu</span>
                    <span className="text-sm font-semibold text-gray-800">{stats.avg_score}/{profileUser.target_score}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min((stats.avg_score / profileUser.target_score) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {Math.round((stats.avg_score / profileUser.target_score) * 100)}% đạt mục tiêu
                  </p>
                </div>
              )}
              <div className="border-t border-gray-100 pt-6">
                <AIInsights userId={profileUser.id} />
              </div>
            </div>
          )}

          {/* ── Tab: VIP ─────────────────────────────────── */}
          {activeTab === 'vip' && (
            <div className="p-6 space-y-6">
              <div className={`rounded-2xl border p-6 ${profileUser?.is_vip ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200'}`}>
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${profileUser?.is_vip ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                    <FaCrown className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    {profileUser?.is_vip ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-black text-amber-900">Bạn đang là thành viên PRO</h3>
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-xs font-bold rounded-full flex items-center gap-1">
                            <FaCrown size={10} /> ACTIVE
                          </span>
                        </div>
                        <p className="text-sm text-amber-700">
                          Hạn VIP: <span className="font-bold">
                            {profileUser.vip_expires_at ? new Date(profileUser.vip_expires_at).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                          </span>
                          {vipDaysLeft !== null && (
                            <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${vipDaysLeft > 0 ? 'bg-amber-200 text-amber-900' : 'bg-red-200 text-red-900'}`}>
                              {vipDaysLeft > 0 ? `Còn ${vipDaysLeft} ngày` : 'Đã hết hạn'}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-black text-indigo-900 mb-1">Nâng cấp lên PRO</h3>
                        <p className="text-sm text-indigo-700">Mở khóa tất cả đề thi, tài liệu và tính năng độc quyền để đạt điểm cao nhất!</p>
                        <button onClick={() => window.location.href = '/vip'}
                          className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all">
                          <FaCrown className="text-amber-300" size={14} /> Nâng cấp ngay
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 VIP Packages */}
              <div>
                <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FiZap className="text-indigo-500" size={18} /> Các gói PRO
                </h3>
                {pkgsLoading ? (
                  <div className="flex justify-center py-6"><div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"/></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {packages.map(pkg => {
                      const ui = derivePackageUI(pkg);
                      const userTier = profileUser?.subscription_tier;
                      const isVipUser = !!profileUser?.is_vip;

                      // Đang dùng gói cùng tier (subscription_tier đã load)
                      const sameTier = isVipUser && userTier === ui.tier;
                      // Premium hạ cấp sang VIP → không cho
                      const downgradeBlocked = isVipUser && userTier === 'premium' && ui.tier === 'vip';
                      // User VIP nhưng subscription_tier chưa load → tạm thời block để tránh duplicate purchase
                      const tierUnknown = isVipUser && !userTier;

                      const disabled = sameTier || downgradeBlocked || tierUnknown;

                      return (
                        <div key={pkg.id} className={`bg-white rounded-xl border ${ui.border} p-5 hover:shadow-md transition-shadow relative overflow-hidden ${disabled ? 'opacity-70' : ''}`}>
                          {sameTier && (
                             <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                               ✓ Đang dùng
                             </div>
                          )}
                          {downgradeBlocked && (
                             <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                               ↓ Hạ cấp
                             </div>
                          )}
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-9 h-9 rounded-lg ${ui.iconBg} flex items-center justify-center`}>
                              <FaCrown size={15} className={ui.iconColor} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{pkg.name}</p>
                              <p className="text-xs text-gray-500">{pkg.duration_days} ngày</p>
                            </div>
                          </div>
                          <div className="mb-4">
                            <span className="text-2xl font-black text-gray-900">{pkg.price.toLocaleString('vi-VN')}</span>
                            <span className="text-sm text-gray-500 ml-1">đ</span>
                          </div>
                          <ul className="space-y-2 mb-4">
                            {(pkg.features || []).slice(0, 4).map((f: string, i: number) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-gray-600 min-h-[20px]">
                                <FiCheckCircle size={13} className="text-emerald-500 shrink-0" />
                                <span className="leading-tight">{f}</span>
                              </li>
                            ))}
                            {(pkg.features || []).length > 4 && (
                               <li className="text-xs text-gray-400">+{pkg.features.length - 4} tính năng khác...</li>
                            )}
                          </ul>
                          {sameTier ? (
                            <div className="w-full py-2 text-center text-sm font-semibold rounded-lg border border-green-200 bg-green-50 text-green-700">
                              ✓ Đang sử dụng gói này
                            </div>
                          ) : downgradeBlocked ? (
                            <div className="w-full py-2 text-center text-sm font-semibold rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                              Bạn đang dùng Premium — không thể hạ cấp
                            </div>
                          ) : tierUnknown ? (
                            <div className="w-full py-2 text-center text-sm font-semibold rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                              Đang tải trạng thái...
                            </div>
                          ) : (
                            <button
                              onClick={() => window.location.href = `/checkout?package_id=${pkg.id}`}
                              className={`w-full py-2 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg border transition-all ${ui.border} ${ui.iconColor} ${ui.btnHover} hover:shadow-sm`}
                            >
                              {isVipUser && ui.tier === 'premium' ? 'Nâng cấp lên Premium' : isVipUser ? 'Gia hạn' : 'Đăng ký ngay'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Thiết bị ─────────────────────────────── */}
          {activeTab === 'devices' && (
            <div className="p-6 space-y-5">
              {sessionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sessionsError ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                    <FiAlertTriangle size={20} className="text-red-400" />
                  </div>
                  <p className="text-sm text-gray-500">{sessionsError}</p>
                  <button onClick={() => { setSessions([]); setSessionsFetched(false); }}
                    className="mt-3 text-sm text-gray-600 hover:text-gray-900 underline">Thử lại</button>
                </div>
              ) : sessions.length <= 1 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <FiMonitor size={20} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Chỉ có một thiết bị được đăng nhập</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FiMonitor size={14} className="text-gray-400" />
                      <span>{sessions.length}/{sessions.length} thiết bị đang dùng</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sessions.map(session => {
                      const isCurrent = session.jti === sessionCurrentJti;
                      const deviceParts = session.device_info?.split(' on ') || [];
                      const browser = deviceParts[0] || 'Trình duyệt';
                      const os = deviceParts[1] || 'Hệ điều hành';

                      const lastActive = session.last_active
                        ? new Date(session.last_active).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—';

                      return (
                        <div key={session.id || session.jti} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                            <FiMonitor size={18} className="text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800 truncate">{browser} trên {os}</p>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full shrink-0">Hiện tại</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">{session.ip_address || '—'}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-400">Hoạt động: {lastActive}</span>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button onClick={async () => {
                              if (!confirm('Đăng xuất thiết bị này?')) return;
                              try {
                                await axios.delete(`/auth/sessions/${session.jti}`);
                                setSessions(prev => prev.filter(s => s.jti !== session.jti));
                                showToast('Đăng xuất thiết bị thành công');
                              } catch {
                                showToast('Không thể đăng xuất thiết bị', 'error');
                              }
                            }}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                              Đăng xuất
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={async () => {
                    if (!confirm('Đăng xuất khỏi tất cả thiết bị khác?')) return;
                    try {
                      await axios.delete('/auth/sessions');
                      const current = sessions.find(s => s.jti === (window as any).__currentJti);
                      setSessions(current ? [current] : []);
                      showToast('Đã đăng xuất khỏi các thiết bị khác');
                    } catch {
                      showToast('Không thể đăng xuất các thiết bị khác', 'error');
                    }
                  }}
                    className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    Đăng xuất tất cả thiết bị khác
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Settings ──────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="p-6 space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><FiLock size={13} className="text-gray-500" /></div>
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
                    <PwField label="Mật khẩu mới" value={pwForm.next} onChange={v => setPwForm(p => ({ ...p, next: v }))} placeholder="Ít nhất 8 ký tự" />
                    <PwField label="Xác nhận mật khẩu mới" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} placeholder="••••••••" />
                  </div>
                  <p className="text-xs text-gray-400">Mật khẩu phải có ít nhất 8 ký tự</p>
                  <button type="submit" disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-40">
                    <FiSave size={13} />{pwSaving ? 'Đang lưu...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </section>

              <div className="border-t border-gray-100" />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><FiBell size={13} className="text-gray-500" /></div>
                  <h3 className="text-sm font-semibold text-gray-800">Thông báo</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-gray-700">Thông báo qua email</p><p className="text-xs text-gray-400">Nhận thông báo qua email</p></div>
                  <Toggle on={notifEmail} onToggle={() => setNotifEmail(p => !p)} />
                </div>
              </section>

              <div className="border-t border-gray-100" />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><FiShield size={13} className="text-gray-500" /></div>
                  <h3 className="text-sm font-semibold text-gray-800">Quyền riêng tư</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-gray-700">Hồ sơ công khai</p><p className="text-xs text-gray-400">Cho phép người khác xem hồ sơ</p></div>
                  <Toggle on={publicProfile} onToggle={() => setPublicProfile(p => !p)} />
                </div>
              </section>

              <div className="border-t border-gray-100" />
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><FiAlertTriangle size={13} className="text-red-400" /></div>
                  <h3 className="text-sm font-semibold text-gray-800">Tài khoản</h3>
                </div>
                <div className="space-y-2">
                  <button onClick={() => { if (confirm('Đăng xuất khỏi tất cả thiết bị?')) { logout?.(); window.location.href = '/login'; } }}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors">
                    <FiLogOut size={14} />Đăng xuất khỏi tất cả thiết bị
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ── Tab: Thiết bị ─────────────────────────── */}
          {activeTab === 'devices' && (
            <div className="p-6 space-y-5">
              {sessionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-48" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sessionsError ? (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                  <FiAlertTriangle size={14} />{sessionsError}
                </div>
              ) : sessions.length <= 1 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                    <FiMonitor size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500">Chỉ có một thiết bị được đăng nhập</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiMonitor size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {sessions.length}/{sessionMaxDevices} thiết bị đang dùng
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {sessions.map(session => {
                      const isCurrent = session.jti === sessionCurrentJti;
                      const deviceParts = (session.device_info || '').split(' on ');
                      const browser = deviceParts[0] || 'Trình duyệt không xác định';
                      const os = deviceParts[1] || 'Hệ điều hành không xác định';

                      const lastActiveDate = session.last_active ? new Date(session.last_active) : null;
                      let relativeTime = '';
                      if (lastActiveDate) {
                        const diffMs = Date.now() - lastActiveDate.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const diffDays = Math.floor(diffHours / 24);
                        if (diffMins < 1) relativeTime = 'Vừa xong';
                        else if (diffMins < 60) relativeTime = `${diffMins} phút trước`;
                        else if (diffHours < 24) relativeTime = `${diffHours} giờ trước`;
                        else if (diffDays === 1) relativeTime = 'Hôm qua';
                        else relativeTime = `${diffDays} ngày trước`;
                      }

                      return (
                        <div key={session.id || session.jti} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                            <FiMonitor size={18} className="text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800">{browser}</p>
                              <span className="text-xs text-gray-400">{os}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">Hiện tại</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                              <span>IP: {session.ip_address || '—'}</span>
                              <span>•</span>
                              <span>{relativeTime || '—'}</span>
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Đăng xuất thiết bị "${browser} trên ${os}"?`)) return;
                                try {
                                  await axios.delete(`/auth/sessions/${session.jti}`);
                                  setSessions(prev => prev.filter(s => s.jti !== session.jti));
                                  showToast('Đăng xuất thiết bị thành công');
                                } catch {
                                  showToast('Không thể đăng xuất thiết bị', 'error');
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors shrink-0"
                            >
                              Đăng xuất
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Đăng xuất tất cả thiết bị khác?')) return;
                      try {
                        await axios.delete('/auth/sessions');
                        setSessions(prev => prev.filter(s => s.jti !== sessionCurrentJti));
                        showToast('Đã đăng xuất các thiết bị khác');
                      } catch {
                        showToast('Không thể đăng xuất các thiết bị khác', 'error');
                      }
                    }}
                    className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors"
                  >
                    Đăng xuất tất cả thiết bị khác
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
