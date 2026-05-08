import type { Metadata } from 'next';
import FAQContent, { FAQ_DATA } from './FAQContent';

export const metadata: Metadata = {
  title: 'Câu Hỏi Thường Gặp | MOLI.STUDIO',
  description: 'Giải đáp các câu hỏi thường gặp về MOLI.STUDIO: đăng ký tài khoản, khóa học, thanh toán, tài liệu và hỗ trợ kỹ thuật.',
  openGraph: {
    title: 'Câu Hỏi Thường Gặp | MOLI.STUDIO',
    description: 'Giải đáp nhanh các thắc mắc về luyện thi HSK/HSKK, CSCA, đăng ký tài khoản và thanh toán.',
    type: 'article',
  },
};

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.flatMap(cat =>
      cat.items.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: Array.isArray(item.a) ? item.a.join(' ') : item.a,
        },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FAQContent />
    </>
  );
}
