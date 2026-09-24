'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FiArrowRight, FiBarChart2, FiBookOpen, FiFileText, FiTarget } from 'react-icons/fi';
import { getSubjectPracticeTopics, type SubjectPracticeTopic } from '@/lib/api/insights';
import { useAuthStore } from '@/lib/store/authStore';

interface TopicPracticeCatalogProps {
  subjectSlug: string;
  subjectCode: string;
  subjectLabel: string;
}

function LoadingCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-[#111b2d]" />
      ))}
    </div>
  );
}

export default function TopicPracticeCatalog({ subjectSlug, subjectCode, subjectLabel }: TopicPracticeCatalogProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [topics, setTopics] = useState<SubjectPracticeTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setTopics([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    getSubjectPracticeTopics(subjectCode)
      .then((data) => {
        if (!cancelled) setTopics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được danh sách chủ đề. Bạn thử lại sau nhé.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, subjectCode]);

  const availableTopics = useMemo(
    () => topics.filter((topic) => Number(topic.file_count) > 0),
    [topics],
  );

  if (!isAuthenticated) {
    return (
      <section className="rounded-3xl border border-dashed border-red-200 bg-white/85 px-6 py-14 text-center shadow-sm dark:border-red-500/35 dark:bg-[#111b2d] dark:shadow-none">
        <FiTarget className="mx-auto mb-4 text-4xl text-red-500 dark:text-red-300" />
        <h2 className="text-xl font-black text-slate-950 dark:text-white">Đăng nhập để mở bài luyện theo chủ đề</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">Mỗi môn có kho PDF và đáp án riêng, đồng thời lưu lại tiến độ của bạn.</p>
        <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700">
          Đăng nhập <FiArrowRight />
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-red-100 bg-gradient-to-br from-white via-rose-50 to-red-50/80 p-6 shadow-[0_16px_42px_rgba(127,29,29,0.08)] dark:border-slate-800 dark:from-[#111b2d] dark:via-[#101c31] dark:to-[#1d1730] dark:shadow-none sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Chọn chủ đề {subjectLabel}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-red-100 bg-white/75 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/45">
            <FiFileText className="text-xl text-red-600 dark:text-red-300" />
            <div><strong className="block text-lg font-black text-slate-950 dark:text-white">{availableTopics.length}</strong><span className="text-xs font-semibold text-slate-500 dark:text-slate-300">chủ đề đã có file</span></div>
          </div>
        </div>
      </div>

      {loading ? <LoadingCards /> : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm font-bold text-rose-700 dark:border-rose-400/35 dark:bg-rose-400/10 dark:text-rose-200">{error}</div>
      ) : availableTopics.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/85 px-6 py-14 text-center dark:border-slate-700 dark:bg-[#111b2d]">
          <FiBookOpen className="mx-auto mb-4 text-4xl text-slate-400 dark:text-slate-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Chưa có file luyện cho môn này</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">Khi quản trị viên thêm PDF kèm đáp án cho một chủ đề, file sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {availableTopics.map((topic, index) => {
            const accuracy = topic.accuracy === null ? null : Math.round(Number(topic.accuracy));
            return (
              <Link
                key={topic.topic_id}
                href={`/luyen-chu-de/chu-de/${topic.topic_id}?subject=${encodeURIComponent(subjectSlug)}`}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_16px_36px_rgba(127,29,29,0.12)] dark:border-slate-800 dark:bg-[#111b2d] dark:shadow-none dark:hover:border-red-500/40 dark:hover:bg-[#14213a]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 translate-x-9 -translate-y-9 rounded-full bg-red-100/80 transition group-hover:scale-125 dark:bg-red-500/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-lg font-black text-red-600 dark:bg-red-500/15 dark:text-red-200">{String(index + 1).padStart(2, '0')}</div>
                  <FiArrowRight className="mt-2 text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-red-600 dark:text-slate-600 dark:group-hover:text-red-300" />
                </div>
                <h3 className="relative mt-7 line-clamp-2 text-lg font-black leading-6 text-slate-950 dark:text-white">{topic.topic_name}</h3>
                <p className="relative mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-500 dark:text-slate-300">{topic.description || 'Mở các file luyện tập tập trung cho chủ đề này.'}</p>
                <div className="relative mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-600 dark:text-red-200"><FiFileText /> {topic.file_count} file luyện</span>
                  {accuracy === null ? <span className="text-xs font-bold text-slate-400 dark:text-slate-400">Chưa làm</span> : <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-300"><FiBarChart2 /> {accuracy}%</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
