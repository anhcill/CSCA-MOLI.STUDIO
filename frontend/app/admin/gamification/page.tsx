'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { getAdminGamification, grantCoins, updateGameMode, type GameMode } from '@/lib/api/games';
import { FiAward, FiGift, FiRefreshCw, FiSave, FiStar, FiTrendingUp } from 'react-icons/fi';

export default function AdminGamificationPage() {
  const [data, setData] = useState<any>(null);
  const [modes, setModes] = useState<GameMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [grantForm, setGrantForm] = useState({ userId: '', amount: '', reason: '' });

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

  const patchMode = (id: number, field: keyof GameMode, value: any) => {
    setModes((prev) => prev.map((mode) => mode.id === id ? { ...mode, [field]: value } : mode));
  };

  const saveMode = async (mode: GameMode) => {
    setSavingId(mode.id);
    setMessage('');
    try {
      const res = await updateGameMode(mode.id, mode);
      setModes((prev) => prev.map((item) => item.id === mode.id ? res.mode : item));
      setMessage('Đã lưu cấu hình mini game.');
    } catch {
      setMessage('Không lưu được cấu hình mini game.');
    } finally {
      setSavingId(null);
    }
  };

  const submitGrant = async () => {
    setMessage('');
    try {
      await grantCoins(Number(grantForm.userId), Number(grantForm.amount), grantForm.reason);
      setGrantForm({ userId: '', amount: '', reason: '' });
      setMessage('Đã điều chỉnh xu cho người dùng.');
      await load();
    } catch {
      setMessage('Không điều chỉnh được xu.');
    }
  };

  const totals = data?.coinSummary?.totals || { total_issued: 0, total_spent: 0, total_balance: 0 };

  return (
    <AdminLayout title="Game, Rank & Xu" description="Kiểm soát mini game, mùa rank, phần thưởng và lịch sử xu">
      {message && <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">{message}</div>}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Xu đã phát', value: totals.total_issued, icon: FiGift, color: 'from-emerald-500 to-teal-500' },
          { label: 'Xu đã tiêu', value: totals.total_spent, icon: FiStar, color: 'from-amber-500 to-orange-500' },
          { label: 'Số dư toàn hệ thống', value: totals.total_balance, icon: FiTrendingUp, color: 'from-blue-500 to-cyan-500' },
          { label: 'Trận rank', value: data?.rankStats?.matches || 0, icon: FiAward, color: 'from-violet-500 to-fuchsia-500' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${card.color} p-3 text-white`}><Icon /></div>
              <p className="text-sm font-semibold text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{Number(card.value || 0).toLocaleString('vi-VN')}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950">Cấu hình mini game</h2>
            <button onClick={load} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><FiRefreshCw className={loading ? 'animate-spin' : ''} /></button>
          </div>
          <div className="space-y-3">
            {modes.map((mode) => (
              <div key={mode.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">{mode.slug}</p>
                    <input value={mode.name} onChange={(e) => patchMode(mode.id, 'name', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-black text-slate-950" />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <input type="checkbox" checked={mode.is_active} onChange={(e) => patchMode(mode.id, 'is_active', e.target.checked)} />
                    Đang bật
                  </label>
                </div>
                <textarea value={mode.description || ''} onChange={(e) => patchMode(mode.id, 'description', e.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2} />
                <div className="mt-3 grid gap-3 md:grid-cols-5">
                  {[
                    ['entry_fee_coins', 'Phí xu'],
                    ['reward_coins', 'Thưởng xu'],
                    ['daily_reward_cap', 'Cap/ngày'],
                    ['question_count', 'Số câu'],
                    ['time_limit_seconds', 'Giây'],
                  ].map(([field, label]) => (
                    <label key={field} className="text-xs font-bold text-slate-500">
                      {label}
                      <input type="number" value={(mode as any)[field]} onChange={(e) => patchMode(mode.id, field as keyof GameMode, Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
                    </label>
                  ))}
                </div>
                <button onClick={() => saveMode(mode)} disabled={savingId === mode.id} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  <FiSave /> {savingId === mode.id ? 'Đang lưu...' : 'Lưu mini game'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Điều chỉnh xu</h2>
            <div className="mt-4 space-y-3">
              <input value={grantForm.userId} onChange={(e) => setGrantForm((p) => ({ ...p, userId: e.target.value }))} placeholder="User ID" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={grantForm.amount} onChange={(e) => setGrantForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Số xu (+/-)" type="number" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" />
              <textarea value={grantForm.reason} onChange={(e) => setGrantForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Lý do" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" rows={3} />
              <button onClick={submitGrant} className="w-full rounded-xl bg-amber-500 px-4 py-3 font-black text-white">Cập nhật xu</button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Nguồn xu</h2>
            <div className="mt-4 space-y-2">
              {(data?.coinSummary?.bySource || []).map((row: any) => (
                <div key={row.source} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="font-black text-slate-800">{row.source}</div>
                  <div className="text-slate-500">Phát {row.issued} · Tiêu {row.spent} · {row.entries} dòng</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AdminLayout>
  );
}
