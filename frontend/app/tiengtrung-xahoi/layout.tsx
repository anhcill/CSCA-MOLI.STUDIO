import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiếng Trung Xã Hội - Đề Mô Phỏng',
  description: 'Luyện thi Tiếng Trung Xã Hội với 100+ đề mô phỏng, phân tích đáp án chi tiết — chuẩn bị cho kỳ thi học bổng CSCA.',
  openGraph: {
    title: 'Tiếng Trung Xã Hội | CSCA',
    description: 'Luyện thi Tiếng Trung Xã Hội với 100+ đề mô phỏng cho học bổng CSCA.',
    url: '/tiengtrung-xahoi',
    images: [{ url: '/images/university-6699377_1920.jpg', width: 1920, height: 1080, alt: 'Tiếng Trung Xã Hội CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tiếng Trung Xã Hội | CSCA',
    description: 'Luyện thi Tiếng Trung Xã Hội cho học bổng CSCA.',
    images: ['/images/university-6699377_1920.jpg'],
  },
};

export default function TiengTrungXaHoiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
