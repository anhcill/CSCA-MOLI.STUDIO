'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FiArrowLeft, FiBookmark, FiCheckCircle, FiEdit3, FiRefreshCw, FiSave, FiXCircle,
} from 'react-icons/fi';
import {
  deleteBookmark,
  getPracticeSet,
  saveBookmark,
  saveQuestionNote,
  type PracticeQuestion,
  type PracticeSetDetail,
} from '@/lib/api/insights';
import AiAnalyzingOverlay from '@/components/common/AiAnalyzingOverlay';
import RichMathText from '@/components/common/RichMathText';

type AnswerState = Record<number, string>;
type NoteState = Record<number, string>;
type BookmarkState = Record<number, boolean>;

export default function PracticeSetPage() {
  const params = useParams();
  const router = useRouter();
  const setId = Number(params?.id);
  const [practiceSet, setPracticeSet] = useState<PracticeSetDetail | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [notes, setNotes] = useState<NoteState>({});
  const [bookmarks, setBookmarks] = useState<BookmarkState>({});
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState<number | null>(null);
  const [error, setError] = useState('');
  const submitDelayRef = useRef<number | null>(null);

  const loadSet = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPracticeSet(setId);
      setPracticeSet(data);
      setNotes(Object.fromEntries(data.questions.map((q) => [q.id, q.note || ''])));
      setBookmarks(Object.fromEntries(data.questions.map((q) => [q.id, q.is_bookmarked])));
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
      else setError(err.response?.data?.message || 'Khong tai duoc bo luyen tap.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (setId) loadSet();
  }, [setId]);

  useEffect(() => () => {
    if (submitDelayRef.current) window.clearTimeout(submitDelayRef.current);
  }, []);

  const score = useMemo(() => {
    if (!practiceSet) return { correct: 0, total: 0 };
    const correct = practiceSet.questions.filter((q) => {
      const chosen = answers[q.id];
      return q.answers.some((a) => a.answer_key === chosen && a.is_correct);
    }).length;
    return { correct, total: practiceSet.questions.length };
  }, [answers, practiceSet]);

  const toggleBookmark = async (question: PracticeQuestion) => {
    const next = !bookmarks[question.id];
    setBookmarks((prev) => ({ ...prev, [question.id]: next }));
    try {
      if (next) {
        await saveBookmark({
          entity_type: 'question',
          entity_id: question.id,
          title: `Cau ${question.question_number} - ${question.exam_title}`,
          metadata: {
            exam_id: question.exam_id,
            subject_code: question.subject_code,
            category: question.question_category,
          },
        });
      } else {
        await deleteBookmark('question', question.id);
      }
    } catch {
      setBookmarks((prev) => ({ ...prev, [question.id]: !next }));
    }
  };

  const saveNote = async (questionId: number) => {
    try {
      setSavingNote(questionId);
      await saveQuestionNote(questionId, notes[questionId] || '');
    } finally {
      setSavingNote(null);
    }
  };

  const submitPractice = () => {
    if (submitted || analyzing || submitDelayRef.current || Object.keys(answers).length === 0) return;

    setAnalyzing(true);
    submitDelayRef.current = window.setTimeout(() => {
      setSubmitted(true);
      setAnalyzing(false);
      submitDelayRef.current = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 900);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCw className="animate-spin text-4xl text-purple-600" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Đang tải bộ luyện tập...</p>
        </div>
      </div>
    );
  }

  if (error || !practiceSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full flex items-center justify-center mb-4 text-xl">⚠️</div>
        <p className="font-extrabold text-gray-900 dark:text-white text-lg">{error || 'Không tìm thấy bộ luyện tập.'}</p>
        <Link href="/profile/insights" className="mt-4 px-6 py-2.5 bg-purple-600 text-white font-bold text-sm rounded-xl hover:bg-purple-700 shadow-md transition-all">Quay lại Insights</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-24">
      <AiAnalyzingOverlay open={analyzing} mode="practice" />

      <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/profile/insights')} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0">
              <FiArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="font-black text-gray-900 dark:text-white text-lg sm:text-xl truncate">{practiceSet.title}</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{practiceSet.questions.length} câu hỏi · {practiceSet.description}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {submitted ? `${score.correct}/${score.total}` : `${Object.keys(answers).length}/${score.total}`}
            </p>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{submitted ? 'kết quả' : 'đã chọn'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {practiceSet.questions.map((question, index) => {
          const chosen = answers[question.id];
          const correctAnswer = question.answers.find((a) => a.is_correct);
          const isCorrect = chosen && correctAnswer?.answer_key === chosen;

          return (
            <section key={question.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/80 dark:border-gray-800/80 p-6 shadow-sm hover:shadow-md transition-all duration-205">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 rounded-md uppercase tracking-wider">
                    Câu #{index + 1} · {question.subject_name || 'CSCA'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1 truncate">{question.exam_title}</p>
                  <RichMathText
                    value={question.question_text}
                    className="mt-3 text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-relaxed"
                  />
                  {question.question_text_cn && (
                    <RichMathText
                      value={question.question_text_cn}
                      className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic"
                    />
                  )}
                </div>
                <button
                  onClick={() => toggleBookmark(question)}
                  className={`p-2.5 rounded-xl transition-all shrink-0 border ${
                    bookmarks[question.id]
                      ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400 shadow-sm'
                      : 'border-transparent text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  title="Bookmark câu hỏi"
                >
                  <FiBookmark size={18} />
                </button>
              </div>

              <div className="mt-5 grid gap-2.5">
                {question.answers.map((answer) => {
                  const selected = chosen === answer.answer_key;
                  const revealCorrect = submitted && answer.is_correct;
                  const revealWrong = submitted && selected && !answer.is_correct;

                  let optionStyle = 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-800 hover:bg-purple-50/10';
                  if (revealCorrect) {
                    optionStyle = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300 font-semibold shadow-sm shadow-emerald-500/5';
                  } else if (revealWrong) {
                    optionStyle = 'border-rose-450 bg-rose-50 dark:bg-rose-950/20 text-rose-950 dark:text-rose-300 font-semibold shadow-sm shadow-rose-500/5';
                  } else if (selected) {
                    optionStyle = 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-950 dark:text-purple-300 font-semibold';
                  }

                  return (
                    <button
                      key={answer.id}
                      disabled={submitted}
                      onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [question.id]: answer.answer_key }))}
                      className={`w-full rounded-2xl border px-4 py-3.5 text-left text-sm transition-all duration-200 flex items-start gap-2.5 ${optionStyle}`}
                    >
                      <span className="font-extrabold shrink-0">{answer.answer_key}.</span>
                      <div className="flex-1">
                        <RichMathText value={answer.answer_text || ''} className="font-normal" />
                        {answer.answer_text_cn && (
                          <RichMathText
                            value={answer.answer_text_cn}
                            className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-normal"
                          />
                        )}
                      </div>
                      {revealCorrect && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓ Đúng</span>}
                      {revealWrong && <span className="text-xs text-rose-600 dark:text-rose-400 font-bold shrink-0">✗ Bạn chọn</span>}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className={`mt-5 rounded-2xl p-5 border ${
                  isCorrect
                    ? 'bg-emerald-50/30 border-emerald-100/50 text-emerald-900 dark:bg-emerald-950/10 dark:border-emerald-900/20 dark:text-emerald-300'
                    : 'bg-rose-50/30 border-rose-100/50 text-rose-900 dark:bg-rose-950/10 dark:border-rose-900/20 dark:text-rose-300'
                }`}>
                  <p className={`font-bold flex items-center gap-2 text-sm ${isCorrect ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                    {isCorrect ? <FiCheckCircle size={18} /> : <FiXCircle size={18} />}
                    {isCorrect ? 'Chúc mừng! Bạn đã trả lời đúng.' : `Chưa chính xác. Đáp án đúng là: ${correctAnswer?.answer_key || '-'}`}
                  </p>
                  {question.explanation && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-base leading-7 text-blue-950 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                      <p className="mb-2 font-bold uppercase tracking-wide text-blue-900 dark:text-blue-200">💡 Giải thích:</p>
                      <p className="whitespace-pre-wrap">{question.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Personal Note */}
              <div className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/30">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
                  <FiEdit3 className="text-purple-500" /> Notebook cá nhân
                </label>
                <textarea
                  value={notes[question.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm outline-none focus:border-purple-500 dark:focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all dark:text-white"
                  placeholder="Ghi lại lý do sai, công thức cần nhớ, mẹo làm bài..."
                />
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={() => saveNote(question.id)}
                    disabled={savingNote === question.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-purple-600 dark:hover:bg-purple-755 text-white px-4 py-2 text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-60"
                  >
                    <FiSave />
                    <span>{savingNote === question.id ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
                  </button>
                </div>
              </div>
            </section>
          );
        })}

        {/* Floating Submit Bar */}
        <div className="sticky bottom-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-[1360px] mx-auto z-20">
          <div>
            <p className="font-extrabold text-gray-900 dark:text-white text-base">
              {submitted ? `Kết quả luyện tập: ${score.correct}/${score.total}` : `${Object.keys(answers).length}/${score.total} câu đã chọn`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
              {submitted ? 'Bài làm của bạn đã được ghi lại vào lịch sử.' : 'Sau khi nộp bài, đáp án và giải thích chi tiết sẽ hiện ra.'}
            </p>
          </div>
          <div className="flex justify-end gap-3 shrink-0">
            {submitted ? (
              <button
                onClick={() => router.push('/profile/insights')}
                className="w-full sm:w-auto rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-[0.97]"
              >
                Về Insights
              </button>
            ) : (
              <button
                onClick={submitPractice}
                disabled={submitted || analyzing || Object.keys(answers).length === 0}
                className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3.5 text-sm font-black transition-all shadow-lg shadow-purple-600/20 hover:shadow-xl active:scale-[0.97] disabled:opacity-50"
              >
                {analyzing ? 'Đang phân tích...' : 'Nộp bài luyện'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

