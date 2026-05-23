import { FiBookOpen } from 'react-icons/fi';
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
  colorScheme,
  adminGradientClass,
}: FocusedExamPageProps) {
  return (
    <SubjectStudyShell
      title={title}
      subjectSlug={subjectSlug}
      activeSection="de-mo-phong"
      showFeatureCards
    >
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <FiBookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight text-slate-950">Danh sách đề thi</h2>
              <p className="text-sm font-medium text-slate-500">Chọn đề và làm lại nhiều lần để theo dõi tiến bộ.</p>
            </div>
          </div>
          <AdminExamButton
            href="/admin/exams/create"
            gradientClass={adminGradientClass || `${colorScheme.from} ${colorScheme.to}`}
            shadowClass="shadow-violet-500/20"
            hoverClass="hover:shadow-violet-500/40 hover:-translate-y-0.5"
          />
        </div>
      </section>

      <ExamList subjectCode={subjectCode} subjectSlug={subjectSlug} />
    </SubjectStudyShell>
  );
}
