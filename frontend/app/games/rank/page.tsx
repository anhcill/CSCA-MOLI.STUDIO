'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { useAuthStore } from '@/lib/store/authStore';
import {
  findRankMatch,
  getMyRankMatches,
  getRankLeaderboard,
  getRankState,
  submitRankMatch,
  type GameQuestion,
} from '@/lib/api/games';
import { FiAward, FiCheck, FiChevronLeft, FiPlay, FiRefreshCw, FiShield, FiTarget } from 'react-icons/fi';

const tierColor: Record<string, string> = {
  Bronze: 'bg-orange-100 text-orange-700',
  Silver: 'bg-slate-100 text-slate-700',
  Gold: 'bg-amber-100 text-amber-700',
  Platinum: 'bg-cyan-100 text-cyan-700',
  Diamond: 'bg-violet-100 text-violet-700',
};

export default function RankPage() {
  const { isAuthenticated } = useAuthStore();
  const [season, setSeason] = useState<any>(null);
  const [rating, setRating] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [state, board, history] = await Promise.all([
        getRankState(),
        getRankLeaderboard(),
        getMyRankMatches(),
      ]);
      setSeason(state.season);
      setRating(state.rating);
      setLeaderboard(board.leaderboard);
      setMatches(history.matches);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được dữ liệu rank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAuthenticated]);

  const currentQuestion = useMemo(() => {
    return questions.find((question) => !answers[question.ref]) || questions[questions.length - 1] || null;
  }, [questions, answers]);

  const startQueue = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setAnswers({});
    try {
      const data = await findRankMatch();
      setSeason(data.season);
      setActiveMatch(data.match);
      setQuestions(data.questions);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tìm được trận rank.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!activeMatch) return;
    setBusy(true);
    try {
      const data = await submitRankMatch(activeMatch.id, answers);
      setResult(data);
      setRating(data.rating);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không nộp được trận rank.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-black text-slate-950">Thi đấu Rank</h1>
          <p className="mt-3 text-slate-500">Đăng nhập để ghép trận, tính MMR và xem bảng xếp hạng mùa.</p>
          <Link href="/login?redirect=/games/rank" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Đăng nhập</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/games" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900">
          <FiChevronLeft /> Quay lại Game Hub
        </Link>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white shadow-xl">
            <p className="text-sm font-bold text-cyan-300">Rank theo mùa</p>
            <h1 className="mt-1 text-3xl font-black">{season?.name || 'Mùa hiện tại'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Ghép trận async: hai người chơi cùng bộ câu hỏi, hệ thống so điểm và cập nhật MMR khi đủ bài nộp.</p>
            <button onClick={startQueue} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
              {busy ? <FiRefreshCw className="animate-spin" /> : <FiPlay />} Tìm trận
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700"><FiShield /></div>
              <div>
                <p className="text-sm text-slate-500">Rank hiện tại</p>
                <p className="text-2xl font-black text-slate-950">{rating?.rating || 1000} MMR</p>
              </div>
            </div>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${tierColor[rating?.tier] || tierColor.Bronze}`}>
              {rating?.tier || 'Bronze'}
            </span>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50 p-2"><b>{rating?.wins || 0}</b><br />Thắng</div>
              <div className="rounded-xl bg-slate-50 p-2"><b>{rating?.losses || 0}</b><br />Thua</div>
              <div className="rounded-xl bg-slate-50 p-2"><b>{rating?.streak || 0}</b><br />Streak</div>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        {activeMatch && !result && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Trận #{activeMatch.id} · {activeMatch.status === 'waiting' ? 'Đang chờ đối thủ' : 'Đã ghép đối thủ'}</p>
                <h2 className="text-xl font-black text-slate-950">Câu {Math.min(Object.keys(answers).length + 1, questions.length)} / {questions.length}</h2>
              </div>
              <button onClick={() => setActiveMatch(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Thoát trận</button>
            </div>

            {currentQuestion && (
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-500">{currentQuestion.exam_title || currentQuestion.prompt_cn || 'Câu hỏi rank'}</p>
                <h3 className="mt-2 whitespace-pre-wrap text-2xl font-black leading-snug text-slate-950">{currentQuestion.prompt}</h3>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {currentQuestion.answers.map((answer) => (
                    <button
                      key={answer.key}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.ref]: answer.key }))}
                      disabled={Boolean(answers[currentQuestion.ref])}
                      className={`rounded-xl border p-4 text-left text-sm font-bold transition ${
                        answers[currentQuestion.ref] === answer.key
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs">{answer.key}</span>
                      {answer.text}
                    </button>
                  ))}
                </div>
                {Object.keys(answers).length === questions.length && (
                  <button onClick={submit} disabled={busy} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 font-black text-white">
                    {busy ? 'Đang nộp...' : 'Nộp trận rank'}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {result && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <div className="flex items-center gap-2 font-black"><FiCheck /> Đã nộp trận rank</div>
            <p className="mt-2 text-sm">Điểm {result.submission.score} · Chính xác {result.submission.accuracy}% · Trạng thái trận: {result.match.status === 'completed' ? 'đã hoàn tất' : 'đang chờ đối thủ nộp bài'}.</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><FiAward /> Bảng xếp hạng mùa</h2>
            <div className="mt-4 space-y-2">
              {loading ? <p className="text-sm text-slate-400">Đang tải...</p> : leaderboard.map((row, index) => (
                <div key={row.user_id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-black text-slate-400">#{index + 1}</span>
                    <div>
                      <p className="font-bold text-slate-800">{row.full_name || row.username}</p>
                      <p className="text-xs text-slate-400">{row.wins} thắng · {row.matches_played} trận</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-950">{row.rating}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tierColor[row.tier] || tierColor.Bronze}`}>{row.tier}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><FiTarget /> Trận gần đây</h2>
            <div className="mt-4 space-y-2">
              {matches.length === 0 ? <p className="text-sm text-slate-400">Chưa có trận rank.</p> : matches.map((match) => (
                <div key={match.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Trận #{match.id}</span>
                    <span className="text-xs font-bold text-slate-400">{match.status}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{match.user_a_score ?? '-'} : {match.user_b_score ?? '-'}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
