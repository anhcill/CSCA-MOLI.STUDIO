import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { BLOG_POSTS, formatDate } from './blogData';
import { FiCalendar, FiClock, FiTag } from 'react-icons/fi';

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
  const featured = BLOG_POSTS.find(p => p.featured);
  const rest = BLOG_POSTS.filter(p => !p.featured);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Blog & Tin Tức
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Cập nhật lịch thi, hướng dẫn luyện thi HSK/HSKK, mẹo học từ vựng và kinh nghiệm từ những người đạt điểm cao.
          </p>
        </div>

        {/* Featured Post */}
        {featured && (
          <Link href={`/blog/${featured.slug}`} className="block mb-12 group">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="relative h-64 overflow-hidden">
                <img
                  src={featured.coverImage}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="hidden absolute inset-0 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-center">
                  <span className="text-amber-600 font-medium text-xl">{featured.category}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end">
                  <div className="p-6 w-full">
                    <span className="inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                      Bài viết nổi bật
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold text-white group-hover:text-amber-200 transition-colors leading-snug drop-shadow">
                      {featured.title}
                    </h2>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 mb-4 line-clamp-3">{featured.excerpt}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <FiCalendar size={14} />
                    {formatDate(featured.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiClock size={14} />
                    {featured.readTime} phút đọc
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiTag size={14} />
                    {featured.category}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* All Posts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 h-full flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="hidden absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-600 text-center px-4">{post.category}</span>
                  </div>
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                    {post.category}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-3 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <FiCalendar size={12} />
                      {formatDate(post.publishedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiClock size={12} />
                      {post.readTime} phút
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Categories */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Chủ đề nổi bật</h2>
          <div className="flex flex-wrap gap-3">
            {['Luyện thi HSK', 'Hướng dẫn thi HSK', 'Từ vựng HSK', 'Luyện thi HSKK', 'Thông tin thi HSK'].map(cat => (
              <span key={cat} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-amber-300 hover:text-amber-600 cursor-pointer transition-colors">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
