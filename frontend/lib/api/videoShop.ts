import axios from '@/lib/utils/axios';
import type { VideoCommerceProductDto, VideoPackageDto } from '@/lib/types/videoCommerce';
import type { VideoRenewalMode, VideoCouponScope } from '@/lib/types/videoPayments';
export type ProductType = 'video' | 'combo';
export interface Page<T> { items:T[];page:number;limit:number;hasMore:boolean }
export type ShopProduct = Omit<VideoCommerceProductDto,'canPurchase'> & {
  canPurchase:boolean;renewalMode:VideoRenewalMode;subjectPrices:Record<string,number>;
  video:VideoPackageDto|null;vip:{id:number;name:string}|null;
  courses:{id:number;title:string;slug:string;subject_code:string}[];
};
export interface VideoRight {
  id:number;userId:number;email?:string;userName?:string;type:ProductType;name:string;source:'payment'|'manual';
  status:'active'|'revoked';startsAt:string;expiresAt:string|null;subjects:string[];courseIds:number[];
  vipExpiresAt:string|null;vipActive:boolean|null;reason:string|null;transactionId:number|null;
}
export interface Lookup {id:number;name:string;email?:string;subject_code?:string;status?:string}
export interface VideoCoupon {
  id:number;code:string;description:string;discount_type:'percentage'|'fixed';discount_value:number;
  min_order_amount:number;max_uses:number|null;user_limit:number;used_count:number;
  valid_from:string|null;valid_until:string|null;is_active:boolean;videoOnly:boolean;scopes:VideoCouponScope[];
}
export interface Promotion {product_type:ProductType;title:string;content:string;coupon_id:number|null;coupon_code?:string;is_active:boolean;starts_at:string|null;ends_at:string|null}
export interface AdminOrder {orderId:string;amount:number;type:ProductType;email:string;name:string;status:string;error:string|null;createdAt:string}
export interface AdminEvent {id:number;actor:string;action:string;entity_type:string;entity_id:number;details:Record<string,unknown>;created_at:string}
export interface Revenue {type:ProductType;orders:number;completed:number;revenue:number;review:number}
export interface CouponUsage {id:number;email:string;transaction_code:string;discount_amount:number;final_amount:number}
export async function shopGet<T>(path:string,params:Record<string,unknown>={}):Promise<T> {
  return (await axios.get<{data:T}>(`/video-commerce${path}`,{params})).data.data;
}
export async function shopWrite<T>(method:'post'|'patch'|'put',path:string,data:unknown):Promise<T> {
  return (await axios[method]<{data:T}>(`/video-commerce${path}`,data)).data.data;
}
export const videoShop={
  catalog:(type:ProductType,page=1)=>shopGet<Page<ShopProduct>>(`/shop/catalog/${type}`,{page}),
  product:(type:ProductType,id:number)=>shopGet<ShopProduct>(`/shop/products/${type}/${id}`),
  rights:(page=1)=>shopGet<Page<VideoRight>>('/me/rights',{page}),
  promotion:(type:ProductType)=>shopGet<Promotion|null>(`/shop/promotion/${type}`),
};
