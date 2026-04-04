import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Từ Vựng Tiếng Trung',
  description: 'Học từ vựng Tiếng Trung theo chủ đề: Toán học, Vật Lý, Hóa Học, Xã Hội, Tự Nhiên — chuẩn bị cho kỳ thi học bổng CSCA.',
  openGraph: {
    title: 'Từ Vựng Tiếng Trung | CSCA',
    description: 'Học từ vựng Tiếng Trung theo chủ đề dành cho kỳ thi học bổng CSCA.',
    url: '/tu-vung',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Từ Vựng CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Từ Vựng Tiếng Trung | CSCA',
    description: 'Học từ vựng Tiếng Trung theo chủ đề cho kỳ thi CSCA.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

export default function TuVungLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
