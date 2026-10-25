'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowRight, FiClock, FiFileText, FiPlay, FiTarget } from 'react-icons/fi';
import { getTopicPracticeExams, type TopicPracticeExam } from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';

interface Props {
  topicId: number;
  subjectCode: string;
}

export default function TopicPracticeExamList({ topicId, subjectCode }: Props) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [items, setItems] = useState<TopicPracticeExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    getTopicPracticeExams(topicId, subjectCode)
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setError('Không tải được danh sách đề luyện.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, subjectCode, topicId]);

  if (!isAuthenticated) return (
    <div className="rounded-3xl border border-dashed border-red-200 bg-white/85 px-6 py-14 text-center dark:border-red-500/35 dark:bg-[#111b2d]">
      <FiTarget className="mx-auto mb-4 text-4xl text-red-500" />
      <h2 className="text-lg font-black text-slate-900 dark:text-white">Đăng nhập để làm đề theo chủ đề</h2>
      <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700">
        Đăng nhập <FiArrowRight />
      </Link>
    </div>
  );
  if (loading) return <div className="h-48 animate-pulse rounded-3xl bg-white/80 dark:bg-[#111b2d]" />;
  if (error) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">{error}</div>;
  if (!items.length) return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-[#111b2d]">
      <FiTarget className="mx-auto mb-4 text-4xl text-slate-400" />
      <h2 className="text-lg font-black text-slate-900 dark:text-white">Chưa có đề luyện trong chủ đề này</h2>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((exam) => (
        <article key={exam.exam_id} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-[#111b2d]">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 dark:bg-red-500/15 dark:text-red-200">{exam.topic_name}</span>
            <span className="text-xs font-bold text-slate-400">{exam.difficulty_level || 'medium'}</span>
          </div>
          <h2 className="mt-5 text-lg font-black text-slate-950 dark:text-white">{exam.title}</h2>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500 dark:text-slate-300">{exam.description || 'Bộ câu hỏi trắc nghiệm luyện tập theo chủ đề.'}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-500 dark:text-slate-300">
            <span className="inline-flex items-center gap-1"><FiFileText /> {exam.question_count} câu</span>
            <span className="inline-flex items-center gap-1"><FiClock /> {exam.duration} phút</span>
          </div>
          <Link href={`/exam/${exam.exam_id}?workspace=topic-questions&topicId=${topicId}&subject=${encodeURIComponent(subjectCode)}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700">
            <FiPlay /> Bắt đầu luyện <FiArrowRight />
          </Link>
        </article>
      ))}
    </div>
  );
}
