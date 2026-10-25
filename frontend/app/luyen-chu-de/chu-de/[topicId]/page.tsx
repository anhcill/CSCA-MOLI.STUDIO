'use client';

import { useParams, useSearchParams } from 'next/navigation';
import TopicPracticeFileList from '@/components/learning/TopicPracticeFileList';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { getSubjectMeta, normalizeContentSubject } from '@/lib/utils/subjectScope';
import { FEATURE_FLAGS } from '@/lib/config/features';

export default function TopicPracticeFilesPage() {
  const params = useParams<{ topicId: string }>();
  const searchParams = useSearchParams();
  const subjectSlug = normalizeContentSubject(searchParams.get('subject')) || 'toan';
  const subjectMeta = getSubjectMeta(subjectSlug);
  const topicId = Number(params.topicId);

  if (!FEATURE_FLAGS.topicPractice) {
    return (
      <SubjectStudyShell title="Luyện Chủ Đề" subjectSlug={subjectSlug} activeSection="de-mo-phong">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tính năng đang tạm khóa</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
            Luyện theo chủ đề đang được nâng cấp. Bạn có thể tiếp tục làm đề mô phỏng trong thời gian này.
          </p>
        </div>
      </SubjectStudyShell>
    );
  }

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
