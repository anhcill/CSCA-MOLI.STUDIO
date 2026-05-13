import type { Metadata } from 'next';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import HomeContent from '@/components/layout/HomeContent';
import DailyQuestBanner from '@/components/layout/DailyQuestBanner';

export const metadata: Metadata = {
  title: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK Online & Ôn Thi CSCA',
  description: 'Nền tảng giáo dục trực tuyến CSCA MOLI.STUDIO cung cấp 500+ đề thi thử chuẩn hoá HSK/HSKK, lộ trình ôn thi cá nhân hoá bằng AI cho du học sinh chinh phục học bổng Đại học Trung Quốc.',
  openGraph: {
    title: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK & CSCA',
    description: 'Nền tảng luyện thi CSCA cung cấp 500+ đề thi, hỗ trợ du học sinh chinh phục học bổng Đại học Trung Quốc.',
    url: '/',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'CSCA MOLI.STUDIO - Luyện thi HSK/HSKK & CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA MOLI.STUDIO | Luyện Thi HSK/HSKK & CSCA',
    description: 'Nền tảng luyện thi CSCA cung cấp 500+ đề thi, hỗ trợ du học sinh chinh phục học bổng Đại học Trung Quốc.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 
        This H1 is crucial for SEO but hidden visually since the banner has multiple titles. 
        It contains all the targeted long-tail keywords. 
      */}
      <h1 className="sr-only text-[#00000000] absolute -z-50 opacity-0 pointer-events-none">
        CSCA MOLI.STUDIO - Nền tảng luyện thi HSK/HSKK online và ôn thi CSCA, cung cấp đề thi mô phỏng chuẩn format, từ vựng HSK, lộ trình học tập cá nhân hoá
      </h1>
      
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
