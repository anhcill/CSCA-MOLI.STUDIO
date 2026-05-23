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

export default function LoTrinhPage({ params }: { params: { subject: string } }) {
  const subject = SUBJECT_ALIASES[params.subject] || params.subject;
  redirect(`/lo-trinh?subject=${encodeURIComponent(subject)}`);
}
