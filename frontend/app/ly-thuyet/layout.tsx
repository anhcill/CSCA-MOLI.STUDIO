import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/ly-thuyet' },
};

export default function LyThuyetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
