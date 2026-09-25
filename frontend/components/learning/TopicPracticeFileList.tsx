'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiBookOpen, FiCheckCircle, FiClock, FiFileText, FiLayers, FiPlay } from 'react-icons/fi';
import { getTopicPracticeFiles, type TopicPracticeFile } from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';

interface TopicPracticeFileListProps {
  topicId: number;
  subjectSlug: string;
  subjectCode: string;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('vi-VN');
}

function languageLabel(value?: string | null) {
  const labels: Record<string, string> = { vi: 'Tiếng Việt', en: 'English', zh: '中文' };
  return labels[String(value || '').toLowerCase()] || String(value || '中文').replace(/_/g, ' + ');
}

function languageListLabel(languages?: string[]) {
  const values = Array.isArray(languages) && languages.length ? languages : ['zh'];
  return values.map((language) => languageLabel(language)).join(' · ');
}

export default function TopicPracticeFileList({ topicId, subjectSlug, subjectCode }: TopicPracticeFileListProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [files, setFiles] = useState<TopicPracticeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !Number.isInteger(topicId) || topicId <= 0) {
      setLoading(false);
      setFiles([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    getTopicPracticeFiles(topicId, subjectCode)
      .then((data) => {
        if (!cancelled) setFiles(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được các file luyện tập. Bạn thử lại sau nhé.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, subjectCode, topicId]);

  const topicName = files[0]?.topic_name || 'Chủ đề';
  const backHref = `/luyen-chu-de?subject=${encodeURIComponent(subjectSlug)}`;

  return (
    <section className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-red-600 dark:text-slate-300 dark:hover:text-red-300"><FiArrowLeft /> Tất cả chủ đề</Link>

      <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-white via-rose-50 to-red-50/80 p-6 shadow-[0_16px_42px_rgba(127,29,29,0.08)] dark:border-slate-800 dark:from-[#111b2d] dark:via-[#101c31] dark:to-[#1d1730] dark:shadow-none">
        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{topicName}</h2>
      </div>

      {!isAuthenticated ? (
        <div className="rounded-3xl border border-dashed border-red-200 bg-white/85 px-6 py-14 text-center dark:border-red-500/35 dark:bg-[#111b2d]">
          <h3 className="text-lg font-black text-slate-950 dark:text-white">Bạn cần đăng nhập để mở file luyện</h3>
          <Link href="/login" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700">Đăng nhập <FiArrowRight /></Link>
        </div>
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-[#111b2d]" />)}</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm font-bold text-rose-700 dark:border-rose-400/35 dark:bg-rose-400/10 dark:text-rose-200">{error}</div>
      ) : files.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-[#111b2d]">
          <FiBookOpen className="mx-auto mb-4 text-4xl text-slate-400 dark:text-slate-500" />
          <h3 className="text-lg font-black text-slate-950 dark:text-white">Chủ đề này chưa có file sẵn sàng</h3>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">File cần có PDF và đáp án đầy đủ trước khi người học có thể làm bài.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {files.map((file, index) => {
            const publishDate = formatDate(file.publish_date);
            return (
              <article key={file.exam_id} className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_16px_36px_rgba(127,29,29,0.12)] dark:border-slate-800 dark:bg-[#111b2d] dark:shadow-none dark:hover:border-red-500/40 dark:hover:bg-[#14213a]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200"><FiFileText size={20} /></div>
                    <div className="min-w-0"><p className="truncate text-sm font-black text-slate-950 dark:text-white">{file.file_name || `File luyện ${index + 1}`}</p><p className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-slate-400">Có file: {languageListLabel(file.paper_languages)}</p></div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="flex flex-1 flex-col px-5 py-5">
                  <h3 className="line-clamp-2 text-xl font-black leading-7 text-slate-950 dark:text-white">{file.title}</h3>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-500 dark:text-slate-300">{file.description || 'Luyện đúng trọng tâm của chủ đề bằng file PDF này.'}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FiLayers /> {file.question_count} câu</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-red-700 dark:bg-red-500/15 dark:text-red-200">{languageListLabel(file.paper_languages)}</span>
                    {file.pages ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FiFileText /> {file.pages} trang</span> : null}
                    {publishDate ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><FiClock /> {publishDate}</span> : null}
                  </div>
                  {file.user_attempt_count > 0 ? <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"><FiCheckCircle /> Đã làm {file.user_attempt_count} lần · điểm cao nhất {Number(file.user_best_score).toFixed(1)}</div> : <div className="mt-4 text-xs font-bold text-slate-400 dark:text-slate-400">Chưa có lượt làm bài</div>}
                  <Link href={`/exam/${file.exam_id}?workspace=topic`} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 group-hover:shadow-lg group-hover:shadow-red-600/20"><FiPlay /> Bắt đầu luyện file <FiArrowRight /></Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
