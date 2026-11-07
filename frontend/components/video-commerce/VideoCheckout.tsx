'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiLock,
  FiPlayCircle,
  FiRefreshCw,
  FiShield,
  FiTag,
  FiZap,
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import { videoShop, shopGet, type ShopProduct, type Page, type VideoRight } from '@/lib/api/videoShop';
import { videoPaymentsApi } from '@/lib/api/videoPayments';
import type {
  VideoCreateOrderInput,
  VideoPaymentOrder,
  VideoPaymentQuote,
  VideoPaymentSelection,
} from '@/lib/types/videoPayments';
import type { CscaSubjectCode } from '@/lib/types/courses';
import {
  ShopShell,
  Message,
  money,
  endDate,
  subjects,
  statusLabel,
  inputClass,
  buttonClass,
  secondaryClass,
  panelClass,
  errorText,
} from './shared';

function formatCountdown(expiresAt: string): { text: string; expired: boolean } {
  const remainingSec = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  if (!Number.isFinite(remainingSec) || remainingSec <= 0) {
    return { text: '00:00', expired: true };
  }
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return {
    text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    expired: false,
  };
}

function CopyRow({
  label,
  value,
  copyValue,
  highlight = false,
}: {
  label: string;
  value: string;
  copyValue?: string;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const target = copyValue ?? value;
  return (
    <div className="flex flex-col gap-1 border-b border-slate-200/80 py-2.5 last:border-b-0 dark:border-slate-700/80 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className={`break-all text-sm font-black ${highlight ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-slate-100'}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(target);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:border-teal-500 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          title="Sao chép"
        >
          {copied ? <FiCheck className="text-emerald-600" /> : <FiCopy />}
          {copied ? 'Đã chép' : 'Chép'}
        </button>
      </div>
    </div>
  );
}

export default function VideoCheckout() {
  const params = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const userCoins = Math.max(0, Number(user?.coins || 0));
  const logged = useAuthStore((s) => s.isAuthenticated);

  const type = params.get('type') === 'combo' ? 'combo' : 'video';
  const id = Number(params.get('productId'));
  const orderId = params.get('orderId');

  const [mounted, setMounted] = useState(false);
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [subject, setSubject] = useState('');
  const [coupon, setCoupon] = useState(params.get('coupon') || '');
  const [useCoins, setUseCoins] = useState(false);
  const [quote, setQuote] = useState<VideoPaymentQuote | null>(null);
  const [order, setOrder] = useState<VideoPaymentOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [pending, setPending] = useState<VideoCreateOrderInput | null>(null);
  const [retry, setRetry] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [owned, setOwned] = useState<VideoRight[]>([]);
  const [, setTick] = useState(0);

  const flight = useRef(false);
  const autoQuotedKey = useRef('');
  const key = `video-checkout:${userId}:${type}:${id}`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [order]);

  useEffect(() => {
    let live = true;
    setOwned([]);
    if (userId && product) {
      shopGet<Page<VideoRight>>('/me/rights', { limit: 100 })
        .then((data) => {
          if (live) {
            setOwned(
              data.items.filter(
                (r) =>
                  r.status === 'active' &&
                  (!r.expiresAt || new Date(r.expiresAt) > new Date()) &&
                  r.courseIds.some((cid) => product.courses.some((c) => Number(c.id) === cid)),
              ),
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [userId, product]);

  useEffect(() => {
    let live = true;
    setError('');
    setProduct(null);
    setQuote(null);
    setOrder(null);
    setPending(null);
    autoQuotedKey.current = '';
    if (!orderId && Number.isSafeInteger(id) && id > 0) {
      videoShop
        .product(type, id)
        .then((p) => {
          if (!live) return;
          setProduct(p);
          if (p.video?.requiresSubjectChoice && p.video.allowedSubjects.length === 1) {
            setSubject(p.video.allowedSubjects[0]);
          }
        })
        .catch((e) => live && setError(errorText(e)));
    } else if (!orderId) {
      setError('Vui lòng chọn một gói khóa học trước khi thanh toán.');
    }
    if (userId && !orderId) {
      try {
        const saved = sessionStorage.getItem(key);
        if (saved) setPending(JSON.parse(saved));
      } catch {
        setError('Không đọc được yêu cầu trước. Kiểm tra lịch sử đơn trước khi tạo mới.');
      }
    }
    return () => {
      live = false;
    };
  }, [type, id, orderId, key, userId, retry]);

  const refresh = useCallback(async () => {
    if (!orderId || !logged) return;
    try {
      setOrder(await videoPaymentsApi.status(orderId));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [orderId, logged]);

  const terminal = !!order && ['completed', 'cancelled', 'expired', 'failed'].includes(order.status);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped || !orderId) return;
      try {
        const next = await videoPaymentsApi.status(orderId);
        if (!stopped) {
          setOrder(next);
          setError('');
        }
      } catch (e) {
        if (!stopped) setError(errorText(e));
      }
      if (!stopped && !terminal) timer = setTimeout(poll, 4000);
    };
    if (orderId && logged) void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, logged, terminal]);

  useEffect(() => {
    let live = true;
    setQr(null);
    if (order?.payment?.qrCode) {
      shopGet<{ dataUrl: string | null }>(`/payments/orders/${encodeURIComponent(order.orderId)}/qr`)
        .then((r) => live && setQr(r.dataUrl))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [order?.orderId, order?.payment?.qrCode]);

  const selection = useCallback(
    (): VideoPaymentSelection => ({
      type,
      productId: id,
      ...(subject ? { selectedSubjectCode: subject as CscaSubjectCode } : {}),
      couponCode: coupon.trim() || null,
      useCoins,
    }),
    [type, id, subject, coupon, useCoins],
  );

  const getQuote = useCallback(async () => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setQuote(null);
    try {
      setQuote(await videoPaymentsApi.quote(selection()));
    } catch (e) {
      setError(errorText(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }, [selection]);

  // Auto-quote when product & subject are ready so student immediately sees final price without an extra click
  useEffect(() => {
    if (!logged || orderId || !product || !product.canPurchase || pending) return;
    if (product.video?.requiresSubjectChoice && !subject) return;
    const currentKey = `${product.id}:${subject}:${useCoins}`;
    if (autoQuotedKey.current === currentKey) return;
    autoQuotedKey.current = currentKey;
    void getQuote();
  }, [logged, orderId, product, subject, useCoins, pending, getQuote]);

  async function pay() {
    if (flight.current || (!quote && !pending)) return;
    flight.current = true;
    setBusy(true);
    setError('');
    try {
      const input = pending || {
        ...selection(),
        quoteHash: quote!.quoteHash,
        idempotencyKey: crypto.randomUUID(),
      };
      // Persist before POST so reload/timeout can only retry this financial intent.
      sessionStorage.setItem(key, JSON.stringify(input));
      setPending(input);
      const result = await videoPaymentsApi.createOrder(input);
      sessionStorage.removeItem(key);
      setPending(null);
      setOrder(result);
      router.replace(`/thanh-toan-khoa-hoc?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (e) {
      const status = (e as { response?: { status: number } }).response?.status;
      const code = (e as { response?: { data?: { code: string } } }).response?.data?.code;
      if (
        status &&
        [409, 422, 503].includes(status) &&
        !['PAYMENT_RECONCILIATION_REQUIRED', 'IDEMPOTENCY_CONFLICT'].includes(code || '')
      ) {
        sessionStorage.removeItem(key);
        setPending(null);
        setQuote(null);
      }
      setError(errorText(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (!order || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    try {
      setOrder(await videoPaymentsApi.cancel(order.orderId));
      setCancelConfirm(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  const change = (fn: () => void) => {
    fn();
    setQuote(null);
    setError('');
  };

  const paymentUrl = order?.payment?.checkoutUrl;
  const safeUrl = paymentUrl && /^https:\/\/pay\.payos\.vn\//.test(paymentUrl) ? paymentUrl : null;
  const countdown = order ? formatCountdown(order.expiresAt) : null;

  return (
    <ShopShell title={orderId ? 'Thanh toán khóa học' : 'Xác nhận đăng ký khóa học'}>
      {error && (
        <div className="mb-5">
          <Message error>{error}</Message>
        </div>
      )}

      {!mounted ? (
        <Message>Đang tải thông tin…</Message>
      ) : !logged ? (
        <Message>
          Bạn cần đăng nhập để hệ thống cấp đúng quyền học vào tài khoản.{' '}
          <Link
            className="font-bold underline"
            href={`/login?redirect=${encodeURIComponent('/thanh-toan-khoa-hoc?' + params.toString())}`}
          >
            Đăng nhập ngay
          </Link>
        </Message>
      ) : orderId ? (
        !order ? (
          <Message>
            Đang kết nối cổng thanh toán để lấy mã QR…{' '}
            <button type="button" className="font-bold underline" onClick={refresh}>
              Thử lại
            </button>
          </Message>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
            {/* Left: Order summary & rights */}
            <section className={`${panelClass} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                  {order.type === 'combo' ? 'Combo Khóa học + VIP' : 'Gói Video khóa học'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    order.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : ['cancelled', 'expired', 'failed'].includes(order.status)
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {statusLabel[order.status] || order.status}
                </span>
              </div>

              <h2 className="text-2xl font-black">{order.snapshot.name}</h2>
              <p className="break-all font-mono text-xs text-slate-500">Mã đơn: {order.orderId}</p>

              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng thanh toán</p>
                <p className="mt-1 text-3xl font-black text-teal-800 dark:text-teal-300">{money(order.amount)}</p>
                {(order.snapshot.couponDiscountAmount > 0 || order.snapshot.coinDiscountAmount > 0) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Giá gốc {money(order.snapshot.originalAmount)}
                    {order.snapshot.couponDiscountAmount > 0 && ` · Voucher −${money(order.snapshot.couponDiscountAmount)}`}
                    {order.snapshot.coinDiscountAmount > 0 && ` · Xu −${money(order.snapshot.coinDiscountAmount)}`}
                  </p>
                )}
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                <p>
                  <strong>Môn học mở khóa:</strong>{' '}
                  {order.snapshot.video.subjects.map((s) => subjects[s] || s).join(', ')}
                </p>
                <p>
                  <strong>Thời hạn học video:</strong>{' '}
                  {order.snapshot.video.durationMode === 'lifetime'
                    ? 'Không giới hạn thời gian'
                    : `${order.snapshot.video.durationDays} ngày`}
                </p>
                {order.snapshot.vip && (
                  <p>
                    <strong>Gói luyện đề đi kèm:</strong> {order.snapshot.vip.name} ({order.snapshot.vip.durationDays} ngày)
                  </p>
                )}
              </div>

              {order.rights && (
                <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <p className="flex items-center gap-2 font-black">
                    <FiCheckCircle className="h-5 w-5 text-emerald-600" /> Đã mở quyền học thành công!
                  </p>
                  <p className="text-xs">Hạn học video: {endDate(order.rights.videoExpiresAt)}</p>
                  {order.rights.vipEntitlementId && (
                    <p className="text-xs">Hạn gói VIP: {endDate(order.rights.vipExpiresAt)}</p>
                  )}
                  <Link href="/hoc" className={`${buttonClass} w-full`}>
                    <FiPlayCircle /> Vào phòng học Video ngay
                  </Link>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 text-xs font-bold">
                <Link href="/tai-khoan/goi-video" className="text-teal-700 underline dark:text-teal-300">
                  Xem gói của tôi & lịch sử đơn
                </Link>
                {['cancelled', 'expired', 'failed'].includes(order.status) && (
                  <Link
                    href={`/thanh-toan-khoa-hoc?type=${order.type}&productId=${order.productId}`}
                    className="text-slate-700 underline dark:text-slate-200"
                  >
                    Đặt lại gói này →
                  </Link>
                )}
              </div>
            </section>

            {/* Right: QR & Bank transfer details */}
            <section className={`${panelClass} space-y-5`}>
              {order.status === 'completed' ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <FiCheckCircle className="h-9 w-9" />
                  </div>
                  <h2 className="text-2xl font-black">Thanh toán hoàn tất!</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Quyền truy cập khóa học đã được kích hoạt tự động trên tài khoản của bạn.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/hoc" className={buttonClass}>
                      <FiPlayCircle /> Bắt đầu học ngay
                    </Link>
                    <Link href="/tai-khoan/goi-video" className={secondaryClass}>
                      Quản lý gói đã mua
                    </Link>
                  </div>
                </div>
              ) : order.status === 'awaiting_fulfillment' || order.status === 'payment_review' ? (
                <Message>
                  Hệ thống đã ghi nhận giao dịch và đang đối soát cấp quyền tự động.{' '}
                  <strong>Vui lòng không chuyển khoản lại.</strong> Giữ mã đơn <code>{order.orderId}</code> nếu cần hỗ trợ qua Zalo 0815913408.
                </Message>
              ) : ['cancelled', 'expired', 'failed'].includes(order.status) ? (
                <div className="space-y-4">
                  <Message>
                    Đơn thanh toán này đã đóng ({statusLabel[order.status] || order.status}). Nếu bạn chưa chuyển khoản, bạn có thể tạo lại đơn mới. Nếu đã chuyển khoản, bấm <strong>Kiểm tra lại trạng thái</strong> hoặc gửi mã đơn cho Zalo hỗ trợ <strong>0815913408</strong>.
                  </Message>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/thanh-toan-khoa-hoc?type=${order.type}&productId=${order.productId}`}
                      className={buttonClass}
                    >
                      Tạo đơn thanh toán mới
                    </Link>
                    <button type="button" className={secondaryClass} onClick={refresh}>
                      <FiRefreshCw /> Kiểm tra lại trạng thái
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 dark:border-teal-800 dark:bg-teal-950/40">
                    <div className="flex items-center gap-2.5">
                      <FiClock className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-200">
                          Quét mã VietQR tự động kích hoạt
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Hệ thống kiểm tra tự động mỗi 4 giây
                        </p>
                      </div>
                    </div>
                    {countdown && (
                      <span className="font-mono text-2xl font-black tabular-nums text-teal-900 dark:text-teal-100">
                        {countdown.text}
                      </span>
                    )}
                  </div>

                  {qr ? (
                    <div className="flex flex-col items-center">
                      <div className="rounded-2xl border-2 border-teal-100 bg-white p-4 shadow-md">
                        <img
                          src={qr}
                          width={260}
                          height={260}
                          alt="Mã QR thanh toán của đơn hàng"
                          className="h-56 w-56 object-contain sm:h-64 sm:w-64"
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Mở App Ngân hàng bất kỳ → Quét mã QR để tự điền đúng số tiền & nội dung
                      </p>
                    </div>
                  ) : null}

                  {order.payment?.accountNumber && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">
                        Hoặc chuyển khoản thủ công chính xác theo thông tin:
                      </p>
                      <CopyRow
                        label="Ngân hàng"
                        value={order.payment.bankName || order.payment.bin || 'Theo mã VietQR'}
                      />
                      <CopyRow label="Số tài khoản" value={order.payment.accountNumber} />
                      {order.payment.accountName && (
                        <CopyRow label="Chủ tài khoản" value={order.payment.accountName} />
                      )}
                      <CopyRow
                        label="Số tiền"
                        value={money(order.payment.amount || order.amount)}
                        copyValue={String(order.payment.amount || order.amount)}
                        highlight
                      />
                      {order.payment.description && (
                        <CopyRow
                          label="Nội dung chuyển khoản"
                          value={order.payment.description}
                          highlight
                        />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${secondaryClass} flex-1`}
                      >
                        Mở cổng PayOS <FiExternalLink />
                      </a>
                    )}
                    <button type="button" className={`${secondaryClass} flex-1`} onClick={refresh}>
                      <FiRefreshCw /> Tôi đã chuyển khoản
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    {!cancelConfirm ? (
                      <button
                        type="button"
                        className="text-xs font-bold text-slate-500 underline hover:text-rose-600"
                        onClick={() => setCancelConfirm(true)}
                      >
                        Hủy đơn này để đổi gói / nhập lại mã giảm giá
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                        <span>Chỉ hủy khi bạn <strong>chưa chuyển tiền</strong>. Xác nhận hủy đơn?</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancel}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            Xác nhận hủy
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700"
                            onClick={() => setCancelConfirm(false)}
                          >
                            Giữ đơn
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {order.reconciliationPending && (
                <Message>Đang chờ phản hồi mới nhất từ cổng thanh toán. Đơn của bạn vẫn được giữ an toàn.</Message>
              )}
            </section>
          </div>
        )
      ) : !product ? (
        <Message>
          Đang tải thông tin gói học…{' '}
          <button type="button" className="font-bold underline" onClick={() => setRetry((r) => r + 1)}>
            Thử lại
          </button>
        </Message>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: Product Details */}
          <section className={`${panelClass} space-y-5`}>
            <div>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-800 dark:bg-teal-900/60 dark:text-teal-200">
                {type === 'combo' ? 'Combo Video + Luyện đề VIP' : 'Gói Khóa học Video'}
              </span>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">{product.name}</h2>
              {product.description && (
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{product.description}</p>
              )}
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Thời hạn Video bài giảng</p>
                <p className="mt-1 font-black">
                  {product.video?.durationMode === 'lifetime'
                    ? 'Không giới hạn thời gian'
                    : `${product.video?.durationDays ?? 'Chưa cấu hình'} ngày học`}
                </p>
              </div>
              {product.vip && (
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Quyền VIP đi kèm</p>
                  <p className="mt-1 font-black text-amber-700 dark:text-amber-300">
                    {product.vip.name} ({'vipDurationDays' in product ? String(product.vipDurationDays) : ''} ngày)
                  </p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Các khóa học có trong gói ({product.courses.length}):
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {product.courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <span className="font-semibold">✓ {c.title}</span>
                    <span className="shrink-0 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                      {subjects[c.subject_code] || c.subject_code}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {product.features?.length > 0 && (
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Quyền lợi học viên:
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {product.features.map((f, idx) => (
                    <li key={idx}>• {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {owned.length > 0 && (
              <Message>
                Bạn hiện đang có quyền học một số khóa thuộc gói này.{' '}
                <Link className="font-bold underline" href="/tai-khoan/goi-video">
                  Kiểm tra thời hạn đang sở hữu
                </Link>{' '}
                trước khi mua thêm.
              </Message>
            )}

            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <FiZap className="mx-auto mb-1 h-4 w-4 text-teal-600" />
                Mở khóa tự động
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <FiShield className="mx-auto mb-1 h-4 w-4 text-teal-600" />
                QR PayOS an toàn
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <FiLock className="mx-auto mb-1 h-4 w-4 text-teal-600" />
                Bảo vệ tài khoản
              </div>
            </div>
          </section>

          {/* Right: Options, Quote & Checkout CTA */}
          <section className={`${panelClass} space-y-5 lg:sticky lg:top-6`}>
            <h3 className="text-lg font-black">Tùy chọn & Thanh toán</h3>

            {pending ? (
              <Message>
                Đang có một yêu cầu tạo đơn trước đó chưa xác nhận xong. Bấm <strong>Thử lại yêu cầu thanh toán</strong> để mở lại đúng đơn đã tạo (không tạo trùng).
              </Message>
            ) : (
              <fieldset disabled={busy} className="space-y-4">
                {product.video?.requiresSubjectChoice && (
                  <label className="block text-sm font-bold">
                    Chọn môn học muốn mở khóa <span className="text-rose-600">*</span>
                    <select
                      className={`${inputClass} mt-2`}
                      value={subject}
                      onChange={(e) => change(() => setSubject(e.target.value))}
                    >
                      <option value="">-- Chọn 1 môn học --</option>
                      {product.video.allowedSubjects.map((s) => (
                        <option key={s} value={s}>
                          {subjects[s] || s}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <label className="block text-sm font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <FiTag className="text-teal-700" /> Mã giảm giá (nếu có)
                    </span>
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      className={inputClass}
                      value={coupon}
                      maxLength={50}
                      onChange={(e) => change(() => setCoupon(e.target.value.toUpperCase()))}
                      placeholder="Nhập mã ưu đãi..."
                    />
                    <button
                      type="button"
                      disabled={busy || !product.canPurchase || (product.video?.requiresSubjectChoice && !subject)}
                      onClick={() => void getQuote()}
                      className={`${secondaryClass} shrink-0`}
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-teal-700"
                    checked={useCoins}
                    disabled={userCoins <= 0}
                    onChange={(e) => change(() => setUseCoins(e.target.checked))}
                  />
                  <div>
                    <p className="font-bold">Dùng xu tích lũy giảm thêm</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Số dư hiện tại: <strong>{userCoins.toLocaleString('vi-VN')} xu</strong> (1 xu = 100 đ, giảm tối đa 20% sau voucher).
                    </p>
                  </div>
                </label>
              </fieldset>
            )}

            {!product.canPurchase && !pending && (
              <Message>Gói này hiện đang tạm dừng mở bán trực tuyến. Bạn vui lòng quay lại sau hoặc liên hệ Zalo 0815913408.</Message>
            )}

            {quote && !pending ? (
              <dl className="space-y-2.5 rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 text-sm dark:border-teal-900 dark:bg-slate-800/80">
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-300">Giá niêm yết</dt>
                  <dd className="font-bold">{money(quote.originalAmount)}</dd>
                </div>
                {quote.couponDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <dt>Mã giảm giá ({quote.couponCode})</dt>
                    <dd className="font-bold">− {money(quote.couponDiscountAmount)}</dd>
                  </div>
                )}
                {quote.coinDiscountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-300">
                    <dt>Dùng {quote.coinsUsed.toLocaleString('vi-VN')} xu</dt>
                    <dd className="font-bold">− {money(quote.coinDiscountAmount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-teal-200/70 pt-3 dark:border-slate-700">
                  <dt className="font-bold">Cần thanh toán</dt>
                  <dd className="text-2xl font-black text-teal-800 dark:text-teal-300">{money(quote.amount)}</dd>
                </div>
              </dl>
            ) : !pending && product.canPurchase ? (
              <button
                type="button"
                disabled={busy || (product.video?.requiresSubjectChoice && !subject)}
                onClick={() => void getQuote()}
                className={`${secondaryClass} w-full`}
              >
                {busy ? 'Đang tính giá & ưu đãi…' : 'Xem báo giá chi tiết'}
              </button>
            ) : null}

            {(quote || pending) && (
              <button
                type="button"
                disabled={busy || (!pending && !quote?.salesEnabled)}
                onClick={() => void pay()}
                className={`${buttonClass} w-full py-3.5 text-base shadow-md`}
              >
                {busy
                  ? 'Đang khởi tạo đơn…'
                  : pending
                    ? 'Thử lại yêu cầu thanh toán'
                    : quote?.amount === 0
                      ? 'Kích hoạt gói miễn phí ngay'
                      : 'Tạo mã QR thanh toán →'}
              </button>
            )}

            <p className="text-center text-xs text-slate-500">
              <Link href="/tai-khoan/goi-video" className="font-semibold underline hover:text-teal-700">
                Xem lịch sử đơn hàng & gói đã sở hữu
              </Link>
            </p>
          </section>
        </div>
      )}
    </ShopShell>
  );
}
