import Link from 'next/link';
import Header from '@/components/layout/Header';
import { getCanonicalSiteUrl } from '@/lib/seo/site';
import { subjectSeoPages, type SubjectSeoKey } from './subjectSeoData';

const themeClasses = {
  blue: {
    hero: 'from-blue-50 via-sky-50 to-indigo-50',
    accent: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    soft: 'bg-blue-50 border-blue-200',
    gradient: 'from-blue-600 to-indigo-600',
  },
  emerald: {
    hero: 'from-emerald-50 via-teal-50 to-cyan-50',
    accent: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
    soft: 'bg-emerald-50 border-emerald-200',
    gradient: 'from-emerald-600 to-cyan-600',
  },
  amber: {
    hero: 'from-amber-50 via-orange-50 to-yellow-50',
    accent: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
    soft: 'bg-amber-50 border-amber-200',
    gradient: 'from-amber-600 to-orange-600',
  },
  violet: {
    hero: 'from-violet-50 via-purple-50 to-fuchsia-50',
    accent: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    button: 'bg-violet-600 hover:bg-violet-700 shadow-violet-200',
    soft: 'bg-violet-50 border-violet-200',
    gradient: 'from-violet-600 to-fuchsia-600',
  },
  rose: {
    hero: 'from-rose-50 via-pink-50 to-purple-50',
    accent: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
    soft: 'bg-rose-50 border-rose-200',
    gradient: 'from-rose-600 to-purple-600',
  },
};

const relatedSubjects: Array<{ key: SubjectSeoKey; label: string }> = [
  { key: 'math', label: 'Ôn thi Toán CSCA' },
  { key: 'physics', label: 'Ôn thi Vật Lý CSCA' },
  { key: 'chemistry', label: 'Ôn thi Hóa CSCA' },
  { key: 'chinese', label: 'Ôn thi Tiếng Trung CSCA' },
  { key: 'general', label: 'Ôn thi Tổng hợp CSCA' },
];

export default function SubjectSeoPage({ pageKey }: { pageKey: SubjectSeoKey }) {
  const page = subjectSeoPages[pageKey];
  const theme = themeClasses[page.theme];
  const visibleRelated = relatedSubjects.filter((item) => item.key !== pageKey);
  const siteUrl = getCanonicalSiteUrl();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Ôn thi CSCA',
        item: `${siteUrl}/on-thi-csca`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: page.h1,
        item: `${siteUrl}${page.route}`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />

      <section className={`relative bg-gradient-to-br ${theme.hero} pt-20 pb-14 sm:pt-24 sm:pb-20 overflow-hidden`}>
        <div className="absolute inset-0 bg-[url('/images/pattern-dots.svg')] opacity-25" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold ${theme.badge}`}>
              {page.eyebrow}
            </span>
            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-black text-gray-950 leading-tight">
              {page.h1}
              <span className={`block bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
                {page.highlight}
              </span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
              {page.intro}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href={page.primaryHref}
                className={`px-7 py-4 rounded-2xl text-white font-black text-center shadow-lg ${theme.button} hover:-translate-y-1 transition-all`}
              >
                {page.primaryCta}
              </Link>
              <Link
                href={page.secondaryHref}
                className="px-7 py-4 rounded-2xl bg-white text-gray-900 font-black text-center border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                {page.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {page.stats.map((stat) => (
              <div key={`${stat.value}-${stat.label}`} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className={`text-2xl font-black ${theme.accent}`}>{stat.value}</div>
                <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <span className={`text-xs font-black uppercase tracking-widest ${theme.accent}`}>Nội dung ôn tập</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-gray-950">
              Học Đúng Phần Google Và Người Học Đang Tìm
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {page.sections.map((section) => (
              <article key={section.title} className={`rounded-2xl border-2 ${theme.soft} p-6`}>
                <h3 className="text-lg font-black text-gray-950">{section.title}</h3>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{section.body}</p>
                <ul className="mt-5 space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm text-gray-700">
                      <span className={`mt-1.5 h-2 w-2 rounded-full bg-gradient-to-r ${theme.gradient} shrink-0`} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5">
              <span className={`text-xs font-black uppercase tracking-widest ${theme.accent}`}>Lộ trình đề xuất</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black text-gray-950">
                Lộ Trình Ôn Thi Rõ Ràng Cho Từng Môn
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Trang này được viết để bắt đúng intent tìm kiếm theo môn, đồng thời dẫn người học vào đề mô phỏng thật trong hệ thống.
              </p>
              <Link
                href="/on-thi-csca"
                className={`inline-flex mt-6 px-5 py-3 rounded-xl text-white font-bold bg-gradient-to-r ${theme.gradient} hover:shadow-lg transition-all`}
              >
                Xem trang ôn thi CSCA tổng quan
              </Link>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {page.plan.map((step, index) => (
                <div key={step.title} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex gap-4">
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-r ${theme.gradient} text-white font-black flex items-center justify-center shrink-0`}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-950">{step.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <span className={`text-xs font-black uppercase tracking-widest ${theme.accent}`}>Câu hỏi thường gặp</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black text-gray-950">
                Giải Đáp Nhanh Khi Ôn Môn Này
              </h2>
              <div className="mt-6 space-y-4">
                {page.faqs.map((faq) => (
                  <div key={faq.question} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <h3 className="font-black text-gray-950">{faq.question}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className={`text-xs font-black uppercase tracking-widest ${theme.accent}`}>Liên kết nội bộ</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black text-gray-950">
                Các Cụm Từ Khóa CSCA Liên Quan
              </h2>
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                {visibleRelated.map((item) => {
                  const related = subjectSeoPages[item.key];
                  return (
                    <Link
                      key={item.key}
                      href={related.route}
                      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
                    >
                      <h3 className="font-black text-gray-950">{item.label}</h3>
                      <p className="mt-2 text-sm text-gray-500 leading-relaxed">{related.description}</p>
                    </Link>
                  );
                })}
                <Link
                  href="/cac-mon-thi-csca"
                  className={`rounded-2xl border-2 ${theme.soft} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all`}
                >
                  <h3 className="font-black text-gray-950">Các môn thi CSCA</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Xem danh sách môn thi và chọn lộ trình ôn phù hợp.
                  </p>
                </Link>
                <Link
                  href="/de-thi-csca"
                  className={`rounded-2xl border-2 ${theme.soft} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all`}
                >
                  <h3 className="font-black text-gray-950">Đề thi CSCA 2026</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Xem bộ đề mô phỏng CSCA và chuyển sang phần luyện đề phù hợp.
                  </p>
                </Link>
                <Link
                  href="/tu-vung-csca"
                  className={`rounded-2xl border-2 ${theme.soft} p-5 hover:-translate-y-0.5 hover:shadow-md transition-all`}
                >
                  <h3 className="font-black text-gray-950">Từ vựng CSCA</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Học từ vựng tiếng Trung theo chủ đề để đọc đề nhanh hơn.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`py-14 sm:py-20 bg-gradient-to-r ${theme.gradient}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Bắt Đầu Luyện Ngay Trên MOLI.STUDIO
          </h2>
          <p className="mt-4 text-white/85 leading-relaxed">
            Làm đề mô phỏng, xem lại lỗi sai và theo dõi tiến độ để tăng điểm từng tuần.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={page.primaryHref} className="px-7 py-4 bg-white text-gray-950 rounded-2xl font-black hover:bg-gray-50 transition-all">
              {page.primaryCta}
            </Link>
            <Link href="/register" className="px-7 py-4 bg-white/10 text-white rounded-2xl font-black border border-white/30 hover:bg-white/20 transition-all">
              Tạo tài khoản miễn phí
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
