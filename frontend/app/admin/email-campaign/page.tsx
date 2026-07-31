'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FiBell, FiCheckCircle, FiGift, FiMail, FiRefreshCw, FiSearch, FiSend, FiUsers } from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { adminApi } from '@/lib/api/admin';

type Recipient = { id: number; full_name: string; email: string };
type EmailQuotaAccount = {
  id: 'default' | 'critical';
  label: string;
  configured: boolean;
  status: 'ok' | 'missing' | 'error';
  planType?: string;
  remaining?: number | null;
  dailyLimit?: number | null;
  usedToday?: number | null;
  error?: string;
};
type EmailSendLog = {
  id: number;
  action: string;
  created_at: string;
  admin_name: string;
  metadata: {
    subject?: string;
    templateId?: string;
    deliveryType?: string;
    recipientCount?: number;
    status?: string;
    errorMessage?: string;
    reserveCritical?: number;
    accountBreakdown?: Array<{
      id: 'default' | 'critical';
      sent: number;
      campaignId?: number;
      quotaBefore?: number | null;
      projectedAfter?: number | null;
    }>;
  };
};

type EmailTemplateId = 'classic' | 'study' | 'exam' | 'spring' | 'event' | 'promotion';
type EmailTemplate = {
  id: EmailTemplateId;
  name: string;
  description: string;
  emoji: string;
  deliveryType: 'transactional' | 'marketing';
  subject: string;
  content: string;
  actionLabel: string;
  actionUrl: string;
  discountCode?: string;
  accent: string;
  soft: string;
};

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'classic',
    name: 'Tự soạn',
    description: 'Mẫu MOLY trang trọng, dùng cho nội dung bất kỳ.',
    emoji: '✍️',
    deliveryType: 'transactional',
    subject: '',
    content: '',
    actionLabel: 'Xem thông báo',
    actionUrl: '',
    accent: '#b4232e',
    soft: '#fff7ed',
  },
  {
    id: 'study',
    name: 'Cập nhật học tập',
    description: 'Bài học, tài liệu hoặc nội dung ôn tập mới.',
    emoji: '📚',
    deliveryType: 'transactional',
    subject: 'Nội dung học tập mới dành cho bạn',
    content: 'MOLY vừa cập nhật thêm nội dung học tập mới để bạn tiếp tục hành trình ôn luyện.\n\nBạn có thể mở bài học, xem lại kiến thức quan trọng và luyện tập theo tốc độ phù hợp với mình.',
    actionLabel: 'Vào học ngay',
    actionUrl: 'https://molystudio.online',
    accent: '#047857',
    soft: '#ecfdf5',
  },
  {
    id: 'exam',
    name: 'Nhắc lịch thi',
    description: 'Nhắc lịch, thời gian và việc cần chuẩn bị.',
    emoji: '⏰',
    deliveryType: 'transactional',
    subject: 'Nhắc bạn về lịch thi sắp tới',
    content: 'Kỳ thi của bạn đang đến gần.\n\nThời gian: [điền thời gian]\nNội dung cần chuẩn bị: [điền nội dung]\n\nHãy kiểm tra thiết bị, đường truyền và đăng nhập sớm để có trạng thái tốt nhất trước giờ thi.',
    actionLabel: 'Xem lịch thi',
    actionUrl: 'https://molystudio.online/exam-room',
    accent: '#b45309',
    soft: '#fffbeb',
  },
  {
    id: 'spring',
    name: 'Mùa xuân hoa đào',
    description: 'Lời chúc Tết, đầu xuân hoặc một dịp nhẹ nhàng.',
    emoji: '🌸',
    deliveryType: 'marketing',
    subject: 'Một lời chúc mùa xuân từ MOLY.STUDIO',
    content: 'Mùa xuân đã ghé qua, MOLY chúc bạn và gia đình thật nhiều sức khỏe, bình an và niềm vui.\n\nMong rằng hành trình học tập trong năm mới của bạn sẽ luôn vững vàng, có thêm nhiều trải nghiệm đẹp và sớm chạm tới mục tiêu của mình.',
    actionLabel: 'Ghé thăm MOLY',
    actionUrl: 'https://molystudio.online',
    accent: '#db2777',
    soft: '#fdf2f8',
  },
  {
    id: 'event',
    name: 'Sự kiện & chúc mừng',
    description: 'MV, livestream, thành tích hoặc sự kiện cộng đồng.',
    emoji: '🎉',
    deliveryType: 'marketing',
    subject: 'Hẹn bạn tại sự kiện mới của MOLY',
    content: 'MOLY thân mời bạn cùng đón chờ một hoạt động đặc biệt.\n\nThời gian: [điền thời gian]\nSự kiện: [điền tên sự kiện]\n\nHy vọng chúng ta sẽ cùng nhau tạo nên những khoảnh khắc thật nhiều cảm xúc.',
    actionLabel: 'Xem chi tiết',
    actionUrl: 'https://molystudio.online',
    accent: '#7c3aed',
    soft: '#f5f3ff',
  },
  {
    id: 'promotion',
    name: 'Ưu đãi',
    description: 'Khuyến mãi có mã giảm giá và thời hạn rõ ràng.',
    emoji: '🎁',
    deliveryType: 'marketing',
    subject: 'Ưu đãi đặc biệt dành riêng cho bạn',
    content: 'MOLY gửi tặng bạn một ưu đãi để hành trình học tập nhẹ nhàng hơn.\n\nThời hạn áp dụng: [điền thời hạn]\nĐiều kiện áp dụng: [điền điều kiện]\n\nNhập mã bên dưới khi thanh toán để nhận ưu đãi.',
    actionLabel: 'Nhận ưu đãi ngay',
    actionUrl: 'https://molystudio.online/vip',
    accent: '#c2410c',
    soft: '#fff7ed',
  },
];

