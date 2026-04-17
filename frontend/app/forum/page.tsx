'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal,
  FiEdit2, FiTrash2, FiSend, FiLoader, FiChevronDown,
  FiFeather, FiZap, FiTrendingUp, FiUsers, FiBookOpen,
  FiStar, FiTarget, FiHash
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import * as postsApi from '@/lib/api/posts';
import type { Post } from '@/lib/api/posts';
import Link from 'next/link';
import Header from '@/components/layout/Header';

const TAGS = ['Tất cả', 'HSK', 'Toán', 'Vật Lý', 'Hóa Học', 'Tiếng Anh', 'Kinh nghiệm', 'Học bổng', 'Chia sẻ'];

const TAG_COLORS: Record<string, string> = {
  'Tất cả': 'from-violet-600 to-indigo-600',
  'HSK': 'from-rose-500 to-pink-600',
  'Toán': 'from-cyan-500 to-blue-600',
  'Vật Lý': 'from-indigo-500 to-purple-600',
  'Hóa Học': 'from-teal-400 to-emerald-500',
  'Tiếng Anh': 'from-amber-500 to-orange-500',
  'Kinh nghiệm': 'from-fuchsia-500 to-pink-600',
  'Học bổng': 'from-yellow-400 to-amber-500',
  'Chia sẻ': 'from-purple-500 to-violet-600',
};

const QUICK_STATS = [
  { icon: FiUsers, label: '10,000+ thành viên', sub: 'Sinh viên tích cực', color: 'bg-violet-100 text-violet-600' },
  { icon: FiTrendingUp, label: '500+ chủ đề hot', sub: 'Thảo luận mỗi ngày', color: 'bg-pink-100 text-pink-600' },
  { icon: FiBookOpen, label: 'Bí kíp học bổng', sub: 'Từ chuyên gia CSCA', color: 'bg-emerald-100 text-emerald-600' },
];

/* ─── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name, size = 42 }: { src?: string; name?: string; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} width={size} height={size}
          className="rounded-2xl object-cover ring-2 ring-white/50 shadow-md h-full w-full"
        />
      ) : (
        <div
          className="rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center text-white font-black shrink-0 ring-2 ring-white/50 shadow-md w-full h-full"
          style={{ fontSize: size * 0.4 }}
        >
          {name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
    </div>
  );
}

/* ─── Time ────────────────────────────────────────────────── */
function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

/* ─── Auto-resize textarea ────────────────────────────────── */
function AutoTextarea({ value, onChange, placeholder, className, onKeyDown, minRows = 1 }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  className?: string; onKeyDown?: React.KeyboardEventHandler; minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} onKeyDown={onKeyDown} rows={minRows}
      className={`resize-none overflow-hidden w-full bg-transparent outline-none ${className}`}
    />
  );
}

/* ─── Skeleton ────────────────────────────────────────────── */
function PostSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/50 p-6 space-y-5 animate-pulse shadow-sm">
      <div className="flex gap-4 items-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-200" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 bg-gray-200 rounded-full" />
          <div className="h-2 w-20 bg-gray-100 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-100 rounded-full w-full" />
        <div className="h-4 bg-gray-100 rounded-full w-5/6" />
        <div className="h-4 bg-gray-50 rounded-full w-2/3" />
      </div>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────── */
