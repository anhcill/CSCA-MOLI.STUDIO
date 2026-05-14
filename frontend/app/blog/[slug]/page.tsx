import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { BLOG_POSTS, getBlogPost, formatDate } from '../blogData';
import { FiCalendar, FiClock, FiTag, FiArrowLeft, FiShare2 } from 'react-icons/fi';

interface PageProps {
  params: Promise<{ slug: string }>;
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

  const relatedPosts = BLOG_POSTS
    .filter(p => p.slug !== slug && (p.category === post.category || p.tags.some(t => post.tags.includes(t))))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-gray-500 hover:text-amber-600 mb-8 transition-colors">
          <FiArrowLeft size={16} />
          <span>Quay lại blog</span>
        </Link>

        {/* Article */}
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Cover Image */}
          <div className="relative h-72 overflow-hidden bg-gray-100">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="hidden absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
              <span className="text-amber-600 font-medium text-2xl">{post.category}</span>
            </div>
          </div>

          {/* Header */}
          <header className="px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
              <span className="flex items-center gap-1.5">
                <FiCalendar size={14} />
                {formatDate(post.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <FiClock size={14} />
                {post.readTime} phút đọc
              </span>
              <span className="flex items-center gap-1.5">
                <FiTag size={14} />
                {post.category}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              {post.excerpt}
            </p>
          </header>

          {/* Content */}
          <div className="px-8 py-10">
            <div className="prose prose-lg max-w-none">
              {post.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold text-gray-900 mt-8 mb-4">{line.slice(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold text-gray-800 mt-8 mb-3">{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold text-gray-700 mt-6 mb-2">{line.slice(4)}</h3>;
                if (line.startsWith('| ')) {
                  const cells = line.split('|').filter(c => c.trim());
                  const isHeader = i > 0 && post.content.split('\n')[i - 1].startsWith('|') && !post.content.split('\n')[i - 1].startsWith('|---');
                  if (isHeader) {
                    return (
                      <table key={i} className="w-full border-collapse my-4">
                        <thead>
                          <tr className="bg-amber-50">
                            {cells.map((cell, j) => <th key={j} className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">{cell.trim()}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const bodyLines = [];
                            let j = i + 1;
                            while (j < post.content.split('\n').length && post.content.split('\n')[j].startsWith('|')) {
                              const rowCells = post.content.split('\n')[j].split('|').filter(c => c.trim());
                              bodyLines.push(
                                <tr key={j}>
                                  {rowCells.map((cell, k) => <td key={k} className="border border-gray-200 px-4 py-2 text-gray-600">{cell.trim()}</td>)}
                                </tr>
                              );
                              j++;
                            }
                            return bodyLines;
                          })()}
                        </tbody>
                      </table>
                    );
                  }
                  return null;
                }
                if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-amber-400 pl-4 py-2 my-4 text-gray-600 italic bg-amber-50 rounded-r-lg">{line.slice(2)}</blockquote>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-gray-900 my-3">{line.slice(2, -2)}</p>;
                if (line.startsWith('- ')) return <li key={i} className="ml-4 text-gray-700 my-1">{line.slice(2)}</li>;
                if (line.startsWith('`') && line.endsWith('`')) return <code key={i} className="bg-gray-100 text-amber-600 px-2 py-0.5 rounded font-mono text-sm">{line.slice(1, -1)}</code>;
                if (line.trim() === '') return <div key={i} className="h-4" />;
                return <p key={i} className="text-gray-700 leading-relaxed my-3">{line}</p>;
              })}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-gray-100">
              {post.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Share */}
            <div className="flex items-center gap-4 mt-6">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <FiShare2 size={14} />
                Chia sẻ:
              </span>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=https://www.molystudio.online/blog/${post.slug}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
                Facebook
              </a>
            </div>
          </div>
        </article>

        {/* Author */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
            M
          </div>
          <div>
            <p className="font-semibold text-gray-900">{post.author}</p>
            <p className="text-sm text-gray-500">MOLI.STUDIO - Nền tảng luyện thi HSK/HSKK online</p>
          </div>
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Bài viết liên quan</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map(rp => (
                <Link key={rp.slug} href={`/blog/${rp.slug}`} className="group">
                  <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-all h-full">
                    <div className="relative h-28 overflow-hidden">
                      <img
                        src={rp.coverImage}
                        alt={rp.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="hidden absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                        <span className="text-xs font-medium text-indigo-600 text-center px-2">{rp.category}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 text-sm group-hover:text-amber-600 transition-colors line-clamp-2 mb-2">
                        {rp.title}
                      </h3>
                      <p className="text-xs text-gray-500">{rp.readTime} phút đọc</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-3">Sẵn sàng luyện thi HSK?</h3>
          <p className="text-amber-100 mb-6">Thi thử miễn phí và theo dõi tiến độ học tập ngay hôm nay</p>
          <Link href="/"
            className="inline-block px-8 py-3 bg-white text-amber-600 font-semibold rounded-xl hover:bg-amber-50 transition-colors">
            Bắt đầu luyện thi ngay
          </Link>
        </div>
      </main>
    </div>
  );
}
