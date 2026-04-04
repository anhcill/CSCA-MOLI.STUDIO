import { redirect } from 'next/navigation';

const SUBJECT_CONFIG: Record<string, {
  code: string;
  name: string;
  redirectPath: string;
}> = {
  'toan': {
    code: 'MATH',
    name: 'Toán',
    redirectPath: '/toan/de-mo-phong'
  },
  'vatly': {
    code: 'PHYSICS',
    name: 'Vật lý',
    redirectPath: '/mon/vatly/de-mo-phong'
  },
  'hoa': {
    code: 'CHEMISTRY',
    name: 'Hóa học',
    redirectPath: '/mon/hoa/de-mo-phong'
  },
  'tiengtrung-xahoi': {
    code: 'CHINESE',
    name: 'Tiếng Trung Xã Hội',
    redirectPath: '/tiengtrung-xahoi'
  },
  'tiengtrung-tunhien': {
    code: 'CHINESE',
    name: 'Tiếng Trung Tự Nhiên',
    redirectPath: '/tiengtrung-tunhien'
  }
};

export default function SubjectPage({ params }: { params: { subject: string } }) {
  const subjectSlug = params.subject;
  const subjectInfo = SUBJECT_CONFIG[subjectSlug];

  // If subject not found, redirect to home
  if (!subjectInfo) {
    redirect('/');
  }

  // Redirect directly to exam list to improve performance
  redirect(subjectInfo.redirectPath);
}
