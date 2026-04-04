import type { Metadata } from 'next';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import HomeContent from '@/components/layout/HomeContent';

export const metadata: Metadata = {
  title: 'CSCA - Ôn Thi Học Bổng Trung Quốc',
  description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi Toán, Vật Lý, Hóa Học, Tiếng Trung. AI phân tích lộ trình cá nhân, 10,000+ học viên.',
  openGraph: {
    title: 'CSCA - Ôn Thi Học Bổng Trung Quốc',
    description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi, AI phân tích lộ trình và 10,000+ học viên.',
    url: '/',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'CSCA - Ôn thi học bổng Trung Quốc' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA - Ôn Thi Học Bổng Trung Quốc',
    description: 'Nền tảng ôn thi học bổng CSCA với 500+ đề thi, AI phân tích lộ trình.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      {/* Hero Banner — full width, no padding */}
      <Banner />
      {/* All homepage sections */}
      <HomeContent />
    </div>
  );
}
