'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FiCheckCircle, FiGift, FiMail, FiSearch, FiSend, FiUsers } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { adminApi } from '@/lib/api/admin';

type Recipient = { id: number; full_name: string; email: string };

export default function EmailCampaignPage() {
  const [mode, setMode] = useState<'all' | 'single'>('all');
  const [activeUsers, setActiveUsers] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [actionLabel, setActionLabel] = useState('Nhận ưu đãi ngay');
  const [actionUrl, setActionUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    adminApi.getEmailAudienceStats()
      .then(response => setActiveUsers(Number(response.data.active_users) || 0))
      .catch(() => setNotice({ ok: false, text: 'Không thể lấy số lượng người nhận.' }));
  }, []);

  useEffect(() => {
    if (mode !== 'single' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await adminApi.getUsers({ page: 1, limit: 8, search: query.trim() });
        setResults((response.users || []).map((user: Recipient) => ({
          id: user.id, full_name: user.full_name, email: user.email,
        })));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mode, query]);

  const recipientCount = mode === 'all' ? activeUsers : selected ? 1 : 0;
  const canSend = subject.trim().length >= 3 && content.trim().length >= 3
    && recipientCount > 0 && !sending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const target = mode === 'all'
      ? `${activeUsers.toLocaleString('vi-VN')} người dùng đang hoạt động`
      : selected?.email;
    if (!window.confirm(`Xác nhận gửi email này đến ${target}? Hành động này không thể hoàn tác.`)) return;

    setSending(true);
    setNotice(null);
    try {
      const response = await adminApi.sendEmailCampaign({
        mode,
        userId: selected?.id,
        subject: subject.trim(),
        content: content.trim(),
        discountCode: discountCode.trim(),
        actionLabel: actionLabel.trim(),
        actionUrl: actionUrl.trim(),
      });
      setNotice({ ok: true, text: response.message });
    } catch (error: any) {
      setNotice({ ok: false, text: error?.response?.data?.message || 'Gửi email thất bại.' });
    } finally {
      setSending(false);
    }
  }

  const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

  return (
    <AdminLayout title="Gửi email ưu đãi" description="Gửi đến toàn bộ hệ thống hoặc một người dùng cụ thể">
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700"><FiUsers /></span>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">1. Chọn người nhận</h2>
                <p className="text-sm text-slate-500">Chỉ gửi đến tài khoản đang hoạt động và có email.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['all', 'Gửi hàng loạt', `${activeUsers.toLocaleString('vi-VN')} người dùng đang hoạt động`],
                ['single', 'Một người chỉ định', 'Tìm bằng tên hoặc email'],
              ] as const).map(option => (
                <button key={option[0]} type="button" onClick={() => setMode(option[0])}
                  className={`rounded-xl border p-4 text-left transition ${mode === option[0] ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100 dark:bg-violet-950/40' : 'border-slate-200 hover:border-violet-300 dark:border-slate-700'}`}>
                  <span className="block font-bold text-slate-900 dark:text-white">{option[1]}</span>
                  <span className="mt-1 block text-sm text-slate-500">{option[2]}</span>
                </button>
              ))}
            </div>
            {mode === 'single' && (
              <div className="relative mt-4">
                <FiSearch className="absolute left-3 top-3.5 text-slate-400" />
                <input value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }}
                  placeholder="Nhập tên hoặc email người dùng..." className={`${field} mt-0 pl-10`} />
                {(searching || results.length > 0) && (
                  <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {searching ? <p className="p-4 text-sm text-slate-500">Đang tìm...</p> : results.map(user => (
                      <button key={user.id} type="button"
                        onClick={() => { setSelected(user); setQuery(user.email); setResults([]); }}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-violet-50 dark:border-slate-800 dark:hover:bg-slate-800">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{user.full_name || 'Chưa có tên'}</span>
                        <span className="block text-xs text-slate-500">{user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selected && <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-600"><FiCheckCircle /> Đã chọn {selected.full_name} ({selected.email})</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><FiGift /></span>
              <h2 className="font-bold text-slate-900 dark:text-white">2. Soạn nội dung</h2>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tiêu đề email *
                <input value={subject} maxLength={160} onChange={e => setSubject(e.target.value)}
                  placeholder="Ví dụ: Ưu đãi 30% dành riêng cho bạn" className={field} />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Nội dung *
                <textarea value={content} maxLength={10000} rows={9} onChange={e => setContent(e.target.value)}
                  placeholder="Nhập nội dung, thời hạn và điều kiện áp dụng..." className={`${field} resize-y leading-6`} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Mã ưu đãi
                  <input value={discountCode} maxLength={80} onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="MOLY30" className={`${field} font-mono`} />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tên nút
                  <input value={actionLabel} maxLength={80} onChange={e => setActionLabel(e.target.value)} className={field} />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Đường dẫn khi bấm nút
                <input type="url" value={actionUrl} maxLength={500} onChange={e => setActionUrl(e.target.value)}
                  placeholder="https://molystudio.online/vip" className={field} />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-white">
              <p className="flex items-center gap-2 text-sm font-bold"><FiMail /> Xem trước email</p>
              <h3 className="mt-2 text-xl font-black">{subject || 'Tiêu đề email ưu đãi'}</h3>
            </div>
            <div className="p-5">
              <div className="mb-5 rounded-xl bg-violet-50 p-5 text-center">
                <FiGift className="mx-auto mb-2 text-3xl text-violet-600" />
                <p className="font-black text-violet-900">Ưu đãi dành cho bạn</p>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{content.trim() || 'Nội dung ưu đãi sẽ hiển thị tại đây.'}</p>
              {discountCode && <div className="mx-auto my-5 w-fit rounded-xl border-2 border-dashed border-violet-500 bg-violet-50 px-5 py-3 font-mono text-lg font-black tracking-widest text-violet-700">{discountCode}</div>}
              {actionUrl && <div className="mt-5 rounded-full bg-violet-600 px-5 py-3 text-center text-sm font-bold text-white">{actionLabel || 'Nhận ưu đãi ngay'}</div>}
            </div>
          </section>
          {notice && <div className={`rounded-xl border p-4 text-sm font-medium ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>}
          <button type="submit" disabled={!canSend}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 font-bold text-white shadow-lg shadow-violet-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
            <FiSend /> {sending ? 'Đang gửi email...' : `Gửi đến ${recipientCount.toLocaleString('vi-VN')} người nhận`}
          </button>
          <p className="text-center text-xs leading-5 text-slate-500">Hệ thống hỏi xác nhận lần cuối trước khi gửi. Người nhận không nhìn thấy email của nhau.</p>
        </div>
      </form>
    </AdminLayout>
  );
}
