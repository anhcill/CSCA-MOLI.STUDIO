import { Suspense } from 'react';
import VideoCatalog from '@/components/video-commerce/VideoCatalog';
export const metadata={title:'Gói video & combo | MOLY'};
export default function Page(){return <Suspense fallback={<p className="p-8">Đang tải gói học…</p>}><VideoCatalog/></Suspense>;}
