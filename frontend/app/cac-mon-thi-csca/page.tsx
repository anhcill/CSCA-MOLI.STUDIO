import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';
import { subjectSeoPages, type SubjectSeoKey } from '../_seo/subjectSeoData';

export const metadata: Metadata = {
  title: 'Các Môn Thi CSCA - Toán, Lý, Hóa, Tiếng Trung & Tổng Hợp | MOLI.STUDIO',
  description:
    'CSCA thi môn gì? Xem danh sách các môn thi CSCA, nội dung cần ôn và lộ trình luyện theo Toán, Vật Lý, Hóa, Tiếng Trung, Tổng hợp.',
  keywords: [
    'CSCA thi môn gì',
    'các môn thi CSCA',
    'ôn thi CSCA theo môn',
    'môn thi CSCA',
    'Toán Lý Hóa Tiếng Trung CSCA',
  ],
  alternates: { canonical: '/cac-mon-thi-csca' },
  openGraph: {
    title: 'Các Môn Thi CSCA - Toán, Lý, Hóa, Tiếng Trung & Tổng Hợp',
    description: 'Xem danh sách các môn thi CSCA và chọn lộ trình ôn theo từng môn.',
    url: '/cac-mon-thi-csca',
    type: 'website',
    locale: 'vi_VN',
    images: [{ url: '/images/du-hoc-trung-quoc-1200x799.jpg', width: 1200, height: 799, alt: 'Các môn thi CSCA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Các Môn Thi CSCA - Toán, Lý, Hóa, Tiếng Trung & Tổng Hợp',
    description: 'Xem danh sách môn thi CSCA và chọn lộ trình ôn theo từng môn.',
    images: ['/images/du-hoc-trung-quoc-1200x799.jpg'],
  },
};

const subjectOrder: Array<{ key: SubjectSeoKey; label: string; note: string }> = [
  { key: 'math', label: 'Toán CSCA', note: 'Công thức, đọc đề Toán tiếng Trung và đề mô phỏng.' },
  { key: 'physics', label: 'Vật Lý CSCA', note: 'Cơ học, điện học, sóng, quang học và bài tập công thức.' },
  { key: 'chemistry', label: 'Hóa CSCA', note: 'Lý thuyết, phương trình phản ứng và bài tập tính toán.' },
  { key: 'chinese', label: 'Tiếng Trung CSCA', note: 'Từ vựng, nghe hiểu, đọc hiểu, tự nhiên và xã hội.' },
  { key: 'general', label: 'Tổng hợp CSCA', note: 'Văn hóa, lịch sử, địa lý Trung Quốc và kiến thức xã hội.' },
];

export default function CacMonThiCscaPage() {
  const siteUrl = getCanonicalSiteUrl();
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Các môn thi CSCA',
    itemListElement: subjectOrder.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      url: `${siteUrl}${subjectSeoPages[item.key].route}`,
    })),
  };

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />

      <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-violet-50 pt-20 pb-14 sm:pt-24 sm:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-25" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-flex px-4 py-1.5 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
            Hướng dẫn chọn môn ôn thi CSCA
          </span>
          <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-950 leading-tight max-w-3xl">
            Các Môn Thi CSCA Và Cách Ôn Theo Từng Môn
          </h1>
          <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl">
            Nếu bạn đang tìm “CSCA thi môn gì” hoặc “ôn thi CSCA theo môn”, đây là trang tổng hợp để chọn đúng lộ trình. Mỗi môn có trang riêng, nội dung riêng và đường dẫn vào đề mô phỏng tương ứng.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link href="/on-thi-csca" className="px-7 py-4 rounded-2xl bg-indigo-600 text-white font-black text-center hover:bg-indigo-700 transition-all">
              Xem ôn thi CSCA tổng quan
            </Link>
            <Link href="/de-thi-csca" className="px-7 py-4 rounded-2xl bg-white text-gray-950 font-black text-center border-2 border-gray-200 hover:bg-gray-50 transition-all">
              Xem đề thi CSCA
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjectOrder.map((item) => {
              const page = subjectSeoPages[item.key];
              return (
                <Link
                  key={item.key}
                  href={page.route}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600">Môn ôn thi</span>
                  <h2 className="mt-3 text-xl font-black text-gray-950">{item.label}</h2>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.note}</p>
                  <p className="mt-4 text-sm font-bold text-indigo-600">Xem lộ trình ôn môn này</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-950">
            Nên Ôn Môn Nào Trước?
          </h2>
          <div className="mt-6 space-y-4 text-gray-600 leading-relaxed">
            <p>
              Nếu nền tiếng Trung còn yếu, hãy học từ vựng CSCA song song với môn Toán hoặc môn tự nhiên. Việc hiểu thuật ngữ đề bài giúp tăng tốc khi làm đề.
            </p>
            <p>
              Nếu mục tiêu là tăng điểm nhanh, hãy bắt đầu bằng môn có nền tảng tốt nhất, sau đó dùng đề mô phỏng để phát hiện phần yếu và quay lại học theo chủ đề.
            </p>
            <p>
              MOLI.STUDIO đang tách nội dung theo từng môn để Google dễ hiểu cấu trúc trang, đồng thời giúp người học đi thẳng vào phần cần ôn thay vì chỉ đọc một trang tổng quan quá rộng.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
