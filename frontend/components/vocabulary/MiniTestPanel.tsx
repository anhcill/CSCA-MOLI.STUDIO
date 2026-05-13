'use client';

import { useState } from 'react';
import { FiCheckCircle, FiPlay, FiXCircle } from 'react-icons/fi';
import { vocabularyReviewApi, type VocabularyReviewFilters } from '@/lib/api/vocabulary';
import type { MiniTestQuestion, MiniTestResult } from '@/lib/types/vocabulary';

interface Props {
  filters: VocabularyReviewFilters;
  onSubmitted?: () => void;
}

export default function MiniTestPanel({ filters, onSubmitted }: Props) {
  const [questions, setQuestions] = useState<MiniTestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<MiniTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startTest = async () => {
    try {
      setLoading(true);
      setError('');
      setResult(null);
      setAnswers({});
      const data = await vocabularyReviewApi.getMiniTest({ ...filters, limit: 10 });
      setQuestions(data);
    } catch (err: any) {
      setError(err.response?.status === 401 ? 'Đăng nhập để làm mini test.' : 'Không tải được mini test.');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      setLoading(true);
      const payload = questions.map((q) => ({
        vocabulary_id: q.vocabulary_id,
        answer: answers[q.vocabulary_id] || '',
      }));
      const data = await vocabularyReviewApi.submitMiniTest(payload);
      setResult(data);
      onSubmitted?.();
    } catch (err) {
      setError('Không nộp được mini test.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-cyan-100 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-900">Mini test tu vung</h2>
          <p className="text-sm text-gray-500">Chọn nghĩa đúng, kết quả sẽ cập nhật lịch ôn</p>
        </div>
        <button
          onClick={startTest}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-60"
        >
          <FiPlay /> Tao de
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      {result ? (
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-2xl font-black text-gray-900">
            {result.score}/{result.total} cau dung
          </p>
          <div className="mt-3 space-y-2">
            {result.results.map((item) => (
              <div key={item.vocabulary_id} className="flex items-start gap-2 text-sm">
                {item.correct ? <FiCheckCircle className="mt-0.5 text-emerald-600" /> : <FiXCircle className="mt-0.5 text-rose-600" />}
                <div>
                  <span className="font-bold text-gray-900">{item.word_cn}</span>
                  <span className="text-gray-500"> ({item.pinyin})</span>
                  <span className="text-gray-600"> - dap an: {item.correct_answer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : questions.length ? (
        <>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.vocabulary_id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-black text-cyan-700">#{index + 1}</span>
                  <span className="text-2xl font-black text-gray-900">{question.word_cn}</span>
                  <span className="text-sm italic text-cyan-700">{question.pinyin}</span>
                  {question.word_en && <span className="text-sm text-gray-500">/ {question.word_en}</span>}
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  {question.choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.vocabulary_id]: choice }))}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                        answers[question.vocabulary_id] === choice
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                          : 'border-gray-200 text-gray-700 hover:border-cyan-300'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={loading || questions.some((q) => !answers[q.vocabulary_id])}
            className="mt-4 w-full px-4 py-3 rounded-xl bg-cyan-600 text-white font-black hover:bg-cyan-700 disabled:opacity-50"
          >
            Nop bai
          </button>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-500">
          Bấm Tạo đề để làm bài test nhanh.
        </div>
      )}
    </section>
  );
}

