'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiHelpCircle,
  FiLock,
  FiMessageCircle,
  FiRefreshCw,
  FiSend,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey, parseExternalApiError } from '@/lib/api/learning';
import type { ExternalQaStatus, ExternalQaThreadDto } from '@/lib/types/courses';
import RichMathText from '@/components/common/RichMathText';

export interface ExternalQaPanelProps {
  profileId: string | null;
  unitId: string | number;
  isPublicPreviewAccess: boolean;
  initialThreads?: ExternalQaThreadDto[];
  onSummaryChange?: (summary: { total: number; unread: number }) => void;
}

const STATUS_META: Record<ExternalQaStatus, { label: string; className: string }> = {
  open: {
    label: 'Chờ trả lời',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  answered: {
    label: 'Đã trả lời',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  },
  resolved: {
    label: 'Đã giải quyết',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

function isThreadUnread(thread: ExternalQaThreadDto): boolean {
  return Boolean(thread.hasUnread || thread.isUnread || (thread.unreadCount ?? 0) > 0);
}

export function ExternalQaPanel({
  profileId,
  unitId,
  isPublicPreviewAccess,
  initialThreads = [],
  onSummaryChange,
}: ExternalQaPanelProps) {
  const [threads, setThreads] = useState<ExternalQaThreadDto[]>(initialThreads);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflictThreadId, setConflictThreadId] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);

  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const notifySummary = useCallback((list: ExternalQaThreadDto[]) => {
    const unread = list.filter((item) => isThreadUnread(item)).length;
    onSummaryChange?.({ total: list.length, unread });
  }, [onSummaryChange]);

  const loadThreads = useCallback(async () => {
    if (!profileId || isPublicPreviewAccess) return;
    try {
      setLoading(true);
      setError('');
      const list = await learningApi.getExternalUnitQa({ profileId, unitId });
      setThreads(list);
      notifySummary(list);
      setConflictThreadId(null);
      setConflictMessage('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải danh sách hỏi đáp.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [isPublicPreviewAccess, notifySummary, profileId, unitId]);

  useEffect(() => {
    setThreads(initialThreads);
    notifySummary(initialThreads);
    setConflictThreadId(null);
    setConflictMessage('');
    setReplyOpenId(null);
    if (profileId && !isPublicPreviewAccess) {
      void loadThreads();
    }
  }, [initialThreads, isPublicPreviewAccess, loadThreads, notifySummary, profileId, unitId]);

  const upsertThread = (updated: ExternalQaThreadDto) => {
    setThreads((prev) => {
      const exists = prev.some((item) => item.id === updated.id);
      const next = exists
        ? prev.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...prev];
      notifySummary(next);
      return next;
    });
  };

  const handleCreateThread = async () => {
    if (!profileId || isPublicPreviewAccess || creating) return;
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;

    try {
      setCreating(true);
      setError('');
      const created = await learningApi.createExternalUnitQaThread({
        profileId,
        unitId,
        title: cleanTitle,
        body: cleanBody,
        idempotencyKey: generateIdempotencyKey(),
      });
      upsertThread(created);
      setTitle('');
      setBody('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể gửi câu hỏi mới.');
      setError(parsed.message);
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (thread: ExternalQaThreadDto) => {
    if (!profileId || isPublicPreviewAccess || replyBusyId) return;
    const draft = (replyDrafts[thread.id] || '').trim();
    if (!draft) return;

    try {
      setReplyBusyId(thread.id);
      setError('');
      setConflictThreadId(null);
      setConflictMessage('');
      const updated = await learningApi.replyExternalUnitQaThread({
        profileId,
        unitId,
        threadId: thread.id,
        body: draft,
        expectedRevision: thread.revision,
        idempotencyKey: generateIdempotencyKey(),
      });
      upsertThread(updated);
      setReplyDrafts((prev) => ({ ...prev, [thread.id]: '' }));
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể gửi phản hồi.');
      if (parsed.status === 409 || parsed.code === 'REVISION_CONFLICT') {
        setConflictThreadId(thread.id);
        setConflictMessage(
          'Cuộc thảo luận vừa được cập nhật mới hơn. Hãy tải lại để đồng bộ trước khi gửi tiếp (nội dung bạn đang gõ vẫn được giữ lại).',
        );
      } else {
        setError(parsed.message);
      }
    } finally {
      setReplyBusyId(null);
    }
  };

  const handlePatchStatus = async (
    thread: ExternalQaThreadDto,
    nextStatus: ExternalQaStatus,
    markRead?: boolean,
  ) => {
    if (!profileId || isPublicPreviewAccess || statusBusyId) return;
    try {
      setStatusBusyId(thread.id);
      setError('');
      setConflictThreadId(null);
      setConflictMessage('');
      const updated = await learningApi.updateExternalUnitQaStatus({
        profileId,
        unitId,
        threadId: thread.id,
        status: nextStatus,
        ...(markRead !== undefined ? { markRead } : {}),
        expectedRevision: thread.revision,
        idempotencyKey: generateIdempotencyKey(),
      });
      upsertThread(updated);
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể cập nhật trạng thái câu hỏi.');
      if (parsed.status === 409 || parsed.code === 'REVISION_CONFLICT') {
        setConflictThreadId(thread.id);
        setConflictMessage('Trạng thái thảo luận vừa thay đổi ở phiên khác. Vui lòng tải lại.');
      } else {
        setError(parsed.message);
      }
    } finally {
      setStatusBusyId(null);
    }
  };

  if (isPublicPreviewAccess || !profileId) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <FiLock className="shrink-0 text-base" />
        <span>Đăng ký khóa học để đặt câu hỏi trực tiếp cho giảng viên tại bài học này.</span>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-[#18243b] dark:text-white">
            <FiHelpCircle className="text-[#ad2033]" /> Hỏi đáp bài học
          </h3>
          <p className="text-xs text-[#6f665f] dark:text-slate-400">
            Câu hỏi và phản hồi được đồng bộ trực tiếp với CSCA-Course.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadThreads()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8c8b9] bg-white px-3 py-1.5 text-xs font-bold text-[#29354b] hover:bg-slate-50 disabled:opacity-50 dark:border-[#34435a] dark:bg-[#101e33] dark:text-slate-200"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới ({threads.length})
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
        <p className="text-sm font-black text-[#18243b] dark:text-white">Đặt câu hỏi mới</p>
        <input
          type="text"
          maxLength={255}
          value={title}
          disabled={creating}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tiêu đề câu hỏi (ví dụ: Chưa rõ bước biến đổi ở phút 10:25)"
          className="w-full rounded-xl border border-[#d9cabc] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
        />
        <textarea
          rows={3}
          maxLength={10000}
          value={body}
          disabled={creating}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Mô tả chi tiết phần bạn cần giải đáp..."
          className="w-full rounded-xl border border-[#d9cabc] bg-white p-3.5 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
        />
        <button
          type="button"
          disabled={creating || !title.trim() || !body.trim()}
          onClick={() => void handleCreateThread()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#911a2b] disabled:opacity-50"
        >
          <FiSend /> {creating ? 'Đang gửi...' : 'Gửi câu hỏi'}
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/35 dark:text-red-300">
          <FiAlertCircle className="shrink-0" /> {error}
        </div>
      ) : null}

      {loading && !threads.length ? (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-[#efe5da] dark:bg-slate-800/70" />
          ))}
        </div>
      ) : !threads.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chưa có câu hỏi nào trong bài học này. Hãy là người đầu tiên đặt câu hỏi!
        </p>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => {
            const meta = STATUS_META[thread.status] ?? STATUS_META.open;
            const unread = isThreadUnread(thread);
            const messages = thread.messages ?? thread.replies ?? [];
            const isReplying = replyOpenId === thread.id;
            const hasConflict = conflictThreadId === thread.id;

            return (
              <article
                key={thread.id}
                className="overflow-hidden rounded-2xl border border-[#ddcfc2] bg-white shadow-sm dark:border-[#34435a] dark:bg-[#101e33]"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ebe0d4] bg-[#fffaf4] px-4 py-3.5 dark:border-[#26354b] dark:bg-[#0b172b]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ad2033] px-2 py-0.5 text-[10px] font-black text-white">
                          Mới
                        </span>
                      ) : null}
                      <h4 className="font-black text-[#18243b] dark:text-white">{thread.title}</h4>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#8b8178] dark:text-slate-400">
                      {thread.authorName || 'Học viên'}
                      {thread.updatedAt ? ` · Cập nhật ${new Date(thread.updatedAt).toLocaleString('vi-VN')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${meta.className}`}>
                      {meta.label}
                    </span>
                    {unread ? (
                      <button
                        type="button"
                        disabled={statusBusyId === thread.id}
                        onClick={() => void handlePatchStatus(thread, thread.status, true)}
                        className="rounded-lg border border-[#d8c8b9] px-2.5 py-1 text-[11px] font-bold text-[#247d7e] hover:bg-[#eff9f7] disabled:opacity-50 dark:border-[#34435a] dark:text-[#6ac6bd]"
                      >
                        Đánh dấu đã đọc
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={statusBusyId === thread.id}
                      onClick={() => void handlePatchStatus(thread, thread.status === 'resolved' ? 'open' : 'resolved')}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] px-2.5 py-1 text-[11px] font-bold text-[#29354b] hover:bg-slate-50 disabled:opacity-50 dark:border-[#34435a] dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FiCheckCircle />
                      {thread.status === 'resolved' ? 'Mở lại' : 'Đã giải quyết'}
                    </button>
                  </div>
                </header>

                <div className="space-y-3 p-4">
                  {hasConflict ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <span>{conflictMessage}</span>
                      <button
                        type="button"
                        onClick={() => void loadThreads()}
                        className="rounded-lg bg-amber-600 px-3 py-1 font-black text-white"
                      >
                        Tải lại ngay
                      </button>
                    </div>
                  ) : null}

                  {thread.body && messages.length === 0 ? (
                    <div className="rounded-xl bg-[#fffaf4] p-3 text-[#29354b] dark:bg-[#0b172b] dark:text-slate-200">
                      <RichMathText value={thread.body} />
                    </div>
                  ) : null}

                  {messages.length > 0 ? (
                    <ul className="space-y-2.5">
                      {messages.map((msg) => {
                        const isTeacher = Boolean(msg.isTeacher || msg.authorRole === 'teacher' || msg.authorRole === 'admin');
                        return (
                          <li
                            key={msg.id}
                            className={`rounded-xl border p-3 ${
                              isTeacher
                                ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25'
                                : 'border-[#ebe0d4] bg-[#fffaf4] dark:border-[#26354b] dark:bg-[#0b172b]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-black text-[#18243b] dark:text-white">
                                {msg.authorName || (isTeacher ? 'Giảng viên' : 'Học viên')}
                                {isTeacher ? (
                                  <span className="ml-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                                    Giảng viên
                                  </span>
                                ) : null}
                              </span>
                              {msg.createdAt ? (
                                <span className="text-[11px] text-[#8b8178] dark:text-slate-400">
                                  {new Date(msg.createdAt).toLocaleString('vi-VN')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1.5 text-[#29354b] dark:text-slate-200">
                              <RichMathText value={msg.body} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  <div className="pt-1">
                    {!isReplying ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyOpenId(thread.id);
                          if (unread) {
                            void handlePatchStatus(thread, thread.status, true);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-[#247d7e] hover:underline dark:text-[#6ac6bd]"
                      >
                        <FiMessageCircle /> Trả lời thêm
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-[#e3d4c5] bg-[#fffaf4] p-3 dark:border-[#2c3a52] dark:bg-[#0b172b]">
                        <textarea
                          rows={2}
                          value={replyDrafts[thread.id] || ''}
                          disabled={replyBusyId === thread.id}
                          onChange={(event) => setReplyDrafts((prev) => ({
                            ...prev,
                            [thread.id]: event.target.value,
                          }))}
                          placeholder="Nhập phản hồi của bạn..."
                          className="w-full rounded-xl border border-[#d9cabc] bg-white p-2.5 text-sm outline-none focus:border-[#247d7e] dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReplyOpenId(null)}
                            className="rounded-lg border border-[#d8c8b9] px-3 py-1.5 text-xs font-bold text-[#6f665f] dark:border-[#34435a] dark:text-slate-300"
                          >
                            Đóng
                          </button>
                          <button
                            type="button"
                            disabled={replyBusyId === thread.id || !(replyDrafts[thread.id] || '').trim()}
                            onClick={() => void handleReply(thread)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#247d7e] px-3.5 py-1.5 text-xs font-black text-white disabled:opacity-50"
                          >
                            <FiSend /> {replyBusyId === thread.id ? 'Đang gửi...' : 'Gửi phản hồi'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
