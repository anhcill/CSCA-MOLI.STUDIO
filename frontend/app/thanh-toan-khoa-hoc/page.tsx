import { Suspense } from 'react';
import VideoCheckout from '@/components/video-commerce/VideoCheckout';
export const metadata={title:'Thanh toán gói học | MOLY',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<p className="p-8">Đang tải thanh toán…</p>}><VideoCheckout/></Suspense>;}
