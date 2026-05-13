'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiBookmark, FiBookOpen, FiEdit3, FiRefreshCw, FiTarget, FiZap,
} from 'react-icons/fi';
import {
  createWeakTopicPractice,
  createWrongQuestionPractice,
  getLearningActionSummary,
  type LearningActionSummary,
  type WeakTopicAction,
} from '@/lib/api/insights';

const num = (value?: number) => Number(value || 0).toLocaleString('vi-VN');

export default function LearningActionsPanel() {
  const router = useRouter();
  const [summary, setSummary] = useState<LearningActionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getLearningActionSummary();
      setSummary(data);
    } catch {
      setError('Không tải được luồng hành động học tập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const openPractice = async (type: 'wrong' | 'weak', topic?: WeakTopicAction) => {
    try {
      setCreating(type === 'wrong' ? 'wrong' : `weak-${topic?.topic_id || 'auto'}`);
      const set = type === 'wrong'
        ? await createWrongQuestionPractice(20)
        : await createWeakTopicPractice(topic?.topic_id, 20);
      router.push(`/practice-sets/${set.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Chưa tạo được bộ luyện tập.');
    } finally {
      setCreating(null);
    }
  };

  const cards = [
    { label: 'Câu sai có thể luyện lại', value: summary?.wrongQuestionCount, icon: FiTarget, tone: 'text-rose-700 bg-rose-50' },
    { label: 'Chủ đề yếu', value: summary?.weakTopics?.length, icon: FiZap, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Bookmark', value: summary?.bookmarkCount, icon: FiBookmark, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Ghi chu notebook', value: summary?.noteCount, icon: FiEdit3, tone: 'text-emerald-700 bg-emerald-50' },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <FiZap className="text-amber-500" /> Hành động tiếp theo
          </h2>
          <p className="text-sm text-gray-500 mt-1">Biến phân tích thành bài luyện, bookmark và notebook cá nhân.</p>
        </div>
        <button onClick={loadSummary} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-gray-100 p-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon />
            </div>
            <p className="mt-3 text-2xl font-black text-gray-900">{loading ? '--' : num(value)}</p>
            <p className="text-xs font-semibold text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-900">Luyện lại câu sai</h3>
          <p className="text-sm text-gray-500 mt-1">Gom các câu bạn sai gần đây thành một bộ luyện tập riêng.</p>
          <button
            onClick={() => openPractice('wrong')}
            disabled={creating === 'wrong' || !summary?.wrongQuestionCount}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <FiTarget /> Tạo bộ câu sai
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-900">Tạo đề từ chủ đề yếu</h3>
          <p className="text-sm text-gray-500 mt-1">Chọn chủ đề có tỉ lệ sai cao để tạo bộ câu tập trung.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {summary?.weakTopics?.slice(0, 4).map((topic) => (
              <button
                key={topic.topic_id}
                onClick={() => openPractice('weak', topic)}
                disabled={creating === `weak-${topic.topic_id}`}
                className="rounded-xl border border-amber-200 px-3 py-2 text-left text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
              >
                {topic.topic_name}
                <span className="ml-2 text-xs text-amber-600">{Number(topic.error_percentage).toFixed(0)}%</span>
              </button>
            ))}
            {!summary?.weakTopics?.length && (
              <span className="text-sm text-gray-400">Chưa có chủ đề yếu dù rõ.</span>
            )}
          </div>
        </div>
      </div>

      {summary?.nextLessons?.length ? (
        <div className="mt-5 rounded-xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FiBookOpen /> Gợi ý bài học tiếp theo
          </h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.nextLessons.slice(0, 4).map((lesson) => (
              <div key={`${lesson.subjectCode}-${lesson.topicId}`} className="rounded-lg bg-gray-50 p-3">
                <p className="font-bold text-gray-900">{lesson.topicName}</p>
                <p className="text-xs text-rose-600 mt-0.5">Tỉ lệ sai {lesson.errorPercentage.toFixed(1)}%</p>
                {lesson.materials.slice(0, 2).map((m) => (
                  <p key={m.id} className="mt-2 text-sm text-gray-600">Tài liệu: {m.title}</p>
                ))}
                {lesson.vocabulary.slice(0, 1).map((v) => (
                  <p key={`${v.subject}-${v.topic}`} className="mt-1 text-sm text-gray-600">
                    Từ vựng: {num(v.word_count)} từ trong chủ đề
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

