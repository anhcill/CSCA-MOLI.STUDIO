import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lộ Trình Học Cá Nhân',
  description: 'AI phân tích điểm mạnh, điểm yếu và xây dựng lộ trình ôn thi học bổng CSCA tối ưu cho từng học viên.',
  openGraph: {
    title: 'Lộ Trình Học | CSCA',
    description: 'AI phân tích và xây dựng lộ trình ôn thi học bổng CSCA tối ưu cho bạn.',
    url: '/lo-trinh',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Lộ Trình Học CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lộ Trình Học | CSCA',
    description: 'AI xây dựng lộ trình ôn thi học bổng CSCA cá nhân hóa.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function LoTrinhLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
