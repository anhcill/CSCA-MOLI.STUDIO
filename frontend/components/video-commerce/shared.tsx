'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import ThemeToggle from '@/components/layout/ThemeToggle';
export const money=(value:number|string|null)=>value==null?'Chưa cấu hình':Number(value).toLocaleString('vi-VN')+' đ';
export const endDate=(value:string|null)=>value?new Date(value).toLocaleString('vi-VN'):'Không giới hạn';
export const subjects:Record<string,string>={MATH:'Toán',PHYSICS:'Vật lý',CHEMISTRY:'Hóa học',CHINESE_SCI:'Tiếng Trung tự nhiên',CHINESE_SOC:'Tiếng Trung xã hội','*':'Tất cả môn'};
export const statusLabel:Record<string,string>={pending:'Chờ thanh toán',processing:'Đang xử lý',completed:'Đã cấp quyền',cancelled:'Đã hủy',expired:'Đã hết hạn',failed:'Không thành công',awaiting_fulfillment:'Đã nhận tiền • đang cấp quyền',payment_review:'Cần đối soát tiền đã nhận',draft:'Bản nháp',active:'Đang hoạt động',archived:'Đã ẩn',revoked:'Đã thu hồi'};
export const inputClass='w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
export const buttonClass='inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryClass='inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800 disabled:opacity-50';
export const panelClass='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7';
const errors:Record<string,string>={
  VIDEO_SALES_DISABLED:'Gói này chưa mở thanh toán. Bạn vui lòng quay lại sau.',PRODUCT_NOT_AVAILABLE:'Gói hiện không mở bán.',
  QUOTE_CHANGED:'Giá hoặc ưu đãi đã thay đổi. Hãy lấy báo giá mới trước khi xác nhận.',
  COUPON_SCOPE_MISMATCH:'Mã giảm giá không áp dụng cho gói này.',COUPON_INVALID:'Mã không hợp lệ hoặc đã hết hạn.',
  COUPON_LIMIT_REACHED:'Mã đã hết lượt hoặc các lượt còn lại đang được giữ cho đơn chờ.',COUPON_USER_LIMIT_REACHED:'Bạn đã dùng hết lượt của mã này.',
  COUPON_MINIMUM:'Đơn chưa đạt giá trị tối thiểu của mã.',SUBJECT_REQUIRED:'Bạn cần chọn môn học.',
  RENEWAL_POLICY_REQUIRED:'Bạn đang có quyền trùng với gói này. Vui lòng liên hệ hỗ trợ để được tư vấn gia hạn.',
  LIFETIME_ALREADY_OWNED:'Bạn đã có quyền không giới hạn của gói này.',
  PAYMENT_RECONCILIATION_REQUIRED:'Chưa xác nhận được kết quả tạo thanh toán. Hãy dùng nút thử lại để mở đúng đơn, hoặc kiểm tra lịch sử.',
  PARTIAL_PAYMENT_REVIEW:'Đơn đã nhận một phần tiền và cần hỗ trợ đối soát.',ORDER_ALREADY_PAID:'Đơn đã nhận tiền, không thể hủy ở đây.',
  PRODUCT_NOT_CONFIGURED:'Cần cấu hình đủ giá, thời hạn và nội dung trước khi bật bán.',COURSES_NOT_READY:'Các môn trong gói phải có khóa đã xuất bản.',
  COURSE_SUBJECT_MISMATCH:'Khóa được chọn phải thuộc môn của gói.',COMBO_SUBJECT_MISMATCH:'Môn của hai thành phần combo chưa khớp.',
  IDEMPOTENCY_CONFLICT:'Yêu cầu đã thay đổi so với lần gửi trước. Kiểm tra lịch sử trước khi thao tác lại.',
};
export function errorText(error:unknown) {
  const e=error as {response?:{status?:number;data?:{code?:string;message?:string}}};
  if(e.response?.status===401)return 'Vui lòng đăng nhập lại để tiếp tục.';
  if(e.response?.status===403)return 'Tài khoản chưa có quyền thực hiện thao tác này.';
  if(e.response?.status===404)return 'Tính năng chưa được bật hoặc nội dung không còn khả dụng.';
  return errors[e.response?.data?.code||'']||'Chưa thể hoàn tất thao tác. Kiểm tra thông tin và thử lại.';
}
export function Message({children,error=false}:{children:ReactNode;error?:boolean}) {return <div role={error?'alert':'status'} className={`rounded-xl border p-4 text-sm leading-6 ${error?'border-red-200 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200':'border-teal-200 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100'}`}>{children}</div>;}
export function ShopShell({title,eyebrow='MOLY • NÂNG CẤP',children}:{title:string;eyebrow?:string;children:ReactNode}) {return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#e3efeb,transparent_55%)] bg-[#f7f3ed] px-4 py-6 text-slate-900 dark:bg-slate-950 dark:bg-none dark:text-slate-100 sm:px-8"><div className="mx-auto max-w-6xl"><nav aria-label="Khóa học" className="mb-9 flex flex-wrap items-center justify-between gap-3"><Link href="/vip" className="font-bold">← Nâng cấp tài khoản</Link><div className="flex flex-wrap items-center gap-4 text-sm"><Link href="/vip?section=video">Gói video & combo</Link><Link href="/tai-khoan/goi-video">Gói của tôi</Link><ThemeToggle /></div></nav><p className="text-xs font-black tracking-[.18em] text-teal-700 dark:text-teal-300">{eyebrow}</p><h1 className="mb-8 mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>{children}</div></main>;}
export function Pager({page,hasMore,onPage}:{page:number;hasMore:boolean;onPage:(page:number)=>void}) {return <nav aria-label="Phân trang" className="my-5 flex items-center justify-center gap-4"><button type="button" className={secondaryClass} disabled={page===1} onClick={()=>onPage(page-1)}>Trước</button><span className="text-sm">Trang {page}</span><button type="button" className={secondaryClass} disabled={!hasMore} onClick={()=>onPage(page+1)}>Sau</button></nav>;}
