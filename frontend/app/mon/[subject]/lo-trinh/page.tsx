import { redirect } from 'next/navigation';

const SUBJECT_ALIASES: Record<string, string> = {
  toan: 'toan',
  vatly: 'vat-ly',
  'vat-ly': 'vat-ly',
  hoa: 'hoa',
  'hoa-hoc': 'hoa',
  'tiengtrung-xahoi': 'tiengtrung-xahoi',
  'tiengtrung-tunhien': 'tiengtrung-tunhien',
};

export default async function LoTrinhPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject: requestedSubject } = await params;
  const subject = SUBJECT_ALIASES[requestedSubject] || requestedSubject;
  redirect(`/lo-trinh?subject=${encodeURIComponent(subject)}`);
}
