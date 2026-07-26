import { redirect } from 'next/navigation';

const SUBJECT_CONFIG: Record<string, { redirectPath: string }> = {
  toan: { redirectPath: '/toan/de-mo-phong' },
  vatly: { redirectPath: '/vat-ly/de-mo-phong' },
  'vat-ly': { redirectPath: '/vat-ly/de-mo-phong' },
  hoa: { redirectPath: '/hoa/de-mo-phong' },
  'hoa-hoc': { redirectPath: '/hoa/de-mo-phong' },
  'tiengtrung-xahoi': { redirectPath: '/tiengtrung-xahoi/de-mo-phong' },
  'tiengtrung-tunhien': { redirectPath: '/tiengtrung-tunhien/de-mo-phong' },
};

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const subjectInfo = SUBJECT_CONFIG[subject];

  if (!subjectInfo) {
    redirect('/');
  }

  redirect(subjectInfo.redirectPath);
}
