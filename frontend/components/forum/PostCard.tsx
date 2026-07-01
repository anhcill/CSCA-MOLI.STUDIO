'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal,
  FiEdit2, FiTrash2, FiSend, FiLoader, FiX
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import * as postsApi from '@/lib/api/posts';
import type { Post } from '@/lib/api/posts';
import PostAuthor from './PostAuthor';

const isAdminRole = (role?: string | null) =>
  ['admin', 'super_admin', 'forum_admin', 'exam_admin', 'content_admin', 'user_admin', 'roadmap_admin'].includes(String(role || '').toLowerCase());

function AminBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'} shrink-0 rounded-md bg-emerald-100 font-black text-emerald-700`}>
      Amin
    </span>
  );
}

function timeAgo(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

interface Props {
  post: Post;
  onDelete?: (postId: number) => void;
  onUpdate?: (post: Post) => void;
  onLike?: (post: Post) => void;
  likePending?: boolean;
  onToggleComments?: (postId: number) => void;
  openComments?: boolean;
  comments?: postsApi.Comment[];
  commentText?: string;
  commentLoading?: boolean;
  replyingTo?: { postId: number; commentId: number; userId: number; userName: string } | null | undefined;
  onSetReplyingTo?: (val: { postId: number; commentId: number; userId: number; userName: string } | null | undefined) => void;
  onCommentTextChange?: (postId: number, text: string) => void;
  onAddComment?: (postId: number) => void;
  onLikeComment?: (postId: number, comment: postsApi.Comment) => void;
}

export default function PostCard({
  post,
  onDelete,
  onUpdate,
  onLike,
  likePending = false,
  onToggleComments,
  openComments = false,
  comments = [],
  commentText = '',
  commentLoading = false,
  replyingTo,
  onSetReplyingTo,
  onCommentTextChange,
  onAddComment,
  onLikeComment,
}: Props) {
  const { user, isAuthenticated } = useAuthStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleEdit = () => {
    setEditingId(post.id);
    setEditContent(post.content);
    setMenuOpen(false);
  };

  const handleCancelEdit = () => { setEditingId(null); setEditContent(''); };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    try {
      const updated = await postsApi.updatePost(post.id, { content: editContent.trim() });
      onUpdate?.(updated);
      setEditingId(null);
      setEditContent('');
    } catch { alert('Lỗi khi cập nhật bài viết'); }
  };

  const handleDeleteConfirm = () => {
    setMenuOpen(false);
    if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
    postsApi.deletePost(post.id)
      .then(() => onDelete?.(post.id))
      .catch(() => alert('Lỗi khi xóa bài viết'));
  };

  const isOwn = user?.id === post.user_id;
  const likeCount = Number(post.like_count || 0);
  const commentCount = Number(post.comment_count || 0);

  return (
    <article id={`post-${post.id}`} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[2rem] border border-white dark:border-slate-800 shadow-lg shadow-gray-200/40 dark:shadow-black/30 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/60 dark:hover:shadow-black/40 hover:-translate-y-1 scroll-mt-28">

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 mb-4">
        <div>
          <PostAuthor
            userId={post.user_id}
            name={post.author_name || 'Học viên Ẩn danh'}
            avatar={post.author_avatar}
            avatarUrl={post.author_avatar}
            time={timeAgo(post.created_at)}
            role={post.author_role}
            isVip={post.author_is_vip}
          />
        </div>

        {isOwn && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FiMoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-2 z-20 animate-in zoom-in-95 duration-200">
                <button onClick={handleEdit} className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600 dark:hover:text-violet-300 font-bold text-sm rounded-xl transition-colors">
                  <FiEdit2 size={16} /> Chỉnh sửa
                </button>
                <button onClick={handleDeleteConfirm} className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 font-bold text-sm rounded-xl transition-colors mt-1">
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
             <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 p-4 transition-all">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={4}
                 className="resize-none overflow-hidden w-full bg-transparent outline-none text-[15px] text-gray-800 dark:text-slate-100 leading-relaxed font-medium"
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCancelEdit}
                className="px-5 py-2.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm font-bold rounded-xl transition-colors">
                Hủy sửa
              </button>
              <button onClick={handleUpdate} disabled={!editContent.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-violet-500/30">
                Cập nhật
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-800 dark:text-slate-100 text-base leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="px-6 pb-2">
          <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-inner">
            <img src={post.image_url} alt="" className="w-full max-h-[500px] object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
          </div>
        </div>
      )}

      {/* Stats */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between px-6 py-3 mt-2">
          <div className="flex items-center gap-2">
            {likeCount > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-sm">
                  <FiHeart className="text-white fill-current w-2.5 h-2.5" />
                </div>
                <span className="text-xs font-bold text-rose-600">{likeCount}</span>
              </div>
            )}
          </div>
          {commentCount > 0 && (
            <button onClick={() => onToggleComments?.(post.id)} className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors">
              {commentCount} Ý kiến
            </button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex border-t border-gray-100 dark:border-slate-800 px-6 py-2 gap-2 mt-2">
        <button
          onClick={() => onLike?.(post)}
          disabled={likePending}
          className={`flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${post.is_liked
            ? 'text-rose-600 bg-rose-50 shadow-inner border border-rose-100'
            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-transparent hover:border-gray-100 dark:hover:border-slate-700'
            } ${likePending ? 'opacity-70 cursor-wait' : ''}`}
        >
          {likePending ? <FiLoader size={18} className="animate-spin" /> : <FiHeart size={18} className={post.is_liked ? 'fill-current' : ''} />}
          {post.is_liked ? 'Hữu Ích' : 'Cổ vũ'}
          {likeCount > 0 && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-rose-600">{likeCount}</span>}
        </button>

        <button
          onClick={() => onToggleComments?.(post.id)}
          className="flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-transparent hover:border-gray-100 dark:hover:border-slate-700 rounded-xl transition-all duration-300"
        >
          <FiMessageCircle size={18} />
          Thảo luận
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `Bài viết của ${post.author_name}`, text: post.content.substring(0, 100), url: `${window.location.origin}${window.location.pathname}#post-${post.id}` }).catch(() => {});
            } else {
              navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#post-${post.id}`).then(() => alert('Đã sao chép link!'));
            }
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white border border-transparent hover:border-gray-100 dark:hover:border-slate-700 rounded-xl transition-all duration-300"
        >
          <FiShare2 size={18} />
        </button>
      </div>

      {/* Comments section */}
      {openComments && (
        <CommentsSection
          post={post}
          comments={comments}
          commentText={commentText}
          commentLoading={commentLoading}
          replyingTo={replyingTo}
          onSetReplyingTo={onSetReplyingTo}
          onCommentTextChange={onCommentTextChange}
          onAddComment={onAddComment}
          onLikeComment={onLikeComment}
        />
      )}
    </article>
  );
}

