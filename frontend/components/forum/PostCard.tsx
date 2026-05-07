'use client';

import { useState, useRef, useCallback } from 'react';
import {
  FiHeart, FiMessageCircle, FiShare2, FiMoreHorizontal,
  FiEdit2, FiTrash2, FiSend, FiLoader, FiX
} from 'react-icons/fi';
import { useAuthStore } from '@/lib/store/authStore';
import * as postsApi from '@/lib/api/posts';
import type { Post } from '@/lib/api/posts';
import PostAuthor from './PostAuthor';
import UserProfileCard from './UserProfileCard';

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
  const [authorCardOpen, setAuthorCardOpen] = useState(false);
  const [authorRef, setAuthorRef] = useState<HTMLDivElement | null>(null);
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

  return (
    <article className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white shadow-lg shadow-gray-200/40 overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/60 hover:-translate-y-1">

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 mb-4">
        <div ref={setAuthorRef} className="relative">
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

        {/* Author profile card */}
        {authorCardOpen && (
          <UserProfileCard
            userId={post.user_id}
            anchorRef={{ current: authorRef } as React.RefObject<HTMLElement>}
            onClose={() => setAuthorCardOpen(false)}
          />
        )}

        {isOwn && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <FiMoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-2 z-20 animate-in zoom-in-95 duration-200">
                <button onClick={handleEdit} className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-violet-50 hover:text-violet-600 font-bold text-sm rounded-xl transition-colors">
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
            <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 p-4 transition-all">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={4}
                className="resize-none overflow-hidden w-full bg-transparent outline-none text-[15px] text-gray-800 leading-relaxed font-medium"
                onInput={e => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }}
              />
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

      {/* Image */}
      {post.image_url && (
        <div className="px-6 pb-2">
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner">
            <img src={post.image_url} alt="" className="w-full max-h-[500px] object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
          </div>
        </div>
      )}

      {/* Stats */}
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
            <button onClick={() => onToggleComments?.(post.id)} className="text-xs font-bold text-gray-500 hover:text-violet-600 transition-colors">
              {post.comment_count} Ý kiến
            </button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex border-t border-gray-100 px-6 py-2 gap-2 mt-2">
        <button
          onClick={() => onLike?.(post)}
          className={`flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${post.is_liked
            ? 'text-rose-600 bg-rose-50 shadow-inner border border-rose-100'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100'
            }`}
        >
          <FiHeart size={18} className={post.is_liked ? 'fill-current' : ''} />
          {post.is_liked ? 'Hữu Ích' : 'Cổ vũ'}
        </button>

        <button
          onClick={() => onToggleComments?.(post.id)}
          className="flex items-center justify-center gap-2 flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100 rounded-xl transition-all duration-300"
        >
          <FiMessageCircle size={18} />
          Thảo luận
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `Bài viết của ${post.author_name}`, text: post.content.substring(0, 100) }).catch(() => {});
            } else {
              navigator.clipboard.writeText(window.location.href).then(() => alert('Đã sao chép link!'));
            }
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-100 rounded-xl transition-all duration-300"
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
  const [avatarRef, setAvatarRef] = useState<HTMLDivElement | null>(null);
  const [showAvatarCard, setShowAvatarCard] = useState(false);
  const [cardUserId, setCardUserId] = useState<number | null>(null);
  const [cardAnchor, setCardAnchor] = useState<HTMLDivElement | null>(null);
  const cardAnchorRef = useRef<HTMLDivElement | null>(null);
  const currentUserAvatarRef = useRef<HTMLDivElement>(null);

  const getAvatarUrl = (avatar?: string | null, avatarUrl?: string | null, name?: string, size = 36) =>
    avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '')}&background=random&size=${size * 2}`;

  const openProfileCard = (userId: number, anchorEl: HTMLDivElement | null) => {
    setCardUserId(userId);
    cardAnchorRef.current = anchorEl;
    setCardAnchor(anchorEl);
    setShowAvatarCard(true);
  };

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
    <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-5">
      {/* Comment input */}
      {isAuthenticated && (
        <div className="flex gap-4 items-start mb-6">
          <div
            ref={currentUserAvatarRef}
            className="shrink-0"
          >
            <img
              src={getAvatarUrl(user?.avatar, user?.avatar_url, user?.full_name, 36)}
              alt=""
              className="w-9 h-9 rounded-2xl object-cover"
            />
          </div>
          <div className="flex-1 relative group">
            {isReplyingTo && (
              <div className="absolute -top-6 left-2 flex items-center gap-2 text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1 rounded-t-lg">
                <span>Đang phản hồi {replyName}</span>
                <button onClick={() => onSetReplyingTo?.(null)} className="hover:text-red-500 ml-1">
                  <FiX size={14} />
                </button>
              </div>
            )}
            <textarea
              value={currentText}
              onChange={e => onCommentTextChange?.(post.id, e.target.value)}
              placeholder={isReplyingTo ? `Phản hồi ${replyName}...` : "Nhập ý kiến của bạn..."}
              rows={1}
              className={`w-full bg-white rounded-2xl border ${isReplyingTo ? 'border-violet-300 rounded-tl-none' : 'border-gray-200'} focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 px-5 py-3 pr-12 text-[15px] font-medium text-gray-800 outline-none placeholder-gray-400 shadow-sm resize-none`}
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
              className="absolute right-2 bottom-2 p-2 rounded-xl bg-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white disabled:opacity-0 disabled:scale-75 transition-all duration-300"
            >
              <FiSend size={16} />
            </button>
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
              onOpenProfileCard={openProfileCard}
            />
          ))}

          {comments.length === 0 && (
            <div className="text-center py-6">
              <span className="text-3xl grayscale opacity-50 block mb-2">🎈</span>
              <p className="text-[13px] font-bold text-gray-400">Trở thành người bình luận đầu tiên</p>
            </div>
          )}
        </div>
      )}

      {showAvatarCard && cardUserId && cardAnchor && (
        <UserProfileCard
          userId={cardUserId}
          anchorRef={cardAnchorRef as React.RefObject<HTMLElement | null>}
          onClose={() => setShowAvatarCard(false)}
        />
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
  onOpenProfileCard,
}: {
  comment: postsApi.Comment;
  postId: number;
  replies: postsApi.Comment[];
  onLikeComment?: (postId: number, comment: postsApi.Comment) => void;
  onSetReplyingTo?: (val: { postId: number; commentId: number; userId: number; userName: string } | null | undefined) => void;
  replyingTo?: { postId: number; commentId: number; userId: number; userName: string } | null | undefined;
  onOpenProfileCard?: (userId: number, anchorEl: HTMLDivElement | null) => void;
}) {
  const [avatarEl, setAvatarEl] = useState<HTMLDivElement | null>(null);

  const getAvatarUrl = (avatar?: string | null, avatarUrl?: string | null, name?: string) =>
    avatarUrl || avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '')}&background=random&size=64`;

  return (
    <div>
      <div className="flex gap-3 items-start">
        <div
          ref={setAvatarEl}
          onClick={() => onOpenProfileCard?.(comment.user_id, avatarEl)}
          className="shrink-0 cursor-pointer"
        >
          <img
            src={getAvatarUrl(comment.author_avatar, comment.author_avatar, comment.author_name)}
            alt=""
            className="w-9 h-9 rounded-2xl object-cover hover:opacity-80 transition-opacity"
          />
        </div>
        <div className="flex-1">
          <div className="inline-block bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-2">
            <p className="text-[13px] font-black text-gray-900 mb-0.5">{comment.author_name}</p>
            <p className="text-[14px] text-gray-700 leading-snug font-medium">
              {comment.reply_to_user_name && (
                <span className="font-bold text-violet-600 mr-1.5">@{comment.reply_to_user_name}</span>
              )}
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-2 mt-1.5 text-[11px] font-bold">
            <span className="text-gray-400">{timeAgo(comment.created_at)}</span>
            <button
              onClick={() => onLikeComment?.(postId, comment)}
              className={`transition-colors ${comment.is_liked ? 'text-rose-500' : 'text-gray-500 hover:text-gray-900'}`}
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
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Phản hồi
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-10 border-l-2 border-gray-100 pl-4 mt-3 space-y-3">
          {replies.map(r => (
            <div key={r.id} className="flex gap-3 items-start">
              <div
                onClick={() => onOpenProfileCard?.(r.user_id, null)}
                className="shrink-0 cursor-pointer"
              >
                <img
                  src={getAvatarUrl(r.author_avatar, r.author_avatar, r.author_name)}
                  alt=""
                  className="w-7 h-7 rounded-xl object-cover hover:opacity-80 transition-opacity"
                />
              </div>
              <div className="flex-1">
                <div className="inline-block bg-white border border-gray-100 shadow-sm rounded-2xl px-3 py-1.5">
                  <p className="text-[12px] font-black text-gray-900 mb-0.5">{r.author_name}</p>
                  <p className="text-[13px] text-gray-700 leading-snug font-medium">
                    {r.reply_to_user_name && (
                      <span className="font-bold text-violet-600 mr-1">@{r.reply_to_user_name}</span>
                    )}
                    {r.content}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-1 mt-1 text-[10px] font-bold">
                  <span className="text-gray-400">{timeAgo(r.created_at)}</span>
                  <button
                    onClick={() => onLikeComment?.(postId, r)}
                    className={`transition-colors ${r.is_liked ? 'text-rose-500' : 'text-gray-500 hover:text-gray-900'}`}
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
                    className="text-gray-500 hover:text-gray-900 transition-colors"
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
