import type { Metadata } from 'next';
import NationalDayBanner from '@/components/layout/NationalDayBanner';
import Header from '@/components/layout/Header';
import HomeContent from '@/components/layout/HomeContent';
import VipSuccessCelebration from '@/components/checkout/VipSuccessCelebration';
import { isNationalDayThemeActive } from '@/lib/nationalDayTheme';

// The seasonal skin expires automatically after 2 September in Vietnam.
// This keeps the existing homepage as the default without a manual rollback.
export const dynamic = 'force-dynamic';

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
  const nationalDayThemeEnabled = isNationalDayThemeActive();

  return (
    <div className={`min-h-screen flex flex-col ${nationalDayThemeEnabled ? 'national-day-home' : 'bg-white'}`}>
      <Header />
      {/* Hero Banner — full width, no padding */}
      <NationalDayBanner initiallyEnabled={nationalDayThemeEnabled} />
      {/* All homepage sections */}
      <div className={nationalDayThemeEnabled ? 'national-day-content' : undefined}>
        <HomeContent />
      </div>
      <VipSuccessCelebration />
    </div>
  );
}
