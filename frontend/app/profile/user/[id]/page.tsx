'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import axios from '@/lib/utils/axios';
import Header from '@/components/layout/Header';
import {
  FiArrowLeft, FiMessageSquare, FiBook, FiAward,
  FiCalendar, FiTrendingUp, FiStar, FiX, FiFlag,
  FiUserX, FiEdit3, FiActivity
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface Badge { type: string; label: string; }

interface PublicProfile {
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
}

interface Props {
  params: { id: string };
}

export default function UserProfilePage({ params }: Props) {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const userId = parseInt(params.id);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axios.get(`/users/${userId}/profile`);
      setProfile(res.data.data?.profile || null);
      if (!res.data.data?.profile) setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleMessage = () => router.push(`/tin-nhan?to=${userId}`);

  const handleBlock = async () => {
    if (!isAuthenticated) return;
    if (!confirm(profile?.is_vip ? 'Chặn người dùng này?' : 'Chặn người dùng này?')) return;
    setBlocking(true);
    try {
      await axios.post(`/users/${userId}/block`);
      router.push('/forum');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi chặn');
    } finally {
      setBlocking(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || reportReason.trim().length < 5) return;
    setReporting(true);
    try {
      await axios.post(`/users/${userId}/report`, { reason: reportReason });
      setShowReport(false);
      setReportReason('');
      alert('Đã gửi report. Cảm ơn bạn!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Lỗi khi gửi report');
    } finally {
      setReporting(false);
    }
  };

  const getAvatar = (p: PublicProfile) =>
    p.avatar_url || p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random&size=256`;

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

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Header />
        <div className="max-w-3xl mx-auto px-4 pt-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
            <div className="h-40 bg-gradient-to-br from-violet-600 to-indigo-600" />
            <div className="px-8 pb-8 -mt-16">
              <div className="w-24 h-24 rounded-2xl bg-gray-200 border-4 border-white shadow-lg" />
              <div className="mt-4 space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Header />
        <main className="container mx-auto px-4 py-16 max-w-lg text-center">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FiUserX size={32} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy người dùng</h2>
            <p className="text-gray-500 text-sm mb-6">Người dùng này có thể không tồn tại hoặc đã bị chặn.</p>
            <button
              onClick={() => router.push('/forum')}
              className="px-6 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors"
            >
              Quay về diễn đàn
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />

      {/* Back */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <FiArrowLeft size={16} /> Quay về
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Profile Hero */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-40 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-8 left-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute bottom-4 right-16 w-20 h-20 rounded-full bg-white/10" />
            </div>
          </div>

          {/* Avatar + Info */}
          <div className="px-8 pb-8 -mt-16 relative">
            {/* Avatar */}
            <img
              src={getAvatar(profile)}
              alt={profile.full_name}
              className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-xl relative z-10"
            />

            {/* Name + badges */}
            <div className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-gray-900">{profile.full_name}</h1>
                {profile.role === 'admin' && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700">Admin</span>
                )}
                {profile.role === 'moderator' && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-700">Mod</span>
                )}
                {profile.is_vip && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                    <FaCrown size={10} /> {profile.subscription_tier || 'VIP'}
                  </span>
                )}
                {profile.is_verified && (
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-100 text-cyan-700">✓ Đã xác minh</span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">@{profile.username}</p>

              {/* Badges */}
              {profile.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {profile.badges.map(b => (
                    <span key={b.type} className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeStyle(b.type)}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
              )}

              {/* Joined */}
              <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
                <FiCalendar size={12} /> Tham gia {joinDate}
              </p>
            </div>

            {/* Action buttons */}
            {!isOwnProfile && (
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={handleMessage}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-lg shadow-violet-600/20 hover:shadow-xl hover:shadow-violet-600/30 hover:-translate-y-0.5 transition-all"
                >
                  <FiMessageSquare size={15} /> Nhắn tin
                </button>
                <button
                  onClick={() => setShowReport(true)}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
                  title="Báo cáo"
                >
                  <FiFlag size={15} />
                </button>
                <button
                  onClick={handleBlock}
                  disabled={blocking}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center disabled:opacity-50"
                  title="Chặn"
                >
                  <FiUserX size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="px-8 pb-8">
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: FiBook, label: 'Đề thi', value: profile.total_completed, color: 'from-blue-50 to-blue-100 text-blue-600' },
                { icon: FiTrendingUp, label: 'Điểm TB', value: Number(profile.avg_score).toFixed(1), color: 'from-emerald-50 to-emerald-100 text-emerald-600' },
                { icon: FiAward, label: 'Điểm cao', value: profile.highest_score, color: 'from-amber-50 to-amber-100 text-amber-600' },
                { icon: FiStar, label: 'Bài viết', value: profile.total_posts, color: 'from-violet-50 to-violet-100 text-violet-600' },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-xl p-3 text-center`}>
                    <Icon size={14} className="mx-auto mb-1 opacity-70" />
                    <p className="text-lg font-black">{stat.value}</p>
                    <p className="text-[10px] font-semibold opacity-70">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Extra stats */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: 'Streak hiện tại', value: `${profile.current_streak} ngày`, color: 'from-rose-50 to-rose-100 text-rose-600' },
                { label: 'Streak dài nhất', value: `${profile.longest_streak} ngày`, color: 'from-orange-50 to-orange-100 text-orange-600' },
                { label: 'Lượt thích', value: profile.total_likes_received, color: 'from-pink-50 to-pink-100 text-pink-600' },
              ].map(stat => (
                <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-xl p-3 text-center`}>
                  <p className="text-sm font-black">{stat.value}</p>
                  <p className="text-[10px] font-semibold opacity-70">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 z-[9999] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-gray-900">Báo cáo người dùng</h3>
              <button onClick={() => setShowReport(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Mô tả lý do báo cáo. Đội ngũ kiểm duyệt sẽ xem xét trong thời gian sớm nhất.
            </p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Lý do báo cáo (tối thiểu 5 ký tự)..."
              className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none h-24"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 transition-colors"
              >
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
          </div>
        </div>
      )}
    </div>
  );
}
