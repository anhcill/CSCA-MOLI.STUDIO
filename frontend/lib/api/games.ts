import axios from '@/lib/utils/axios';

export interface GameMode {
  id: number;
  slug: string;
  name: string;
  description: string;
  mode_type: string;
  is_active: boolean;
  entry_fee_coins: number;
  reward_coins: number;
  daily_reward_cap: number;
  question_count: number;
  time_limit_seconds: number;
  min_accuracy_reward: number;
  config?: Record<string, any>;
}

export interface GameQuestion {
  ref: string;
  index: number;
  source: 'question' | 'vocabulary';
  prompt: string;
  prompt_cn?: string;
  image_url?: string;
  exam_title?: string;
  answers: { key: string; text: string; text_cn?: string; image_url?: string }[];
}

export async function getGameHub() {
  const res = await axios.get('/games');
  return res.data.data as { modes: GameMode[]; recent: any[]; balance: number };
}

export async function startGame(mode: string) {
  const res = await axios.post(`/games/${mode}/start`);
  return res.data.data as { mode: GameMode; session: any; questions: GameQuestion[] };
}

export async function answerGameQuestion(sessionId: number, questionRef: string, answerKey: string, timeSpent = 0) {
  const res = await axios.post(`/games/sessions/${sessionId}/answer`, {
    question_ref: questionRef,
    answer_key: answerKey,
    time_spent_seconds: timeSpent,
  });
  return res.data.data as { is_correct: boolean; correct_key: string };
}

export async function finishGame(sessionId: number) {
  const res = await axios.post(`/games/sessions/${sessionId}/finish`);
  return res.data.data as { session: any; accuracy?: number; balance: number };
}

export async function getRankState() {
  const res = await axios.get('/rank/seasons/current');
  return res.data.data as { season: any; rating: any };
}

export async function findRankMatch() {
  const res = await axios.post('/rank/matchmaking');
  return res.data.data as { season: any; match: any; questions: GameQuestion[] };
}

export async function submitRankMatch(matchId: number, answers: Record<string, string>) {
  const payload = Object.entries(answers).map(([question_ref, answer_key]) => ({ question_ref, answer_key }));
  const res = await axios.post(`/rank/matches/${matchId}/submit`, { answers: payload });
  return res.data.data as { match: any; submission: any; rating: any };
}

export async function getRankLeaderboard() {
  const res = await axios.get('/rank/leaderboard');
  return res.data.data as { season: any; leaderboard: any[] };
}

export async function getMyRankMatches() {
  const res = await axios.get('/rank/matches/me');
  return res.data.data as { matches: any[] };
}

export async function getWalletLedger() {
  const res = await axios.get('/wallet/ledger');
  return res.data.data as { balance: number; entries: any[] };
}

export async function getUnlockCatalog() {
  const res = await axios.get('/unlocks/catalog');
  return res.data.data as { catalog: Record<string, Record<string, { title: string; cost: number }>>; unlocked: any[] };
}

export async function purchaseUnlock(type: string, id: string) {
  const res = await axios.post(`/unlocks/${type}/${id}/purchase`);
  return res.data.data as { unlock: any; alreadyUnlocked: boolean };
}

export async function getAdminGamification() {
  const res = await axios.get('/admin/gamification/summary');
  return res.data.data;
}

export async function updateGameMode(id: number, data: Partial<GameMode>) {
  const res = await axios.put(`/admin/gamification/modes/${id}`, data);
  return res.data.data as { mode: GameMode };
}

export async function grantCoins(userId: number, amount: number, reason: string) {
  const res = await axios.post('/admin/gamification/wallet/grant', {
    user_id: userId,
    amount,
    reason,
  });
  return res.data.data;
}
