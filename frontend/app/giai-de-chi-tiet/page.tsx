'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { FiPlay, FiVideo, FiShuffle, FiX, FiChevronRight, FiSearch, FiClock, FiAward, FiLock } from 'react-icons/fi';
import axios from '@/lib/utils/axios';
import { Exam } from '@/lib/api/exams';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import Link from 'next/link';

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <FiVideo className="text-purple-400 shrink-0" size={16} />
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
        <div className="p-4 bg-gray-900 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-gray-400 text-sm">Bạn chưa hiểu đoạn nào trong video? Hãy nhắn tin cho Cố vấn nhé.</span>
            <Link href="/hoi-dap" className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/30 transition-all hover:-translate-y-0.5">
               <FiMessageSquare /> Hỏi Cố Vấn VIP
            </Link>
        </div>
      </div>
    </div>
  );
}

function ExamCard({ exam, onPlay, isAdmin }: { exam: Exam; onPlay: (e: Exam) => void; isAdmin: boolean }) {
  const isVipLocked = exam.is_premium;

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-purple-300 hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-bold rounded-lg">
            {exam.subject_name || exam.subject_code || 'Môn học'}
          </span>
          {exam.shuffle_mode && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg">
              <FiShuffle size={10} /> Xáo trộn
            </span>
          )}
          {isVipLocked && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg">
              <FiLock size={10} /> VIP
            </span>
          )}
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

      {/* Meta row */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <FiClock size={12} /> {exam.duration} phút
        </span>
        <span className="flex items-center gap-1.5">
          <FiAward size={12} /> {exam.total_questions || exam.question_count || 0} câu
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        {exam.solution_video_url ? (
          <button
            onClick={() => onPlay(exam)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors">
            <FiPlay size={14} /> Xem Video
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-400 text-sm font-medium rounded-xl cursor-not-allowed">
            <FiVideo size={14} /> Chưa có video
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
  );
}

export default function GiaiDeChiTietPage() {
  const { user } = useAuthStore();
  const isAdmin = hasPermission(user, 'exams.manage');
  const searchParams = useSearchParams() as unknown as URLSearchParams;
  const initialSubject = searchParams.get('subject') || '';
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState(initialSubject);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<Exam | null>(null);

  const handleSubjectChange = (subject: string) => {
    setActiveSubject(subject);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (subject) url.searchParams.set('subject', subject);
      else url.searchParams.delete('subject');
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, subjectsRes] = await Promise.all([
          axios.get('/exams/lobby'),
          axios.get('/subjects'),
        ]);
        const all = [
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
  }, []);

  const filtered = useMemo(() => {
    return exams.filter(e => {
      // Filter by subject_code (slug) — exact match
      const matchSubject = !activeSubject ||
        (e.subject_code || '') === activeSubject;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q);
      return matchSubject && matchSearch;
    });
  }, [exams, activeSubject, search]);

  const videosOnly = useMemo(() => filtered.filter(e => e.solution_video_url), [filtered]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
        <Header />

        {/* ── HERO ──────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-violet-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[120px] opacity-30" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-xl">
                <FiVideo className="text-white text-2xl sm:text-3xl" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                  Giải Đề Chi Tiết
                </h1>
                <p className="text-purple-100 text-sm sm:text-base max-w-xl">
                  Xem video hướng dẫn giải chi tiết từng đề thi. Hướng dẫn từng bước, phương pháp giải nhanh và mẹo làm bài thi HSK.
                  {videosOnly.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold text-white align-middle">
                      {videosOnly.length} video
                    </span>
                  )}
                </p>
                <div className="mt-5">
                    <Link href="/hoi-dap" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg transition-transform hover:-translate-y-1">
                        <FiMessageSquare /> Nhắn tin Hỏi Đáp 1-1 với Cố Vấn
                    </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Subject tabs */}
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
                    activeSubject === s.code
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-700'
                  }`}>
                  {s.name}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative sm:ml-auto sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="text" placeholder="Tìm kiếm đề..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent" />
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-6 text-xs text-gray-500">
            <span className="font-medium">Tổng cộng: <strong className="text-gray-700">{filtered.length} đề</strong></span>
            {videosOnly.length > 0 && (
              <span className="font-medium">Có video: <strong className="text-purple-600">{videosOnly.length} đề</strong></span>
            )}
          </div>

          {/* Exam grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
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
              {filtered.map(exam => (
                <ExamCard key={exam.id} exam={exam} onPlay={setPlaying} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </main>
      </div>

      {playing && playing.solution_video_url && (
        <VideoModal
          videoUrl={playing.solution_video_url}
          title={playing.title}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  );
}
