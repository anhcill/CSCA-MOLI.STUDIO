'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { updateProfile, updateAvatar, getUserStats, changePassword, UserStats } from '@/lib/api/users';
import axios from '@/lib/utils/axios';
import { canAccessAdminPanel } from '@/lib/utils/permissions';
import { getCurrentUser } from '@/lib/api/auth';
import { getWalletLedger } from '@/lib/api/games';
import Header from '@/components/layout/Header';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import PWAInstallSettings from '@/components/pwa/PWAInstallSettings';
import PushNotificationSettings from '@/components/pwa/PushNotificationSettings';
import { useLanguage } from '@/context/LanguageContext';
import {
  FiEdit2, FiSave, FiX, FiUser, FiMail, FiBook,
  FiAward, FiTarget, FiMessageSquare, FiUpload,
  FiCheckCircle, FiLock, FiCalendar, FiEye, FiEyeOff,
  FiBell, FiShield, FiLogOut, FiAlertTriangle,
  FiStar, FiZap, FiMonitor, FiRefreshCw, FiDownload, FiSmartphone,
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

function derivePackageUI(pkg: any) {
  const isPre = pkg.tier === 'premium' || /pre/i.test(pkg.name);
  return {
    tier: isPre ? 'premium' : 'vip',
    color: isPre ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-purple-600',
    iconColor: isPre ? 'text-amber-600' : 'text-indigo-600',
    iconBg: isPre ? 'bg-amber-50' : 'bg-indigo-50',
    border: isPre ? 'border-amber-200' : 'border-indigo-200',
    btnHover: isPre ? 'hover:bg-amber-50' : 'hover:bg-indigo-50',
  };
}

const Sk = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-gray-200/60 rounded-2xl ${className}`} />
);

type DeviceType = 'mobile' | 'desktop';

type DeviceSession = {
  id?: number;
  jti: string;
  device_info?: string;
  device_type?: DeviceType;
  ip_address?: string;
  last_active?: string;
  created_at?: string;
};

type DeviceLimits = Record<DeviceType, number>;

const DEVICE_LABELS: Record<DeviceType, string> = {
  mobile: 'Điện thoại',
  desktop: 'Máy tính',
};

const DEVICE_ICONS = {
  mobile: FiSmartphone,
  desktop: FiMonitor,
};

const StatCard = ({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${color}`}>
      <Icon className="text-white" size={22} />
    </div>
    <div>
      <p className="text-xs text-gray-400 font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-2xl font-black text-gray-800 leading-tight mt-0.5">{value}</p>
    </div>
  </div>
);

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-semibold mb-0.5 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-800 font-semibold break-words leading-relaxed">{value}</p>
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
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-10 border border-gray-200 bg-gray-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white focus:border-transparent transition-all text-gray-900 font-medium"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${on ? 'bg-indigo-600' : 'bg-gray-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold transition-all duration-300 border
      ${type === 'success' 
        ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
        : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
      {type === 'success' ? <FiCheckCircle className="text-emerald-500" size={18} /> : <FiAlertTriangle className="text-rose-500" size={18} />}
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const { t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'vip' | 'wallet' | 'settings' | 'devices'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [packages, setPackages] = useState<any[]>([]);
  const [pkgsLoading, setPkgsLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [purchasedPkgIds, setPurchasedPkgIds] = useState<Set<number>>(new Set());
  const [userPkgMap, setUserPkgMap] = useState<Record<number, any>>({}); // package_id -> package data

  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [sessionDeviceLimits, setSessionDeviceLimits] = useState<DeviceLimits>({ mobile: 1, desktop: 1 });
  const [sessionDeviceUsage, setSessionDeviceUsage] = useState<DeviceLimits>({ mobile: 0, desktop: 0 });
  const [sessionCurrentJti, setSessionCurrentJti] = useState('');
  const [wallet, setWallet] = useState<{ balance: number; entries: any[] } | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

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

  // Fetch fresh user data on mount (force refresh VIP status)
  useEffect(() => {
    if (!mounted) return;
    setUserLoading(true);
    getCurrentUser()
      .then(res => {
        if (res?.success && res?.data?.user) {
          const fresh = res.data.user;
          setProfileUser(fresh);
          updateUser(fresh);
        }
      })
      .catch(() => {})
      .finally(() => setUserLoading(false));
  }, [mounted]);

  useEffect(() => {
    if (!authUser?.id) return;
    getUserStats(authUser.id)
      .then(r => setStats(r.data))
      .catch(() => { })
      .finally(() => setStatsLoading(false));
  }, [authUser?.id]);

  // Fetch payment history on mount to get user's active package name
  useEffect(() => {
    if (!mounted) return;
    axios.get('/payments/history')
      .then(res => {
        const hist = res.data?.data || [];
        const purchased = new Set<number>();
        const pkgMap: Record<number, any> = {};
        hist.forEach((tx: any) => {
          if (tx.status === 'completed' && tx.package_id) {
            purchased.add(tx.package_id);
            // package data will be populated when packages load
          }
        });
        setPurchasedPkgIds(purchased);
        // Also fetch packages to get names
        return axios.get('/vip/packages').then(pkgRes => {
          const allPkgs = pkgRes.data?.data || [];
          setPackages(allPkgs);
          hist.forEach((tx: any) => {
            if (tx.status === 'completed' && tx.package_id) {
              const found = allPkgs.find((p: any) => p.id === tx.package_id);
              if (found) pkgMap[tx.package_id] = found;
            }
          });
          setUserPkgMap(pkgMap);
        });
      })
      .catch(() => {});
  }, [mounted]);

  useEffect(() => {
    if (activeTab === 'vip' && packages.length === 0) {
      setPkgsLoading(true);
      axios.get('/vip/packages')
        .then(res => setPackages(res.data?.data || []))
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
        const data = res.data?.data || {};
        setSessions(data?.sessions || []);
        setSessionDeviceLimits(data?.limits || { mobile: 1, desktop: 1 });
        setSessionDeviceUsage(data?.usage || { mobile: 0, desktop: 0 });
        setSessionCurrentJti(data?.currentJti || '');
        setSessionsFetched(true);
      })
      .catch(() => setSessionsError('Không thể tải danh sách thiết bị'))
      .finally(() => setSessionsLoading(false));
  }, [activeTab, mounted, sessionsFetched]);

  useEffect(() => {
    if (!mounted || activeTab !== 'wallet') return;
    setWalletLoading(true);
    getWalletLedger()
      .then(setWallet)
      .catch(() => setWallet({ balance: profileUser?.coins || 0, entries: [] }))
      .finally(() => setWalletLoading(false));
  }, [activeTab, mounted, profileUser?.coins]);

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

  if (!mounted || userLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar Skeleton */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100/85 shadow-sm p-6 space-y-6 animate-pulse">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-3xl bg-gray-200/70" />
                  <div className="h-6 bg-gray-200/70 rounded-xl w-36" />
                  <div className="h-4 bg-gray-200/70 rounded-xl w-24" />
                </div>
                <div className="border-t border-gray-100 my-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200/70 rounded-lg w-full" />
                  <div className="h-4 bg-gray-200/70 rounded-lg w-5/6" />
                </div>
              </div>
            </div>
            {/* Main Content Skeleton */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100/85 shadow-sm p-6 animate-pulse space-y-6">
                <div className="h-12 bg-gray-200/50 rounded-2xl w-full" />
                <div className="space-y-4 pt-4">
                  <div className="h-4 bg-gray-200/70 rounded-lg w-1/3" />
                  <div className="h-10 bg-gray-200/70 rounded-xl w-full" />
                  <div className="h-10 bg-gray-200/70 rounded-xl w-full" />
                  <div className="h-10 bg-gray-200/70 rounded-xl w-full" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex flex-col items-center justify-center h-96 px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-400 mb-4 shadow-inner">
            <FiUser size={28} />
          </div>
          <p className="text-gray-500 font-bold text-base text-center">Vui lòng đăng nhập để xem thông tin cá nhân</p>
          <button 
            onClick={() => router.push('/login')} 
            className="mt-4 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    );
  }

  const vipDaysLeft = profileUser?.is_vip && profileUser?.vip_expires_at
    ? Math.max(0, Math.ceil((new Date(profileUser.vip_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const completedExams = Number(stats?.total_exams || 0);
  const averageScore = Number(stats?.avg_score || 0);
  const currentStreak = Number(profileUser?.current_streak || 0);
  const sessionsByType: Record<DeviceType, DeviceSession[]> = {
    mobile: sessions.filter(session => (session.device_type || 'desktop') === 'mobile'),
    desktop: sessions.filter(session => (session.device_type || 'desktop') === 'desktop'),
  };
  const totalDeviceSlots = sessionDeviceLimits.mobile + sessionDeviceLimits.desktop;
  const usedDeviceSlots = sessionDeviceUsage.mobile + sessionDeviceUsage.desktop;

  const getDeviceName = (session: DeviceSession) => {
    const deviceParts = session.device_info?.split(' on ') || [];
    const browser = deviceParts[0] || 'Trình duyệt';
    const os = deviceParts[1] || DEVICE_LABELS[session.device_type || 'desktop'];
    return `${browser} trên ${os}`;
  };

  const getLastActive = (session: DeviceSession) => (
    session.last_active
      ? new Date(session.last_active).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '—'
  );

  const updateDeviceUsageFromSessions = (nextSessions: DeviceSession[]) => {
    setSessionDeviceUsage({
      mobile: nextSessions.filter(session => (session.device_type || 'desktop') === 'mobile').length,
      desktop: nextSessions.filter(session => (session.device_type || 'desktop') === 'desktop').length,
    });
  };

  const removeSession = async (jti: string) => {
    if (!confirm('Đăng xuất tài khoản khỏi thiết bị này?')) return;
    try {
      await axios.delete(`/auth/sessions/${jti}`);
      const nextSessions = sessions.filter(session => session.jti !== jti);
      setSessions(nextSessions);
      updateDeviceUsageFromSessions(nextSessions);
      showToast('Đăng xuất thiết bị thành công');
    } catch {
      showToast('Không thể đăng xuất thiết bị', 'error');
    }
  };

  const removeOtherSessions = async () => {
    if (!confirm('Đăng xuất khỏi tất cả thiết bị khác?')) return;
    try {
      await axios.delete('/auth/sessions');
      const current = sessions.find(session => session.jti === sessionCurrentJti);
      const nextSessions = current ? [current] : [];
      setSessions(nextSessions);
      updateDeviceUsageFromSessions(nextSessions);
      showToast('Đã đăng xuất khỏi các thiết bị khác');
    } catch {
      showToast('Không thể đăng xuất thiết bị khác', 'error');
    }
  };
  const learnerLevel = completedExams >= 30 && averageScore >= 8
    ? { label: 'Cao thủ luyện đề', progress: 100, next: 'Duy trì phong độ và giữ streak mỗi ngày' }
    : completedExams >= 15 && averageScore >= 6
      ? { label: 'Tăng tốc', progress: 72, next: 'Mục tiêu tiếp theo: 30 đề và điểm TB 8+' }
      : completedExams >= 5
        ? { label: 'Đang vào nhịp', progress: 45, next: 'Mục tiêu tiếp theo: 15 đề và điểm TB 6+' }
        : { label: 'Khởi động', progress: Math.min(completedExams * 12, 35), next: 'Mục tiêu tiếp theo: hoàn thành 5 đề' };
  const earnedBadges = [
    { label: 'Làm đề đầu tiên', unlocked: completedExams >= 1 },
    { label: '5 đề đã hoàn thành', unlocked: completedExams >= 5 },
    { label: 'Điểm 8+', unlocked: Number(stats?.highest_score || 0) >= 8 },
    { label: 'Streak 7 ngày', unlocked: currentStreak >= 7 },
  ];
  const profileTabs = [
    { key: 'info', label: t('profile.info'), icon: FiUser },
    { key: 'stats', label: t('profile.stats'), icon: FiAward },
    { key: 'wallet', label: t('profile.wallet'), icon: FiStar },
    { key: 'vip', label: t('profile.vip'), icon: FaCrown },
    { key: 'devices', label: t('profile.devices'), icon: FiMonitor },
    { key: 'settings', label: t('profile.settings'), icon: FiShield },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header />
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── CỘT TRÁI: SIDEBAR CÁ NHÂN (4/12) ─────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Profile Summary Card */}
            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-sm p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <div className="flex flex-col items-center lg:items-start gap-4 mt-2">
                <div className="relative shrink-0 group">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={displayName} className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-md transition-transform duration-350 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="w-24 h-24 rounded-3xl bg-gray-900 flex items-center justify-center border-4 border-white shadow-md">
                      <span className="text-3xl font-black text-white">{avatarLetter}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm" />
                </div>
                
                <div className="w-full text-center lg:text-left">
                  <div className="flex flex-col gap-1 items-center lg:items-start justify-center">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{displayName}</h1>
                    <p className="text-sm font-semibold text-gray-400">@{profileUser.username}</p>
                  </div>
                  
                  {/* Badges strip */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-3.5">
                    {profileUser?.is_vip && (() => {
                      const purchasedIds = Array.from(purchasedPkgIds);
                      const activePkg = purchasedIds.length > 0
                        ? Object.values(userPkgMap).find((p: any) => purchasedIds.includes(p.id))
                        : null;
                      const pkgName = activePkg?.name || 'PRO';
                      const isPre = activePkg?.tier === 'premium' || /premium/i.test(pkgName);
                      return (
                        <span className={`bg-gradient-to-r ${isPre ? 'from-amber-500 to-orange-600' : 'from-indigo-600 to-purple-700'} text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm`}>
                          <FaCrown size={11} className="text-amber-200" /> {pkgName}
                          {vipDaysLeft !== null && vipDaysLeft > 0 && (
                            <span className="ml-1 bg-white/20 px-1 py-0.2 rounded text-[9px] font-black">{vipDaysLeft}d</span>
                          )}
                        </span>
                      );
                    })()}
                    
                    {canAccessAdminPanel(profileUser) && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-xl text-[10px] font-black uppercase tracking-widest">Admin</span>
                    )}

                    {profileUser.target_score && (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-wider">
                        <FiTarget size={11} className="text-gray-400" />
                        <span>Mục tiêu: {profileUser.target_score} đ</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 my-5" />

              {/* Quick Details List */}
              <div className="space-y-3.5 text-left text-sm text-gray-500 font-semibold">
                <div className="flex items-center gap-3">
                  <FiMail size={16} className="text-gray-400 shrink-0" />
                  <span className="truncate text-gray-700 font-bold">{profileUser.email}</span>
                </div>
                {joinDate && (
                  <div className="flex items-center gap-3">
                    <FiCalendar size={16} className="text-gray-400 shrink-0" />
                    <span className="text-gray-700 font-bold">Gia nhập {joinDate}</span>
                  </div>
                )}
              </div>

              {profileUser.bio && (
                <div className="mt-4 p-3.5 bg-gray-50/60 rounded-2xl border border-gray-100/50 text-xs text-gray-600 text-left font-medium leading-relaxed italic">
                  "{profileUser.bio}"
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row lg:flex-col gap-2">
                <button
                  onClick={isEditing ? () => setIsEditing(false) : initEdit}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white text-sm font-extrabold rounded-2xl transition-all shadow-sm"
                >
                  {isEditing ? <><FiX size={16} />Hủy bỏ</> : <><FiEdit2 size={15} />Chỉnh sửa hồ sơ</>}
                </button>
                <button
                  onClick={() => {
                    setUserLoading(true);
                    getCurrentUser().then(res => {
                      if (res?.success && res?.data?.user) {
                        setProfileUser(res.data.user);
                        updateUser(res.data.user);
                      }
                    }).finally(() => setUserLoading(false));
                  }}
                  disabled={userLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-150/70 hover:bg-gray-200/80 active:scale-[0.98] text-gray-600 text-sm font-extrabold rounded-2xl transition-all"
                  title="Làm mới"
                >
                  <FiRefreshCw size={15} className={userLoading ? 'animate-spin' : ''} />
                  <span>Làm mới dữ liệu</span>
                </button>
              </div>
            </div>

            {/* Language Selection Card */}
            <div className="bg-white rounded-3xl border border-gray-100/90 shadow-sm p-6 transition-all duration-300 hover:shadow-md">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('profile.languageTitle')}</h2>
                  <p className="mt-0.5 text-xs text-gray-400 font-semibold">{t('profile.languageDesc')}</p>
                </div>
                <div className="border-t border-gray-100 my-1" />
                <div className="flex justify-center lg:justify-start">
                  <LanguageSwitcher />
                </div>
              </div>
            </div>

          </div>

          {/* ── CỘT PHẢI: TABS & NỘI DUNG (8/12) ─────────────────────────── */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Tabs Selector Navigation */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
              <div
                role="tablist"
                aria-label="Điều hướng hồ sơ"
                className="flex gap-1 overflow-x-auto hide-scrollbar scroll-smooth"
              >
                {profileTabs.map(tab => {
                  const I = tab.icon;
                  const isActive = activeTab === tab.key;
                  const isVipTab = tab.key === 'vip';
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.key)}
                      className={`group flex min-h-10 shrink-0 select-none items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold tracking-[-0.01em] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.04]'
                          : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                      }`}
                    >
                      <I
                        size={15}
                        strokeWidth={isActive ? 2.25 : 2}
                        className={`transition-colors ${
                          isVipTab
                            ? 'text-amber-500'
                            : isActive
                              ? 'text-blue-600'
                              : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Workspace Panel Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 min-h-[420px] transition-all duration-300 hover:shadow-md">
              
              {/* ── Tab Content: Thông tin ────────────────────── */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Chỉnh sửa thông tin</h3>
                        <span className="text-xs text-gray-400 font-semibold">Cập nhật thông tin công khai</span>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Ảnh đại diện</label>
                        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-gray-55 rounded-2xl border border-gray-100/80">
                          {avatarPreview ? (
                            <img src={avatarPreview} alt="preview" className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-sm shrink-0" />
                          ) : (
                            <div className="w-20 h-20 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-sm">{avatarLetter}</div>
                          )}
                          <div className="flex flex-col items-center sm:items-start gap-2">
                            <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] rounded-xl text-sm font-extrabold text-gray-700 cursor-pointer shadow-sm transition-all">
                              <FiUpload size={14} />
                              <span>Chọn ảnh mới</span>
                              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            </label>
                            <span className="text-[11px] text-gray-400 font-semibold">Chấp nhận JPG, PNG, GIF, WEBP · Tối đa 10MB</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Họ và tên</label>
                          <input type="text" value={formData.full_name}
                            onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-gray-900" placeholder="Nguyễn Văn A" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Điểm mục tiêu (0–100)</label>
                          <input type="number" min="0" max="100" value={formData.target_score}
                            onChange={e => setFormData(p => ({ ...p, target_score: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-gray-900"
                            placeholder="Ví dụ: 85" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Giới thiệu bản thân</label>
                        <textarea value={formData.bio} rows={3} maxLength={500}
                          onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:bg-white rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-gray-900 resize-none"
                          placeholder="Viết vài dòng giới thiệu bản thân..." />
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] text-gray-400 font-semibold">Tự giới thiệu ngắn giúp nổi bật trên bảng xếp hạng</span>
                          <span className="text-xs text-gray-400 font-bold">{formData.bio.length}/500</span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-gray-100">
                        <button onClick={handleSaveInfo} disabled={saving}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold rounded-2xl shadow-md transition-all disabled:opacity-50">
                          <FiSave size={15} />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                        <button onClick={() => setIsEditing(false)} className="px-6 py-3 border border-gray-200 hover:bg-gray-50 active:scale-[0.98] text-gray-600 text-sm font-bold rounded-2xl transition-all">
                          Hủy bỏ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Thông tin tài khoản</h3>
                        <button
                          onClick={initEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition-all"
                        >
                          <FiEdit2 size={12} />
                          <span>Chỉnh sửa</span>
                        </button>
                      </div>
                      <div className="divide-y divide-gray-100/50">
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
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Content: Thống kê ────────────────────── */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Kết quả học tập & Thống kê</h3>
                    <span className="text-xs text-gray-400 font-semibold">Tóm tắt tiến độ luyện đề</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {statsLoading ? (
                      <><Sk className="h-24" /><Sk className="h-24" /><Sk className="h-24" /><Sk className="h-24" /></>
                    ) : (
                      <>
                        <StatCard icon={FiBook} label="Đề thi đã làm" value={stats?.total_exams ?? 0} color="bg-gradient-to-br from-blue-500 to-indigo-600" />
                        <StatCard icon={FiAward} label="Điểm trung bình" value={stats?.avg_score ?? 0} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
                        <StatCard icon={FiTarget} label="Điểm cao nhất" value={stats?.highest_score ?? 0} color="bg-gradient-to-br from-amber-500 to-orange-600" />
                        <StatCard icon={FiMessageSquare} label="Bài viết" value={stats?.total_posts ?? 0} color="bg-gradient-to-br from-purple-500 to-pink-600" />
                      </>
                    )}
                  </div>
                  
                  {!statsLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                      {[
                        { label: 'Streak hiện tại', value: `${profileUser?.current_streak || 0} ngày`, color: 'from-rose-50 to-orange-50 border-rose-100 text-rose-700', icon: '🔥' },
                        { label: 'Streak kỷ lục', value: `${profileUser?.longest_streak || 0} ngày`, color: 'from-amber-50 to-yellow-50 border-amber-100 text-amber-700', icon: '🏆' },
                        { label: 'Tổng số dư xu', value: `${(profileUser?.coins || 0).toLocaleString('vi-VN')} xu`, color: 'from-yellow-50 to-orange-50 border-yellow-100 text-yellow-700', icon: '⭐' },
                        { label: 'Kinh nghiệm', value: `${(profileUser?.exp || 0).toLocaleString('vi-VN')} XP`, color: 'from-blue-50 to-cyan-50 border-blue-100 text-blue-700', icon: '⚡' },
                      ].map(stat => (
                        <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border rounded-2xl p-4 text-center flex flex-col items-center justify-center hover:shadow-sm transition-all duration-300`}>
                          <div className="text-2xl mb-1.5">{stat.icon}</div>
                          <p className="text-base font-black tracking-tight">{stat.value}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mt-1 leading-tight">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!statsLoading && (
                    <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-indigo-50/20 to-white p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Cấp độ học viên</p>
                          <h3 className="mt-1 text-xl font-black text-gray-900 tracking-tight">{learnerLevel.label}</h3>
                          <p className="mt-1.5 text-xs text-gray-500 font-medium leading-relaxed">{learnerLevel.next}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-2.5 text-center shadow-sm border border-indigo-50/40 shrink-0 self-stretch sm:self-auto flex sm:flex-col justify-between items-center">
                          <p className="text-3xl font-black text-indigo-600">{learnerLevel.progress}%</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider sm:mt-0.5">tiến độ</p>
                        </div>
                      </div>
                      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white border border-indigo-50/30">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700" style={{ width: `${learnerLevel.progress}%` }} />
                      </div>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {earnedBadges.map((badge) => (
                          <div
                            key={badge.label}
                            className={`rounded-2xl border px-4 py-3 text-xs font-bold flex items-center gap-2.5 transition-all ${
                              badge.unlocked
                                ? 'border-amber-200 bg-amber-50/60 text-amber-800'
                                : 'border-gray-100 bg-white/70 text-gray-400'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${badge.unlocked ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-300'}`}>
                              {badge.unlocked ? '✓' : '○'}
                            </span>
                            <span className="leading-tight">{badge.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!statsLoading && stats && profileUser.target_score && (
                    <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tiến trình đạt mục tiêu điểm</span>
                        <span className="text-sm font-bold text-gray-800">{stats.avg_score}/{profileUser.target_score} điểm</span>
                      </div>
                      <div className="h-2 bg-gray-200/60 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min((stats.avg_score / profileUser.target_score) * 100, 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-400 font-semibold mt-2">
                        Đã hoàn thành {Math.round((stats.avg_score / profileUser.target_score) * 100)}% chặng đường đến mục tiêu đề ra.
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={() => router.push('/lich-su/thong-ke')}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.99] text-white font-extrabold rounded-2xl shadow-md hover:shadow-lg transition-all"
                  >
                    <FiAward size={16} />
                    <span>Xem thống kê chi tiết toàn bộ</span>
                  </button>
                </div>
              )}

              {/* ── Tab Content: Ví Xu ────────────────────────── */}
              {activeTab === 'wallet' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Ví xu của bạn</h3>
                    <span className="text-xs text-gray-400 font-semibold">Quản lý và xem lịch sử xu</span>
                  </div>

                  <div className="rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 p-6 lg:p-8 text-white shadow-lg relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-xl duration-300">
                    <div className="absolute top-[-30px] right-[-30px] w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute bottom-[-20px] left-[-20px] w-28 h-28 bg-black/10 rounded-full blur-xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                          <FiStar className="text-yellow-250 fill-yellow-250 animate-pulse" size={20} />
                        </div>
                        <span className="text-sm font-bold tracking-wider uppercase text-yellow-50/90">Số dư hiện tại</span>
                      </div>
                      <FaCrown className="text-white/20" size={32} />
                    </div>
                    
                    <div className="mt-6">
                      <p className="text-4xl lg:text-5xl font-black tracking-tight leading-none">
                        {(wallet?.balance ?? profileUser?.coins ?? 0).toLocaleString('vi-VN')}
                        <span className="text-lg lg:text-xl font-bold ml-2 text-yellow-100">xu</span>
                      </p>
                    </div>

                    <div className="mt-6 border-t border-white/20 pt-4 flex items-center justify-between text-xs text-amber-50 font-medium">
                      <span className="leading-relaxed max-w-[80%]">Xu dùng để chơi game ôn luyện, mở phân tích chi tiết bằng AI và các ưu đãi.</span>
                      <span className="font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-xl backdrop-blur-md">CSCA WALLET</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                      Lịch sử giao dịch
                    </h3>
                    {walletLoading ? (
                      <div className="space-y-2.5">{[1, 2, 3].map(i => <Sk key={i} className="h-16" />)}</div>
                    ) : wallet?.entries?.length ? (
                      <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                        {wallet.entries.map((entry: any) => {
                          const isGain = entry.amount >= 0;
                          return (
                            <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm hover:border-gray-200/80 transition-colors">
                              <div className="min-w-0 pr-4">
                                <p className="font-bold text-gray-800 truncate leading-snug">{entry.description || entry.source}</p>
                                <p className="text-xs text-gray-400 mt-1 font-semibold">
                                  {new Date(entry.created_at).toLocaleString('vi-VN')} · <span className="text-gray-500 font-bold">{entry.source}</span>
                                </p>
                              </div>
                              <div className={`text-base font-extrabold tracking-tight shrink-0 ${isGain ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isGain ? '+' : ''}{entry.amount.toLocaleString('vi-VN')} xu
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-gray-50 p-6 text-center border border-gray-100/50">
                        <p className="text-sm text-gray-400 font-bold">Chưa có giao dịch xu nào.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab Content: VIP ──────────────────────────── */}
              {activeTab === 'vip' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Thành viên VIP / Premium</h3>
                    <span className="text-xs text-gray-400 font-semibold">Quản lý và đăng ký gói VIP</span>
                  </div>

                  <div className={`rounded-3xl border p-6 transition-all duration-300 hover:shadow-sm ${
                    profileUser?.is_vip 
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/40 border-amber-200' 
                      : 'bg-gradient-to-br from-indigo-50 to-purple-50/40 border-indigo-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        profileUser?.is_vip 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                          : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                      }`}>
                        <FaCrown className="text-white" size={26} />
                      </div>
                      <div className="flex-1">
                        {profileUser?.is_vip ? (() => {
                          const purchasedIds = Array.from(purchasedPkgIds);
                          const activePkg = purchasedIds.length > 0
                            ? Object.values(userPkgMap).find((p: any) => purchasedIds.includes(p.id))
                            : null;
                          const pkgName = activePkg?.name || 'PRO';
                          const isPre = activePkg?.tier === 'premium' || /premium/i.test(pkgName);
                          return (
                            <>
                              <div className="flex flex-col sm:flex-row items-center gap-2 mb-1.5 justify-center sm:justify-start">
                                <h3 className={`text-lg font-black tracking-tight ${isPre ? 'text-amber-900' : 'text-indigo-900'}`}>
                                  Thành viên {pkgName}
                                </h3>
                                <span className={`px-2.5 py-0.5 ${isPre ? 'bg-amber-200 text-amber-900' : 'bg-indigo-200 text-indigo-900'} text-[10px] font-extrabold rounded-full flex items-center gap-1`}>
                                  <FaCrown size={10} /> ĐANG KÍCH HOẠT
                                </span>
                              </div>
                              <p className={`text-sm font-semibold ${isPre ? 'text-amber-700' : 'text-indigo-700'} leading-relaxed`}>
                                Hạn sử dụng: <span className="font-extrabold">{profileUser.vip_expires_at ? new Date(profileUser.vip_expires_at).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span>
                                {vipDaysLeft !== null && (
                                  <span className={`ml-2 inline-block px-2.5 py-0.5 text-xs font-black rounded-lg ${
                                    vipDaysLeft > 0 
                                      ? (isPre ? 'bg-amber-200 text-amber-900' : 'bg-indigo-200 text-indigo-900') 
                                      : 'bg-red-200 text-red-900'
                                  }`}>
                                    {vipDaysLeft > 0 ? `Còn ${vipDaysLeft} ngày` : 'Hết hạn'}
                                  </span>
                                )}
                              </p>
                            </>
                          );
                        })() : (
                          <>
                            <h3 className="text-lg font-black text-indigo-950 mb-1 tracking-tight">Nâng cấp tài khoản VIP</h3>
                            <p className="text-sm font-medium text-indigo-700 leading-relaxed">
                              Mở khóa không giới hạn ngân hàng đề thi thử, lời giải chi tiết và tính năng học tập cao cấp khác.
                            </p>
                            <button onClick={() => window.location.href = '/vip'}
                              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-md transition-all">
                              <FaCrown className="text-amber-300" size={14} /> 
                              <span>Nâng cấp ngay</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                      <FiZap className="text-indigo-500" size={16} /> Các gói tài khoản
                    </h3>
                    {pkgsLoading ? (
                      <div className="flex justify-center py-8"><div className="w-9 h-9 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"/></div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {packages.map(pkg => {
                          const ui = derivePackageUI(pkg);
                          const userTier = profileUser?.subscription_tier;
                          const isVipUser = !!profileUser?.is_vip;

                          const alreadyPurchased = purchasedPkgIds.has(pkg.id);
                          const downgradeBlocked = isVipUser && userTier === 'premium' && ui.tier === 'vip';
                          const disabled = alreadyPurchased || downgradeBlocked;

                          return (
                            <div key={pkg.id} className={`bg-white rounded-2xl border ${ui.border} p-5 hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${disabled ? 'opacity-70' : ''}`}>
                              <div>
                                {alreadyPurchased && (
                                   <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-xl shadow-sm">
                                     ✓ Đã mua
                                   </div>
                                )}
                                {downgradeBlocked && (
                                   <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-xl shadow-sm">
                                     ↓ Hạ cấp
                                   </div>
                                )}
                                <div className="flex items-center gap-3 mb-4">
                                  <div className={`w-10 h-10 rounded-xl ${ui.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                                    <FaCrown size={18} className={ui.iconColor} />
                                  </div>
                                  <div>
                                    <p className="font-extrabold text-gray-900 text-sm leading-tight">{pkg.name}</p>
                                    <p className="text-xs text-gray-400 font-semibold mt-0.5">{pkg.duration_days} ngày sử dụng</p>
                                  </div>
                                </div>
                                
                                <div className="mb-4">
                                  <span className="text-3xl font-black text-gray-900 tracking-tight">{pkg.price.toLocaleString('vi-VN')}</span>
                                  <span className="text-xs text-gray-450 font-bold ml-1 uppercase">đ</span>
                                </div>
                                
                                <ul className="space-y-2 mb-6">
                                  {(pkg.features || []).slice(0, 4).map((f: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 font-medium">
                                      <FiCheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                      <span className="leading-relaxed">{f}</span>
                                    </li>
                                  ))}
                                  {(pkg.features || []).length > 4 && (
                                     <li className="text-[11px] text-gray-400 font-semibold pl-6">+{pkg.features.length - 4} đặc quyền khác...</li>
                                  )}
                                </ul>
                              </div>

                              <div>
                                {alreadyPurchased ? (
                                  <div className="w-full py-2.5 text-center text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
                                    Gói hiện tại
                                  </div>
                                ) : downgradeBlocked ? (
                                  <div className="w-full py-2.5 text-center text-[10px] font-bold rounded-xl border border-amber-200 bg-amber-50 text-amber-800 leading-normal px-2">
                                    Không thể hạ cấp từ Premium
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => window.location.href = `/checkout?package_id=${pkg.id}`}
                                    className={`w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl border transition-all active:scale-[0.98] ${
                                      ui.tier === 'premium' 
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 border-transparent text-white shadow-sm'
                                        : 'border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700'
                                    }`}
                                  >
                                    <span>{isVipUser && ui.tier === 'premium' ? 'Nâng cấp Premium' : isVipUser ? 'Gia hạn thêm' : 'Đăng ký sử dụng'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab Content: Thiết bị ─────────────────────── */}
              {activeTab === 'devices' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 tracking-tight">Thiết bị đang đăng nhập</h3>
                      <p className="text-xs font-semibold text-gray-400">Đang dùng {usedDeviceSlots}/{totalDeviceSlots} slot</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-500">
                      {(['mobile', 'desktop'] as DeviceType[]).map(type => (
                        <div key={type} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-center">
                          <span className="block text-gray-900">{sessionDeviceUsage[type]}/{sessionDeviceLimits[type]}</span>
                          <span>{DEVICE_LABELS[type]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {sessionsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4">
                          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-gray-100" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
                            <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sessionsError ? (
                    <div className="py-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                        <FiAlertTriangle size={20} className="text-red-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">{sessionsError}</p>
                      <button onClick={() => { setSessions([]); setSessionsFetched(false); }}
                        className="mt-3 text-xs font-bold text-indigo-650 underline hover:text-indigo-850">Thử tải lại</button>
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="rounded-3xl border border-gray-100 bg-gray-50/50 py-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <FiMonitor size={20} className="text-gray-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">Chưa có phiên đăng nhập nào đang hoạt động</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {(['mobile', 'desktop'] as DeviceType[]).map(type => {
                        const Icon = DEVICE_ICONS[type];
                        const typedSessions = sessionsByType[type];
                        return (
                          <section key={type} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
                                <Icon size={15} className="text-gray-400" />
                                <span>{DEVICE_LABELS[type]}</span>
                              </div>
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
                                {typedSessions.length}/{sessionDeviceLimits[type]} slot
                              </span>
                            </div>

                            {typedSessions.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-sm font-semibold text-gray-400">
                                Chưa có {DEVICE_LABELS[type].toLowerCase()} nào đăng nhập
                              </div>
                            ) : typedSessions.map(session => {
                              const isCurrent = session.jti === sessionCurrentJti;
                              return (
                                <div key={session.id || session.jti} className="flex flex-col gap-3 rounded-2xl border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50/30 sm:flex-row sm:items-center">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                                    <Icon size={18} className="text-gray-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-bold text-gray-800">{getDeviceName(session)}</p>
                                      {isCurrent && (
                                        <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">Hiện tại</span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-400">
                                      <span>IP: {session.ip_address || '—'}</span>
                                      <span>•</span>
                                      <span>Hoạt động: <span className="font-bold text-gray-500">{getLastActive(session)}</span></span>
                                    </div>
                                  </div>
                                  {!isCurrent && (
                                    <button onClick={() => removeSession(session.jti)}
                                      className="w-full rounded-xl border border-red-100/70 bg-red-50/20 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 active:scale-[0.98] sm:w-auto">
                                      Đăng xuất
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </section>
                        );
                      })}

                      {sessions.length > 1 && (
                        <button onClick={removeOtherSessions}
                          className="w-full rounded-2xl border border-gray-200 py-3.5 text-sm font-bold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 active:scale-[0.99]">
                          Đăng xuất tất cả thiết bị khác
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Content: Cài đặt ─────────────────────── */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Cài đặt tài khoản & Bảo mật</h3>
                    <span className="text-xs text-gray-400 font-semibold">Tùy chỉnh bảo mật và nhắc nhở</span>
                  </div>

                  <section className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/40 flex items-center justify-center shrink-0">
                        <FiLock size={14} className="text-indigo-650" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Đổi mật khẩu</h3>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {pwError && (
                        <div className="flex items-center gap-2 text-xs font-bold text-red-705 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                          <FiAlertTriangle size={15} className="shrink-0 text-red-500" />
                          <span>{pwError}</span>
                        </div>
                      )}
                      <PwField label="Mật khẩu hiện tại" value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} placeholder="Nhập mật khẩu hiện tại" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <PwField label="Mật khẩu mới" value={pwForm.next} onChange={v => setPwForm(p => ({ ...p, next: v }))} placeholder="Tối thiểu 8 ký tự" />
                        <PwField label="Xác nhận mật khẩu mới" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} placeholder="Nhập lại mật khẩu mới" />
                      </div>
                      <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">Hãy sử dụng mật khẩu mạnh bao gồm chữ cái, chữ số và ký tự đặc biệt để bảo vệ tài khoản.</p>
                      <button type="submit" disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                        className="flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40">
                        <FiSave size={14} />{pwSaving ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
                      </button>
                    </form>
                  </section>

                  <div className="border-t border-gray-100" />
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <FiDownload size={14} className="text-gray-500" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Cài app</h3>
                    </div>
                    <PWAInstallSettings />
                  </section>

                  <div className="border-t border-gray-100" />
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <FiBell size={14} className="text-gray-500" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Thông báo nhận tin</h3>
                    </div>
                    <PushNotificationSettings />
                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50/20 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Thông báo qua Email</p>
                        <p className="text-xs text-gray-400 mt-1 font-semibold">Nhận cập nhật về các đề thi mới, sự kiện học tập và nhắc nhở ôn tập</p>
                      </div>
                      <Toggle on={notifEmail} onToggle={() => setNotifEmail(p => !p)} />
                    </div>
                  </section>

                  <div className="border-t border-gray-100" />
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <FiShield size={14} className="text-gray-500" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Cấu hình riêng tư</h3>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50/20 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Hồ sơ cá nhân công khai</p>
                        <p className="text-xs text-gray-400 mt-1 font-semibold">Cho phép học viên khác xem tiến độ học tập và thành tích trên BXH</p>
                      </div>
                      <Toggle on={publicProfile} onToggle={() => setPublicProfile(p => !p)} />
                    </div>
                  </section>

                  <div className="border-t border-gray-100" />
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <FiAlertTriangle size={14} className="text-red-500" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Tác vụ khẩn cấp</h3>
                    </div>
                    
                    <div className="p-4 border border-red-100 rounded-2xl bg-red-50/10 space-y-3 text-left">
                      <p className="text-xs font-semibold text-gray-500">Nếu cảm thấy tài khoản bị xâm nhập trái phép, bạn có thể đăng xuất tức thì trên tất cả thiết bị khác.</p>
                      <button 
                        onClick={() => { 
                          if (confirm('Đăng xuất khỏi tất cả thiết bị?')) { 
                            logout?.(); 
                            window.location.href = '/login'; 
                          } 
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold border border-red-250 bg-red-50 text-red-750 hover:bg-red-100/60 rounded-xl transition-all"
                      >
                        <FiLogOut size={14} />
                        <span>Đăng xuất khỏi tất cả thiết bị</span>
                      </button>
                    </div>
                  </section>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
