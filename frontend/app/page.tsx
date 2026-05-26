import type { Metadata } from 'next';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import HomeContent from '@/components/layout/HomeContent';
import DailyQuestBanner from '@/components/layout/DailyQuestBanner';

export const metadata: Metadata = {
  title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
  description: 'Nền tảng ôn thi CSCA và luyện đề học bổng du học Trung Quốc (CSC) hàng đầu dành cho học sinh Việt Nam. Cung cấp đề thi mô phỏng sát đề thi thật, từ vựng tiếng Trung, lộ trình học cá nhân hóa bằng AI và lời giải chi tiết.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
    description: 'Nền tảng luyện thi CSCA, ôn học bổng CSC và chuẩn bị du học Trung Quốc với đề mô phỏng chuẩn cấu trúc và lộ trình cá nhân hóa bằng AI.',
    url: '/',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'CSCA MOLI.STUDIO - Luyện thi HSK/HSKK & CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc',
    description: 'Ôn thi CSCA, ôn học bổng CSC và du học Trung Quốc với lộ trình thông minh.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      {/* Daily Quests Banner */}
      <DailyQuestBanner />
      {/* Hero Banner — full width, no padding */}
      <Banner />
      {/* All homepage sections */}
      <HomeContent />
    </div>
  );
}
