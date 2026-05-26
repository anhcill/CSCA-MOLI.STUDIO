import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/cau-truc-de' },
};

export default function CauTrucDeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
