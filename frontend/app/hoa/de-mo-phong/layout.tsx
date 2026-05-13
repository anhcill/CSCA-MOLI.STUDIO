import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đề Thi Hóa Học | MOLI.STUDIO',
  description: 'Luyện thi Hóa Học CSCA với đề mô phỏng chuẩn format. Bài tập có lời giải chi tiết, phân tích kết quả bằng AI và theo dõi tiến độ học tập.',
  keywords: ['đề thi Hóa Học CSCA', 'luyện thi Hóa Học', 'thi thử Hóa Học', 'ôn thi Hóa Học CSCA', 'Hóa Học du học Trung Quốc'],
  openGraph: {
    title: 'Đề Thi Hóa Học CSCA | MOLI.STUDIO',
    description: 'Luyện thi Hóa Học CSCA với đề mô phỏng chuẩn format, lời giải chi tiết.',
    type: 'website',
    locale: 'vi_VN',
  },
  alternates: { canonical: '/hoa/de-mo-phong' },
};

export default function HoaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
