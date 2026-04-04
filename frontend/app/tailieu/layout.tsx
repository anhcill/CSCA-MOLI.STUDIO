import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tài Liệu Ôn Thi',
  description: 'Kho tài liệu ôn thi học bổng CSCA: lý thuyết, cấu trúc đề, đề mô phỏng, từ vựng các môn Toán, Vật Lý, Hóa Học, Tiếng Trung.',
  openGraph: {
    title: 'Tài Liệu Ôn Thi | CSCA',
    description: 'Kho tài liệu ôn thi học bổng CSCA: lý thuyết, cấu trúc đề, đề mô phỏng, từ vựng.',
    url: '/tailieu',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Tài Liệu CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tài Liệu Ôn Thi | CSCA',
    description: 'Kho tài liệu ôn thi học bổng CSCA miễn phí.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function TaiLieuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
