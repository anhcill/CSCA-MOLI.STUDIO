'use client';

import { useParams, useSearchParams } from 'next/navigation';
import TopicPracticeFileList from '@/components/learning/TopicPracticeFileList';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
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
      subtitle="Chọn file PDF trong chủ đề để mở giao diện làm bài."
      subjectSlug={subjectSlug}
      activeSection="luyen-chu-de"
      searchPlaceholder="Tìm file luyện..."
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <TopicPracticeFileList
          topicId={topicId}
          subjectSlug={subjectSlug}
          subjectCode={subjectMeta?.examCode || 'MATH'}
        />
      </div>
    </SubjectStudyShell>
  );
}
