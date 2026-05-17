'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
  createGameMode,
  disableGameMode,
  getAdminGamification,
  grantCoins,
  updateGameMode,
  type GameMode,
} from '@/lib/api/games';
import {
  FiActivity, FiAward, FiClock, FiExternalLink, FiGift, FiPlus, FiRefreshCw,
  FiSave, FiSlash, FiStar, FiTrendingUp, FiUsers,
} from 'react-icons/fi';

type NewModeForm = {
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
  sort_order: number;
  config: Record<string, any>;
};

const emptyMode: NewModeForm = {
  slug: '',
  name: '',
  description: '',
  mode_type: 'external',
  is_active: true,
  entry_fee_coins: 0,
  reward_coins: 5,
  daily_reward_cap: 25,
  question_count: 0,
  time_limit_seconds: 120,
  min_accuracy_reward: 0,
  sort_order: 50,
  config: {
    external_url: '',
    provider: '',
    license: '',
    cover_url: '',
    instructions: '',
    min_play_seconds: 30,
    max_score: 1500,
  },
};

const modeTypeLabels: Record<string, string> = {
  quiz: 'Quiz cĂ¢u há»i',
  vocabulary: 'Tá»« vá»±ng',
  boss: 'Boss',
  mixed: 'Mixed daily',
  external: 'Game nhĂºng',
};

const number = (value: any) => Number(value || 0).toLocaleString('vi-VN');

