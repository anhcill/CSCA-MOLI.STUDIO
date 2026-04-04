import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiếng Trung Tự Nhiên - Đề Mô Phỏng',
  description: 'Luyện thi Tiếng Trung Tự Nhiên với 100+ đề mô phỏng, phân tích đáp án chi tiết — chuẩn bị cho kỳ thi học bổng CSCA.',
  openGraph: {
    title: 'Tiếng Trung Tự Nhiên | CSCA',
    description: 'Luyện thi Tiếng Trung Tự Nhiên với 100+ đề mô phỏng cho học bổng CSCA.',
    url: '/tiengtrung-tunhien',
    images: [{ url: '/images/university-6699377_1920.jpg', width: 1920, height: 1080, alt: 'Tiếng Trung Tự Nhiên CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tiếng Trung Tự Nhiên | CSCA',
    description: 'Luyện thi Tiếng Trung Tự Nhiên cho học bổng CSCA.',
    images: ['/images/university-6699377_1920.jpg'],
  },
};

export default function TiengTrungTuNhienLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
