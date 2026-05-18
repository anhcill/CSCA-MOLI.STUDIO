export const dynamic = 'force-dynamic';

import FocusedExamPage from '@/components/layout/FocusedExamPage';

export default function ToanDeMoPhongPage() {
  return (
    <FocusedExamPage
      title="Đề Mô Phỏng Toán"
      subjectCode="MATH"
      subjectSlug="toan"
      colorScheme={{ from: 'from-blue-600', via: 'via-indigo-600', to: 'to-purple-700' }}
      shadowClass="shadow-indigo-900/10"
      accentSoftClass="from-blue-600"
      adminGradientClass="from-violet-600 to-fuchsia-600"
    />
  );
}
