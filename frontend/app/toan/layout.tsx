import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Môn Toán | Ôn Thi CSCA',
    template: '%s | CSCA MOLI.STUDIO',
  },
  description: 'Trang tài liệu, luyện thi và học tập môn Toán cho kỳ thi CSCA. Đề thi mô phỏng, từ vựng, lộ trình học và phân tích kết quả bằng AI.',
  keywords: ['ôn thi Toán CSCA', 'Toán CSCA', 'luyện thi Toán', 'đề thi Toán CSCA', 'tài liệu Toán CSCA', 'toán du học Trung Quốc'],
  openGraph: {
    title: 'Môn Toán | Ôn Thi CSCA',
    description: 'Tài liệu, luyện thi Toán CSCA: đề mô phỏng, từ vựng, lộ trình học, AI phân tích kết quả.',
    type: 'website',
    locale: 'vi_VN',
  },
};

export default function ToanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
