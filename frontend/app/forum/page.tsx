'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal,
  FiEdit2, FiTrash2, FiSend, FiLoader, FiChevronDown,
  FiFeather, FiZap, FiTrendingUp, FiUsers, FiBookOpen,
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import * as postsApi from '@/lib/api/posts';
import type { Post } from '@/lib/api/posts';
import Link from 'next/link';
import Header from '@/components/layout/Header';

const TAGS = ['Tất cả', 'HSK', 'Toán', 'Vật Lý', 'Hóa Học', 'Tiếng Anh', 'Kinh nghiệm', 'Học bổng', 'Chia sẻ'];

const TAG_COLORS: Record<string, string> = {
  'Tất cả': 'from-violet-500 to-purple-600',
  'HSK': 'from-red-400 to-rose-500',
  'Toán': 'from-blue-400 to-cyan-500',
  'Vật Lý': 'from-indigo-400 to-blue-500',
  'Hóa Học': 'from-emerald-400 to-teal-500',
  'Tiếng Anh': 'from-orange-400 to-amber-500',
  'Kinh nghiệm': 'from-pink-400 to-rose-500',
  'Học bổng': 'from-yellow-400 to-orange-400',
  'Chia sẻ': 'from-purple-400 to-violet-500',
};

const QUICK_STATS = [
  { icon: FiUsers, label: '10,000+ học viên', color: 'text-violet-500' },
  { icon: FiTrendingUp, label: 'Cộng đồng sôi nổi', color: 'text-pink-500' },
  { icon: FiBookOpen, label: 'Ôn thi hiệu quả', color: 'text-cyan-500' },
];

