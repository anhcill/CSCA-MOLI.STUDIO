export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import FocusedExamPage from '@/components/layout/FocusedExamPage';

export const metadata: Metadata = {
  title: 'Tiếng Trung Xã Hội - Đề Mô Phỏng',
  description: 'Luyện thi Tiếng Trung Xã Hội với đề mô phỏng CSCA, câu hỏi theo chủ đề văn hóa, lịch sử, xã hội và phân tích kết quả học tập.',
  alternates: { canonical: '/tiengtrung-xahoi/de-mo-phong' },
  openGraph: {
    title: 'Tiếng Trung Xã Hội - Đề Mô Phỏng',
    description: 'Luyện thi Tiếng Trung Xã Hội với đề mô phỏng CSCA và phân tích kết quả học tập.',
    url: '/tiengtrung-xahoi/de-mo-phong',
  },
};

export default function TiengTrungXaHoiDeMoPhongPage() {
  return (
    <FocusedExamPage
      title="Đề Mô Phỏng Tiếng Trung Xã Hội"
      subjectCode="CHINESE"
      subjectSlug="tiengtrung-xahoi"
      colorScheme={{ from: 'from-rose-500', to: 'to-purple-600' }}
      shadowClass="shadow-rose-900/10"
      accentSoftClass="from-rose-500"
      adminGradientClass="from-rose-500 to-purple-600"
    />
  );
}
