'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FiCheckCircle, FiGift, FiMail, FiSearch, FiSend, FiUsers } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { adminApi } from '@/lib/api/admin';

type Recipient = { id: number; full_name: string; email: string };

const cleanCopiedContent = (value: string) => value.replace(/\*+/g, '');

export default function EmailCampaignPage() {
  const [channel, setChannel] = useState<'notification' | 'email'>('notification');
  const [mode, setMode] = useState<'all' | 'single'>('all');
  const [activeUsers, setActiveUsers] = useState(0);
  const [activeAccounts, setActiveAccounts] = useState(0);
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
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    adminApi.getEmailAudienceStats()
      .then(response => {
        setActiveUsers(Number(response.data.active_users) || 0);
        setActiveAccounts(Number(response.data.active_accounts) || 0);
      })
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

  const recipientCount = mode === 'all'
    ? (channel === 'notification' ? activeAccounts : activeUsers)
    : selected ? 1 : 0;
  const canSend = subject.trim().length >= 3 && content.trim().length >= 3
    && recipientCount > 0 && !sending && !sentSuccessfully;

  function startNewEmail() {
    setSubject('');
    setContent('');
    setDiscountCode('');
    setActionLabel('Nhận ưu đãi ngay');
    setActionUrl('');
    setSelected(null);
    setQuery('');
    setResults([]);
    setNotice(null);
    setSentSuccessfully(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const target = mode === 'all'
      ? `${recipientCount.toLocaleString('vi-VN')} người dùng đang hoạt động`
      : selected?.email;
    const itemName = channel === 'notification' ? 'thông báo' : 'email';
    if (!window.confirm(`Xác nhận gửi ${itemName} này đến ${target}? Hành động này không thể hoàn tác.`)) return;

    setSending(true);
    setNotice(null);
    try {
      const response = channel === 'notification'
        ? await adminApi.sendUserNotification({
            mode,
            userId: selected?.id,
            title: subject.trim(),
            content: content.trim(),
            discountCode: discountCode.trim(),
            link: actionUrl.trim(),
          })
        : await adminApi.sendEmailCampaign({
            mode,
            userId: selected?.id,
            subject: subject.trim(),
            content: content.trim(),
            discountCode: discountCode.trim(),
            actionLabel: actionLabel.trim(),
            actionUrl: actionUrl.trim(),
          });
      setNotice({ ok: true, text: response.message });
      setSentSuccessfully(true);
    } catch (error: any) {
      setNotice({ ok: false, text: error?.response?.data?.message || 'Gửi thất bại.' });
    } finally {
      setSending(false);
    }
  }

  const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

  return (
    <AdminLayout title="Gửi thông báo" description="Gửi qua chuông trong hệ thống hoặc qua email">
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Kênh gửi</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={sentSuccessfully} onClick={() => setChannel('notification')}
                className={`rounded-xl border p-4 text-left transition ${channel === 'notification' ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="block font-bold text-slate-900 dark:text-white">Thông báo hệ thống</span>
                <span className="mt-1 block text-sm text-slate-500">Hiện ở chuông thông báo, không gửi mail</span>
              </button>
              <button type="button" disabled={sentSuccessfully} onClick={() => setChannel('email')}
                className={`rounded-xl border p-4 text-left transition ${channel === 'email' ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="block font-bold text-slate-900 dark:text-white">Email</span>
                <span className="mt-1 block text-sm text-slate-500">Gửi qua email đã đăng ký</span>
              </button>
            </div>
          </section>
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
                ['all', 'Gửi hàng loạt', `${recipientCount.toLocaleString('vi-VN')} người dùng đang hoạt động`],
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
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tiêu đề *
                <input value={subject} maxLength={160} onChange={e => setSubject(e.target.value)}
                  placeholder="Ví dụ: Ưu đãi 30% dành riêng cho bạn" className={field} />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Nội dung *
                <textarea value={content} maxLength={10000} rows={9} onChange={e => setContent(cleanCopiedContent(e.target.value))}
                  placeholder="Nhập nội dung, thời hạn và điều kiện áp dụng..." className={`${field} resize-y leading-6`} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Mã ưu đãi
                  <input value={discountCode} maxLength={80} onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="MOLY30" className={`${field} font-mono`} />
                </label>
                {channel === 'email' && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tên nút
                  <input value={actionLabel} maxLength={80} onChange={e => setActionLabel(e.target.value)} className={field} />
                </label>}
              </div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                {channel === 'notification' ? 'Trang mở khi bấm thông báo' : 'Đường dẫn khi bấm nút'}
                <input type={channel === 'notification' ? 'text' : 'url'} value={actionUrl} maxLength={500} onChange={e => setActionUrl(e.target.value)}
                  placeholder={channel === 'notification' ? '/vip' : 'https://molystudio.online/vip'} className={field} />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {channel === 'email' ? (
            <section className="overflow-hidden rounded-2xl border border-[#ded6c8] border-t-[6px] border-t-[#b4232e] bg-[#fffdf8] shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e8e0d3] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b4232e] font-serif text-xl font-bold text-[#fffdf8]">学</span>
                  <div>
                    <p className="text-sm font-black tracking-wide text-[#172033]">MOLY.STUDIO</p>
                    <p className="text-[10px] font-bold tracking-[.14em] text-[#8a7760]">CSCA · DU HỌC TRUNG QUỐC</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#ddcdb8] px-2.5 py-1 font-serif text-xs font-bold text-[#9d2933]">留学</span>
              </div>
              <div className="p-6">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9d2933]">Thông báo dành cho bạn</p>
                <h3 className="mt-2 font-serif text-2xl font-bold leading-tight text-[#172033]">{subject || 'Tiêu đề thông báo'}</h3>
                <div className="my-5 h-[3px] w-10 bg-[#b4232e]" />
                <p className="mb-3 text-sm text-[#344054]">Chào bạn,</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#475467]">{content.trim() || 'Nội dung thông báo sẽ hiển thị tại đây.'}</p>
                {discountCode && (
                  <div className="mt-5 rounded-lg border border-dashed border-[#c69a68] bg-[#faf4e8] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8a7760]">Mã dành cho bạn</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-widest text-[#9d2933]">{discountCode}</p>
                  </div>
                )}
                {actionUrl && <div className="mt-5 w-fit rounded-lg bg-[#b4232e] px-5 py-3 text-sm font-bold text-white">{actionLabel || 'Xem thông tin'} &nbsp;→</div>}
                <p className="mt-6 border-t border-[#e8e0d3] pt-5 text-sm leading-6 text-[#475467]">Thân mến,<br /><strong className="text-[#172033]">Đội ngũ MOLY.STUDIO</strong></p>
              </div>
              <div className="bg-[#172033] px-5 py-4 text-center">
                <p className="text-[10px] leading-5 text-[#d6d0c5]">Đồng hành cùng bạn trên hành trình CSCA và du học Trung Quốc.</p>
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-white">
                <p className="flex items-center gap-2 text-sm font-bold"><FiMail /> Xem trước thông báo</p>
                <h3 className="mt-2 text-xl font-black">{subject || 'Tiêu đề thông báo'}</h3>
              </div>
              <div className="p-5">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{content.trim() || 'Nội dung thông báo sẽ hiển thị tại đây.'}</p>
                {discountCode && <div className="mx-auto my-5 w-fit rounded-xl border-2 border-dashed border-violet-500 bg-violet-50 px-5 py-3 font-mono text-lg font-black tracking-widest text-violet-700">{discountCode}</div>}
              </div>
            </section>
          )}
          {notice && <div className={`rounded-xl border p-4 text-sm font-medium ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>}
          <button type="submit" disabled={!canSend}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 font-bold text-white shadow-lg shadow-violet-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
            <FiSend /> {sending
              ? 'Đang gửi...'
              : sentSuccessfully
                ? 'Đã gửi — nút đã khóa'
                : `Gửi đến ${recipientCount.toLocaleString('vi-VN')} người nhận`}
          </button>
          {sentSuccessfully && (
            <button type="button" onClick={startNewEmail}
              className="w-full rounded-xl border border-violet-200 bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-slate-800">
              Soạn thông báo mới
            </button>
          )}
          <p className="text-center text-xs leading-5 text-slate-500">
            {channel === 'notification'
              ? 'Thông báo sẽ xuất hiện tại biểu tượng chuông của tài khoản người nhận.'
              : 'Hệ thống hỏi xác nhận lần cuối trước khi gửi. Người nhận không nhìn thấy email của nhau.'}
          </p>
        </div>
      </form>
    </AdminLayout>
  );
}
