import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đề Thi Toán',
  description: 'Luyện thi Toán với 200+ đề mô phỏng, phân tích từng bước, bảng xếp hạng — chuẩn bị cho kỳ thi học bổng CSCA.',
  openGraph: {
    title: 'Đề Thi Toán | CSCA',
    description: 'Luyện thi Toán với 200+ đề mô phỏng cho học bổng CSCA.',
    url: '/toan/de-mo-phong',
    images: [{ url: '/images/pexels-markus-winkler-1430818-30855414.jpg', width: 1200, height: 630, alt: 'Đề Thi Toán CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Đề Thi Toán | CSCA',
    description: 'Luyện thi Toán cho học bổng CSCA.',
    images: ['/images/pexels-markus-winkler-1430818-30855414.jpg'],
  },
};

export default function ToanDeMoPhongLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
