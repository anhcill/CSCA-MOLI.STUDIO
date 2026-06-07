import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Công thức ôn thi CSCA | Moly Studio',
  description: 'Kho công thức ôn thi CSCA theo từng môn học, trích nội dung từ tài liệu PDF.',
  alternates: { canonical: '/cong-thuc' },
};

export default function CongThucLayout({ children }: { children: React.ReactNode }) {
  return children;
}
