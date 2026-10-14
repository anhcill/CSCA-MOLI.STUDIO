import axios from '@/lib/utils/axios';
import type { ApiSuccessEnvelope } from '@/lib/types/courses';
import type { VideoCommerceProductType } from '@/lib/types/videoCommerce';
import type {
  VideoCouponScope,
  VideoCreateOrderInput,
  VideoOrderHistory,
  VideoPaymentOrder,
  VideoPaymentQuote,
  VideoPaymentSelection,
  VideoProductPaymentConfig,
} from '@/lib/types/videoPayments';

const base = '/video-commerce/payments';
const unwrap = <T>(payload: ApiSuccessEnvelope<T>): T => payload.data;

export const videoPaymentsApi = {
  async quote(input: VideoPaymentSelection): Promise<VideoPaymentQuote> {
    return unwrap((await axios.post<ApiSuccessEnvelope<VideoPaymentQuote>>(`${base}/quote`, input)).data);
  },
  async createOrder(input: VideoCreateOrderInput): Promise<VideoPaymentOrder> {
    return unwrap((await axios.post<ApiSuccessEnvelope<VideoPaymentOrder>>(`${base}/orders`, input)).data);
  },
  async history(params: { page?: number; limit?: number } = {}): Promise<VideoOrderHistory> {
    return unwrap((await axios.get<ApiSuccessEnvelope<VideoOrderHistory>>(`${base}/orders`, { params })).data);
  },
  async status(orderId: string): Promise<VideoPaymentOrder> {
    return unwrap((await axios.get<ApiSuccessEnvelope<VideoPaymentOrder>>(`${base}/orders/${encodeURIComponent(orderId)}`)).data);
  },
  async cancel(orderId: string): Promise<VideoPaymentOrder> {
    return unwrap((await axios.post<ApiSuccessEnvelope<VideoPaymentOrder>>(`${base}/orders/${encodeURIComponent(orderId)}/cancel`)).data);
  },
  async couponScopes(couponId: number): Promise<VideoCouponScope[]> {
    return unwrap((await axios.get<ApiSuccessEnvelope<VideoCouponScope[]>>(`${base}/admin/coupons/${couponId}/scopes`)).data);
  },
  async setCouponScopes(couponId: number, scopes: VideoCouponScope[]): Promise<VideoCouponScope[]> {
    return unwrap((await axios.put<ApiSuccessEnvelope<VideoCouponScope[]>>(`${base}/admin/coupons/${couponId}/scopes`, { scopes })).data);
  },
  async configureProduct(type: VideoCommerceProductType, id: number, config: Partial<VideoProductPaymentConfig>): Promise<VideoProductPaymentConfig> {
    return unwrap((await axios.patch<ApiSuccessEnvelope<VideoProductPaymentConfig>>(`${base}/admin/products/${type}/${id}/config`, config)).data);
  },
};