/* ─── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name, size = 40 }: { src?: string; name?: string; size?: number }) {
  return src ? (
    <img src={src} alt={name} width={size} height={size}
      className="rounded-full object-cover shrink-0 ring-2 ring-white"
      style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 select-none ring-2 ring-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
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
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/80 p-5 space-y-4 animate-pulse shadow-sm">
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-28 bg-gray-200 rounded-full" />
          <div className="h-2.5 w-16 bg-gray-100 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded-full w-full" />
        <div className="h-3 bg-gray-200 rounded-full w-5/6" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
      </div>
      <div className="flex gap-3 pt-1">
        <div className="h-8 w-20 bg-gray-100 rounded-xl" />
        <div className="h-8 w-24 bg-gray-100 rounded-xl" />
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
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #f0f4ff 0%, #faf0ff 40%, #fff0f8 70%, #f0fbff 100%)'
    }}>
      <Header />

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'rgba(139,92,246,0.1)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Brand mark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <FiZap size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent hidden sm:block">
              Diễn Đàn
            </span>
          </div>
          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* Tag pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${activeTag === tag
                  ? `bg-gradient-to-r ${TAG_COLORS[tag] || 'from-violet-500 to-purple-600'} text-white shadow-md scale-105`
                  : 'bg-white text-gray-500 hover:bg-violet-50 hover:text-violet-600 border border-gray-200'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* ── Feed column ── */}
          <div className="space-y-4">

            {/* ── Composer ── */}
            {isAuth ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-md overflow-hidden"
                style={{ boxShadow: '0 4px 24px rgba(139,92,246,0.08)' }}>
                {!composerOpen ? (
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-violet-50/50 transition-all"
                  >
                    <Avatar src={user?.avatar} name={user?.full_name} size={40} />
                    <span className="flex-1 text-sm text-gray-400 bg-gray-50 hover:bg-violet-50 rounded-full px-4 py-2.5 transition-all border border-gray-100">
                      {user?.full_name?.split(' ').pop() || 'Bạn'} đang nghĩ gì? ✨
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-sm">
                      <FiFeather size={15} className="text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="p-5 space-y-4">
                    <div className="flex gap-3 items-center">
                      <Avatar src={user?.avatar} name={user?.full_name} size={42} />
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user?.full_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          <p className="text-xs text-gray-400">Đang đăng ở Diễn đàn CSCA</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 p-3.5 transition-all bg-gray-50/50">
                      <AutoTextarea
                        value={newPost}
                        onChange={setNewPost}
                        placeholder="Chia sẻ kinh nghiệm, câu hỏi, hay bất cứ điều gì... 🚀"
                        className="text-sm text-gray-800 placeholder-gray-400 leading-relaxed min-h-[80px]"
                        minRows={3}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreate(); }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Ctrl+Enter để đăng nhanh</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setComposerOpen(false); setNewPost(''); }}
                          className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleCreate}
                          disabled={!newPost.trim() || submitting}
                          className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-violet-200"
                        >
                          {submitting ? <FiLoader size={14} className="animate-spin" /> : <FiSend size={14} />}
                          Đăng bài
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              mounted && (
                <div className="rounded-2xl overflow-hidden shadow-md" style={{ boxShadow: '0 4px 24px rgba(139,92,246,0.12)' }}>
                  <div className="bg-gradient-to-r from-violet-600 to-pink-500 p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-white text-base">Tham gia cộng đồng CSCA 🎉</p>
                      <p className="text-xs text-violet-200 mt-0.5">Đăng nhập để chia sẻ và kết nối cùng 10,000+ học viên</p>
                    </div>
                    <Link href="/auth"
                      className="shrink-0 px-5 py-2.5 bg-white hover:bg-gray-50 text-violet-600 text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      Đăng nhập
                    </Link>
                  </div>
                </div>
              )
            )}

            {/* ── Feed ── */}
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)
              : posts.length === 0
                ? (
                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white py-20 text-center shadow-sm">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="font-bold text-gray-700 text-lg">Chưa có bài viết nào</p>
                    <p className="text-sm text-gray-400 mt-2">Hãy là người đầu tiên chia sẻ! 🚀</p>
                  </div>
                )
                : posts.map(post => (
                  <article key={post.id}
                    className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/90 shadow-sm overflow-hidden group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                    style={{ boxShadow: '0 2px 16px rgba(139,92,246,0.06)' }}>

                    {/* Header */}
                    <div className="flex items-start justify-between px-5 pt-5">
                      <div className="flex gap-3 items-center">
                        <Avatar src={post.author_avatar} name={post.author_name} size={44} />
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{post.author_name || 'Ẩn danh'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(post.created_at)}</p>
                        </div>
                      </div>

                      {isAuth && user?.id === post.user_id && (
                        <div className="relative" ref={menuPost === post.id ? menuRef : undefined}>
                          <button
                            onClick={() => setMenuPost(menuPost === post.id ? null : post.id)}
                            className="p-2 rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <FiMoreHorizontal size={17} />
                          </button>
                          {menuPost === post.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 text-sm">
                              <button onClick={() => handleEdit(post)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
                                <FiEdit2 size={14} className="text-violet-500" /> Chỉnh sửa
                              </button>
                              <button onClick={() => handleDelete(post.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-500 hover:bg-red-50 transition-colors">
                                <FiTrash2 size={14} /> Xóa bài
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="px-5 mt-3.5">
                      {editingId === post.id ? (
                        <div className="space-y-2">
                          <div className="bg-gray-50 rounded-xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 px-4 py-3 transition-all">
                            <AutoTextarea value={editContent} onChange={setEditContent}
                              className="text-sm text-gray-800 leading-relaxed" minRows={3} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleUpdate} disabled={!editContent.trim()}
                              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition-all">
                              Lưu thay đổi
                            </button>
                            <button onClick={handleCancelEdit}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium rounded-lg transition-colors">
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-800 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      )}
                    </div>

                    {/* Image */}
                    {post.image_url && (
                      <div className="mt-4 overflow-hidden">
                        <img src={post.image_url} alt="" className="w-full max-h-[480px] object-cover" loading="lazy" />
                      </div>
                    )}

                    {/* Stats row */}
                    {(post.like_count > 0 || post.comment_count > 0) && (
                      <div className="flex items-center gap-3 px-5 pt-3 text-xs text-gray-400">
                        {post.like_count > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-[10px] shadow-sm">❤</span>
                            <span className="font-medium">{post.like_count}</span>
                          </span>
                        )}
                        {post.comment_count > 0 && (
                          <button onClick={() => toggleComments(post.id)} className="hover:text-violet-500 transition-colors ml-auto font-medium">
                            {post.comment_count} bình luận
                          </button>
                        )}
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="flex border-t border-gray-100 mx-4 mt-2 mb-1 gap-1">
                      <button
                        onClick={() => handleLike(post)}
                        className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 ${post.is_liked
                          ? 'text-red-500 bg-red-50'
                          : 'text-gray-500 hover:bg-pink-50 hover:text-pink-500'
                          }`}
                      >
                        <FiHeart size={16} className={post.is_liked ? 'fill-current' : ''} />
                        {post.is_liked ? 'Đã thích' : 'Thích'}
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-blue-50 hover:text-blue-500 rounded-xl transition-all"
                      >
                        <FiMessageCircle size={16} />
                        Bình luận
                      </button>

                      <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({ title: `Bài viết của ${post.author_name}`, text: post.content.substring(0, 100) }).catch(() => { });
                          } else {
                            navigator.clipboard.writeText(window.location.href).then(() => alert('Đã sao chép link!'));
                          }
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-violet-50 hover:text-violet-500 rounded-xl transition-all"
                      >
                        <FiShare2 size={16} />
                        Chia sẻ
                      </button>
                    </div>

                    {/* Comments section */}
                    {openComments.has(post.id) && (
                      <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3">
                        {isAuth && (
                          <div className="flex gap-2.5 items-center">
                            <Avatar src={user?.avatar} name={user?.full_name} size={32} />
                            <div className="flex-1 flex items-center bg-gray-50 rounded-full border border-gray-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 pl-4 pr-1.5 py-1 transition-all">
                              <input
                                type="text"
                                value={commentText[post.id] || ''}
                                onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Viết bình luận..."
                                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment(post.id); } }}
                              />
                              <button
                                onClick={() => handleAddComment(post.id)}
                                disabled={!commentText[post.id]?.trim()}
                                className="p-1.5 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
                              >
                                <FiSend size={12} />
                              </button>
                            </div>
                          </div>
                        )}

                        {commentLoading.has(post.id) ? (
                          <div className="flex justify-center py-3">
                            <FiLoader size={18} className="animate-spin text-violet-400" />
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {(comments[post.id] || []).map(c => (
                              <div key={c.id} className="flex gap-2.5">
                                <Avatar src={c.author_avatar} name={c.author_name} size={32} />
                                <div>
                                  <div className="inline-block bg-gray-50 hover:bg-violet-50/50 rounded-2xl px-3.5 py-2.5 transition-colors">
                                    <p className="text-xs font-bold text-gray-900">{c.author_name}</p>
                                    <p className="text-sm text-gray-700 mt-0.5 leading-snug">{c.content}</p>
                                  </div>
                                  <p className="text-xs text-gray-400 ml-2 mt-1">{timeAgo(c.created_at)}</p>
                                </div>
                              </div>
                            ))}
                            {comments[post.id]?.length === 0 && (
                              <p className="text-center text-xs text-gray-400 py-2">Chưa có bình luận nào 👋</p>
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
              <div className="text-center pb-6">
                <button
                  onClick={() => loadPosts(posts.length)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-violet-200 hover:bg-violet-50 text-violet-600 text-sm font-bold rounded-full shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {loadingMore ? <FiLoader size={14} className="animate-spin" /> : <FiChevronDown size={14} />}
                  {loadingMore ? 'Đang tải...' : 'Xem thêm bài viết'}
                </button>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="hidden lg:flex flex-col gap-4 self-start sticky top-20">

            {/* Community stats */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white p-5 shadow-sm"
              style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.08)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <FiZap size={15} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Cộng đồng CSCA</h3>
              </div>
              <div className="space-y-3">
                {QUICK_STATS.map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center ${color}`}>
                      <Icon size={15} />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">{label}</span>
                  </div>
                ))}
              </div>
              {!isAuth && mounted && (
                <Link href="/auth"
                  className="mt-4 w-full block text-center py-2.5 bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-700 hover:to-pink-600 transition-all active:scale-95 shadow-md shadow-violet-200">
                  Tham gia ngay 🚀
                </Link>
              )}
            </div>

            {/* Popular topics */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white p-5 shadow-sm"
              style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.06)' }}>
              <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <FiTrendingUp size={15} className="text-violet-500" />
                Chủ đề hot 🔥
              </h3>
              <div className="flex flex-wrap gap-2">
                {TAGS.slice(1).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${activeTag === tag
                      ? `bg-gradient-to-r ${TAG_COLORS[tag]} text-white shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600'
                      }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Tip card */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)' }}>
              <div className="p-5">
                <p className="text-white font-bold text-sm mb-1">💡 Tip học tiếng Trung</p>
                <p className="text-violet-100 text-xs leading-relaxed">
                  Học chữ Hán mỗi ngày chỉ 15 phút, kiên trì 30 ngày sẽ nhớ 450 từ vựng cơ bản!
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
