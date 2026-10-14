import type { CscaSubjectCode } from './courses';
import type { VideoCommerceProductType } from './videoCommerce';

export type VideoRenewalMode = 'unconfigured' | 'new_period' | 'extend';

export interface VideoPaymentSelection {
  type: VideoCommerceProductType;
  productId: number;
  selectedSubjectCode?: CscaSubjectCode | null;
  couponCode?: string | null;
  useCoins?: boolean;
  coinsToUse?: number | null;
  paymentMethod?: 'bank_transfer';
}

export interface VideoPaymentSnapshot {
  version: 1;
  type: VideoCommerceProductType;
  productId: number;
  name: string;
  originalAmount: number;
  renewalMode: VideoRenewalMode;
  video: {
    packageId: number;
    name: string;
    subjects: CscaSubjectCode[];
    courseIds: number[];
    durationMode: 'days' | 'lifetime';
    durationDays: number | null;
  };
  vip: {
    packageId: number;
    name: string;
    tier: 'vip' | 'premium';
    subjects: (CscaSubjectCode | '*')[];
    durationDays: number;
  } | null;
  couponCode: string | null;
  couponId: number | null;
  couponDiscountAmount: number;
  coinsUsed: number;
  coinDiscountAmount: number;
  amount: number;
  quoteHash: string;
}

export interface VideoPaymentQuote extends VideoPaymentSnapshot {
  salesEnabled: boolean;
}

export interface VideoCreateOrderInput extends VideoPaymentSelection {
  quoteHash: string;
  /** Keep the same key and quote when retrying an uncertain request. */
  idempotencyKey: string;
}

export interface VideoPaymentOrder {
  orderId: string;
  type: VideoCommerceProductType;
  productId: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'expired' | 'failed'
    | 'awaiting_fulfillment' | 'payment_review';
  amount: number;
  snapshot: VideoPaymentSnapshot;
  expiresAt: string;
  payment: {
    orderCode: number;
    status: string;
    amount: number;
    qrCode: string | null;
    checkoutUrl: string | null;
    bin: string | null;
    accountNumber: string | null;
    accountName: string | null;
    description: string | null;
  } | null;
  rights: {
    videoEntitlementId: number;
    videoExpiresAt: string | null;
    vipEntitlementId: number | null;
    vipExpiresAt: string | null;
  } | null;
  fulfillmentError: string | null;
  reconciliationPending?: boolean;
}

export interface VideoOrderHistory {
  items: VideoPaymentOrder[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VideoCouponScope {
  type: VideoCommerceProductType;
  /** Empty means all packages of this type; omitted scope means none. */
  productIds: number[];
}

export interface VideoProductPaymentConfig {
  renewalMode: VideoRenewalMode;
  subjectPrices: Partial<Record<CscaSubjectCode, number>>;
}
