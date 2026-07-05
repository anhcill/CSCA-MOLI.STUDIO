'use client';

import { FiBookOpen } from 'react-icons/fi';
import AdminExamButton from '@/components/common/AdminExamButton';
import ExamList from '@/components/toan/ExamList';
import SubjectStudyShell from '@/components/layout/SubjectStudyShell';
import { useLanguage } from '@/context/LanguageContext';

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
  const { t } = useLanguage();

  return (
    <SubjectStudyShell
      title={title}
      subjectSlug={subjectSlug}
      activeSection="de-mo-phong"
      showFeatureCards
    >
      <section className="mb-5 rounded-2xl border border-rose-100/80 bg-white/75 px-5 py-4 shadow-[0_8px_28px_rgba(127,29,29,0.06)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <FiBookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight text-slate-950">{t('course.examListTitle')}</h2>
              <p className="text-sm font-medium text-slate-500">{t('course.examListDesc')}</p>
            </div>
          </div>
          <AdminExamButton
            href="/admin/exams/create"
            gradientClass="from-red-600 to-rose-600"
            shadowClass="shadow-red-500/20"
            hoverClass="hover:shadow-red-500/40 hover:-translate-y-0.5"
          />
        </div>
      </section>

      <ExamList subjectCode={subjectCode} subjectSlug={subjectSlug} />
    </SubjectStudyShell>
  );
}
