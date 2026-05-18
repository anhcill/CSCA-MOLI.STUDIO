export const dynamic = 'force-dynamic';

import FocusedExamPage from '@/components/layout/FocusedExamPage';

export default function HoaDeMoPhongPage() {
  return (
    <FocusedExamPage
      title="Đề Mô Phỏng Hóa Học"
      subjectCode="CHEMISTRY"
      subjectSlug="hoa"
      colorScheme={{ from: 'from-emerald-500', to: 'to-cyan-600' }}
      shadowClass="shadow-teal-900/10"
      accentSoftClass="from-emerald-500"
      adminGradientClass="from-emerald-500 to-cyan-600"
    />
  );
}
