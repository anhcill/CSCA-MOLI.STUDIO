import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

type Faq = { question: string; answer: string };

interface Props {
  slug: string;
  badge: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta?: string;
  sections: Array<{ title: string; body: string[] }>;
  faqs: Faq[];
  keywords: string[];
}

export default function CscaKeywordLanding({
  slug,
  badge,
  title,
  description,
  primaryCta,
  secondaryCta = 'Xem bài hướng dẫn CSCA',
  sections,
  faqs,
  keywords,
}: Props) {
  const siteUrl = getCanonicalSiteUrl();
  const url = `${siteUrl}/${slug}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: title, item: url },
    ],
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    inLanguage: 'vi-VN',
    about: keywords,
    author: { '@type': 'Organization', name: 'CSCA MOLI.STUDIO', url: siteUrl },
    publisher: { '@type': 'Organization', name: 'CSCA MOLI.STUDIO', logo: { '@type': 'ImageObject', url: `${siteUrl}/images/logo.svg` } },
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <Header />
      <section className="bg-gradient-to-br from-indigo-950 via-indigo-800 to-amber-500 text-white py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <span className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-bold mb-6">{badge}</span>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight max-w-4xl">{title}</h1>
          <p className="mt-6 text-lg text-indigo-50 max-w-3xl leading-relaxed">{description}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/de-thi-csca" className="rounded-2xl bg-white px-7 py-4 text-center font-black text-indigo-700 hover:bg-amber-50 transition-colors">
              {primaryCta}
            </Link>
            <Link href="/blog/csca-la-gi-chung-chi-thi-dau-vao-du-hoc-trung-quoc" className="rounded-2xl border border-white/40 px-7 py-4 text-center font-black text-white hover:bg-white/10 transition-colors">
              {secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 grid lg:grid-cols-[1fr_280px] gap-8">
        <article className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900 mb-4">{section.title}</h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900 mb-5">Câu hỏi thường gặp</h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl bg-slate-50 p-5">
                  <h3 className="font-black text-slate-900">{faq.question}</h3>
                  <p className="mt-2 text-slate-600 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-black text-slate-900 mb-3">Liên kết ôn thi</h2>
            <div className="grid gap-2 text-sm font-bold">
              <Link className="text-indigo-700 hover:text-indigo-900" href="/on-thi-csca">Ôn thi CSCA online</Link>
              <Link className="text-indigo-700 hover:text-indigo-900" href="/de-thi-csca">Đề thi thử CSCA</Link>
              <Link className="text-indigo-700 hover:text-indigo-900" href="/tu-vung-csca">Từ vựng CSCA</Link>
              <Link className="text-indigo-700 hover:text-indigo-900" href="/lo-trinh-on-thi-csca">Lộ trình ôn thi CSCA</Link>
              <Link className="text-indigo-700 hover:text-indigo-900" href="/hoc-bong-du-hoc-trung-quoc">Học bổng CSC</Link>
            </div>
          </div>
          <div className="rounded-3xl bg-indigo-700 p-6 text-white shadow-sm">
            <h2 className="font-black mb-2">Làm đề miễn phí</h2>
            <p className="text-sm text-indigo-100 mb-4">Kiểm tra trình độ, xem điểm và lỗi sai ngay.</p>
            <Link href="/de-thi-csca" className="block rounded-2xl bg-white px-4 py-3 text-center font-black text-indigo-700">Vào phòng thi</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}