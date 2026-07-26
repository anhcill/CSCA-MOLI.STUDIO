export const dynamic = 'force-dynamic';

import FocusedExamPage from '@/components/layout/FocusedExamPage';

const SUBJECT_CONFIG: Record<string, {
  code: string;
  name: string;
  subjectSlug: string;
  colorScheme: { from: string; via?: string; to: string };
  shadowClass: string;
  accentSoftClass: string;
  adminGradientClass: string;
}> = {
  toan: {
    code: 'MATH',
    name: 'Toán',
    subjectSlug: 'toan',
    colorScheme: { from: 'from-blue-600', via: 'via-indigo-600', to: 'to-purple-700' },
    shadowClass: 'shadow-indigo-900/10',
    accentSoftClass: 'from-blue-600',
    adminGradientClass: 'from-violet-600 to-fuchsia-600',
  },
  vatly: {
    code: 'PHYSICS',
    name: 'Vật Lý',
    subjectSlug: 'vat-ly',
    colorScheme: { from: 'from-amber-500', via: 'via-orange-500', to: 'to-red-600' },
    shadowClass: 'shadow-orange-900/10',
    accentSoftClass: 'from-orange-500',
    adminGradientClass: 'from-amber-500 to-red-600',
  },
  'vat-ly': {
    code: 'PHYSICS',
    name: 'Vật Lý',
    subjectSlug: 'vat-ly',
    colorScheme: { from: 'from-amber-500', via: 'via-orange-500', to: 'to-red-600' },
    shadowClass: 'shadow-orange-900/10',
    accentSoftClass: 'from-orange-500',
    adminGradientClass: 'from-amber-500 to-red-600',
  },
  hoa: {
    code: 'CHEMISTRY',
    name: 'Hóa Học',
    subjectSlug: 'hoa',
    colorScheme: { from: 'from-emerald-500', via: 'via-teal-600', to: 'to-cyan-600' },
    shadowClass: 'shadow-teal-900/10',
    accentSoftClass: 'from-emerald-500',
    adminGradientClass: 'from-emerald-500 to-cyan-600',
  },
  'hoa-hoc': {
    code: 'CHEMISTRY',
    name: 'Hóa Học',
    subjectSlug: 'hoa',
    colorScheme: { from: 'from-emerald-500', via: 'via-teal-600', to: 'to-cyan-600' },
    shadowClass: 'shadow-teal-900/10',
    accentSoftClass: 'from-emerald-500',
    adminGradientClass: 'from-emerald-500 to-cyan-600',
  },
  'tiengtrung-xahoi': {
    code: 'CHINESE',
    name: 'Tiếng Trung Xã Hội',
    subjectSlug: 'tiengtrung-xahoi',
    colorScheme: { from: 'from-rose-500', via: 'via-pink-600', to: 'to-purple-600' },
    shadowClass: 'shadow-rose-900/10',
    accentSoftClass: 'from-rose-500',
    adminGradientClass: 'from-rose-500 to-purple-600',
  },
  'tiengtrung-tunhien': {
    code: 'CHINESE',
    name: 'Tiếng Trung Tự Nhiên',
    subjectSlug: 'tiengtrung-tunhien',
    colorScheme: { from: 'from-violet-500', via: 'via-purple-600', to: 'to-fuchsia-600' },
    shadowClass: 'shadow-fuchsia-900/10',
    accentSoftClass: 'from-violet-500',
    adminGradientClass: 'from-violet-500 to-fuchsia-600',
  },
};

export default async function DeMoPhongPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const subjectInfo = SUBJECT_CONFIG[subject];

  if (!subjectInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-400">
        Không tìm thấy môn học
      </div>
    );
  }

  return (
    <FocusedExamPage
      title={`Đề Mô Phỏng ${subjectInfo.name}`}
      subjectCode={subjectInfo.code}
      subjectSlug={subjectInfo.subjectSlug}
      colorScheme={subjectInfo.colorScheme}
      shadowClass={subjectInfo.shadowClass}
      accentSoftClass={subjectInfo.accentSoftClass}
      adminGradientClass={subjectInfo.adminGradientClass}
    />
  );
}
