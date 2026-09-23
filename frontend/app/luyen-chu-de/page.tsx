'use client';

import { useSearchParams } from 'next/navigation';
import TopicPracticeCatalog from '@/components/learning/TopicPracticeCatalog';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { getSubjectMeta, normalizeContentSubject } from '@/lib/utils/subjectScope';

export default function TopicPracticePage() {
  const searchParams = useSearchParams();
  const subjectSlug = normalizeContentSubject(searchParams.get('subject')) || 'toan';
  const subjectMeta = getSubjectMeta(subjectSlug);

  return (
    <SubjectStudyShell
      title="Luyện Chủ Đề"
      subtitle="Chọn một chủ đề, rồi luyện theo từng file PDF với bảng đáp án như phòng thi."
      subjectSlug={subjectSlug}
      activeSection="luyen-chu-de"
      searchPlaceholder="Tìm chủ đề hoặc file luyện..."
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <TopicPracticeCatalog
          subjectSlug={subjectSlug}
          subjectCode={subjectMeta?.examCode || 'MATH'}
          subjectLabel={subjectMeta?.label || 'Toán học'}
        />
      </div>
    </SubjectStudyShell>
  );
}
