import type { Metadata } from 'next';
import Banner from '@/components/layout/Banner';
import Header from '@/components/layout/Header';
import HomeContent from '@/components/layout/HomeContent';

export const metadata: Metadata = {
  title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc (CIS) & Bài Thi CSCA',
  description: 'Nền tảng giáo dục trực tuyến CSCA cung cấp 500+ đề thi thử chuẩn hoá, lộ trình ôn thi cá nhân hoá bằng AI cho du học sinh chinh phục học bổng Đại học Trung Quốc an toàn.',
  openGraph: {
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc (CIS)',
    description: 'Nền tảng luyện thi CSCA cung cấp 500+ đề thi, hỗ trợ du học sinh chinh phục học bổng CIS.',
    url: '/',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'CSCA - Ôn thi học bổng Trung Quốc' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CSCA | Ôn Thi Học Bổng Du Học Trung Quốc (CIS)',
    description: 'Nền tảng luyện thi CSCA cung cấp 500+ đề thi, hỗ trợ du học sinh chinh phục học bổng CIS.',
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
        CSCA - Nền tảng ôn thi đại học và luyện thi học bổng du học sinh Trung Quốc (CIS), cung cấp đề thi CSCA, Toán, Lý, Hoá
      </h1>
      
      <Header />
      {/* Hero Banner — full width, no padding */}
      <Banner />
      {/* All homepage sections */}
      <HomeContent />
    </div>
  );
}
