'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import {
  answerGameQuestion,
  finishGame,
  finishExternalGame,
  getGameHub,
  getUnlockCatalog,
  purchaseUnlock,
  startGame,
  type GameMode,
  type GameQuestion,
} from '@/lib/api/games';
import { FiAward, FiCheck, FiChevronLeft, FiClock, FiExternalLink, FiGift, FiLock, FiMaximize2, FiMinimize2, FiPlay, FiStar, FiZap } from 'react-icons/fi';

const toneMap: Record<string, string> = {
  quiz: 'from-blue-500 to-cyan-500',
  vocabulary: 'from-emerald-500 to-teal-500',
  boss: 'from-rose-500 to-orange-500',
  mixed: 'from-amber-500 to-pink-500',
  external: 'from-fuchsia-500 to-indigo-500',
};

export default function GamesPage() {
  const { isAuthenticated, updateUser } = useAuthStore();
  const [modes, setModes] = useState<GameMode[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<{ mode: GameMode; session: any; questions: GameQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [unlockData, setUnlockData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const externalFrameRef = useRef<HTMLDivElement>(null);
  const [isFrameFullscreen, setIsFrameFullscreen] = useState(false);

  const load = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const [hub, unlocks] = await Promise.all([getGameHub(), getUnlockCatalog()]);
      setModes(hub.modes);
      setRecent(hub.recent);
      setBalance(hub.balance);
      setUnlockData(unlocks);
      updateUser({ coins: hub.balance });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không tải được khu trò chơi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAuthenticated]);

  useEffect(() => {
    if (!active || active.mode.mode_type !== 'external') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFrameFullscreen(document.fullscreenElement === externalFrameRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const currentQuestion = useMemo(() => {
    if (!active) return null;
    return active.questions.find((question) => !answers[question.ref]) || active.questions[active.questions.length - 1];
  }, [active, answers]);

  const answeredCount = active ? Object.keys(answers).length : 0;
  const isExternalActive = active?.mode.mode_type === 'external';
  const externalConfig = active?.mode.config || {};
  const minPlaySeconds = Number(externalConfig.min_play_seconds || 30);
  const elapsedExternalSeconds = active?.session?.started_at
    ? Math.max(0, Math.floor((now - new Date(active.session.started_at).getTime()) / 1000))
    : 0;
  const externalReady = Boolean(isExternalActive && elapsedExternalSeconds >= minPlaySeconds);
  const visibleModes = useMemo(() => modes.filter((mode) => mode.is_active), [modes]);
  const learningModes = useMemo(() => visibleModes.filter((mode) => mode.mode_type !== 'external'), [visibleModes]);
  const relaxingModes = useMemo(() => visibleModes.filter((mode) => mode.mode_type === 'external'), [visibleModes]);

  const begin = async (mode: GameMode) => {
    setBusy(true);
    setError('');
    setResult(null);
    setAnswers({});
    setFeedback({});
    try {
      const data = await startGame(mode.slug);
      setActive(data);
      setNow(Date.now());
      if (mode.entry_fee_coins > 0) {
        const next = Math.max(0, balance - mode.entry_fee_coins);
        setBalance(next);
        updateUser({ coins: next });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không bắt đầu được mini game.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (question: GameQuestion, key: string) => {
    if (!active || answers[question.ref]) return;
    setAnswers((prev) => ({ ...prev, [question.ref]: key }));
    try {
      const data = await answerGameQuestion(active.session.id, question.ref, key, 5);
      setFeedback((prev) => ({ ...prev, [question.ref]: data.is_correct }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không lưu được câu trả lời.');
    }
  };

  const finish = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const data = await finishGame(active.session.id);
      setResult(data);
      setBalance(data.balance);
      updateUser({ coins: data.balance });
      setRecent((prev) => [data.session, ...prev].slice(0, 8));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không kết thúc được phiên chơi.');
    } finally {
      setBusy(false);
    }
  };

  const finishExternal = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const score = Math.min(Number(externalConfig.max_score || 1500), 500 + elapsedExternalSeconds * 3);
      const data = await finishExternalGame(active.session.id, score);
      setResult(data);
      setBalance(data.balance);
      updateUser({ coins: data.balance });
      setRecent((prev) => [data.session, ...prev].slice(0, 8));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Chưa thể ghi nhận phiên game này.');
    } finally {
      setBusy(false);
    }
  };

  const toggleExternalFullscreen = async () => {
    const frame = externalFrameRef.current;
    if (!frame) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch {
      if (externalConfig.external_url) {
        window.open(externalConfig.external_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const renderModeCard = (mode: GameMode) => (
    <article key={mode.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-2 bg-gradient-to-r ${toneMap[mode.mode_type] || toneMap.quiz}`} />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">{mode.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{mode.description}</p>
          </div>
          {!mode.is_active && <FiLock className="text-slate-300" />}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
          <span className="rounded-lg bg-slate-50 px-2 py-1"><FiZap className="inline" /> {mode.mode_type === 'external' ? 'Game ngoài' : `${mode.question_count} câu`}</span>
          <span className="rounded-lg bg-slate-50 px-2 py-1"><FiGift className="inline" /> +{mode.reward_coins} xu</span>
          <span className="rounded-lg bg-slate-50 px-2 py-1">Phí {mode.entry_fee_coins} xu</span>
          <span className="rounded-lg bg-slate-50 px-2 py-1">Cap {mode.daily_reward_cap}/ngày</span>
        </div>
        <button onClick={() => begin(mode)} disabled={!mode.is_active || busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:bg-slate-300">
          <FiPlay /> Chơi ngay
        </button>
      </div>
    </article>
  );

  const buyUnlock = async (type: string, key: string) => {
    setBusy(true);
    try {
      await purchaseUnlock(type, key);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không đủ xu hoặc vật phẩm đã được mở khóa.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 text-center sm:px-6 lg:px-10">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:text-slate-950">
            <FiChevronLeft /> Quay về trang chủ
          </Link>
          <h1 className="text-3xl font-black text-slate-950">Game Hub</h1>
          <p className="mt-3 text-slate-500">Đăng nhập để chơi mini game, nhận xu và leo rank.</p>
          <Link href="/login?redirect=/games" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Đăng nhập</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-10">
        {active ? (
          <button
            type="button"
            onClick={() => { setActive(null); setResult(null); load(); }}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:text-slate-950"
          >
            <FiChevronLeft /> Quay lại Game Hub
          </button>
        ) : (
          <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:text-slate-950">
            <FiChevronLeft /> Quay về trang chủ
          </Link>
        )}

        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-cyan-300">Học mà chơi, chơi vẫn lên trình</p>
            <h1 className="mt-1 text-3xl font-black">Game Hub</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Luyện phản xạ, từ vựng và kiến thức bằng mini game nhanh. Xu dùng để mở lượt chơi, vật phẩm và vẫn giữ giảm giá VIP/khóa học như hiện tại.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-white/10 px-5 py-4">
              <FiStar className="mx-auto text-amber-300" />
              <p className="mt-1 text-2xl font-black">{balance.toLocaleString('vi-VN')}</p>
              <p className="text-xs text-slate-300">Xu hiện có</p>
            </div>
            <Link href="/games/rank" className="rounded-2xl bg-cyan-400 px-5 py-4 text-slate-950 transition hover:bg-cyan-300">
              <FiAward className="mx-auto" />
              <p className="mt-1 font-black">Thi đấu Rank</p>
              <p className="text-xs opacity-70">MMR theo mùa</p>
            </Link>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        {active ? (
          <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${isExternalActive ? 'p-3 sm:p-4' : 'p-5'}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{active.mode.name}</p>
                <h2 className="text-xl font-black text-slate-950">
                  {isExternalActive ? 'Đang chơi game thư giãn' : `Câu ${Math.min(answeredCount + 1, active.questions.length)} / ${active.questions.length}`}
                </h2>
              </div>
              <button onClick={() => { setActive(null); setResult(null); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Thoát</button>
            </div>

            {isExternalActive && !result && (
              <div className="space-y-4">
                <div ref={externalFrameRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{active.mode.name}</p>
                      <p className="text-xs text-slate-400">{externalConfig.provider || 'External game'} {externalConfig.license ? `- ${externalConfig.license}` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleExternalFullscreen}
                      className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
                      title={isFrameFullscreen ? 'Thoát toàn màn hình' : 'Phóng to toàn màn hình'}
                    >
                      {isFrameFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                    </button>
                    {externalConfig.external_url && (
                      <a href={externalConfig.external_url} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 p-2 hover:bg-white/20" title="Mở tab mới">
                        <FiExternalLink />
                      </a>
                    )}
                  </div>
                  {externalConfig.external_url ? (
                    <iframe
                      src={externalConfig.external_url}
                      title={active.mode.name}
                      className="h-[78vh] min-h-[680px] w-full bg-white"
                      allow="fullscreen; gamepad; autoplay; clipboard-write; accelerometer; gyroscope"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="flex h-[78vh] min-h-[680px] items-center justify-center bg-white p-6 text-center text-sm font-bold text-slate-500">
                      Game này chưa có nội dung hiển thị.
                    </div>
                  )}
                </div>
                <aside className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><FiClock /> Thời gian ghi nhận</div>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <p className="text-3xl font-black text-slate-950">{elapsedExternalSeconds}s</p>
                      <p className="pb-1 text-sm text-slate-500">Cần tối thiểu {minPlaySeconds}s để nhận thưởng, backend sẽ kiểm tra lại trước khi cộng xu.</p>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${Math.min(100, (elapsedExternalSeconds / minPlaySeconds) * 100)}%` }} />
                    </div>
                    {externalConfig.instructions && (
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{externalConfig.instructions}</p>
                    )}
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      Nếu game không tải do website ngoài chặn nhúng, bấm biểu tượng mở tab mới ở góc khung game.
                    </p>
                  </div>
                  <button onClick={finishExternal} disabled={busy || !externalReady} className="w-full rounded-xl bg-slate-950 px-5 py-4 font-black text-white disabled:bg-slate-300 md:w-72">
                    {busy ? 'Đang ghi nhận...' : externalReady ? 'Hoàn thành và nhận thưởng' : `Chơi thêm ${Math.max(0, minPlaySeconds - elapsedExternalSeconds)}s`}
                  </button>
                </aside>
              </div>
            )}

            {currentQuestion && !result && !isExternalActive && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-500">{currentQuestion.exam_title || currentQuestion.prompt_cn || 'Câu hỏi nhanh'}</p>
                  <h3 className="mt-2 whitespace-pre-wrap text-2xl font-black leading-snug text-slate-950">{currentQuestion.prompt}</h3>
                  {currentQuestion.image_url && <img src={currentQuestion.image_url} alt="Câu hỏi" className="mt-4 max-h-72 rounded-xl border object-contain" />}
                  <div className="mt-5 grid gap-3">
                    {currentQuestion.answers.map((answer) => {
                      const picked = answers[currentQuestion.ref] === answer.key;
                      const done = Boolean(answers[currentQuestion.ref]);
                      const ok = feedback[currentQuestion.ref];
                      return (
                        <button
                          key={answer.key}
                          onClick={() => choose(currentQuestion, answer.key)}
                          disabled={done}
                          className={`rounded-xl border p-4 text-left text-sm font-bold transition ${
                            picked ? (ok ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700')
                              : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'
                          }`}
                        >
                          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs">{answer.key}</span>
                          {answer.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <aside className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><FiClock /> Giới hạn {active.mode.time_limit_seconds}s</div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${(answeredCount / active.questions.length) * 100}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Đã trả lời {answeredCount}/{active.questions.length}</p>
                  {answeredCount === active.questions.length && (
                    <button onClick={finish} disabled={busy} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-white">
                      {busy ? 'Đang chấm...' : 'Kết thúc và nhận thưởng'}
                    </button>
                  )}
                </aside>
              </div>
            )}

            {result && (
              <div className="rounded-2xl bg-emerald-50 p-6 text-center">
                <FiCheck className="mx-auto text-emerald-600" size={34} />
                <h3 className="mt-2 text-2xl font-black text-emerald-900">Hoàn thành phiên chơi</h3>
                <p className="mt-2 text-emerald-700">Điểm {result.session.score} · Đúng {result.session.correct_count}/{result.session.total_questions} · Nhận {result.session.coins_earned} xu</p>
                <button onClick={() => { setActive(null); setResult(null); load(); }} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Quay lại Game Hub</button>
              </div>
            )}
          </section>
        ) : (
          <>
            <section>
              <div className="mb-3">
                <h2 className="text-xl font-black text-slate-950">Game học tập</h2>
                <p className="mt-1 text-sm text-slate-500">Ôn câu hỏi, từ vựng và thử thách CSCA để vừa chơi vừa giữ nhịp học.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-white" />) : learningModes.map((mode) => (
                <article key={mode.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className={`h-2 bg-gradient-to-r ${toneMap[mode.mode_type] || toneMap.quiz}`} />
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-950">{mode.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{mode.description}</p>
                      </div>
                      {!mode.is_active && <FiLock className="text-slate-300" />}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                      <span className="rounded-lg bg-slate-50 px-2 py-1"><FiZap className="inline" /> {mode.mode_type === 'external' ? 'Game nhúng' : `${mode.question_count} câu`}</span>
                      <span className="rounded-lg bg-slate-50 px-2 py-1"><FiGift className="inline" /> +{mode.reward_coins} xu</span>
                      <span className="rounded-lg bg-slate-50 px-2 py-1">Phí {mode.entry_fee_coins} xu</span>
                      <span className="rounded-lg bg-slate-50 px-2 py-1">Cap {mode.daily_reward_cap}/ngày</span>
                    </div>
                    <button onClick={() => begin(mode)} disabled={!mode.is_active || busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:bg-slate-300">
                      <FiPlay /> Chơi ngay
                    </button>
                  </div>
                </article>
              ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-3">
                <h2 className="text-xl font-black text-slate-950">Game thư giãn</h2>
                <p className="mt-1 text-sm text-slate-500">Game ngoài nhẹ, phổ biến và ưu tiên nguồn cho phép nhúng để hạn chế lỗi từ chối kết nối.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-white" />) : relaxingModes.map(renderModeCard)}
              </div>
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Lịch sử chơi gần đây</h2>
                <div className="mt-4 space-y-2">
                  {recent.length === 0 ? <p className="text-sm text-slate-400">Chưa có phiên chơi nào.</p> : recent.map((item) => (
                    <div key={`${item.id}-${item.started_at}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="font-bold text-slate-700">{item.name || item.slug || 'Mini game'}</span>
                      <span className="text-slate-500">{item.score || 0} điểm · +{item.coins_earned || 0} xu</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Mở khóa bằng xu</h2>
                <div className="mt-4 space-y-3">
                  {unlockData && Object.entries(unlockData.catalog).flatMap(([type, items]: any) =>
                    Object.entries(items).map(([key, item]: any) => {
                      const unlocked = unlockData.unlocked.some((u: any) => u.unlock_type === type && u.unlock_key === key);
                      return (
                        <button key={`${type}-${key}`} onClick={() => buyUnlock(type, key)} disabled={busy || unlocked} className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm transition hover:bg-amber-100 disabled:opacity-60">
                          <span className="font-black text-amber-900">{item.title}</span>
                          <span className="float-right font-bold text-amber-700">{unlocked ? 'Đã mở' : `${item.cost} xu`}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
