'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiBookOpen,
  FiCheckCircle,
  FiCreditCard,
  FiExternalLink,
  FiFileText,
  FiGift,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiTag,
  FiUserCheck,
} from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import {
  shopGet,
  shopWrite,
  type Page,
  type ShopProduct,
  type VideoRight,
  type VideoCoupon,
  type AdminOrder,
  type AdminEvent,
  type Revenue,
  type CouponUsage,
  type ProductType,
} from '@/lib/api/videoShop';
import { videoPaymentsApi } from '@/lib/api/videoPayments';
import AdminProductEditor, { LookupPicker } from './AdminProductEditor';
import AdminGrantForm from './AdminGrantForm';
import AdminCouponEditor from './AdminCouponEditor';
import AdminPromotionEditor from './AdminPromotionEditor';
import ConfirmDialog from './ConfirmDialog';
import {
  Message,
  Pager,
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

type Tab = 'products' | 'rights' | 'orders' | 'coupons' | 'promotions' | 'events';

const tabItems: Array<{ id: Tab; label: string; icon: typeof FiLayers }> = [
  { id: 'products', label: 'Gói bán (Video / Combo)', icon: FiLayers },
  { id: 'rights', label: 'Học viên & Cấp quyền', icon: FiUserCheck },
  { id: 'orders', label: 'Đơn thanh toán', icon: FiCreditCard },
  { id: 'coupons', label: 'Mã giảm giá', icon: FiTag },
  { id: 'promotions', label: 'Banner ưu đãi', icon: FiGift },
  { id: 'events', label: 'Nhật ký thao tác', icon: FiFileText },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'draft':
    case 'pending':
    case 'processing':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'awaiting_fulfillment':
    case 'payment_review':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800';
    case 'revoked':
    case 'cancelled':
    case 'failed':
    case 'expired':
      return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export default function AdminVideoCommerce() {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, 'users.manage');
  const canManageCourses = hasPermission(user, '*');

  const [tab, setTab] = useState<Tab>('products');
  const [type, setType] = useState<ProductType>('video');
  const [page, setPage] = useState(1);
  const [loaded, setData] = useState<Page<unknown> | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [stats, setStats] = useState<Revenue[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const [editProduct, setEditProduct] = useState<ShopProduct | null | undefined>(undefined);
  const [editCoupon, setEditCoupon] = useState<VideoCoupon | null | undefined>(undefined);
  const [grantPreset, setGrantPreset] = useState<{ open: boolean; type: ProductType; productId?: number }>({
    open: false,
    type: 'video',
  });
  const [revoke, setRevoke] = useState<VideoRight | null>(null);
  const [reason, setReason] = useState('');
  const [userIds, setUserIds] = useState<number[]>([]);
  const [sharedId, setSharedId] = useState<number[]>([]);
  const [attach, setAttach] = useState(false);
  const [usage, setUsage] = useState<{ id: number; page: number; data: Page<CouponUsage> } | null>(null);

  const requestKey = JSON.stringify([tab, type, page, version, userIds]);
  const data = loadedKey === requestKey ? loaded : null;
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setError('');
    setData(null);
    const paths: Record<Tab, string> = {
      products: `/manage/products/${type}`,
      rights: '/manage/rights',
      orders: '/manage/orders',
      coupons: '/manage/coupons',
      promotions: '',
      events: '/manage/events',
    };
    if (paths[tab]) {
      shopGet<Page<unknown>>(paths[tab], {
        page,
        ...(tab === 'orders' ? { type } : {}),
        ...(tab === 'rights' && userIds[0] ? { userId: userIds[0] } : {}),
      })
        .then((d) => {
          if (live) {
            setData(d);
            setLoadedKey(requestKey);
          }
        })
        .catch((e) => live && setError(errorText(e)));
    }
    shopGet<Revenue[]>('/manage/stats')
      .then((s) => live && setStats(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [allowed, tab, type, page, version, userIds, requestKey]);

  function saved() {
    setEditProduct(undefined);
    setEditCoupon(undefined);
    setGrantPreset((curr) => ({ ...curr, open: false }));
    setNotice('Đã lưu và cập nhật dữ liệu thành công.');
    refresh();
  }

  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice('Đã xử lý thành công.');
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadUsage(id: number, p = 1) {
    try {
      setUsage({ id, page: p, data: await shopGet<Page<CouponUsage>>(`/manage/coupons/${id}/usage`, { page: p }) });
    } catch (e) {
      setError(errorText(e));
    }
  }

  function openQuickGrant(targetType: ProductType, productId?: number) {
    setTab('rights');
    setPage(1);
    setEditProduct(undefined);
    setEditCoupon(undefined);
    setGrantPreset({ open: true, type: targetType, productId });
  }

  return (
    <AdminLayout
      title="Gói Video & Combo khóa học"
      description="Đóng gói khóa học quay sẵn để bán tự động qua PayOS hoặc cấp quyền hàng loạt cho học viên."
    >
      {!allowed ? (
        <Message error>Bạn cần quyền quản lý người dùng để mở khu vực này.</Message>
      ) : (
        <div className="space-y-6">
          {/* Quick Workflow Banner */}
          <section className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50/90 via-white to-emerald-50/70 p-5 shadow-sm dark:border-teal-900 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  Quy trình vận hành khóa học Video chuẩn (3 bước)
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Quản lý tách biệt rõ ràng giữa <strong>Nội dung video bài giảng</strong> và <strong>Gói bán / Cấp quyền</strong>:
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageCourses && (
                  <Link href="/admin/courses" className={secondaryClass}>
                    <FiBookOpen /> Quản lý khóa học & Upload Video ↗
                  </Link>
                )}
                <button type="button" onClick={() => openQuickGrant(type)} className={buttonClass}>
                  <FiUserCheck /> Cấp quyền gói nhanh
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 text-xs leading-5 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-black text-slate-900 dark:text-white">Bước 1 · Đăng video & Xuất bản khóa</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Tạo khóa học, tải video Bunny Stream và bấm <em>Xuất bản bài sẵn sàng</em> tại mục Khóa học. (Có thể cấp lẻ từng khóa ngay tại đó).
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 text-xs leading-5 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-black text-slate-900 dark:text-white">Bước 2 · Tạo Gói Video hoặc Combo</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Ở tab <strong>Gói bán</strong> bên dưới, gom 1 hoặc nhiều khóa vào gói, cấu hình giá, số ngày học và chuyển trạng thái sang <em>Bật bán</em>.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 text-xs leading-5 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-black text-slate-900 dark:text-white">Bước 3 · Tự động kích hoạt / Cấp tay</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Học viên quét QR PayOS sẽ tự nhận quyền ngay. Nếu học viên chuyển khoản ngoài, bấm <strong>Cấp quyền gói nhanh</strong> và dán danh sách Email.
                </p>
              </div>
            </div>
          </section>

          {/* Revenue KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(['video', 'combo'] as const).map((t) => {
              const s = stats.find((x) => x.type === t);
              const hasReview = (s?.review ?? 0) > 0;
              return (
                <div key={t} className={`${panelClass} flex flex-col justify-between`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                        {t === 'video' ? 'Gói Video độc lập' : 'Combo Video + VIP'}
                      </p>
                      <p className="mt-2 text-2xl font-black sm:text-3xl">{money(s?.revenue ?? 0)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setType(t);
                        setTab('products');
                        setPage(1);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Xem gói {t === 'video' ? 'Video' : 'Combo'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                    <span>
                      <strong>{s?.completed ?? 0}</strong> / {s?.orders ?? 0} đơn thanh toán hoàn tất (không tính cấp thủ công)
                    </span>
                    {hasReview ? (
                      <button
                        type="button"
                        onClick={() => {
                          setType(t);
                          setTab('orders');
                          setPage(1);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-900"
                      >
                        <FiAlertCircle /> {s?.review} đơn cần đối soát
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <FiCheckCircle /> Không có đơn treo
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <nav className="flex flex-wrap gap-2" aria-label="Quản trị video">
              {tabItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={tab === id}
                  className={tab === id ? buttonClass : secondaryClass}
                  onClick={() => {
                    setTab(id);
                    setPage(1);
                    setEditProduct(undefined);
                    setEditCoupon(undefined);
                    setGrantPreset((curr) => ({ ...curr, open: false }));
                    setUsage(null);
                    setNotice('');
                  }}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </nav>
            <button type="button" onClick={refresh} className={secondaryClass} title="Làm mới dữ liệu">
              <FiRefreshCw className="h-4 w-4" /> Làm mới
            </button>
          </div>

          {error && (
            <Message error>
              {error}{' '}
              <button type="button" className="font-bold underline" onClick={refresh}>
                Tải lại
              </button>
            </Message>
          )}
          {notice && <Message>{notice}</Message>}

          {/* Product Type Segmented Switcher for Products & Orders */}
          {(tab === 'products' || tab === 'orders') && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Đang xem danh mục:</span>
                <div className="inline-flex rounded-xl border border-slate-300 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setType('video');
                      setPage(1);
                      setEditProduct(undefined);
                    }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${
                      type === 'video' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Gói Video ({stats.find((s) => s.type === 'video')?.completed ?? 0} đã bán)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('combo');
                      setPage(1);
                      setEditProduct(undefined);
                    }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${
                      type === 'combo' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Combo Video + VIP ({stats.find((s) => s.type === 'combo')?.completed ?? 0} đã bán)
                  </button>
                </div>
              </div>

              {tab === 'products' && (
                <button type="button" className={buttonClass} onClick={() => setEditProduct(null)}>
                  <FiPlus /> Tạo {type === 'video' ? 'gói video mới' : 'combo mới'}
                </button>
              )}
            </div>
          )}

          {tab === 'products' && editProduct !== undefined && (
            <AdminProductEditor
              key={`${type}-${editProduct?.id ?? 'new'}`}
              type={type}
              product={editProduct}
              onSaved={saved}
              onClose={() => setEditProduct(undefined)}
            />
          )}

          {tab === 'rights' && (
            <>
              <div className="grid items-start gap-4 md:grid-cols-[1fr_auto]">
                <LookupPicker
                  kind="users"
                  label="Tra cứu quyền học của một học viên (tìm theo tên, email, username)"
                  selected={userIds}
                  onChange={(ids) => {
                    setUserIds(ids);
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setGrantPreset({ open: !grantPreset.open, type })}
                >
                  <FiPlus /> Cấp quyền thủ công / theo danh sách Email
                </button>
              </div>
              {grantPreset.open && (
                <AdminGrantForm
                  initialType={grantPreset.type}
                  initialProductId={grantPreset.productId}
                  onSaved={saved}
                  onClose={() => setGrantPreset((curr) => ({ ...curr, open: false }))}
                />
              )}
            </>
          )}

          {tab === 'coupons' && (
            <>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonClass} onClick={() => setEditCoupon(null)}>
                  <FiPlus /> Tạo voucher Video / Combo
                </button>
                <button type="button" className={secondaryClass} onClick={() => setAttach(!attach)}>
                  Bật mã VIP có sẵn cho {type === 'video' ? 'Gói Video' : 'Combo'}
                </button>
                <Link href="/admin/coupons" className={secondaryClass}>
                  Quản lý mã VIP chung <FiExternalLink />
                </Link>
              </div>
              {attach && (
                <div className={`${panelClass} space-y-4`}>
                  <p className="text-sm">
                    Chọn một mã giảm giá đã có trong hệ thống để cho phép áp dụng sang toàn bộ gói thuộc loại bên dưới (có thể giới hạn từng gói sau khi bật).
                  </p>
                  <select
                    aria-label="Loại gói cho mã"
                    className={inputClass}
                    value={type}
                    onChange={(e) => setType(e.target.value as ProductType)}
                  >
                    <option value="video">Gói Video</option>
                    <option value="combo">Combo Video + VIP</option>
                  </select>
                  <LookupPicker kind="coupons" label="Chọn mã giảm giá có sẵn" selected={sharedId} onChange={setSharedId} />
                  <button
                    disabled={busy || !sharedId.length}
                    className={buttonClass}
                    onClick={() =>
                      action(async () => {
                        const old = await videoPaymentsApi.couponScopes(sharedId[0]);
                        await videoPaymentsApi.setCouponScopes(sharedId[0], [
                          ...old.filter((s) => s.type !== type),
                          { type, productIds: [] },
                        ]);
                        setAttach(false);
                      })
                    }
                  >
                    Xác nhận mở phạm vi áp dụng
                  </button>
                </div>
              )}
              {editCoupon !== undefined && (
                <AdminCouponEditor
                  key={editCoupon?.id ?? 'new'}
                  coupon={editCoupon}
                  onSaved={saved}
                  onClose={() => setEditCoupon(undefined)}
                />
              )}
              {usage && (
                <section className={panelClass}>
                  <div className="flex justify-between">
                    <h2 className="font-black">Lịch sử sử dụng mã #{usage.id}</h2>
                    <button type="button" className="text-sm font-bold underline" onClick={() => setUsage(null)}>
                      Đóng
                    </button>
                  </div>
                  {!usage.data.items.length ? (
                    <p className="mt-3 text-sm text-slate-500">Chưa có lượt sử dụng nào.</p>
                  ) : (
                    usage.data.items.map((u) => (
                      <p className="mt-3 break-words text-sm" key={u.id}>
                        <strong>{u.email}</strong> · Giảm {money(u.discount_amount)} · Đơn <code>{u.transaction_code}</code>
                      </p>
                    ))
                  )}
                  <Pager page={usage.page} hasMore={usage.data.hasMore} onPage={(p) => loadUsage(usage.id, p)} />
                </section>
              )}
            </>
          )}

          {/* Tab Body */}
          {tab === 'promotions' ? (
            <AdminPromotionEditor />
          ) : !data ? (
            !error && <Message>Đang tải dữ liệu…</Message>
          ) : (
            <>
              {!data.items.length && <Message>Chưa có dữ liệu ở mục này.</Message>}

              <div className="grid gap-4 xl:grid-cols-2">
                {tab === 'products' ? (
                  (data.items as ShopProduct[]).map((p) => (
                    <article key={p.id} className={`${panelClass} flex flex-col justify-between`}>
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(p.status)}`}>
                            {statusLabel[p.status] || p.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">ID #{p.id} · Thứ tự {p.sortOrder}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-black">{p.name}</h2>
                        {p.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{p.description}</p>}

                        <div className="mt-4 flex flex-wrap items-baseline gap-3">
                          <span className="text-2xl font-black text-teal-800 dark:text-teal-300">{money(p.priceVnd)}</span>
                          {p.originalPriceVnd && p.priceVnd && p.originalPriceVnd > p.priceVnd ? (
                            <span className="text-sm text-slate-400 line-through">{money(p.originalPriceVnd)}</span>
                          ) : null}
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Video: {p.video?.durationMode === 'lifetime' ? 'Không giới hạn' : p.video?.durationDays ? `${p.video.durationDays} ngày` : 'Chưa đặt hạn'}
                          </span>
                          {p.vip && (
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                              + {p.vip.name}
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Khóa học gắn trong gói ({p.courses.length}):
                          </p>
                          {p.courses.length === 0 ? (
                            <p className="mt-1 text-xs text-amber-700">Chưa gắn khóa học nào.</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {p.courses.map((c) => (
                                <Link
                                  key={c.id}
                                  href={canManageCourses ? `/admin/courses/${c.id}/curriculum` : `/khoa-hoc/${c.slug}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {c.title} ({subjects[c.subject_code] || c.subject_code}) ↗
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>

                        {p.configurationIssues.length > 0 && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            <p className="font-bold">⚠️ Cần hoàn thiện trước khi mở bán:</p>
                            <p className="mt-0.5">Kiểm tra đủ giá bán, thời hạn ngày học, chính sách gia hạn và khóa học đã xuất bản cho mọi môn trong gói.</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <button type="button" className={secondaryClass} onClick={() => setEditProduct(p)}>
                          Chỉnh sửa / Bật tắt bán
                        </button>
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() => openQuickGrant(type, p.id)}
                        >
                          <FiUserCheck /> Cấp quyền gói này
                        </button>
                      </div>
                    </article>
                  ))
                ) : tab === 'rights' ? (
                  (data.items as VideoRight[]).map((r) => {
                    const expired = Boolean(r.expiresAt && new Date(r.expiresAt) <= new Date());
                    const effStatus = r.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active';
                    return (
                      <article key={r.id} className={`${panelClass} flex flex-col justify-between`}>
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(effStatus)}`}>
                              {effStatus === 'revoked' ? 'Đã thu hồi' : effStatus === 'expired' ? 'Đã hết hạn' : 'Đang có hiệu lực'}
                            </span>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {r.source === 'manual' ? 'Cấp thủ công' : 'Thanh toán PayOS'}
                            </span>
                          </div>
                          <h2 className="mt-3 text-lg font-black">{r.name}</h2>
                          <p className="mt-1 break-words text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {r.userName || 'Học viên'} · <span className="text-teal-700 dark:text-teal-300">{r.email}</span>
                          </p>
                          <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <p>Hạn Video: <strong>{endDate(r.expiresAt)}</strong></p>
                            {r.type === 'combo' && <p>Hạn VIP kèm theo: <strong>{endDate(r.vipExpiresAt)}</strong></p>}
                            {r.subjects?.length > 0 && (
                              <p>Môn áp dụng: {r.subjects.map((s) => subjects[s] || s).join(', ')}</p>
                            )}
                            {r.reason && <p className="italic text-slate-500">Ghi chú: {r.reason}</p>}
                          </div>
                        </div>
                        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <button
                            type="button"
                            disabled={busy || r.status === 'revoked'}
                            className={secondaryClass}
                            onClick={() => {
                              setRevoke(r);
                              setReason('');
                            }}
                          >
                            <FiShield /> {r.status === 'revoked' ? 'Đã thu hồi' : 'Thu hồi quyền này'}
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : tab === 'orders' ? (
                  (data.items as AdminOrder[]).map((o) => (
                    <article key={o.orderId} className={`${panelClass} flex flex-col justify-between`}>
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(o.status)}`}>
                            {statusLabel[o.status] || o.status}
                          </span>
                          <span className="text-xs text-slate-400">{endDate(o.createdAt)}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-black">
                          {o.name} · <span className="text-teal-700 dark:text-teal-300">{money(o.amount)}</span>
                        </h2>
                        <p className="mt-1 break-words text-sm font-medium">{o.email}</p>
                        <p className="mt-2 break-all font-mono text-xs text-slate-500">Mã đơn: {o.orderId}</p>
                        {o.error && (
                          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            Cảnh báo đối soát: {o.error}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          disabled={busy}
                          className={secondaryClass}
                          onClick={() => action(() => shopWrite('post', `/manage/orders/${encodeURIComponent(o.orderId)}/sync`, {}))}
                        >
                          <FiRefreshCw /> Đối soát với PayOS
                        </button>
                      </div>
                    </article>
                  ))
                ) : tab === 'coupons' ? (
                  (data.items as VideoCoupon[]).map((c) => (
                    <article key={c.id} className={panelClass}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-lg bg-teal-50 px-3 py-1 font-mono text-sm font-black text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                          {c.code}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(c.is_active ? 'active' : 'archived')}`}>
                          {c.is_active ? 'Đang bật' : 'Đã tắt'}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-black">
                        Giảm {c.discount_type === 'percentage' ? `${c.discount_value}%` : money(c.discount_value)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {c.videoOnly ? 'Voucher riêng Video/Combo' : 'Mã dùng chung hệ thống'} · Đã dùng {c.used_count}/{c.max_uses ?? '∞'} lượt
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        Phạm vi:{' '}
                        {c.scopes
                          .map((s) => `${s.type === 'video' ? 'Video' : 'Combo'}: ${s.productIds.length ? `#${s.productIds.join(', #')}` : 'tất cả gói'}`)
                          .join(' · ') || 'Chưa mở phạm vi cho Video/Combo'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className={secondaryClass} onClick={() => setEditCoupon(c)}>
                          {c.videoOnly ? 'Chỉnh sửa voucher' : 'Sửa phạm vi áp dụng'}
                        </button>
                        <button type="button" className={secondaryClass} onClick={() => loadUsage(c.id)}>
                          Lịch sử dùng mã
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  (data.items as AdminEvent[]).map((e) => (
                    <article key={e.id} className={panelClass}>
                      <p className="font-bold">
                        {e.action} · {e.entity_type} #{e.entity_id}
                      </p>
                      <p className="mt-1 break-words text-xs text-slate-500">
                        Thực hiện bởi: {e.actor} · {endDate(e.created_at)}
                      </p>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-bold text-teal-700 dark:text-teal-300">
                          Xem chi tiết thay đổi
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      </details>
                    </article>
                  ))
                )}
              </div>

              <Pager page={page} hasMore={data.hasMore} onPage={setPage} />
            </>
          )}

          {revoke && (
            <ConfirmDialog busy={busy} onClose={() => setRevoke(null)}>
              <form
                className={`${panelClass} w-full max-w-lg space-y-4`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await shopWrite('post', `/manage/rights/${revoke.id}/revoke`, { reason });
                    setRevoke(null);
                  });
                }}
              >
                <h2 id="revoke-title" className="text-xl font-black">
                  Thu hồi quyền {revoke.name}?
                </h2>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {revoke.type === 'combo'
                    ? 'Thao tác này sẽ thu hồi cả quyền học Video và gói VIP thuộc lần cấp/mua này.'
                    : 'Thao tác này sẽ thu hồi quyền học Video thuộc lần cấp/mua này.'}{' '}
                  Tiến độ bài học của học viên vẫn được giữ lại. Thao tác không tự động hoàn tiền.
                </p>
                <label className="block text-sm font-bold">
                  Lý do thu hồi
                  <textarea
                    autoFocus
                    required
                    minLength={3}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Cấp nhầm tài khoản / Học viên hoàn học phí..."
                    className={`${inputClass} mt-2`}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} className={buttonClass}>
                    Xác nhận thu hồi
                  </button>
                  <button type="button" disabled={busy} className={secondaryClass} onClick={() => setRevoke(null)}>
                    Hủy
                  </button>
                </div>
              </form>
            </ConfirmDialog>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
