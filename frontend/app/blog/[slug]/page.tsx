import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { BLOG_POSTS, getBlogPost, formatDate } from '../blogData';
import { FiCalendar, FiClock, FiTag, FiArrowLeft, FiShare2 } from 'react-icons/fi';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const isTableLine = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
};

const parseTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isTableDivider = (line: string) => {
  if (!isTableLine(line)) return false;
  const cells = parseTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

function renderInlineMarkdown(text: string): ReactNode[] {
  const chunks = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return chunks.map((chunk, index) => {
    const linkMatch = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (href.startsWith('http')) {
        return (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
            {label}
          </a>
        );
      }
      return (
        <Link key={index} href={href} className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
          {label}
        </Link>
      );
    }

    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={index} className="font-extrabold text-gray-950">{chunk.slice(2, -2)}</strong>;
    }

    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      return (
        <code key={index} className="bg-gray-150/70 text-indigo-700 px-2 py-0.5 rounded-lg font-mono text-xs sm:text-sm font-bold border border-gray-200">
          {chunk.slice(1, -1)}
        </code>
      );
    }

    return chunk;
  });
}

function renderBlogContent(content: string): ReactNode[] {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const key = `block-${i}`;

    if (!trimmed) {
      blocks.push(<div key={key} className="h-4" />);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(<h2 key={key} className="text-xl sm:text-2xl font-black text-gray-950 mt-10 mb-4 tracking-tight leading-snug">{renderInlineMarkdown(trimmed.slice(3))}</h2>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(<h3 key={key} className="text-lg sm:text-xl font-bold text-gray-900 mt-8 mb-3 tracking-tight">{renderInlineMarkdown(trimmed.slice(4))}</h3>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      blocks.push(<h4 key={key} className="text-base sm:text-lg font-extrabold text-gray-900 mt-6 mb-2 tracking-tight">{renderInlineMarkdown(trimmed.slice(5))}</h4>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre key={key} className="my-6 overflow-x-auto rounded-2xl border border-gray-200 bg-gray-950 p-4 text-gray-50 text-xs sm:text-sm">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (isTableLine(trimmed) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = parseTableCells(trimmed);
      const rows: string[][] = [];
      i += 2;

      while (i < lines.length && isTableLine(lines[i]) && !isTableDivider(lines[i])) {
        rows.push(parseTableCells(lines[i]));
        i += 1;
      }

      blocks.push(
        <div key={key} className="overflow-x-auto rounded-2xl border border-gray-150/70 shadow-sm my-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-indigo-50/50 border-b border-gray-100">
                {headers.map((cell, index) => (
                  <th key={index} className="px-4 py-3 text-left font-extrabold text-indigo-900 uppercase tracking-wider text-xs">
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50/40 transition-colors">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 text-gray-600 font-semibold align-top">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (trimmed === '---') {
      blocks.push(<hr key={key} className="my-8 border-gray-200" />);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote key={key} className="border-l-4 border-indigo-500 pl-5 py-3.5 my-6 text-gray-650 italic bg-indigo-50/40 rounded-r-2xl border-y border-r border-indigo-100/50">
          {quoteLines.map((quote, index) => (
            <p key={index} className="my-1">{renderInlineMarkdown(quote)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key} className="list-disc pl-6 my-4 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="text-gray-700 pl-1 font-semibold leading-relaxed">{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key} className="list-decimal pl-6 my-4 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="text-gray-700 pl-1 font-semibold leading-relaxed">{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    blocks.push(<p key={key} className="text-gray-650 leading-relaxed my-4.5 font-medium">{renderInlineMarkdown(trimmed)}</p>);
    i += 1;
  }

  return blocks;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
      images: [{ url: post.coverImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  
  const siteUrl = 'https://www.molystudio.online';
  
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'CSCA MOLI.STUDIO', logo: { '@type': 'ImageObject', url: `${siteUrl}/images/logo.svg` } },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    inLanguage: 'vi-VN',
    keywords: post.tags.join(', '),
  };
  
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  };

  const relatedPosts = BLOG_POSTS
    .filter(p => p.slug !== slug && (p.category === post.category || p.tags.some(t => post.tags.includes(t))))
    .slice(0, 3);

  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    'Ôn thi CSCA': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    'Đề thi CSCA': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
    'Học bổng CSC': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    'Du học Trung Quốc': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    'Từ vựng CSCA': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  };

  const catColors = categoryColors[post.category] || { bg: 'bg-gray-50', text: 'text-gray-705', border: 'border-gray-150' };

  return (
    <div className="min-h-screen bg-gray-50/50 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl relative z-10">
        
        {/* Back navigation button */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-indigo-600 mb-8 transition-colors font-bold text-xs uppercase tracking-wider">
          <FiArrowLeft size={14} />
          <span>Quay lại danh sách blog</span>
        </Link>

        {/* Bố cục Grid 2 Cột trên màn hình lớn */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── CỘT TRÁI (8/12): NỘI DUNG CHÍNH BÀI VIẾT ────────────────── */}
          <div className="lg:col-span-8 space-y-6">
            
            <article className="bg-white rounded-3xl shadow-sm border border-gray-150/60 overflow-hidden hover:shadow-md transition-all duration-300">
              
              {/* Cover Image */}
              <div className="relative h-64 sm:h-[400px] overflow-hidden bg-gray-100">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 900px"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              {/* Title & Metadata Header */}
              <header className="p-6 sm:p-8 lg:p-10 border-b border-gray-100 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-bold uppercase tracking-wider">
                  <span className={`px-2.5 py-1 rounded-lg border ${catColors.bg} ${catColors.text} ${catColors.border}`}>
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiCalendar size={13} className="text-gray-300" />
                    {formatDate(post.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiClock size={13} className="text-gray-300" />
                    {post.readTime} phút đọc
                  </span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl font-black text-gray-950 leading-tight tracking-tight">
                  {post.title}
                </h1>
                
                <div className="text-gray-500 font-medium leading-relaxed pl-4 border-l-4 border-indigo-200 py-1 italic text-sm sm:text-base">
                  {post.excerpt}
                </div>
              </header>

              {/* Markdown Content Parser */}
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="prose prose-indigo max-w-none text-gray-700 text-sm sm:text-base leading-relaxed font-medium">
                  {renderBlogContent(post.content)}
                </div>

                {/* Continue exam block CTA */}
                <div className="mt-10 rounded-3xl bg-indigo-50/60 border border-indigo-100/70 p-6 space-y-4">
                  <h3 className="text-base font-extrabold text-gray-900 uppercase tracking-wider">Tiếp tục hành trình học tập</h3>
                  <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
                    <Link href="/csca-la-gi" className="px-4 py-2.5 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 text-indigo-700 shadow-sm transition-all hover:scale-[1.01]">CSCA là gì?</Link>
                    <Link href="/de-thi-thu-csca" className="px-4 py-2.5 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 text-indigo-700 shadow-sm transition-all hover:scale-[1.01]">Đề thi thử CSCA</Link>
                    <Link href="/on-thi-csca-online" className="px-4 py-2.5 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 text-indigo-700 shadow-sm transition-all hover:scale-[1.01]">Ôn thi online</Link>
                    <Link href="/tu-vung-csca" className="px-4 py-2.5 rounded-xl bg-white border border-indigo-100 hover:border-indigo-300 text-indigo-700 shadow-sm transition-all hover:scale-[1.01]">Từ vựng CSCA</Link>
                  </div>
                </div>

                {/* Tags bottom strip */}
                <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-gray-100">
                  {post.tags.map(tag => (
                    <span key={tag} className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-150/80 text-gray-500 rounded-xl text-xs font-bold transition-colors">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Social Share section */}
                <div className="flex items-center gap-3 mt-6 pt-4">
                  <span className="text-xs text-gray-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                    <FiShare2 size={13} />
                    <span>Chia sẻ bài viết:</span>
                  </span>
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=https://www.molystudio.online/blog/${post.slug}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-[0.98]">
                    Facebook
                  </a>
                </div>

              </div>
            </article>
          </div>

          {/* ── CỘT PHẢI (4/12): SIDEBAR BỔ TRỢ ─────────────────────────── */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Author Summary Card */}
            <div className="bg-white rounded-3xl border border-gray-150/60 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-sm shrink-0">
                  M
                </div>
                <div>
                  <p className="font-extrabold text-gray-900 text-base leading-tight">{post.author}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Ban biên tập Moly</p>
                </div>
              </div>
              <div className="border-t border-gray-100 my-4" />
              <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                MOLI.STUDIO - Nền tảng ôn thi CSCA mô phỏng hàng đầu, hỗ trợ săn học bổng Chính phủ Trung Quốc (CSC) toàn diện.
              </p>
            </div>

            {/* Related Articles list */}
            {relatedPosts.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-150/60 p-6 shadow-sm space-y-4 hover:shadow-md transition-all duration-300">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-2.5 border-b border-gray-100 flex items-center gap-2">
                  <FiTag className="text-indigo-500" size={14} />
                  <span>Bài viết liên quan</span>
                </h3>
                <div className="space-y-4">
                  {relatedPosts.map(rp => (
                    <Link key={rp.slug} href={`/blog/${rp.slug}`} className="group block">
                      <div className="flex gap-3.5 items-start">
                        <div className="relative w-18 h-18 rounded-2xl overflow-hidden bg-gray-50 shrink-0 border border-gray-100 shadow-sm">
                          <Image
                            src={rp.coverImage}
                            alt={rp.title}
                            fill
                            sizes="72px"
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-350"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h4 className="font-bold text-gray-900 text-xs sm:text-sm leading-snug group-hover:text-indigo-650 transition-colors line-clamp-2">
                            {rp.title}
                          </h4>
                          <span className="inline-block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            {rp.readTime} phút đọc
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Premium CTA Banner */}
            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 rounded-3xl p-6 text-center text-white shadow-lg relative overflow-hidden transition-all hover:scale-[1.015] hover:shadow-xl duration-350">
              <div className="absolute top-[-30px] right-[-30px] w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-[-20px] left-[-20px] w-24 h-24 bg-black/10 rounded-full blur-xl pointer-events-none" />
              
              <h3 className="text-xl font-black mb-2 tracking-tight">Sẵn sàng ôn thi CSCA?</h3>
              <p className="text-indigo-100 text-xs font-semibold leading-relaxed mb-6">
                Mở khóa đề thi thử mô phỏng, tích lũy từ vựng học thuật HSK và chuẩn bị sẵn sàng đạt điểm số mục tiêu cao nhất.
              </p>
              <Link href="/de-thi-csca"
                className="w-full inline-block py-3 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm transition-all active:scale-[0.98]">
                Luyện đề thi ngay
              </Link>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