export default function AdminGamificationPage() {
  const [data, setData] = useState<any>(null);
  const [modes, setModes] = useState<GameMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [grantForm, setGrantForm] = useState({ userId: '', amount: '', reason: '' });
  const [newMode, setNewMode] = useState<NewModeForm>(emptyMode);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await getAdminGamification();
      setData(next);
      setModes(next.modes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = data?.coinSummary?.totals || { total_issued: 0, total_spent: 0, total_balance: 0 };
  const gameStats = data?.gameStats || [];
  const statsBySlug = useMemo(() => new Map(gameStats.map((row: any) => [row.slug, row])), [gameStats]);

  const patchMode = (id: number, field: keyof GameMode, value: any) => {
    setModes((prev) => prev.map((mode) => mode.id === id ? { ...mode, [field]: value } : mode));
  };

  const patchModeConfig = (id: number, key: string, value: any) => {
    setModes((prev) => prev.map((mode) => (
      mode.id === id ? { ...mode, config: { ...(mode.config || {}), [key]: value } } : mode
    )));
  };

  const saveMode = async (mode: GameMode) => {
    setSavingId(mode.id);
    setMessage('');
    try {
      const res = await updateGameMode(mode.id, mode);
      setModes((prev) => prev.map((item) => item.id === mode.id ? res.mode : item));
      setMessage('ÄĂ£ lÆ°u cáº¥u hĂ¬nh mini game.');
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'KhĂ´ng lÆ°u Ä‘Æ°á»£c cáº¥u hĂ¬nh mini game.');
    } finally {
      setSavingId(null);
    }
  };

  const createMode = async () => {
    setCreating(true);
    setMessage('');
    try {
      const res = await createGameMode(newMode);
      setModes((prev) => [...prev, res.mode].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
      setNewMode(emptyMode);
      setMessage('ÄĂ£ táº¡o mini game má»›i.');
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'KhĂ´ng táº¡o Ä‘Æ°á»£c mini game.');
    } finally {
      setCreating(false);
    }
  };

  const disableMode = async (mode: GameMode) => {
    if (!confirm(`Táº¯t mini game "${mode.name}"? Dá»¯ liá»‡u phiĂªn chÆ¡i váº«n Ä‘Æ°á»£c giá»¯ láº¡i.`)) return;
    setSavingId(mode.id);
    try {
      const res = await disableGameMode(mode.id);
      setModes((prev) => prev.map((item) => item.id === mode.id ? res.mode : item));
      setMessage('ÄĂ£ táº¯t mini game.');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'KhĂ´ng táº¯t Ä‘Æ°á»£c mini game.');
    } finally {
      setSavingId(null);
    }
  };

  const submitGrant = async () => {
    setMessage('');
    try {
      await grantCoins(Number(grantForm.userId), Number(grantForm.amount), grantForm.reason);
      setGrantForm({ userId: '', amount: '', reason: '' });
      setMessage('ÄĂ£ Ä‘iá»u chá»‰nh xu cho ngÆ°á»i dĂ¹ng.');
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'KhĂ´ng Ä‘iá»u chá»‰nh Ä‘Æ°á»£c xu.');
    }
  };

  return (
    <AdminLayout title="Game, Rank & Xu" description="Quáº£n lĂ½ mini game, game nhĂºng, rank, vĂ­ xu vĂ  thÆ°á»Ÿng">
      {message && <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">{message}</div>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">Báº£ng Ä‘iá»u khiá»ƒn game</h2>
          <p className="mt-1 text-sm text-slate-500">Game há»c táº­p Ä‘Æ°á»£c cháº¥m báº±ng cĂ¢u há»i; game nhĂºng chá»‰ thÆ°á»Ÿng sau thá»i gian chÆ¡i tá»‘i thiá»ƒu.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Táº£i láº¡i
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Xu Ä‘Ă£ phĂ¡t', value: totals.total_issued, icon: FiGift, color: 'from-emerald-500 to-teal-500' },
          { label: 'Xu Ä‘Ă£ tiĂªu', value: totals.total_spent, icon: FiStar, color: 'from-amber-500 to-orange-500' },
          { label: 'Sá»‘ dÆ° toĂ n há»‡ thá»‘ng', value: totals.total_balance, icon: FiTrendingUp, color: 'from-blue-500 to-cyan-500' },
          { label: 'Tráº­n rank', value: data?.rankStats?.matches || 0, icon: FiAward, color: 'from-violet-500 to-fuchsia-500' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${card.color} p-3 text-white`}><Icon /></div>
              <p className="text-sm font-semibold text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{number(card.value)}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_25rem]">
        <section className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Táº¡o game má»›i</h2>
              <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-black text-fuchsia-700">Há»— trá»£ game nhĂºng</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Slug">
                <input value={newMode.slug} onChange={(e) => setNewMode((p) => ({ ...p, slug: e.target.value }))} placeholder="snake-open-source" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </Field>
              <Field label="TĂªn game">
                <input value={newMode.name} onChange={(e) => setNewMode((p) => ({ ...p, name: e.target.value }))} placeholder="Snake vui nhá»™n" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </Field>
              <Field label="Loáº¡i game">
                <select value={newMode.mode_type} onChange={(e) => setNewMode((p) => ({ ...p, mode_type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                  {Object.entries(modeTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </Field>
              <Field label="Thá»© tá»±">
                <input type="number" value={newMode.sort_order} onChange={(e) => setNewMode((p) => ({ ...p, sort_order: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </Field>
              <div className="md:col-span-2">
                <Field label="MĂ´ táº£">
                  <textarea value={newMode.description} onChange={(e) => setNewMode((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" rows={2} />
                </Field>
              </div>
              {newMode.mode_type === 'external' && (
                <>
                  <Field label="URL nhĂºng">
                    <input value={newMode.config.external_url || ''} onChange={(e) => setNewMode((p) => ({ ...p, config: { ...p.config, external_url: e.target.value } }))} placeholder="https://..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </Field>
                  <Field label="Provider / License">
                    <input value={newMode.config.license || ''} onChange={(e) => setNewMode((p) => ({ ...p, config: { ...p.config, license: e.target.value } }))} placeholder="MIT, CC BY, tá»± sá»Ÿ há»¯u..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </Field>
                  <Field label="Cover URL">
                    <input value={newMode.config.cover_url || ''} onChange={(e) => setNewMode((p) => ({ ...p, config: { ...p.config, cover_url: e.target.value } }))} placeholder="https://..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </Field>
                  <Field label="Tá»‘i thiá»ƒu giĂ¢y">
                    <input type="number" value={newMode.config.min_play_seconds || 30} onChange={(e) => setNewMode((p) => ({ ...p, config: { ...p.config, min_play_seconds: Number(e.target.value) } }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </Field>
                </>
              )}
              {[
                ['entry_fee_coins', 'PhĂ­ xu'],
                ['reward_coins', 'ThÆ°á»Ÿng xu'],
                ['daily_reward_cap', 'Cap/ngĂ y'],
                ['question_count', 'Sá»‘ cĂ¢u'],
                ['time_limit_seconds', 'GiĂ¢y'],
                ['min_accuracy_reward', 'Äá»™ chĂ­nh xĂ¡c %'],
              ].map(([field, label]) => (
                <Field key={field} label={label}>
                  <input type="number" value={(newMode as any)[field]} onChange={(e) => setNewMode((p) => ({ ...p, [field]: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                </Field>
              ))}
            </div>
            <button onClick={createMode} disabled={creating} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">
              <FiPlus /> {creating ? 'Äang táº¡o...' : 'Táº¡o mini game'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-950">Cáº¥u hĂ¬nh game hiá»‡n cĂ³</h2>
            <div className="space-y-4">
              {modes.map((mode) => {
                const stat: any = statsBySlug.get(mode.slug) || {};
                return (
                  <div key={mode.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Slug">
                          <input value={mode.slug} onChange={(e) => patchMode(mode.id, 'slug', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                        <Field label="TĂªn game">
                          <input value={mode.name} onChange={(e) => patchMode(mode.id, 'name', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                        <Field label="Loáº¡i">
                          <select value={mode.mode_type} onChange={(e) => patchMode(mode.id, 'mode_type', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                            {Object.entries(modeTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                          </select>
                        </Field>
                        <Field label="Tráº¡ng thĂ¡i">
                          <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600">
                            <input type="checkbox" checked={mode.is_active} onChange={(e) => patchMode(mode.id, 'is_active', e.target.checked)} />
                            Äang báº­t
                          </label>
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="MĂ´ táº£">
                            <textarea value={mode.description || ''} onChange={(e) => patchMode(mode.id, 'description', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" rows={2} />
                          </Field>
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                        <p><b className="text-slate-900">{number(stat.sessions)}</b> phiĂªn</p>
                        <p><b className="text-slate-900">{number(stat.players)}</b> ngÆ°á»i chÆ¡i</p>
                        <p><b className="text-slate-900">{number(stat.coins_earned)}</b> xu thÆ°á»Ÿng</p>
                        <p><b className="text-slate-900">{number(stat.avg_score)}</b> Ä‘iá»ƒm TB</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-6">
                      {[
                        ['entry_fee_coins', 'PhĂ­ xu'],
                        ['reward_coins', 'ThÆ°á»Ÿng xu'],
                        ['daily_reward_cap', 'Cap/ngĂ y'],
                        ['question_count', 'Sá»‘ cĂ¢u'],
                        ['time_limit_seconds', 'GiĂ¢y'],
                        ['min_accuracy_reward', 'Äá»™ chĂ­nh xĂ¡c %'],
                      ].map(([field, label]) => (
                        <Field key={field} label={label}>
                          <input type="number" value={(mode as any)[field]} onChange={(e) => patchMode(mode.id, field as keyof GameMode, Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                      ))}
                    </div>

                    {mode.mode_type === 'external' && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="URL nhĂºng">
                          <input value={mode.config?.external_url || ''} onChange={(e) => patchModeConfig(mode.id, 'external_url', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                        <Field label="License">
                          <input value={mode.config?.license || ''} onChange={(e) => patchModeConfig(mode.id, 'license', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                        <Field label="Cover URL">
                          <input value={mode.config?.cover_url || ''} onChange={(e) => patchModeConfig(mode.id, 'cover_url', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                        <Field label="Tá»‘i thiá»ƒu giĂ¢y">
                          <input type="number" value={mode.config?.min_play_seconds || 30} onChange={(e) => patchModeConfig(mode.id, 'min_play_seconds', Number(e.target.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        </Field>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => saveMode(mode)} disabled={savingId === mode.id} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300">
                        <FiSave /> {savingId === mode.id ? 'Äang lÆ°u...' : 'LÆ°u'}
                      </button>
                      <button onClick={() => disableMode(mode)} disabled={savingId === mode.id || !mode.is_active} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">
                        <FiSlash /> Táº¯t game
                      </button>
                      {mode.mode_type === 'external' && mode.config?.external_url && (
                        <a href={mode.config.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                          <FiExternalLink /> Má»Ÿ thá»­
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Äiá»u chá»‰nh xu</h2>
            <div className="mt-4 space-y-3">
              <input value={grantForm.userId} onChange={(e) => setGrantForm((p) => ({ ...p, userId: e.target.value }))} placeholder="User ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              <input value={grantForm.amount} onChange={(e) => setGrantForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Sá»‘ xu (+/-)" type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              <textarea value={grantForm.reason} onChange={(e) => setGrantForm((p) => ({ ...p, reason: e.target.value }))} placeholder="LĂ½ do" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" rows={3} />
              <button onClick={submitGrant} className="w-full rounded-xl bg-amber-500 px-4 py-3 font-black text-white">Cáº­p nháº­t xu</button>
            </div>
          </section>

          <Panel title="PhiĂªn chÆ¡i gáº§n Ä‘Ă¢y" icon={<FiActivity />}>
            {(data?.recentSessions || []).map((row: any) => (
              <div key={row.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-800">{row.full_name || row.email || 'NgÆ°á»i dĂ¹ng'}</p>
                    <p className="text-xs text-slate-500">{row.name} - {row.status}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-700">+{row.coins_earned || 0}</span>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="Top ngÆ°á»i chÆ¡i" icon={<FiUsers />}>
            {(data?.topPlayers || []).map((row: any, index: number) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-800">#{index + 1} {row.full_name || row.email}</p>
                  <p className="text-xs text-slate-500">{row.sessions} phiĂªn - +{row.coins_earned} xu</p>
                </div>
                <span className="font-black text-slate-900">{number(row.total_score)}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Nguá»“n xu" icon={<FiClock />}>
            {(data?.coinSummary?.bySource || []).map((row: any) => (
              <div key={row.source} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-black text-slate-800">{row.source}</div>
                <div className="text-slate-500">PhĂ¡t {row.issued} - TiĂªu {row.spent} - {row.entries} dĂ²ng</div>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-950">{icon}{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
