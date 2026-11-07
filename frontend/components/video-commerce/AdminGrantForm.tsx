'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy, FiMail, FiSearch, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { videoShop, shopWrite, type BulkGrantResult, type ProductType } from '@/lib/api/videoShop';
import { LookupPicker } from './AdminProductEditor';
import { Message, subjects, inputClass, buttonClass, secondaryClass, panelClass, errorText } from './shared';

type TargetMode = 'emails' | 'picker';
type DurationPreset = '30' | '90' | '180' | '365' | 'lifetime' | 'custom';

function parseEmailList(raw: string): string[] {
  return [...new Set(
    raw
      .split(/[\s,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
  )];
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export default function AdminGrantForm({
  onSaved,
  onClose,
  initialType = 'video',
  initialProductId,
}: {
  onSaved: () => void;
  onClose: () => void;
  initialType?: ProductType;
  initialProductId?: number;
}) {
  const [targetMode, setTargetMode] = useState<TargetMode>('emails');
  const [type, setType] = useState<ProductType>(initialType);
  const [users, setUsers] = useState<number[]>([]);
  const [emailsText, setEmailsText] = useState('');
  const [products, setProducts] = useState<number[]>(initialProductId ? [initialProductId] : []);
  const [subject, setSubject] = useState('');

  const [videoPreset, setVideoPreset] = useState<DurationPreset>('90');
  const [videoEnd, setVideoEnd] = useState('');
  const [vipPreset, setVipPreset] = useState<Exclude<DurationPreset, 'lifetime'>>('90');
  const [vipEnd, setVipEnd] = useState('');

  const [reason, setReason] = useState('Cấp quyền học viên đăng ký qua chuyển khoản / tư vấn');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkGrantResult | null>(null);
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  const actor = useAuthStore((s) => s.user?.id);
  const storageKey = `video-manual-grant:${actor}`;

  useEffect(() => {
    setType(initialType);
    setProducts(initialProductId ? [initialProductId] : []);
  }, [initialType, initialProductId]);

  useEffect(() => {
    if (!actor) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setPending(JSON.parse(saved));
    } catch {
      setError('Không đọc được yêu cầu cũ. Kiểm tra danh sách quyền trước khi cấp thêm.');
    }
  }, [actor, storageKey]);

  const parsedEmails = useMemo(() => parseEmailList(emailsText), [emailsText]);
  const targetCount = targetMode === 'emails' ? parsedEmails.length : users.length;

  function resolveVideoExpiry(): string | null {
    if (videoPreset === 'lifetime') return null;
    if (videoPreset === 'custom') return new Date(videoEnd).toISOString();
    return addDaysIso(Number(videoPreset));
  }

  function resolveVipExpiry(): string | null {
    if (type !== 'combo') return null;
    if (vipPreset === 'custom') return new Date(vipEnd).toISOString();
    return addDaysIso(Number(vipPreset));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);

    try {
      const videoExpiresAt = resolveVideoExpiry();
      const vipExpiresAt = resolveVipExpiry();

      if (targetMode === 'picker' && users.length === 1 && !pending?.bulk) {
        const input = pending || {
          type,
          userId: users[0],
          productId: products[0],
          selectedSubjectCode: subject || null,
          videoExpiresAt,
          vipExpiresAt,
          reason,
          requestKey: crypto.randomUUID(),
        };
        sessionStorage.setItem(storageKey, JSON.stringify(input));
        setPending(input);
        await shopWrite('post', '/manage/grants', input);
        sessionStorage.removeItem(storageKey);
        setPending(null);
        onSaved();
        return;
      }

      const bulkPayload = (pending?.bulk ? pending.payload : null) || {
        type,
        productId: products[0],
        userIds: targetMode === 'picker' ? users : [],
        emails: targetMode === 'emails' ? parsedEmails : [],
        selectedSubjectCode: subject || null,
        videoExpiresAt,
        vipExpiresAt,
        reason,
        requestKey: crypto.randomUUID(),
      };

      sessionStorage.setItem(storageKey, JSON.stringify({ bulk: true, payload: bulkPayload }));
      setPending({ bulk: true, payload: bulkPayload });
      const res = await videoShop.bulkGrant(bulkPayload as any);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setResult(res);
      if (res.notFoundEmails.length === 0 && res.failed.length === 0) {
        onSaved();
      }
    } catch (err) {
      const status = (err as { response?: { status: number } }).response?.status;
      if (status && status < 500 && status !== 409) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const customVideoMissing = videoPreset === 'custom' && !videoEnd;
  const customVipMissing = type === 'combo' && vipPreset === 'custom' && !vipEnd;
  const canSubmit = pending || (confirmed && products.length > 0 && targetCount > 0 && !customVideoMissing && !customVipMissing && reason.trim().length >= 3);

  return (
    <form className={`${panelClass} space-y-5 border-teal-200 dark:border-teal-800`} onSubmit={submit}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div>
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
            Cấp quyền thủ công / hàng loạt
          </span>
          <h2 className="mt-2 text-xl font-black">Mở quyền gói Video hoặc Combo cho học viên</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Không ghi nhận vào doanh thu cổng thanh toán. Dùng cho học viên chuyển khoản trực tiếp, học bổng hoặc hỗ trợ lớp học.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <FiX className="h-5 w-5" />
        </button>
      </div>

      {error && <Message error>{error}</Message>}

      {pending && (
        <Message>
          Có một yêu cầu cấp quyền trước đó chưa xác nhận xong kết quả mạng. Bấm <strong>Thử lại yêu cầu</strong> để gửi an toàn (không bị cấp trùng) hoặc{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => {
              sessionStorage.removeItem(storageKey);
              setPending(null);
            }}
          >
            hủy yêu cầu cũ
          </button>.
        </Message>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl border border-teal-300 bg-teal-50/80 p-4 text-sm dark:border-teal-800 dark:bg-teal-950/40">
          <p className="font-black text-teal-900 dark:text-teal-100">
            ✓ Đã cấp quyền thành công cho {result.grantedCount} học viên!
          </p>
          {result.notFoundEmails.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">⚠️ {result.notFoundEmails.length} email chưa đăng ký tài khoản trên web:</p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.notFoundEmails.join('\n'));
                    setCopiedMissing(true);
                    setTimeout(() => setCopiedMissing(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-sm"
                >
                  {copiedMissing ? <FiCheck /> : <FiCopy />}
                  {copiedMissing ? 'Đã sao chép' : 'Sao chép email thiếu'}
                </button>
              </div>
              <p className="mt-1.5 break-all font-mono text-xs">{result.notFoundEmails.join(', ')}</p>
            </div>
          )}
          {result.failed.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              <p className="font-bold">Một số tài khoản chưa cấp được ({result.failed.length}):</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {result.failed.map((item, idx) => (
                  <li key={idx}>{item.email}: {item.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-1">
            <button type="button" onClick={onSaved} className={buttonClass}>
              Hoàn tất & cập nhật danh sách
            </button>
          </div>
        </div>
      )}

      <fieldset disabled={busy || !!pending} className="space-y-5">
        {/* Step 1: Choose package */}
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <label className="block text-sm font-bold">
            1. Loại gói cần cấp
            <select
              className={`${inputClass} mt-2`}
              value={type}
              onChange={(e) => {
                setType(e.target.value as ProductType);
                setProducts([]);
                setConfirmed(false);
              }}
            >
              <option value="video">Gói Video khóa học</option>
              <option value="combo">Gói Combo (Video + VIP)</option>
            </select>
          </label>
          <LookupPicker
            kind={type}
            label="Chọn gói được cấp"
            selected={products}
            onChange={(ids) => {
              setProducts(ids);
              setConfirmed(false);
            }}
          />
        </div>

        {/* Step 2: Choose students */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">2. Chọn học viên nhận quyền</p>
            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => { setTargetMode('emails'); setConfirmed(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  targetMode === 'emails' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <FiMail /> Dán danh sách Email
              </button>
              <button
                type="button"
                onClick={() => { setTargetMode('picker'); setConfirmed(false); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  targetMode === 'picker' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                }`}
              >
                <FiSearch /> Tìm tên / Email
              </button>
            </div>
          </div>

          {targetMode === 'emails' ? (
            <div>
              <textarea
                rows={4}
                value={emailsText}
                onChange={(e) => { setEmailsText(e.target.value); setConfirmed(false); }}
                placeholder="Dán 1 hoặc nhiều email (mỗi dòng 1 email, hoặc ngăn cách bằng dấu phẩy / khoảng trắng)&#10;Ví dụ:&#10;hocvien1@gmail.com&#10;hocvien2@gmail.com"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                Đã nhận diện: <strong className="text-teal-700 dark:text-teal-300">{parsedEmails.length}</strong> email hợp lệ (tối đa 200 học viên/lần).
              </p>
            </div>
          ) : (
            <LookupPicker
              kind="users"
              label="Tìm học viên theo tên, email, username hoặc ID"
              selected={users}
              multiple
              onChange={(ids) => {
                setUsers(ids);
                setConfirmed(false);
              }}
            />
          )}
        </div>

        {/* Step 3: Subject & Duration */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            3. Môn học (chỉ chọn nếu gói bắt buộc chọn 1 môn)
            <select className={`${inputClass} mt-2`} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Mở toàn bộ môn có trong gói</option>
              {Object.entries(subjects)
                .filter(([s]) => s !== '*')
                .map(([s, n]) => (
                  <option key={s} value={s}>{n}</option>
                ))}
            </select>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-bold">4. Thời hạn quyền Video</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['30', '30 ngày'],
                ['90', '90 ngày'],
                ['180', '180 ngày'],
                ['365', '1 năm'],
                ['lifetime', 'Vĩnh viễn'],
                ['custom', 'Chọn ngày'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setVideoPreset(val)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                    videoPreset === val
                      ? 'border-teal-700 bg-teal-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {videoPreset === 'custom' && (
              <input
                required
                type="datetime-local"
                value={videoEnd}
                onChange={(e) => setVideoEnd(e.target.value)}
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
        </div>

        {type === 'combo' && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
            <p className="text-sm font-bold">Thời hạn quyền VIP đi kèm trong Combo</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['30', '30 ngày'],
                ['90', '90 ngày'],
                ['180', '180 ngày'],
                ['365', '1 năm'],
                ['custom', 'Chọn ngày'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setVipPreset(val)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                    vipPreset === val
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {vipPreset === 'custom' && (
              <input
                required
                type="datetime-local"
                value={vipEnd}
                onChange={(e) => setVipEnd(e.target.value)}
                className={`${inputClass} mt-2`}
              />
            )}
          </div>
        )}

        <label className="block text-sm font-bold">
          5. Ghi chú / Lý do cấp quyền (lưu nhật ký đối soát)
          <textarea
            required
            rows={2}
            minLength={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/50">
          <input
            type="checkbox"
            required={!pending}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 accent-teal-700"
          />
          <span>
            Xác nhận cấp <strong>{type === 'combo' ? 'Combo Video + VIP' : 'Gói Video'}</strong> cho{' '}
            <strong>{targetCount}</strong> học viên ({videoPreset === 'lifetime' ? 'không giới hạn thời hạn' : videoPreset === 'custom' ? 'theo ngày đã chọn' : `${videoPreset} ngày`}).
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button className={buttonClass} disabled={busy || !canSubmit}>
          {busy ? 'Đang xử lý cấp quyền…' : pending ? 'Thử lại yêu cầu' : `Xác nhận cấp cho ${targetCount} học viên`}
        </button>
        <button type="button" disabled={busy} className={secondaryClass} onClick={onClose}>
          Đóng
        </button>
      </div>
    </form>
  );
}
