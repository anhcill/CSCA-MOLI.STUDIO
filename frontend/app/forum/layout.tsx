import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diễn Đàn Học Tập',
  description: 'Trao đổi kiến thức, chia sẻ kinh nghiệm ôn thi học bổng CSCA cùng 10,000+ học viên.',
  openGraph: {
    title: 'Diễn Đàn | CSCA',
    description: 'Trao đổi kiến thức, chia sẻ kinh nghiệm ôn thi học bổng CSCA cùng 10,000+ học viên.',
    url: '/forum',
    images: [{ url: '/images/pexels-markus-winkler-1430818-30855414.jpg', width: 1200, height: 630, alt: 'Diễn Đàn CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Diễn Đàn | CSCA',
    description: 'Trao đổi kiến thức, chia sẻ kinh nghiệm ôn thi học bổng CSCA.',
    images: ['/images/pexels-markus-winkler-1430818-30855414.jpg'],
  },
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
