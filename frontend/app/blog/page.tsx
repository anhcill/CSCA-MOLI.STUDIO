import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { BLOG_POSTS } from './blogData';
import BlogListClient from './BlogListClient';
import { getCanonicalSiteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Blog Ôn Thi CSCA & Du Học Trung Quốc',
  description: 'Hướng dẫn ôn thi CSCA, học bổng CSC, du học Trung Quốc, cấu trúc đề thi, mẫu đề và kinh nghiệm chuẩn bị hồ sơ học bổng.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog Ôn Thi CSCA & Du Học Trung Quốc',
    description: 'Hướng dẫn ôn thi CSCA, học bổng CSC và du học Trung Quốc.',
    type: 'website',
  },
};

export default function BlogPage() {
  const siteUrl = getCanonicalSiteUrl();
  const blogUrl = `${siteUrl}/blog`;
  const topicLinks = [
    { label: 'Cau truc de thi CSCA', href: '/blog/cau-truc-de-thi-csca-phan-toan-tong-hop-tieng-trung' },
    { label: 'De thi thu CSCA', href: '/de-thi-csca' },
    { label: 'Huong dan apply CSC', href: '/blog/hoc-bong-csc-trung-quoc-2026-huong-dan-dang-ky-day-du' },
    { label: 'Tu vung tieng Trung hoc thuat', href: '/tu-vung' },
    { label: 'Kinh nghiem phong van hoc bong', href: '/blog/kinh-nghiem-phong-van-hoc-bong-csc-trung-quoc' },
    { label: 'Tai lieu tu hoc tieng Trung', href: '/tailieu' },
    { label: 'Review truong dai hoc Trung Quoc', href: '/blog' },
  ];
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: metadata.title,
    description: metadata.description,
    url: blogUrl,
    inLanguage: 'vi-VN',
    publisher: {
      '@type': 'Organization',
      name: 'CSCA MOLI.STUDIO',
      url: siteUrl,
    },
    blogPost: BLOG_POSTS.slice(0, 12).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      url: `${blogUrl}/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: { '@type': 'Organization', name: post.author },
      keywords: post.tags.join(', '),
    })),
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chu', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: blogUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50/50 relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-purple-200/25 rounded-full blur-3xl pointer-events-none" />
      
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl relative z-10 space-y-12">
        
        {/* Immersive Hero Section */}
        <div className="text-center py-6 max-w-3xl mx-auto space-y-4">
          <span className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm">
            Blog & Tin tức
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-950 tracking-tight leading-none">
            Ôn Thi CSCA &amp; Du Học Trung Quốc
          </h1>
          <p className="text-base sm:text-lg text-gray-500 font-medium leading-relaxed">
            Cập nhật lịch thi mới nhất, cẩm nang chinh phục học bổng CSC, chia sẻ mẹo học từ vựng và kinh nghiệm chuẩn bị hồ sơ từ các cựu du học sinh xuất sắc.
          </p>
        </div>

        {/* Client Interactive Workspace */}
        <BlogListClient posts={BLOG_POSTS} />

        {/* Premium Topic Cloud (Footer Section) */}
        <div className="mt-16 bg-white rounded-3xl border border-gray-150/60 p-8 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-2.5 uppercase tracking-wider">Chủ đề được đọc nhiều nhất</h2>
          <p className="text-xs text-gray-400 font-semibold mb-6">Khám phá các bài hướng dẫn theo phân mục chuyên biệt</p>
          <div className="flex flex-wrap gap-2.5">
            {[
              'Cấu trúc đề thi CSCA',
              'Đề thi thử CSCA',
              'Hướng dẫn apply CSC',
              'Từ vựng tiếng Trung học thuật',
              'Kinh nghiệm phỏng vấn học bổng',
              'Tài liệu tự học tiếng Trung',
              'Review trường đại học Trung Quốc'
            ].map((cat, index) => (
              <Link
                key={cat}
                href={topicLinks[index]?.href ?? '/blog'}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:text-indigo-650 rounded-2xl text-xs font-bold text-gray-650 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
