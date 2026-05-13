'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState<number | null>(null);
  const [error, setError] = useState('');

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FiRefreshCw className="animate-spin text-3xl text-indigo-600" />
      </div>
    );
  }

  if (error || !practiceSet) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <p className="font-bold text-gray-900">{error || 'Khong tim thay bo luyen tap.'}</p>
        <Link href="/profile/insights" className="mt-4 text-indigo-600 font-semibold">Quay lai insights</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push('/profile/insights')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <FiArrowLeft />
            </button>
            <div className="min-w-0">
              <h1 className="font-black text-gray-900 truncate">{practiceSet.title}</h1>
              <p className="text-sm text-gray-500">{practiceSet.questions.length} cau - {practiceSet.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-gray-900">{submitted ? `${score.correct}/${score.total}` : `${Object.keys(answers).length}/${score.total}`}</p>
            <p className="text-xs text-gray-500">{submitted ? 'ket qua' : 'da chon'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {practiceSet.questions.map((question, index) => {
          const chosen = answers[question.id];
          const correctAnswer = question.answers.find((a) => a.is_correct);
          const isCorrect = chosen && correctAnswer?.answer_key === chosen;

          return (
            <section key={question.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-indigo-600">
                    #{index + 1} - {question.subject_name} - {question.exam_title}
                  </p>
                  <h2 className="mt-2 text-base font-bold text-gray-900 whitespace-pre-wrap">
                    {question.question_text}
                  </h2>
                  {question.question_text_cn && (
                    <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{question.question_text_cn}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleBookmark(question)}
                  className={`p-2 rounded-lg ${bookmarks[question.id] ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:bg-gray-100'}`}
                  title="Bookmark cau hoi"
                >
                  <FiBookmark />
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                {question.answers.map((answer) => {
                  const selected = chosen === answer.answer_key;
                  const revealCorrect = submitted && answer.is_correct;
                  const revealWrong = submitted && selected && !answer.is_correct;

                  return (
                    <button
                      key={answer.id}
                      onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [question.id]: answer.answer_key }))}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        revealCorrect
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                          : revealWrong
                            ? 'border-rose-400 bg-rose-50 text-rose-900'
                            : selected
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                              : 'border-gray-200 text-gray-700 hover:border-indigo-300'
                      }`}
                    >
                      <span className="font-black mr-2">{answer.answer_key}.</span>
                      {answer.answer_text}
                      {answer.answer_text_cn && <span className="block mt-1 text-gray-500">{answer.answer_text_cn}</span>}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className={`mt-4 rounded-xl p-4 ${isCorrect ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <p className={`font-bold flex items-center gap-2 ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {isCorrect ? <FiCheckCircle /> : <FiXCircle />}
                    {isCorrect ? 'Dung' : `Sai - dap an dung: ${correctAnswer?.answer_key || '-'}`}
                  </p>
                  {question.explanation && (
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{question.explanation}</p>
                  )}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-gray-100 p-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                  <FiEdit3 /> Notebook ca nhan
                </label>
                <textarea
                  value={notes[question.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  placeholder="Ghi lai ly do sai, cong thuc can nho, meo lam bai..."
                />
                <button
                  onClick={() => saveNote(question.id)}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
                >
                  <FiSave /> {savingNote === question.id ? 'Dang luu...' : 'Luu ghi chu'}
                </button>
              </div>
            </section>
          );
        })}

        <div className="sticky bottom-4 bg-white/95 backdrop-blur border border-gray-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4">
          <div>
            <p className="font-black text-gray-900">
              {submitted ? `Ket qua: ${score.correct}/${score.total}` : `${Object.keys(answers).length}/${score.total} cau da chon`}
            </p>
            <p className="text-sm text-gray-500">Sau khi nop bai, dap an va giai thich se hien ra.</p>
          </div>
          <button
            onClick={() => setSubmitted(true)}
            disabled={submitted || Object.keys(answers).length === 0}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Nop bo luyen
          </button>
        </div>
      </main>
    </div>
  );
}

