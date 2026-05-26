import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/giai-de-chi-tiet' },
};

export default function GiaiDeChiTietLayout({ children }: { children: React.ReactNode }) {
  return children;
}