const cleanCopiedContent = (value: string) => value.replace(/\*+/g, '');

export default function EmailCampaignPage() {
  const [channel, setChannel] = useState<'notification' | 'email'>('email');
  const [emailType, setEmailType] = useState<'transactional' | 'marketing'>('transactional');
  const [mode, setMode] = useState<'all' | 'single'>('all');
  const [activeUsers, setActiveUsers] = useState(0);
  const [transactionalUsers, setTransactionalUsers] = useState(0);
  const [activeAccounts, setActiveAccounts] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [templateId, setTemplateId] = useState<EmailTemplateId>('classic');
  const [discountCode, setDiscountCode] = useState('');
  const [actionLabel, setActionLabel] = useState('Xem thông báo');
  const [actionUrl, setActionUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [quotaAccounts, setQuotaAccounts] = useState<EmailQuotaAccount[]>([]);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [criticalReserve, setCriticalReserve] = useState(50);
  const [emailLogs, setEmailLogs] = useState<EmailSendLog[]>([]);

  async function loadQuota() {
    setQuotaLoading(true);
    try {
      const response = await adminApi.getEmailQuota();
      setQuotaAccounts(response.data.accounts || []);
      setCriticalReserve(Number(response.data.criticalReserve) || 0);
    } catch {
      setQuotaAccounts([]);
    } finally {
      setQuotaLoading(false);
    }
  }

  async function loadEmailLogs() {
    try {
      const response = await adminApi.getEmailSendLogs();
      setEmailLogs(response.data || []);
    } catch {
      setEmailLogs([]);
    }
  }

  useEffect(() => {
    adminApi.getEmailAudienceStats()
      .then(response => {
        setActiveUsers(Number(response.data.active_users) || 0);
        setTransactionalUsers(Number(response.data.transactional_users) || 0);
        setActiveAccounts(Number(response.data.active_accounts) || 0);
      })
      .catch(() => setNotice({ ok: false, text: 'Không thể lấy số lượng người nhận.' }));
    loadQuota();
    loadEmailLogs();
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
    ? (channel === 'notification'
        ? activeAccounts
        : emailType === 'transactional' ? transactionalUsers : activeUsers)
    : selected ? 1 : 0;
  const canSend = subject.trim().length >= 3 && content.trim().length >= 3
    && recipientCount > 0 && !sending && !sentSuccessfully;
  const hasUnfilledPlaceholders = /\[điền[^\]]*\]/i.test(content);

  function startNewEmail() {
    setTemplateId('classic');
    setSubject('');
    setContent('');
    setDiscountCode('');
    setActionLabel(emailType === 'transactional' ? 'Xem thông báo' : 'Nhận ưu đãi ngay');
    setActionUrl('');
    setSelected(null);
    setQuery('');
    setResults([]);
    setNotice(null);
    setSentSuccessfully(false);
  }

  function selectEmailType(type: 'transactional' | 'marketing') {
    setEmailType(type);
    setDiscountCode('');
    setActionLabel(type === 'transactional' ? 'Xem thông báo' : 'Nhận ưu đãi ngay');
  }

  function applyEmailTemplate(template: EmailTemplate) {
    setChannel('email');
    setTemplateId(template.id);
    setEmailType(template.deliveryType);
    setSubject(template.subject);
    setContent(template.content);
    setDiscountCode(template.discountCode || '');
    setActionLabel(template.actionLabel);
    setActionUrl(template.actionUrl);
    setNotice(null);
    setSentSuccessfully(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const target = mode === 'all'
      ? `${recipientCount.toLocaleString('vi-VN')} người dùng đang hoạt động`
      : selected?.email;
    const itemName = channel === 'notification'
      ? 'thông báo'
      : emailType === 'transactional' ? 'email học tập' : 'email marketing';
    const defaultRemaining = quotaAccounts.find(account => account.id === 'default')?.remaining || 0;
    const criticalRemaining = quotaAccounts.find(account => account.id === 'critical')?.remaining || 0;
    const defaultShare = Math.min(recipientCount, defaultRemaining);
    const criticalShare = Math.max(0, recipientCount - defaultShare);
    const criticalAfter = Math.max(0, criticalRemaining - criticalShare);
    const allocation = channel === 'email' && mode === 'all'
      ? `\n\nPhân bổ dự kiến:\n• Tài khoản 1: ${defaultShare} email\n• Tài khoản 2: ${criticalShare} email\n• Tài khoản 2 còn khoảng ${criticalAfter} lượt (mức dự phòng: ${criticalReserve})`
      : '';
    const placeholderWarning = hasUnfilledPlaceholders
      ? '\n\n⚠️ Nội dung vẫn còn chỗ [điền ...] chưa được thay.'
      : '';
    if (!window.confirm(`Xác nhận gửi ${itemName} này đến ${target}?${allocation}${placeholderWarning}\n\nHành động này không thể hoàn tác.`)) return;

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
            deliveryType: emailType,
            userId: selected?.id,
            subject: subject.trim(),
            content: content.trim(),
            discountCode: emailType === 'marketing' ? discountCode.trim() : '',
            actionLabel: actionLabel.trim(),
            actionUrl: actionUrl.trim(),
            templateId,
          });
      setNotice({ ok: true, text: response.message });
      setSentSuccessfully(true);
      loadQuota();
      loadEmailLogs();
    } catch (error: any) {
      setNotice({ ok: false, text: error?.response?.data?.message || 'Gửi thất bại.' });
    } finally {
      setSending(false);
    }
  }

  const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
  const selectedTemplate = EMAIL_TEMPLATES.find(template => template.id === templateId) || EMAIL_TEMPLATES[0];

  return (
    <AdminLayout title="Gửi thông báo" description="Gửi qua chuông trong hệ thống hoặc qua email">
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Quota gửi email hôm nay</h2>
                <p className="mt-1 text-xs text-slate-500">Số liệu trực tiếp từ từng tài khoản Brevo.</p>
              </div>
              <button type="button" onClick={loadQuota} disabled={quotaLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <FiRefreshCw className={quotaLoading ? 'animate-spin' : ''} /> Làm mới
              </button>
            </div>
            {quotaLoading && quotaAccounts.length === 0 ? (
              <p className="text-sm text-slate-500">Đang đọc quota Brevo...</p>
            ) : quotaAccounts.length === 0 ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                Không thể đọc quota. Kiểm tra API key hoặc Authorized IPs trong Brevo.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {quotaAccounts.map(account => {
                  const remaining = account.remaining ?? null;
                  const dailyLimit = account.dailyLimit ?? null;
                  const percent = remaining !== null && dailyLimit
                    ? Math.max(0, Math.min(100, (remaining / dailyLimit) * 100))
                    : 0;
                  return (
                    <div key={account.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{account.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {account.id === 'critical'
                              ? 'Xác minh · OTP · Reset · VIP · Marketing'
                              : 'Học tập · Thanh toán · Hệ thống'}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          account.status === 'ok'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }`}>
                          {account.status === 'ok' ? account.planType || 'OK' : account.status}
                        </span>
                      </div>
                      {account.status === 'ok' ? (
                        <>
                          <div className="mt-4 flex items-end justify-between">
                            <p className="text-3xl font-black text-slate-900 dark:text-white">
                              {remaining === null ? '—' : remaining.toLocaleString('vi-VN')}
                            </p>
                            <p className="pb-1 text-xs font-semibold text-slate-500">
                              {dailyLimit ? `/ ${dailyLimit} lượt còn lại` : 'lượt còn lại'}
                            </p>
                          </div>
                          {dailyLimit && remaining !== null && (
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className={`h-full rounded-full ${percent <= 20 ? 'bg-red-500' : percent <= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${percent}%` }} />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-4 text-xs font-semibold text-red-600 dark:text-red-300">
                          {account.error || 'API key chưa được cấu hình.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 font-bold text-slate-900 dark:text-white">Kênh gửi</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={sentSuccessfully} onClick={() => setChannel('notification')}
                className={`rounded-xl border p-4 text-left transition ${channel === 'notification' ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><FiBell /> Thông báo hệ thống</span>
                <span className="mt-1 block text-sm text-slate-500">Hiện ở chuông thông báo, không gửi mail</span>
              </button>
              <button type="button" disabled={sentSuccessfully} onClick={() => setChannel('email')}
                className={`rounded-xl border p-4 text-left transition ${channel === 'email' ? 'border-[#b4232e] bg-[#fff7ed] ring-2 ring-red-100 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><FiMail /> Email</span>
                <span className="mt-1 block text-sm text-slate-500">Gửi thư thật đến hộp thư đã đăng ký</span>
              </button>
            </div>
            <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${channel === 'email' ? 'bg-red-50 text-[#9d2933] dark:bg-red-950/30 dark:text-red-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300'}`}>
              Đang chọn: {channel === 'email' ? 'EMAIL — người nhận sẽ nhận thư trong hộp thư' : 'THÔNG BÁO HỆ THỐNG — chỉ hiện ở biểu tượng chuông'}
            </p>
            {channel === 'email' && (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Loại email</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={sentSuccessfully} onClick={() => selectEmailType('transactional')}
                    className={`rounded-xl border p-4 text-left transition ${emailType === 'transactional' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className="block font-bold text-slate-900 dark:text-white">Thông báo học tập</span>
                    <span className="mt-1 block text-sm text-slate-500">Bài học, lịch học, kết quả — ưu tiên tab Chính</span>
                  </button>
                  <button type="button" disabled={sentSuccessfully} onClick={() => selectEmailType('marketing')}
                    className={`rounded-xl border p-4 text-left transition ${emailType === 'marketing' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-100 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <span className="block font-bold text-slate-900 dark:text-white">Ưu đãi / marketing</span>
                    <span className="mt-1 block text-sm text-slate-500">Khuyến mãi, mã giảm giá — có hủy đăng ký</span>
                  </button>
                </div>
                <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${emailType === 'transactional' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>
                  {emailType === 'transactional'
                    ? 'Chỉ dùng cho thông tin cần thiết liên quan trực tiếp đến việc học; không chèn ưu đãi.'
                    : 'Brevo Marketing Campaign sẽ tự quản lý hủy đăng ký và Gmail có thể xếp vào tab Quảng cáo.'}
                </p>
              </div>
            )}
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

          {channel === 'email' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-xl bg-pink-100 p-2.5 text-pink-700">🪄</span>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">2. Chọn mẫu email</h2>
                  <p className="text-sm text-slate-500">Chọn mẫu để điền nhanh, sau đó bạn vẫn sửa được mọi nội dung.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {EMAIL_TEMPLATES.map(template => {
                  const selected = template.id === templateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={sentSuccessfully}
                      onClick={() => applyEmailTemplate(template)}
                      className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700"
                      style={selected ? {
                        borderColor: template.accent,
                        backgroundColor: template.soft,
                        boxShadow: `0 0 0 2px ${template.accent}22`,
                      } : undefined}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-2xl">{template.emoji}</span>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800">
                          {template.deliveryType === 'transactional' ? 'Học tập' : 'Marketing'}
                        </span>
                      </span>
                      <span className="mt-2 block font-bold text-slate-900 dark:text-white">{template.name}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{template.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 rounded-lg bg-pink-50 px-3 py-2 text-xs font-semibold leading-5 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300">
                🌸 Mẫu hoa đào dùng cánh hoa trang trí tĩnh để hiển thị ổn định trong Gmail. Email không hỗ trợ hiệu ứng rơi bằng JavaScript như trang đăng nhập.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><FiGift /></span>
              <h2 className="font-bold text-slate-900 dark:text-white">{channel === 'email' ? '3.' : '2.'} Soạn nội dung</h2>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tiêu đề *
                <input value={subject} maxLength={160} onChange={e => setSubject(e.target.value)}
                  placeholder={channel === 'email' && emailType === 'transactional'
                    ? 'Ví dụ: Lịch học tuần này đã được cập nhật'
                    : 'Ví dụ: Ưu đãi 30% dành riêng cho bạn'} className={field} />
              </label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Nội dung *
                <textarea value={content} maxLength={10000} rows={9} onChange={e => setContent(cleanCopiedContent(e.target.value))}
                  placeholder={channel === 'email' && emailType === 'transactional'
                    ? 'Nhập nội dung học tập cần thông báo cho học sinh...'
                    : 'Nhập nội dung, thời hạn và điều kiện áp dụng...'} className={`${field} resize-y leading-6`} />
              </label>
              {hasUnfilledPlaceholders && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  ⚠️ Hãy thay các chỗ “[điền ...]” trước khi gửi thật.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {(channel === 'notification' || emailType === 'marketing') && (
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Mã ưu đãi
                    <input value={discountCode} maxLength={80} onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                      placeholder="MOLY30" className={`${field} font-mono`} />
                  </label>
                )}
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
            <section
              className="overflow-hidden rounded-2xl border border-[#ded6c8] border-t-[6px] bg-[#fffdf8] shadow-sm"
              style={{ borderTopColor: selectedTemplate.accent }}
            >
              <div className="flex items-center justify-between border-b border-[#e8e0d3] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-serif text-xl font-bold text-[#fffdf8]"
                    style={{ backgroundColor: selectedTemplate.accent }}
                  >
                    {selectedTemplate.emoji}
                  </span>
                  <div>
                    <p className="text-sm font-black tracking-wide text-[#172033]">MOLY.STUDIO</p>
                    <p className="text-[10px] font-bold tracking-[.14em] text-[#8a7760]">CSCA · DU HỌC TRUNG QUỐC</p>
                  </div>
                </div>
                <span
                  className="rounded-full border px-2.5 py-1 text-xs font-bold"
                  style={{ borderColor: `${selectedTemplate.accent}55`, color: selectedTemplate.accent }}
                >
                  {selectedTemplate.name}
                </span>
              </div>
              {templateId === 'spring' && (
                <div className="overflow-hidden border-b border-pink-100 bg-gradient-to-r from-pink-50 via-rose-100 to-pink-50 px-4 py-2 text-center text-lg tracking-[.55em] text-pink-500">
                  🌸　🌸　🌸　🌸　🌸
                </div>
              )}
              <div className="p-6" style={{ backgroundColor: templateId === 'spring' ? '#fffafd' : '#fffdf8' }}>
                <p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: selectedTemplate.accent }}>
                  Thông báo dành cho bạn
                </p>
                <h3 className="mt-2 font-serif text-2xl font-bold leading-tight text-[#172033]">{subject || 'Tiêu đề thông báo'}</h3>
                <div className="my-5 h-[3px] w-10" style={{ backgroundColor: selectedTemplate.accent }} />
                <p className="mb-3 text-sm text-[#344054]">Chào bạn,</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#475467]">{content.trim() || 'Nội dung thông báo sẽ hiển thị tại đây.'}</p>
                {discountCode && (
                  <div className="mt-5 rounded-lg border border-dashed border-[#c69a68] bg-[#faf4e8] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8a7760]">Mã dành cho bạn</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-widest" style={{ color: selectedTemplate.accent }}>{discountCode}</p>
                  </div>
                )}
                {actionUrl && (
                  <div className="mt-5 w-fit rounded-lg px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: selectedTemplate.accent }}>
                    {actionLabel || 'Xem thông tin'} &nbsp;→
                  </div>
                )}
                {templateId === 'spring' && (
                  <p className="mt-6 text-center text-base tracking-[.35em] text-pink-400">🌸　·　🌸　·　🌸</p>
                )}
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
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 font-bold text-white shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 ${channel === 'email' ? 'bg-[#b4232e] shadow-red-200' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-violet-200'}`}>
            <FiSend /> {sending
              ? 'Đang gửi...'
              : sentSuccessfully
                ? 'Đã gửi — nút đã khóa'
                : channel === 'email'
                  ? `Gửi ${emailType === 'transactional' ? 'THÔNG BÁO HỌC TẬP' : 'EMAIL MARKETING'} đến ${recipientCount.toLocaleString('vi-VN')} người nhận`
                  : `Gửi THÔNG BÁO CHUÔNG đến ${recipientCount.toLocaleString('vi-VN')} người nhận`}
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
              : emailType === 'transactional'
                ? 'Gửi riêng qua notification@molystudio.online. Không dùng nội dung quảng cáo trong loại email này.'
                : 'Gửi qua Brevo Marketing Campaign với cơ chế hủy đăng ký chuẩn. Người nhận không nhìn thấy email của nhau.'}
          </p>
        </div>
      </form>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Lịch sử gửi email</h2>
            <p className="mt-1 text-xs text-slate-500">Log phân bổ quota và kết quả Brevo gần nhất.</p>
          </div>
          <button type="button" onClick={loadEmailLogs}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <FiRefreshCw /> Làm mới
          </button>
        </div>
        {emailLogs.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có log gửi email.</p>
        ) : (
          <div className="space-y-3">
            {emailLogs.slice(0, 15).map(log => {
              const failed = log.action.endsWith('_failed') || log.metadata?.status === 'failed';
              return (
                <div key={log.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.metadata?.subject || 'Email không có tiêu đề'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString('vi-VN')} · {log.admin_name || 'Admin'} · {log.metadata?.deliveryType || 'email'} · mẫu {log.metadata?.templateId || 'classic'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      failed
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}>
                      {failed ? 'Thất bại' : `${Number(log.metadata?.recipientCount || 0).toLocaleString('vi-VN')} đã giao Brevo`}
                    </span>
                  </div>
                  {failed ? (
                    <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">
                      {log.metadata?.errorMessage || 'Không xác định được lỗi.'}
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(log.metadata?.accountBreakdown || []).map(account => (
                        <div key={`${log.id}-${account.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            {account.id === 'default' ? 'Tài khoản 1' : 'Tài khoản 2'}: {account.sent.toLocaleString('vi-VN')} email
                          </p>
                          <p className="mt-1 text-slate-500">
                            Quota {account.quotaBefore ?? '—'} → {account.projectedAfter ?? '—'}
                            {account.campaignId ? ` · Campaign #${account.campaignId}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