export default function ForumPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [activeTag, setActiveTag] = useState('Tất cả');

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [newPost, setNewPost] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [comments, setComments] = useState<Record<number, postsApi.Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [commentLoading, setCommentLoading] = useState<Set<number>>(new Set());

  const [menuPost, setMenuPost] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuPost(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadPosts = useCallback(async (offset = 0) => {
    try {
      offset === 0 ? setLoading(true) : setLoadingMore(true);
      const data = await postsApi.getPosts(15, offset);
      setPosts(prev => offset === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === 15);
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { loadPosts(0); }, [loadPosts]);

  /* Actions */
  const handleCreate = async () => {
    if (!newPost.trim() || !isAuthenticated || submitting) return;
    setSubmitting(true);
    try {
      const post = await postsApi.createPost({ content: newPost.trim() });
      setPosts(prev => [post, ...prev]);
      setNewPost('');
      setComposerOpen(false);
    } catch { alert('Lỗi khi đăng bài. Vui lòng thử lại.'); }
    finally { setSubmitting(false); }
  };

  const handleLike = async (post: Post) => {
    if (!isAuthenticated) return;
    setPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, is_liked: !p.is_liked, like_count: p.like_count + (p.is_liked ? -1 : 1) } : p
    ));
    try {
      post.is_liked ? await postsApi.unlikePost(post.id) : await postsApi.likePost(post.id);
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_liked: post.is_liked, like_count: post.like_count } : p));
    }
  };

  const toggleComments = async (postId: number) => {
    setOpenComments(prev => {
      const s = new Set(prev);
      s.has(postId) ? s.delete(postId) : s.add(postId);
      return s;
    });
    if (!comments[postId]) {
      setCommentLoading(prev => new Set(prev).add(postId));
      try {
        const data = await postsApi.getComments(postId);
        setComments(prev => ({ ...prev, [postId]: data }));
      } catch { /* silent */ }
      finally { setCommentLoading(prev => { const s = new Set(prev); s.delete(postId); return s; }); }
    }
  };

  const handleAddComment = async (postId: number) => {
    const text = commentText[postId]?.trim();
    if (!text || !isAuthenticated) return;
    try {
      const c = await postsApi.addComment(postId, { content: text });
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), c] }));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
    } catch { alert('Lỗi khi thêm bình luận'); }
  };

  const handleEdit = (post: Post) => { setEditingId(post.id); setEditContent(post.content); setMenuPost(null); };
  const handleCancelEdit = () => { setEditingId(null); setEditContent(''); };
  const handleUpdate = async () => {
    if (!editContent.trim() || !editingId) return;
    try {
      const updated = await postsApi.updatePost(editingId, { content: editContent.trim() });
      setPosts(prev => prev.map(p => p.id === editingId ? updated : p));
      setEditingId(null); setEditContent('');
    } catch { alert('Lỗi khi cập nhật bài viết'); }
  };
  const handleDelete = async (postId: number) => {
    setMenuPost(null);
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    try {
      await postsApi.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { alert('Lỗi khi xóa bài viết'); }
  };

  const isAuth = mounted && isAuthenticated;

  return (
    <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden flex flex-col">
      {/* Premium Ambient Background */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-violet-200/40 to-pink-200/40 blur-[120px] rounded-full mix-blend-multiply pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-100/40 to-indigo-200/40 blur-[120px] rounded-full mix-blend-multiply pointer-events-none -translate-x-1/2" />

      <Header />

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-[64px] z-30 bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0 hidden md:flex">
             <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
               <FiZap size={16} className="text-white" />
             </div>
             <span className="font-black tracking-tight text-gray-900">Mạng Lưới</span>
          </div>
          <div className="w-px h-6 bg-gray-200 shrink-0 hidden md:block" />

          {/* Tag pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1 pb-1 pt-1 -my-1">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`shrink-0 px-4 py-2 text-sm font-bold rounded-xl transition-all duration-300 ${activeTag === tag
                  ? `bg-gradient-to-r ${TAG_COLORS[tag] || 'from-violet-600 to-indigo-600'} text-white shadow-lg scale-105`
                  : 'bg-white text-gray-500 hover:bg-gray-100/80 hover:text-gray-900 border border-gray-200/60 shadow-sm'
                  }`}
              >
                {activeTag === tag && <FiHash className="inline-block mr-1 opacity-80" size={12} />}
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 sm:px-6 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Feed column ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* ── Composer Glassmorphism ── */}
            {isAuth ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/50 shadow-xl shadow-indigo-100/50 overflow-hidden transition-all duration-300">
                {!composerOpen ? (
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="w-full flex items-center gap-4 p-4 md:p-6 text-left group"
                  >
                    <Avatar src={user?.avatar} name={user?.full_name} size={48} />
                    <div className="flex-1">
                       <div className="px-5 py-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 text-gray-400 font-medium group-hover:bg-violet-50/50 group-hover:border-violet-100 transition-colors shadow-inner flex items-center justify-between">
                          <span>{user?.full_name?.split(' ').pop() || 'Bạn'} ơi, chia sẻ bí kíp học tập nào! ✨</span>
                          <FiFeather className="text-violet-400 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" size={20} />
                       </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-6 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex gap-4 items-center">
                      <Avatar src={user?.avatar} name={user?.full_name} size={48} />
                      <div>
                        <p className="text-sm font-black text-gray-900 tracking-tight">{user?.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-1 bg-green-50 px-2 py-0.5 rounded-md w-fit">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          <p className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Đang kết nối viễn thông</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 p-4 transition-all bg-white shadow-inner">
                      <AutoTextarea
                        value={newPost}
                        onChange={setNewPost}
                        placeholder="Hãy bật mí kinh nghiệm ôn thi, review tài liệu hay đặt lộ trình chung cho mọi người nhé... 🚀"
                        className="text-[15px] text-gray-800 placeholder-gray-400 leading-relaxed min-h-[100px] font-medium"
                        minRows={4}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreate(); }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                       <div className="flex items-center gap-2 text-xs text-gray-400 font-medium bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                         <span className="px-1.5 py-0.5 bg-white rounded border border-gray-200 shadow-sm text-gray-500">Ctrl</span>
                         <span>+</span>
                         <span className="px-1.5 py-0.5 bg-white rounded border border-gray-200 shadow-sm text-gray-500">Enter</span>
                         <span>để đăng bài</span>
                       </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setComposerOpen(false); setNewPost(''); }}
                          className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors font-bold"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleCreate}
                          disabled={!newPost.trim() || submitting}
                          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-500/30"
                        >
                          {submitting ? <FiLoader size={16} className="animate-spin" /> : <FiSend size={16} />}
                          Công bố
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              mounted && (
                <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden flex items-center justify-between">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                  <div className="relative z-10 max-w-md">
                     <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Tham gia Trạm Học Tập 🚀</h2>
                     <p className="text-violet-200 text-sm leading-relaxed">Đăng nhập để chia sẻ kinh nghiệm ôn thi học bổng, đặt câu hỏi cho cao thủ và tìm đồng đội chạy deadline.</p>
                  </div>
                  <Link href="/auth"
                    className="relative z-10 shrink-0 px-8 py-3.5 bg-white text-violet-700 text-sm font-bold rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-indigo-900/40"
                  >
                    Gia Nhập Ngay
                  </Link>
                </div>
              )
            )}

            {/* ── Feed ── */}
            <div className="space-y-6">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)
                : posts.length === 0
                  ? (
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/50 p-12 text-center shadow-xl shadow-indigo-100/30 w-full flex flex-col items-center justify-center min-h-[400px]">
                      <div className="w-24 h-24 bg-gradient-to-br from-violet-100 to-pink-100 rounded-3xl flex items-center justify-center rotate-12 mb-6 shadow-inner border border-white">
                         <span className="text-4xl -rotate-12">🪶</span>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2">Chưa có dòng tâm sự nào</h3>
                      <p className="text-gray-500">Hãy là người tiên phong khai phá khu vực vùng đất này nhé!</p>
                    </div>
                  )
                  : posts.map(post => (
                    <article key={post.id}
                      className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white shadow-lg shadow-gray-200/40 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/60 hover:-translate-y-1">

                      {/* Header */}
                      <div className="flex items-start justify-between px-6 pt-6 mb-4">
                        <div className="flex gap-4 items-center">
                          <Avatar src={post.author_avatar} name={post.author_name} size={48} />
                          <div>
                            <p className="font-bold text-gray-900 text-[15px]">{post.author_name || 'Học viên Ẩn danh'}</p>
                            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                               {timeAgo(post.created_at)}
                               <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                               <span>Công khai</span>
                            </p>
                          </div>
                        </div>

                        {isAuth && user?.id === post.user_id && (
                          <div className="relative" ref={menuPost === post.id ? menuRef : undefined}>
                            <button
                              onClick={() => setMenuPost(menuPost === post.id ? null : post.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                            >
                              <FiMoreHorizontal size={20} />
                            </button>
                            {menuPost === post.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-2 z-20 animate-in zoom-in-95 duration-200">
                                <button onClick={() => handleEdit(post)} className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-violet-50 hover:text-violet-600 font-bold text-sm rounded-xl transition-colors">
                                  <FiEdit2 size={16} /> Chỉnh sửa
                                </button>
                                <button onClick={() => handleDelete(post.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 font-bold text-sm rounded-xl transition-colors mt-1">
                                  <FiTrash2 size={16} /> Xóa bài
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="px-6 mb-4">
                        {editingId === post.id ? (
                          <div className="space-y-3">
                            <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 p-4 transition-all">
                              <AutoTextarea value={editContent} onChange={setEditContent}
                                className="text-[15px] text-gray-800 leading-relaxed font-medium" minRows={3} />
                            </div>
                            <div className="flex gap-2 justify-end">
                               <button onClick={handleCancelEdit}
                                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 text-sm font-bold rounded-xl transition-colors">
                                Hủy sửa
                              </button>
                              <button onClick={handleUpdate} disabled={!editContent.trim()}
                                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-violet-500/30">
                                Cập nhật
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">{post.content}</p>
                        )}
                      </div>

                      {/* Image Component */}
                      {post.image_url && (
                        <div className="px-6 pb-2">
                           <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner">
                              <img src={post.image_url} alt="" className="w-full max-h-[500px] object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
                           </div>
                        </div>
                      )}

                      {/* Stats Overview */}
                      {(post.like_count > 0 || post.comment_count > 0) && (
                        <div className="flex items-center justify-between px-6 py-3 mt-2">
                          <div className="flex items-center gap-2">
                             {post.like_count > 0 && (
                                <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-sm">
                                    <FiHeart className="text-white fill-current w-2.5 h-2.5" />
                                  </div>
                                  <span className="text-xs font-bold text-rose-600">{post.like_count}</span>
                                </div>
                             )}
                          </div>
                          {post.comment_count > 0 && (
                            <button onClick={() => toggleComments(post.id)} className="text-xs font-bold text-gray-500 hover:text-violet-600 transition-colors">
                              {post.comment_count} Ý kiến
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action bar Premium */}
                      <div className="flex border-t border-gray-100 px-6 py-2 gap-2 mt-2">
                        <button
                          onClick={() => handleLike(post)}
                          className={`flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${post.is_liked
                            ? 'text-rose-600 bg-rose-50 shadow-inner border border-rose-100'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100'
                            }`}
                        >
                          <FiHeart size={18} className={post.is_liked ? 'fill-current' : ''} />
                          {post.is_liked ? 'Hữu Ích' : 'Cổ vũ'}
                        </button>

                        <button
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100 rounded-xl transition-all duration-300"
                        >
                          <FiMessageCircle size={18} />
                          Thảo luận
                        </button>

                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: `Bài viết của ${post.author_name}`, text: post.content.substring(0, 100) }).catch(() => { });
                            } else {
                              navigator.clipboard.writeText(window.location.href).then(() => alert('Đã sao chép link!'));
                            }
                          }}
                          className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100 rounded-xl transition-all duration-300"
                        >
                          <FiShare2 size={18} />
                        </button>
                      </div>

                      {/* Comments UI Upgrade */}
                      {openComments.has(post.id) && (
                        <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-5">
                          {isAuth && (
                            <div className="flex gap-4 items-start mb-6">
                              <Avatar src={user?.avatar} name={user?.full_name} size={36} />
                              <div className="flex-1 relative group">
                                <textarea
                                  value={commentText[post.id] || ''}
                                  onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="Nhập ý kiến của bạn..."
                                  rows={1}
                                  className="w-full bg-white rounded-2xl border border-gray-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 px-5 py-3 pr-12 text-[15px] font-medium text-gray-800 outline-none placeholder-gray-400 shadow-sm resize-none"
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                                />
                                <button
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={!commentText[post.id]?.trim()}
                                  className="absolute right-2 bottom-2 p-2 rounded-xl bg-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white disabled:opacity-0 disabled:scale-75 transition-all duration-300"
                                >
                                  <FiSend size={16} />
                                </button>
                              </div>
                            </div>
                          )}

                          {commentLoading.has(post.id) ? (
                            <div className="flex justify-center py-6">
                              <div className="w-8 h-8 relative">
                                <div className="w-8 h-8 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin"></div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {(comments[post.id] || []).map(c => (
                                <div key={c.id} className="flex gap-4 items-start">
                                  <Avatar src={c.author_avatar} name={c.author_name} size={36} />
                                  <div className="flex-1">
                                    <div className="inline-block bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-5 py-3">
                                      <p className="text-[13px] font-black text-gray-900 mb-1">{c.author_name}</p>
                                      <p className="text-[14px] text-gray-700 leading-snug font-medium">{c.content}</p>
                                    </div>
                                    <p className="text-[11px] font-bold text-gray-400 ml-2 mt-1.5">{timeAgo(c.created_at)}</p>
                                  </div>
                                </div>
                              ))}
                              {comments[post.id]?.length === 0 && (
                                <div className="text-center py-6">
                                  <span className="text-3xl grayscale opacity-50 block mb-2">🎈</span>
                                  <p className="text-[13px] font-bold text-gray-400">Trở thành người bình luận đầu tiên</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))
              }

              {/* Load more */}
              {!loading && hasMore && posts.length > 0 && (
                <div className="text-center pt-4 pb-8">
                  <button
                    onClick={() => loadPosts(posts.length)}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center gap-2 min-w-[200px] h-12 bg-white/80 backdrop-blur-md border border-violet-200 hover:bg-violet-50 hover:border-violet-300 text-violet-700 text-sm font-black tracking-wide uppercase rounded-[1rem] shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-50"
                  >
                    {loadingMore ? <FiLoader size={18} className="animate-spin" /> : <FiChevronDown size={18} />}
                    {loadingMore ? 'Đang Lấy Dữ Liệu' : 'Tải Thêm Cập Nhật'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar Right Premium ── */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-6 self-start sticky top-[120px]">

            {/* Community Stats Card - Glassmorphism */}
            <div className="bg-white/80 backdrop-blur-2xl rounded-[2rem] border border-white/50 p-6 shadow-xl shadow-gray-200/40 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full pointer-events-none" />
               <div className="flex items-center gap-3 mb-6 relative z-10">
                 <div className="w-10 h-10 rounded-[1rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                   <FiGlobe size={20} className="text-white" />
                 </div>
                 <div>
                   <h3 className="font-black text-gray-900 text-base">Toàn cảnh CSCA</h3>
                   <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Hệ sinh thái</p>
                 </div>
               </div>
               
               <div className="space-y-4 relative z-10">
                 {QUICK_STATS.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                     <div key={i} className="flex gap-4 items-center group">
                       <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 ${stat.color} transition-transform group-hover:scale-110`}>
                         <Icon size={20} />
                       </div>
                       <div>
                         <p className="text-sm font-black text-gray-900 group-hover:text-violet-600 transition-colors">{stat.label}</p>
                         <p className="text-xs font-medium text-gray-500 mt-0.5">{stat.sub}</p>
                       </div>
                     </div>
                   );
                 })}
               </div>

               {!isAuth && mounted && (
                 <div className="mt-6 pt-6 border-t border-gray-100">
                    <Link href="/auth" className="flex items-center justify-center w-full py-3.5 bg-gray-900 text-white hover:bg-gray-800 text-sm font-bold rounded-xl transition-colors shadow-lg">
                      Đăng Ký Thành Viên
                    </Link>
                 </div>
               )}
            </div>

            {/* Popular Topics Card */}
            <div className="bg-white/80 backdrop-blur-2xl rounded-[2rem] border border-white/50 p-6 shadow-xl shadow-gray-200/40">
              <h3 className="font-black text-gray-900 text-base mb-5 flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-orange-500 rounded-lg"><FiTrendingUp size={16} /></div>
                Xu hướng thao luận
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {TAGS.slice(1).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className="px-4 py-2 hover:scale-105 transition-transform bg-gray-50 hover:bg-white border border-gray-100 hover:border-violet-200 rounded-xl flex items-center gap-1.5 group shadow-sm hover:shadow-md"
                  >
                    <span className="text-violet-400 group-hover:text-violet-600 font-bold">#</span>
                    <span className="text-xs font-bold text-gray-700 group-hover:text-gray-900">{tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Master Tip / Inspiration Ad Card */}
            <div className="rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 via-purple-800 to-fuchsia-700 transition-transform duration-700 group-hover:scale-110" />
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay" />
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
               
               <div className="relative z-10 flex flex-col items-start gap-4">
                 <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-[1rem] flex items-center justify-center border border-white/30 shadow-lg">
                   <span className="text-xl">🎓</span>
                 </div>
                 <div>
                    <h4 className="text-white font-black text-lg mb-2">Du học sinh tương lai</h4>
                    <p className="text-purple-100 text-[13px] leading-relaxed font-medium">Bạn có biết 85% học viên tích cực tương tác trên CSCA đạt được mức điểm học bổng mục tiêu trong 6 tháng? Đừng bỏ lỡ cơ hội rèn luyện nhé.</p>
                 </div>
                 <button className="px-5 py-2 mt-2 bg-white/20 backdrop-blur-md border border-white/50 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-white/30 transition-colors">
                   Khám phá khoá học
                 </button>
               </div>
            </div>

          </div>
        </div>
      </main>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// Re-export required icons from fi that might have been missing
import { FiGlobe } from 'react-icons/fi';
