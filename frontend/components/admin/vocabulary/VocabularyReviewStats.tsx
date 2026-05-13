'use client';

import { useEffect, useState } from 'react';
import { FiActivity, FiBarChart2, FiCheckCircle, FiRefreshCw, FiTarget, FiUsers } from 'react-icons/fi';
import { vocabularyAdminApi } from '@/lib/api/vocabulary';
import type { AdminVocabularyReviewStats } from '@/lib/types/vocabulary';

const num = (value?: number) => Number(value || 0).toLocaleString('vi-VN');

export default function VocabularyReviewStats() {
  const [stats, setStats] = useState<AdminVocabularyReviewStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await vocabularyAdminApi.getReviewStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const summary = stats?.summary;
  const cards = [
    { label: 'Nguoi hoc', value: summary?.active_learners, icon: FiUsers, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Tu da track', value: summary?.tracked_words, icon: FiActivity, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Luot on', value: summary?.total_reviews, icon: FiBarChart2, tone: 'bg-gray-50 text-gray-700' },
    { label: 'Tu yeu', value: summary?.weak_reviews, icon: FiTarget, tone: 'bg-rose-50 text-rose-700' },
    { label: 'Da nho', value: summary?.mastered_reviews, icon: FiCheckCircle, tone: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Thong ke flashcard</h2>
          <p className="text-sm text-gray-500">Theo doi SM-2, tu yeu va lich on cua hoc vien</p>
        </div>
        <button onClick={loadStats} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-gray-100 p-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-3">{num(value)}</p>
            <p className="text-xs font-semibold text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {stats?.topics?.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2">Mon</th>
                <th className="px-3 py-2">Chu de</th>
                <th className="px-3 py-2 text-right">Nguoi hoc</th>
                <th className="px-3 py-2 text-right">Can on</th>
                <th className="px-3 py-2 text-right">Tu yeu</th>
                <th className="px-3 py-2 text-right">Da nho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.topics.slice(0, 8).map((topic) => (
                <tr key={`${topic.subject}-${topic.topic}`}>
                  <td className="px-3 py-2 text-gray-500">{topic.subject}</td>
                  <td className="px-3 py-2 font-semibold text-gray-900">{topic.topic}</td>
                  <td className="px-3 py-2 text-right">{num(topic.learners)}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{num(topic.due_now)}</td>
                  <td className="px-3 py-2 text-right text-rose-700">{num(topic.weak_words)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{num(topic.mastered_words)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

