'use client';

import { useParams, useSearchParams } from 'next/navigation';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import TopicPracticeExamList from '@/components/learning/TopicPracticeExamList';
import { getSubjectMeta, normalizeContentSubject } from '@/lib/utils/subjectScope';

export default function TopicPracticeFilesPage() {
  const params = useParams<{ topicId: string }>();
  const searchParams = useSearchParams();
  const subjectSlug = normalizeContentSubject(searchParams.get('subject')) || 'toan';
  const subjectMeta = getSubjectMeta(subjectSlug);
  const topicId = Number(params.topicId);

  return (
    <SubjectStudyShell
      title="Luyện Chủ Đề"
      subtitle="Chọn một đề trắc nghiệm trong chủ đề để bắt đầu luyện tập."
      subjectSlug={subjectSlug}
      activeSection="luyen-chu-de"
      searchPlaceholder="Tìm đề luyện..."
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <TopicPracticeExamList topicId={topicId} subjectCode={subjectMeta?.examCode || 'MATH'} />
      </div>
    </SubjectStudyShell>
  );
}
