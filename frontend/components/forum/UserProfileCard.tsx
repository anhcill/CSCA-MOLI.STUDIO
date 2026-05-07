'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiMessageSquare, FiUserX, FiFlag, FiStar, FiTrendingUp,
  FiBookOpen, FiAward, FiCalendar, FiX, FiExternalLink, FiUser
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';

interface Badge { type: string; label: string; }

interface Profile {
  id: number;
  username: string;
  full_name: string;
  avatar: string | null;
  avatar_url: string | null;
  role: string;
  bio: string | null;
  is_vip: boolean;
  subscription_tier: string | null;
  is_verified: boolean;
  created_at: string;
  total_exams: number;
  total_completed: number;
  avg_score: number;
  highest_score: number;
  current_streak: number;
  longest_streak: number;
  total_posts: number;
  total_likes_received: number;
  badges: Badge[];
  isBlocked?: boolean;
  isBlockedBy?: boolean;
}

interface Props {
  userId: number;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export default function UserProfileCard({ userId, anchorRef, onClose }: Props) {
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`/users/${userId}/profile`);
      setProfile(res.data.data?.profile || null);
    } catch { setProfile(null); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        cardRef.current && !cardRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  const handleBlock = async () => {
    if (!isAuthenticated) return;
    setBlocking(true);
    try {
      const res = await axios.post(`/users/${userId}/block`);
      setProfile(prev => prev ? { ...prev, isBlocked: res.data.data?.blocked } : prev);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi chặn');
    } finally { setBlocking(false); }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || reportReason.trim().length < 5) return;
    setReporting(true);
    try {
      await axios.post(`/users/${userId}/report`, { reason: reportReason });
      setReportSent(true);
      setTimeout(() => { setShowReportModal(false); setReportSent(false); setReportReason(''); }, 2000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi gửi report');
    } finally { setReporting(false); }
  };

  const handleMessage = () => {
    router.push(`/tin-nhan?to=${userId}`);
    onClose();
  };

  const handleViewProfile = () => {
    router.push(`/profile/user/${userId}`);
    onClose();
  };

  // Position calculation
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const cardW = 340;
    const cardH = 380;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 8;
    let left = rect.left;
    if (left + cardW > vw - 8) left = vw - cardW - 8;
    if (top + cardH > vh - 8) top = rect.top - cardH - 8;
    setPos({ top, left });
  }, [anchorRef]);

  const getAvatar = (p: Profile) => p.avatar_url || p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random&size=128`;

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'vip': return 'bg-amber-100 text-amber-700';
      case 'premium': return 'bg-orange-100 text-orange-700';
      case 'admin': return 'bg-emerald-100 text-emerald-700';
      case 'moderator': return 'bg-blue-100 text-blue-700';
      case 'streak': return 'bg-rose-100 text-rose-700';
      case 'top_scorer': return 'bg-violet-100 text-violet-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        className="fixed z-[9999] w-[340px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ top: pos.top, left: pos.left }}
      >
        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        ) : profile ? (
          <>
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-5 pb-14 relative">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors"
              >
                <FiX size={14} />
              </button>
              <div className="flex items-end gap-3">
                <img
                  src={getAvatar(profile)}
                  alt={profile.full_name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-md"
                />
                <div className="pb-1">
                  <h3 className="text-white font-black text-lg leading-tight">{profile.full_name}</h3>
                  <p className="text-white/70 text-xs">@{profile.username}</p>
                </div>
              </div>
            </div>

            {/* Avatar overlap + actions */}
            <div className="px-5 -mt-8 flex items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {profile.badges.slice(0, 4).map(b => (
                  <span key={b.type} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeStyle(b.type)}`}>
                    {b.label}
                  </span>
                ))}
              </div>
              {isAuthenticated && currentUser?.id !== userId && (
                <button
                  onClick={handleMessage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-violet-700 text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all border border-violet-100"
                >
                  <FiMessageSquare size={12} /> Nhắn tin
                </button>
              )}

              {/* Xem trang cá nhân */}
              <button
                onClick={handleViewProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all border border-gray-200"
              >
                <FiUser size={12} /> Xem trang cá nhân
              </button>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="px-5 mt-3 text-xs text-gray-500 leading-relaxed line-clamp-2">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="px-5 mt-3 grid grid-cols-3 gap-2">
              {[
                { icon: FiBookOpen, label: 'Bài thi', value: profile.total_completed, color: 'text-blue-600 bg-blue-50' },
                { icon: FiTrendingUp, label: 'Điểm TB', value: Number(profile.avg_score).toFixed(1), color: 'text-emerald-600 bg-emerald-50' },
                { icon: FiStar, label: 'Bài viết', value: profile.total_posts, color: 'text-amber-600 bg-amber-50' },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`${stat.color} rounded-xl p-2 text-center`}>
                    <Icon size={12} className="mx-auto mb-0.5 opacity-70" />
                    <p className="text-sm font-black">{stat.value}</p>
                    <p className="text-[9px] font-semibold opacity-70">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Joined */}
            <p className="px-5 mt-3 text-[10px] text-gray-400 flex items-center gap-1">
              <FiCalendar size={10} />
              Tham gia {new Date(profile.created_at).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </p>

            {/* Actions */}
            {isAuthenticated && currentUser?.id !== userId && (
              <div className="px-5 mt-3 pt-3 border-t border-gray-100 flex gap-2 pb-4">
                {profile.isBlocked ? (
                  <button
                    onClick={handleBlock}
                    disabled={blocking}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <FiUserX size={12} /> Bỏ chặn
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <FiFlag size={12} /> Report
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">Không tìm thấy người dùng</div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[10000] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900">Report người dùng</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            {reportSent ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <FiFlag className="text-green-600" size={20} />
                </div>
                <p className="font-bold text-green-700">Đã gửi report!</p>
              </div>
            ) : (
              <>
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="Mô tả lý do báo cáo (tối thiểu 5 ký tự)..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none h-24"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors">
                    Hủy
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={reportReason.trim().length < 5 || reporting}
                    className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {reporting ? 'Đang gửi...' : 'Gửi Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
