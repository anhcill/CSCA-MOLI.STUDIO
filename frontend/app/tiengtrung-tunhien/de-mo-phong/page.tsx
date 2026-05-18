export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import FocusedExamPage from '@/components/layout/FocusedExamPage';

export const metadata: Metadata = {
  title: 'Tiếng Trung Tự Nhiên - Đề Mô Phỏng',
  description: 'Luyện thi Tiếng Trung Tự Nhiên với đề mô phỏng CSCA, danh sách đề luyện tập và phân tích kết quả theo từng lần làm bài.',
  alternates: { canonical: '/tiengtrung-tunhien/de-mo-phong' },
  openGraph: {
    title: 'Tiếng Trung Tự Nhiên - Đề Mô Phỏng',
    description: 'Luyện thi Tiếng Trung Tự Nhiên với đề mô phỏng CSCA và phân tích kết quả học tập.',
    url: '/tiengtrung-tunhien/de-mo-phong',
  },
};

export default function TiengTrungTuNhienDeMoPhongPage() {
  return (
    <FocusedExamPage
      title="Đề Mô Phỏng Tiếng Trung Tự Nhiên"
      subjectCode="CHINESE"
      subjectSlug="tiengtrung-tunhien"
      colorScheme={{ from: 'from-violet-500', to: 'to-fuchsia-600' }}
      shadowClass="shadow-fuchsia-900/10"
      accentSoftClass="from-violet-500"
      adminGradientClass="from-violet-500 to-fuchsia-600"
    />
  );
}
