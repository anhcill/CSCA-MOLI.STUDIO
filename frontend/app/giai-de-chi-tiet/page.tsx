'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ScopedStudyTopBar from '@/components/layout/ScopedStudyTopBar';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import {
  FiPlay, FiVideo, FiShuffle, FiX, FiChevronRight, FiSearch,
  FiClock, FiAward, FiLock, FiMessageSquare, FiStar, FiZap
} from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import axios from '@/lib/utils/axios';
import { Exam } from '@/lib/api/exams';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { isPremiumActive } from '@/lib/utils/permissions';
import { getExamSubjectCode, getExamSubjectSlug, normalizeContentSubject } from '@/lib/utils/subjectScope';
import Link from 'next/link';

// ── Video Modal ────────────────────────────────────────────────────────────────
function VideoModal({ videoUrl, title, onClose }: { videoUrl: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-950 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl border border-gray-800">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-purple-600/20 rounded-lg">
              <FiVideo className="text-purple-400 shrink-0" size={15} />
            </div>
            <span className="text-sm font-semibold text-white truncate">{title}</span>
          </div>
          <button onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white shrink-0 ml-3">
            <FiX size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
        <div className="p-4 bg-gray-950 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-gray-400 text-sm">Bạn chưa hiểu đoạn nào? Hãy hỏi cố vấn ngay nhé.</span>
          <Link href="/hoi-dap"
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all hover:-translate-y-0.5">
            <FiMessageSquare /> Hỏi Cố Vấn VIP
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Upsell Modal ───────────────────────────────────────────────────────────────
function UpsellModal({ tier, onClose }: { tier: 'vip' | 'premium'; onClose: () => void }) {
  const isPre = tier === 'premium';
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden`}>
        <div className={`p-8 text-center ${isPre ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-indigo-600 to-purple-700'}`}>
          <div className="text-5xl mb-3">{isPre ? '👑' : '🔒'}</div>
          <h2 className="text-xl font-black text-white mb-1">
            {isPre ? 'Cần tài khoản Pre' : 'Video giải đề chỉ dành cho Pre'}
          </h2>
          <p className="text-white/80 text-sm">
            {isPre ? 'Video giải đề Pre độc quyền — chỉ dành cho tài khoản Pre.' : 'Video giải đề này dành cho thành viên Pre. VIP chỉ có AI phân tích.'}
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-2.5 mb-6">
            {(isPre ? [
              'Xem toàn bộ video giải đề Pre',
              'Chat 1-1 với cố vấn chuyên gia',
              'Phân tích AI chi tiết từng câu',
            ] : [
              'Phân tích AI chi tiết từng câu',
              'Truy cập đề thi cao cấp không giới hạn',
              'Nâng cấp Pre để xem video giải đề',
            ]).map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isPre ? 'bg-amber-500' : 'bg-indigo-500'}`}>✓</div>
                {f}
              </div>
            ))}
          </div>
          <Link href="/vip"
            className={`block text-center py-3.5 font-bold rounded-xl text-white text-sm transition-all hover:-translate-y-0.5 shadow-lg ${isPre ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/30' : 'bg-gradient-to-r from-indigo-600 to-purple-700 shadow-indigo-500/30'}`}>
            {isPre ? '👑 Nâng cấp Pre ngay' : '👑 Nâng cấp Pre ngay'}
          </Link>
          <button onClick={onClose} className="w-full mt-3 py-2.5 text-gray-500 text-sm hover:text-gray-700 font-medium">Để sau</button>
        </div>
      </div>
    </div>
  );
}

// ── Exam Card ──────────────────────────────────────────────────────────────────
function ExamCard({
  exam, onPlay, isAdmin, user, onLocked
}: {
  exam: Exam & { vip_tier?: string };
  onPlay: (e: Exam) => void;
  isAdmin: boolean;
  user: any;
  onLocked: (tier: 'vip' | 'premium') => void;
}) {
  const hasVideo = !!exam.solution_video_url;
  // Video giải đề = Premium only (cần kiểm tra expiry date)
  const allowed = isAdmin || isPremiumActive(user);
  const neededTier = 'premium';

  const tierBadge = exam.vip_tier === 'premium'
    ? <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-lg"><FaCrown size={8} /> Pre</span>
    : exam.vip_tier === 'vip' || exam.is_premium
      ? <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold rounded-lg"><FiStar size={8} /> VIP</span>
      : null;

  return (
    <div className={`group relative bg-white rounded-2xl border transition-all duration-300 ${
      !allowed && hasVideo
        ? 'border-gray-200 hover:border-gray-300 hover:shadow-md'
        : 'border-gray-200 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100'
    }`}>
      {/* Locked overlay */}
      {!allowed && hasVideo && (
        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <div className={`p-3 rounded-full text-white shadow-lg ${neededTier === 'premium' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
            <FiLock size={20} />
          </div>
          <button
            onClick={() => onLocked(neededTier)}
            className={`px-5 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition-transform hover:scale-105 ${neededTier === 'premium' ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}>
            {neededTier === 'premium' ? 'Nâng cấp Pre' : 'Nâng cấp VIP'}
          </button>
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg">
              {exam.subject_name || exam.subject_code || 'Môn học'}
            </span>
            {exam.shuffle_mode && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg">
                <FiShuffle size={9} /> Xáo trộn
              </span>
            )}
            {tierBadge}
          </div>
          <span className="text-xs text-gray-400 font-medium shrink-0">{exam.code}</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-900 text-base leading-snug mb-2 group-hover:text-purple-700 transition-colors line-clamp-2">
          {exam.title}
        </h3>

        {exam.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{exam.description}</p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><FiClock size={11} /> {exam.duration} phút</span>
          <span className="flex items-center gap-1.5"><FiAward size={11} /> {exam.total_questions || exam.question_count || 0} câu</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          {hasVideo ? (
            allowed ? (
              <button
                onClick={() => onPlay(exam)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all shadow-sm shadow-purple-500/20">
                <FiPlay size={14} /> Xem Video
              </button>
            ) : (
              <button
                onClick={() => onLocked(neededTier)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  neededTier === 'premium'
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 hover:border-amber-300'
                    : 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
                }`}>
                <FiLock size={13} /> {neededTier === 'premium' ? 'Pre' : 'VIP'}
              </button>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-400 text-sm font-medium rounded-xl cursor-not-allowed border border-dashed border-gray-200">
              <FiVideo size={13} /> Chưa có video
            </div>
          )}
          {isAdmin ? (
            <Link href={`/admin/exams/${exam.id}/edit`}
              className="flex items-center gap-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-purple-300 hover:text-purple-600 transition-colors">
              Sửa
            </Link>
          ) : (
            <Link href={`/exam/${exam.id}`}
              className="flex items-center gap-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-purple-300 hover:text-purple-600 transition-colors">
              Làm bài <FiChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function GiaiDeChiTietPage() {
  const { user } = useAuthStore();
  const isAdmin = hasPermission(user, 'exams.manage');
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const subjectParam = normalizeContentSubject(searchParams.get('subject'));
  const isStrictSubject = !!subjectParam;
  const [exams, setExams] = useState<(Exam & { vip_tier?: string })[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState(subjectParam);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<Exam | null>(null);
  const [upsellTier, setUpsellTier] = useState<'vip' | 'premium' | null>(null);

  useEffect(() => {
    setActiveSubject(subjectParam);
  }, [subjectParam]);

  const handleSubjectChange = (subject: string) => {
    const normalizedSubject = normalizeContentSubject(subject);
    setActiveSubject(normalizedSubject);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (normalizedSubject) url.searchParams.set('subject', normalizedSubject);
      else url.searchParams.delete('subject');
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const examRequest = activeSubject
          ? axios.get(`/subjects/${getExamSubjectCode(activeSubject)}/exams`, {
              params: { subjectSlug: getExamSubjectSlug(activeSubject) },
            })
          : axios.get('/exams/lobby');
        const [examsRes, subjectsRes] = await Promise.all([
          examRequest,
          axios.get('/subjects'),
        ]);
        const all = activeSubject
          ? (examsRes.data.data || [])
          : [
              ...(examsRes.data.data?.live || []),
              ...(examsRes.data.data?.upcoming || []),
              ...(examsRes.data.data?.public || []),
            ];
        setExams(all);
        setSubjects(subjectsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setExams([]);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeSubject]);

  const filtered = useMemo(() => {
    return exams.filter(e => {
      const examSubjectCode = (e.subject_code || '').toUpperCase();
      const activeSubjectCode = getExamSubjectCode(activeSubject);
      const matchSubject = !activeSubject
        || examSubjectCode === activeSubjectCode
        || (activeSubjectCode.startsWith('CHINESE_') && examSubjectCode === 'CHINESE');
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q);
      return matchSubject && matchSearch;
    });
  }, [exams, activeSubject, search]);

  const videosOnly = useMemo(() => filtered.filter(e => e.solution_video_url), [filtered]);
  const lockedCount = useMemo(() => videosOnly.filter(e => !isAdmin && !isPremiumActive(user)).length, [videosOnly, user, isAdmin]);

  // Hide exams with video from non-premium/non-admin users
  const visibleExams = useMemo(() => {
    if (isAdmin || isPremiumActive(user)) return filtered;
    return filtered.filter(e => !e.solution_video_url);
  }, [filtered, user, isAdmin]);

  const page = (
      <div className={isStrictSubject ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20'}>
        {!isStrictSubject && <ScopedStudyTopBar title="Giải Đề Chi Tiết" subject={activeSubject} fallbackIcon="🎥" />}

        {/* ── Hero ──────────────────────────────────────────────────── */}
        {!isStrictSubject && (
        <div className="relative bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[120px] opacity-30" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-xl">
                <FiVideo className="text-white text-2xl sm:text-3xl" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                  Giải Đề Chi Tiết
                </h1>
                <p className="text-purple-100 text-sm sm:text-base max-w-xl">
                  Xem video hướng dẫn giải chi tiết từng đề thi. Hướng dẫn từng bước, phương pháp giải nhanh.
                  {videosOnly.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold text-white align-middle">
                      {videosOnly.length} video
                    </span>
                  )}
                </p>
                <div className="mt-5">
                  <Link href="/hoi-dap"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-1">
                    <FiMessageSquare /> Nhắn tin Hỏi Đáp 1-1 với Cố Vấn
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Tier Banner (if not premium) ─────────────────────────────── */}
        {!isPremiumActive(user) && lockedCount > 0 && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl">
              <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0">
                <FiZap className="text-indigo-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">Có {lockedCount} video giải đề cần nâng cấp để xem</p>
                <p className="text-gray-500 text-xs mt-0.5">Nâng cấp gói Pre để mở khóa video hướng dẫn giải đề</p>
              </div>
              <Link href="/vip"
                className="shrink-0 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm">
                Nâng cấp
              </Link>
            </div>
          </div>
        )}

        {/* ── Main Content ────────────────────────────────────────────── */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {!isStrictSubject && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleSubjectChange('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeSubject === ''
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                }`}>
                Tất cả
              </button>
              {subjects.map(s => (
                <button key={s.code} onClick={() => handleSubjectChange(s.code)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  getExamSubjectCode(activeSubject) === s.code
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                  }`}>
                  {s.name}
                </button>
              ))}
            </div>
            )}

            <div className="relative sm:ml-auto sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="text" placeholder="Tìm kiếm đề..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-6 text-xs text-gray-500">
            <span className="font-medium">Tổng cộng: <strong className="text-gray-700">{visibleExams.length} đề</strong></span>
            {videosOnly.length > 0 && (isAdmin || isPremiumActive(user)) && (
              <span className="font-medium">Có video: <strong className="text-purple-600">{videosOnly.length} đề</strong></span>
            )}
            {lockedCount > 0 && (
              <span className="font-medium">Đã khóa: <strong className="text-amber-600">{lockedCount} video</strong></span>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-52 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : visibleExams.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiVideo className="text-purple-400 text-2xl" />
              </div>
              <p className="text-gray-500 font-medium">
                {search ? 'Không tìm thấy đề thi phù hợp' : 'Chưa có đề thi nào'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleExams.map(exam => (
                <ExamCard
                  key={exam.id}
                  exam={exam as any}
                  onPlay={setPlaying}
                  isAdmin={isAdmin}
                  user={user}
                  onLocked={(tier) => setUpsellTier(tier)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
  );

  const modals = (
    <>

      {/* Video modal */}
      {playing && playing.solution_video_url && (
        <VideoModal videoUrl={playing.solution_video_url} title={playing.title} onClose={() => setPlaying(null)} />
      )}

      {/* Upsell modal */}
      {upsellTier && <UpsellModal tier={upsellTier} onClose={() => setUpsellTier(null)} />}
    </>
  );

  if (isStrictSubject) {
    return (
      <>
        <SubjectStudyShell
          title="Giải Đề Chi Tiết"
          subjectSlug={activeSubject}
          activeSection="giai-de-chi-tiet"
          searchPlaceholder="Tìm kiếm đề..."
        >
          {page}
        </SubjectStudyShell>
        {modals}
      </>
    );
  }

  return (
    <>
      {page}
      {modals}
    </>
  );
}
