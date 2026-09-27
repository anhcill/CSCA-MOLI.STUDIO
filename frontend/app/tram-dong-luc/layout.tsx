import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trạm Động Lực – Tiếp Lửa Ôn Thi & Kỷ Luật Bản Thân | Moly',
  description: 'Trạm động lực học tập: tuyển tập video TikTok truyền cảm hứng, rèn luyện kỷ luật, thức khuya ôn thi CSCA và săn học bổng du học Trung Quốc cùng đồng hồ Pomodoro và âm thanh tập trung.',
  openGraph: {
    title: 'Trạm Động Lực Học Tập | Moly CSCA',
    description: 'Nạp năng lượng học tập mỗi ngày với các video truyền cảm hứng, chế độ Pomodoro và không gian tự học chuẩn kỷ luật.',
    url: '/tram-dong-luc',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Trạm Động Lực Moly' }],
  },
  alternates: { canonical: '/tram-dong-luc' },
};

export default function TramDongLucLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
