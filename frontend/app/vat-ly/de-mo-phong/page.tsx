export const dynamic = 'force-dynamic';

import FocusedExamPage from '@/components/layout/FocusedExamPage';

export default function VatLyDeMoPhongPage() {
  return (
    <FocusedExamPage
      title="Đề Mô Phỏng Vật Lý"
      subjectCode="PHYSICS"
      subjectSlug="vat-ly"
      colorScheme={{ from: 'from-amber-500', to: 'to-red-600' }}
      shadowClass="shadow-orange-900/10"
      accentSoftClass="from-orange-500"
      adminGradientClass="from-amber-500 to-red-600"
    />
  );
}
