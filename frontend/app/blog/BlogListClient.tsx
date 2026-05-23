'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiCalendar, FiClock, FiTag, FiBookOpen, FiArrowRight } from 'react-icons/fi';
import { formatDate } from './blogData';

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  readTime: number;
  featured?: boolean;
}

interface BlogListClientProps {
  posts: BlogPost[];
}

const categoryColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  'Tất cả': { bg: 'bg-gray-900', text: 'text-white', border: 'border-transparent', accent: 'bg-gray-900' },
  'Ôn thi CSCA': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', accent: 'bg-blue-600' },
  'Đề thi CSCA': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', accent: 'bg-indigo-600' },
  'Học bổng CSC': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', accent: 'bg-amber-600' },
  'Du học Trung Quốc': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', accent: 'bg-purple-600' },
  'Từ vựng CSCA': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', accent: 'bg-emerald-600' },
};

function getCategoryColor(cat: string) {
  return categoryColors[cat] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-150', accent: 'bg-gray-700' };
}

export default function BlogListClient({ posts }: BlogListClientProps) {
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  // Extract unique categories dynamically, maintaining predefined order where possible
  const rawCategories = Array.from(new Set(posts.map(p => p.category)));
  const categories = ['Tất cả', ...rawCategories];

  // Filter posts based on active category
  const filteredPosts = activeCategory === 'Tất cả' 
    ? posts 
    : posts.filter(p => p.category === activeCategory);

  // If "Tất cả" is selected, we pull out the featured post
  const showFeatured = activeCategory === 'Tất cả';
  const featuredPost = showFeatured ? filteredPosts.find(p => p.featured) : null;
  const gridPosts = featuredPost 
    ? filteredPosts.filter(p => p.slug !== featuredPost.slug) 
    : filteredPosts;

  return (
    <div className="space-y-12">
      
      {/* ── Category Filter Pills ─────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <FiTag className="text-gray-400" size={14} />
            <span>Chủ đề bài viết</span>
          </span>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar scroll-smooth w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map(cat => {
              const colors = getCategoryColor(cat);
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all duration-200 shrink-0 select-none border ${
                    isActive
                      ? 'bg-gray-900 text-white border-transparent shadow-md'
                      : `${colors.bg} ${colors.text} ${colors.border} hover:scale-[1.02]`
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Featured Post (Split Layout on Desktop) ─────────── */}
      {featuredPost && (
        <Link href={`/blog/${featuredPost.slug}`} className="block group">
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-150/60 hover:shadow-xl hover:scale-[1.005] transition-all duration-300 grid grid-cols-1 lg:grid-cols-12 gap-0">
            
            {/* Cover Image Block */}
            <div className="relative h-64 lg:h-96 lg:col-span-7 overflow-hidden bg-gray-100">
              <Image
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 800px"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <span className="absolute top-4 left-4 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 animate-pulse">
                <FiBookOpen size={12} /> Bài viết nổi bật
              </span>
            </div>

            {/* Content Details Block */}
            <div className="p-6 lg:p-10 lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className={`inline-block px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${getCategoryColor(featuredPost.category).bg} ${getCategoryColor(featuredPost.category).text} ${getCategoryColor(featuredPost.category).border}`}>
                  {featuredPost.category}
                </span>
                <h2 className="text-2xl lg:text-3xl font-black text-gray-950 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-4">
                  {featuredPost.excerpt}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <FiCalendar size={13} className="text-gray-300" />
                    {formatDate(featuredPost.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiClock size={13} className="text-gray-300" />
                    {featuredPost.readTime} phút đọc
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-black text-gray-900 group-hover:translate-x-1.5 transition-transform duration-300 uppercase tracking-widest shrink-0">
                  <span>Đọc tiếp</span>
                  <FiArrowRight size={13} />
                </span>
              </div>
            </div>

          </div>
        </Link>
      )}

      {/* ── Grid of Other Posts ─────────────────────────────── */}
      {gridPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gridPosts.map(post => {
            const colors = getCategoryColor(post.category);
            return (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group flex">
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-150/60 hover:shadow-xl hover:scale-[1.015] transition-all duration-300 flex flex-col justify-between w-full">
                  <div>
                    {/* Cover image container */}
                    <div className="relative h-48 overflow-hidden bg-gray-50">
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                      <span className={`absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl shadow-sm border ${colors.border} ${colors.text}`}>
                        {post.category}
                      </span>
                    </div>

                    {/* Text container */}
                    <div className="p-6">
                      <h3 className="text-base font-black text-gray-950 mb-2.5 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-semibold leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Footer */}
                  <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <FiCalendar size={12} className="text-gray-300" />
                      {formatDate(post.publishedAt)}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 font-extrabold group-hover:text-indigo-600 transition-colors">
                      <FiClock size={12} />
                      {post.readTime} phút
                    </span>
                  </div>

                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
            <FiTag size={20} />
          </div>
          <p className="text-gray-500 font-bold">Không có bài viết nào thuộc chủ đề này.</p>
          <button 
            onClick={() => setActiveCategory('Tất cả')} 
            className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 underline font-bold"
          >
            Quay lại tất cả bài viết
          </button>
        </div>
      )}

    </div>
  );
}
