'use client';

import AdminExamButton from '@/components/common/AdminExamButton';
import ExamList from '@/components/toan/ExamList';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';

type ColorScheme = {
  from: string;
  via?: string;
  to: string;
};

type FocusedExamPageProps = {
  title: string;
  subjectCode: string;
  subjectSlug: string;
  colorScheme: ColorScheme;
  shadowClass?: string;
  accentSoftClass?: string;
  adminGradientClass?: string;
};

export default function FocusedExamPage({
  title,
  subjectCode,
  subjectSlug,
}: FocusedExamPageProps) {
  return (
    <SubjectStudyShell
      title={title}
      subjectSlug={subjectSlug}
      activeSection="de-mo-phong"
      headerAction={
        <AdminExamButton
          href="/admin/exams/create"
          gradientClass="from-rose-500 to-red-600"
          shadowClass="shadow-rose-500/20"
          hoverClass="hover:shadow-rose-500/35 hover:-translate-y-0.5"
        />
      }
    >
      <ExamList subjectCode={subjectCode} subjectSlug={subjectSlug} />
    </SubjectStudyShell>
  );
}