/* ─── Comments Section ─────────────────────────────────────────────────────── */
function CommentsSection({
  post,
  comments,
  commentText,
  commentLoading,
  replyingTo,
  onSetReplyingTo,
  onCommentTextChange,
  onAddComment,
  onLikeComment,
}: {
  post: Post;
  comments: postsApi.Comment[];
  commentText: string;
  commentLoading: boolean;
  replyingTo: { postId: number; commentId: number; userId: number; userName: string } | null | undefined;
  onSetReplyingTo?: (val: { postId: number; commentId: number; userId: number; userName: string } | null | undefined) => void;
  onCommentTextChange?: (postId: number, text: string) => void;
  onAddComment?: (postId: number) => void;
  onLikeComment?: (postId: number, comment: postsApi.Comment) => void;
}) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const getAvatarUrl = (avatar?: string | null, avatarUrl?: string | null, name?: string, size = 36) =>
    avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '')}&background=random&size=${size * 2}`;

  const parents = comments.filter(c => !c.parent_id);
  const childrenMap = new Map<number, postsApi.Comment[]>();
  comments.forEach(c => {
    if (c.parent_id) {
      const arr = childrenMap.get(c.parent_id) || [];
      arr.push(c);
      childrenMap.set(c.parent_id, arr);
    }
  });

  const isReplyingTo = replyingTo?.postId === post.id;
  const replyName = isReplyingTo ? replyingTo.userName : '';
  const currentText = commentText || '';

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950/40 border-t border-gray-100 dark:border-slate-800 px-6 py-5">
      {/* Comment input */}
      {isAuthenticated && (
        <div className="flex gap-3 items-start mb-6">
          <div className="shrink-0">
            <img
              src={getAvatarUrl(user?.avatar, user?.avatar_url, user?.full_name, 36)}
              alt=""
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          </div>
          <div className="flex-1 min-w-0">
            {isReplyingTo && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-[12px] font-bold text-violet-700 shadow-sm">
                <span className="truncate">Đang phản hồi {replyName}</span>
                <button
                  onClick={() => onSetReplyingTo?.(null)}
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-violet-500 transition-colors hover:bg-white hover:text-red-500"
                  aria-label="Hủy phản hồi"
                >
                  <FiX size={13} />
                </button>
              </div>
            )}
            <div className="relative">
              <textarea
                value={currentText}
                onChange={e => onCommentTextChange?.(post.id, e.target.value)}
                placeholder={isReplyingTo ? `Phản hồi ${replyName}...` : "Viết bình luận..."}
                rows={1}
                className="w-full resize-none rounded-[1.25rem] border border-gray-200 bg-white px-4 py-3 pr-12 text-[15px] font-medium text-gray-800 outline-none shadow-sm transition placeholder:text-gray-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddComment?.(post.id); } }}
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
              />
              <button
                onClick={() => onAddComment?.(post.id)}
                disabled={!currentText.trim()}
                className="absolute bottom-2.5 right-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm transition-all hover:bg-violet-700 disabled:pointer-events-none disabled:scale-90 disabled:opacity-0"
              >
                <FiSend size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment list */}
      {commentLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-8 h-8 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {parents.map(p => (
            <CommentThread
              key={p.id}
              comment={p}
              postId={post.id}
              replies={childrenMap.get(p.id) || []}
              onLikeComment={onLikeComment}
              onSetReplyingTo={onSetReplyingTo}
              replyingTo={replyingTo}
            />
          ))}

          {comments.length === 0 && (
            <div className="text-center py-6">
              <span className="text-3xl grayscale opacity-50 block mb-2">🎈</span>
              <p className="text-[13px] font-bold text-gray-400 dark:text-slate-500">Trở thành người bình luận đầu tiên</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Comment Thread ───────────────────────────────────────────────────────── */
function CommentThread({
  comment,
  postId,
  replies,
  onLikeComment,
  onSetReplyingTo,
  replyingTo,
}: {
  comment: postsApi.Comment;
  postId: number;
  replies: postsApi.Comment[];
  onLikeComment?: (postId: number, comment: postsApi.Comment) => void;
  onSetReplyingTo?: (val: { postId: number; commentId: number; userId: number; userName: string } | null | undefined) => void;
  replyingTo?: { postId: number; commentId: number; userId: number; userName: string } | null | undefined;
}) {
  const router = useRouter();

  const getAvatarUrl = (avatar?: string | null, avatarUrl?: string | null, name?: string) =>
    avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '')}&background=random&size=64`;

  return (
    <div>
      <div className="flex gap-3 items-start">
        <div
          onClick={() => router.push(`/profile/user/${comment.user_id}`)}
          className="shrink-0 cursor-pointer"
        >
          <img
            src={getAvatarUrl(comment.author_avatar, comment.author_avatar, comment.author_name)}
            alt=""
            className="w-9 h-9 rounded-full object-cover hover:opacity-80 transition-opacity ring-2 ring-white shadow-sm"
          />
        </div>
        <div className="flex-1">
          <div className="inline-block max-w-full rounded-[1.15rem] bg-slate-100 px-4 py-2.5 text-left shadow-sm dark:bg-slate-800">
            <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[13px] font-black text-gray-900 dark:text-white">
              <span className="truncate">{comment.author_name}</span>
              {isAdminRole(comment.author_role) && <AminBadge compact />}
            </p>
            <p className="text-[14px] text-gray-700 dark:text-slate-200 leading-snug font-medium">
              {comment.reply_to_user_name && (
                <span className="font-bold text-violet-600 mr-1.5">@{comment.reply_to_user_name}</span>
              )}
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-2 mt-1.5 text-[11px] font-bold text-gray-500">
            <span className="text-gray-400 dark:text-slate-500">{timeAgo(comment.created_at)}</span>
            <button
              onClick={() => onLikeComment?.(postId, comment)}
              className={`transition-colors ${comment.is_liked ? 'text-rose-500' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Thích {Number(comment.like_count) > 0 && `(${comment.like_count})`}
            </button>
            <button
              onClick={() => onSetReplyingTo?.({
                postId,
                commentId: comment.parent_id ?? comment.id,
                userId: comment.user_id,
                userName: comment.author_name,
              })}
              className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Phản hồi
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-10 border-l border-gray-200/80 pl-4 mt-3 space-y-3 dark:border-slate-700">
          {replies.map(r => (
            <div key={r.id} className="flex gap-3 items-start">
              <div
                onClick={() => router.push(`/profile/user/${r.user_id}`)}
                className="shrink-0 cursor-pointer"
              >
                <img
                  src={getAvatarUrl(r.author_avatar, r.author_avatar, r.author_name)}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover hover:opacity-80 transition-opacity ring-2 ring-white shadow-sm"
                />
              </div>
              <div className="flex-1">
                <div className="inline-block max-w-full rounded-[1.05rem] bg-white px-3 py-1.5 shadow-sm dark:bg-slate-800">
                  <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[12px] font-black text-gray-900 dark:text-white">
                    <span className="truncate">{r.author_name}</span>
                    {isAdminRole(r.author_role) && <AminBadge compact />}
                  </p>
                  <p className="text-[13px] text-gray-700 dark:text-slate-200 leading-snug font-medium">
                    {r.reply_to_user_name && (
                      <span className="font-bold text-violet-600 mr-1">@{r.reply_to_user_name}</span>
                    )}
                    {r.content}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-1 mt-1 text-[10px] font-bold text-gray-500">
                  <span className="text-gray-400 dark:text-slate-500">{timeAgo(r.created_at)}</span>
                  <button
                    onClick={() => onLikeComment?.(postId, r)}
                    className={`transition-colors ${r.is_liked ? 'text-rose-500' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    Thích {Number(r.like_count) > 0 && `(${r.like_count})`}
                  </button>
                  <button
                    onClick={() => onSetReplyingTo?.({
                      postId,
                      commentId: r.parent_id!,
                      userId: r.user_id,
                      userName: r.author_name,
                    })}
                    className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Phản hồi
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
