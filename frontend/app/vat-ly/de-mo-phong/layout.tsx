import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Đề Thi Vật Lý | MOLI.STUDIO',
  description: 'Luyện thi Vật Lý CSCA với đề mô phỏng chuẩn format. Bài tập có lời giải chi tiết, phân tích kết quả bằng AI và theo dõi tiến độ học tập.',
  keywords: ['đề thi Vật Lý CSCA', 'luyện thi Vật Lý', 'thi thử Vật Lý', 'ôn thi Vật Lý CSCA', 'Vật Lý du học Trung Quốc'],
  openGraph: {
    title: 'Đề Thi Vật Lý CSCA | MOLI.STUDIO',
    description: 'Luyện thi Vật Lý CSCA với đề mô phỏng chuẩn format, lời giải chi tiết.',
    type: 'website',
    locale: 'vi_VN',
  },
  alternates: { canonical: '/vat-ly/de-mo-phong' },
};

export default function VatLyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
