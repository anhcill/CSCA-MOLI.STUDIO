'use client';

import { FiActivity, FiCalendar, FiCheckCircle, FiRefreshCw, FiTarget } from 'react-icons/fi';
import type { VocabularyReviewDashboard } from '@/lib/types/vocabulary';
import { type AppLanguage, useLanguage } from '@/context/LanguageContext';

interface Props {
  data: VocabularyReviewDashboard | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const NUMBER_LOCALES: Record<AppLanguage, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
};

const numberValue = (value: number | undefined, language: AppLanguage) =>
  Number(value || 0).toLocaleString(NUMBER_LOCALES[language]);

export default function ReviewStatsPanel({ data, loading, onRefresh }: Props) {
  const { language, t } = useLanguage();
  const summary = data?.summary;
  const stats = [
    { labelKey: 'vocab.dueToday', value: summary?.due_today, icon: FiCalendar, tone: 'text-blue-700 bg-blue-50' },
    { labelKey: 'vocab.weakWords', value: summary?.weak_words, icon: FiTarget, tone: 'text-rose-700 bg-rose-50' },
    { labelKey: 'vocab.mastered', value: summary?.mastered_words, icon: FiCheckCircle, tone: 'text-emerald-700 bg-emerald-50' },
    { labelKey: 'vocab.started', value: summary?.started_words, icon: FiActivity, tone: 'text-violet-700 bg-violet-50' },
  ];

  return (
    <section className="bg-white rounded-2xl border border-cyan-100 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">{t('vocab.reviewTitle')}</h2>
          <p className="text-sm text-gray-500">{t('vocab.reviewDesc')}</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 text-cyan-700 hover:bg-cyan-50 rounded-lg"
          title={t('vocab.refreshStats')}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ labelKey, value, icon: Icon, tone }) => (
          <div key={labelKey} className="rounded-xl border border-gray-100 p-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon />
            </div>
            <p className="text-2xl font-black text-gray-900 mt-3">{numberValue(value, language)}</p>
            <p className="text-xs font-semibold text-gray-500">{t(labelKey)}</p>
          </div>
        ))}
      </div>

      {data?.topics?.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">{t('vocab.topic')}</th>
                <th className="py-2 px-3 text-right">{t('vocab.due')}</th>
                <th className="py-2 px-3 text-right">{t('vocab.weak')}</th>
                <th className="py-2 pl-3 text-right">{t('vocab.mastered')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.slice(0, 6).map((topic) => (
                <tr key={`${topic.subject}-${topic.topic}`} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-gray-800">{topic.topic}</td>
                  <td className="py-2 px-3 text-right text-blue-700">{numberValue(topic.due_now, language)}</td>
                  <td className="py-2 px-3 text-right text-rose-700">{numberValue(topic.weak_words, language)}</td>
                  <td className="py-2 pl-3 text-right text-emerald-700">{numberValue(topic.mastered_words, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

