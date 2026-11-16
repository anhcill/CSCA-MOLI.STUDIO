'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FiAlertTriangle,
  FiBookmark,
  FiCheck,
  FiClock,
  FiEdit2,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import learningApi, { generateIdempotencyKey, parseExternalApiError } from '@/lib/api/learning';
import type { ExternalUnitBookmarkDto, ExternalUnitNoteDto } from '@/lib/types/courses';

export interface ExternalNotesBookmarksPanelProps {
  profileId: string | null;
  unitId: string | number;
  isPublicPreviewAccess: boolean;
  initialNotes?: ExternalUnitNoteDto[];
  initialBookmarks?: ExternalUnitBookmarkDto[];
  currentPositionSeconds: number;
  activeVideoAssetId?: string | null;
  bookmarkRefreshNonce?: number;
  onSeekVideo: (seconds: number) => void;
  onCountsChange?: (counts: { notes: number; bookmarks: number }) => void;
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

interface NoteConflictState {
  noteId: string;
  currentRevision: number;
  serverNote: ExternalUnitNoteDto | null;
  message: string;
}

export function ExternalNotesBookmarksPanel({
  profileId,
  unitId,
  isPublicPreviewAccess,
  initialNotes = [],
  initialBookmarks = [],
  currentPositionSeconds,
  activeVideoAssetId = null,
  bookmarkRefreshNonce = 0,
  onSeekVideo,
  onCountsChange,
}: ExternalNotesBookmarksPanelProps) {
  const [notes, setNotes] = useState<ExternalUnitNoteDto[]>(initialNotes);
  const [bookmarks, setBookmarks] = useState<ExternalUnitBookmarkDto[]>(initialBookmarks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [newBookmarkLabel, setNewBookmarkLabel] = useState('');
  const [creatingBookmark, setCreatingBookmark] = useState(false);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState<string | null>(null);

  const [newNoteContent, setNewNoteContent] = useState('');
  const [usePlayerTimestamp, setUsePlayerTimestamp] = useState(true);
  const [creatingNote, setCreatingNote] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<NoteConflictState | null>(null);

  const emitCounts = useCallback((nextNotes: ExternalUnitNoteDto[], nextBookmarks: ExternalUnitBookmarkDto[]) => {
    onCountsChange?.({ notes: nextNotes.length, bookmarks: nextBookmarks.length });
  }, [onCountsChange]);

  const loadAll = useCallback(async () => {
    if (!profileId || isPublicPreviewAccess) return;
    try {
      setLoading(true);
      setError('');
      const [fetchedNotes, fetchedBookmarks] = await Promise.all([
        learningApi.getExternalUnitNotes({ profileId, unitId }),
        learningApi.getExternalUnitBookmarks({ profileId, unitId }),
      ]);
      setNotes(fetchedNotes);
      setBookmarks(fetchedBookmarks);
      emitCounts(fetchedNotes, fetchedBookmarks);
      setConflict(null);
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể tải ghi chú và mốc video.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [emitCounts, isPublicPreviewAccess, profileId, unitId]);

  useEffect(() => {
    setNotes(initialNotes);
    setBookmarks(initialBookmarks);
    emitCounts(initialNotes, initialBookmarks);
    setEditingNoteId(null);
    setConflict(null);
    if (profileId && !isPublicPreviewAccess) {
      void loadAll();
    }
  }, [emitCounts, initialBookmarks, initialNotes, isPublicPreviewAccess, loadAll, profileId, unitId]);

  useEffect(() => {
    if (bookmarkRefreshNonce > 0 && profileId && !isPublicPreviewAccess) {
      void learningApi.getExternalUnitBookmarks({ profileId, unitId })
        .then((nextBookmarks) => {
          setBookmarks(nextBookmarks);
          emitCounts(notes, nextBookmarks);
        })
        .catch(() => {});
    }
  }, [bookmarkRefreshNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateBookmark = async () => {
    if (!profileId || isPublicPreviewAccess || creatingBookmark) return;
    const ts = Math.max(0, Math.floor(currentPositionSeconds));
    const label = newBookmarkLabel.trim() || `Mốc ${formatDuration(ts)}`;
    try {
      setCreatingBookmark(true);
      setError('');
      const created = await learningApi.createExternalUnitBookmark({
        profileId,
        unitId,
        timestampSeconds: ts,
        label,
        videoAssetId: activeVideoAssetId,
        idempotencyKey: generateIdempotencyKey(),
      });
      setBookmarks((prev) => {
        const next = [created, ...prev.filter((b) => b.id !== created.id)];
        emitCounts(notes, next);
        return next;
      });
      setNewBookmarkLabel('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể lưu mốc video.');
      setError(parsed.message);
    } finally {
      setCreatingBookmark(false);
    }
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!profileId || isPublicPreviewAccess || deletingBookmarkId) return;
    try {
      setDeletingBookmarkId(bookmarkId);
      setError('');
      await learningApi.deleteExternalUnitBookmark({
        profileId,
        unitId,
        bookmarkId,
        idempotencyKey: generateIdempotencyKey(),
      });
      setBookmarks((prev) => {
        const next = prev.filter((item) => item.id !== bookmarkId);
        emitCounts(notes, next);
        return next;
      });
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể xóa mốc video.');
      setError(parsed.message);
    } finally {
      setDeletingBookmarkId(null);
    }
  };

  const handleCreateNote = async () => {
    if (!profileId || isPublicPreviewAccess || creatingNote) return;
    const content = newNoteContent.trim();
    if (!content) return;
    const timestampSeconds = usePlayerTimestamp ? Math.max(0, Math.floor(currentPositionSeconds)) : 0;

    try {
      setCreatingNote(true);
      setError('');
      const created = await learningApi.createExternalUnitNote({
        profileId,
        unitId,
        timestampSeconds,
        content,
        idempotencyKey: generateIdempotencyKey(),
      });
      setNotes((prev) => {
        const next = [created, ...prev.filter((n) => n.id !== created.id)];
        emitCounts(next, bookmarks);
        return next;
      });
      setNewNoteContent('');
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể lưu ghi chú mới.');
      setError(parsed.message);
    } finally {
      setCreatingNote(false);
    }
  };

  const handleSaveEdit = async (note: ExternalUnitNoteDto, overrideRevision?: number) => {
    if (!profileId || isPublicPreviewAccess || savingEditId) return;
    const content = editDraft.trim();
    if (!content) return;
    const expectedRevision = overrideRevision ?? note.revision ?? 1;

    try {
      setSavingEditId(note.id);
      setError('');
      const updated = await learningApi.updateExternalUnitNote({
        profileId,
        unitId,
        noteId: note.id,
        content,
        timestampSeconds: note.timestampSeconds,
        expectedRevision,
        idempotencyKey: generateIdempotencyKey(),
      });
      setNotes((prev) => {
        const next = prev.map((item) => (item.id === updated.id ? updated : item));
        emitCounts(next, bookmarks);
        return next;
      });
      setEditingNoteId(null);
      setEditDraft('');
      setConflict(null);
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể cập nhật ghi chú.');
      if (parsed.status === 409 || parsed.code === 'REVISION_CONFLICT') {
        const serverNote = (parsed.details?.note as ExternalUnitNoteDto | undefined) ?? null;
        const currentRevision = typeof parsed.details?.currentRevision === 'number'
          ? parsed.details.currentRevision
          : (serverNote?.revision ?? expectedRevision + 1);
        setConflict({
          noteId: note.id,
          currentRevision,
          serverNote,
          message: 'Ghi chú này đã được cập nhật ở thiết bị hoặc tab khác.',
        });
      } else {
        setError(parsed.message);
      }
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDeleteNote = async (note: ExternalUnitNoteDto) => {
    if (!profileId || isPublicPreviewAccess || deletingNoteId) return;
    try {
      setDeletingNoteId(note.id);
      setError('');
      await learningApi.deleteExternalUnitNote({
        profileId,
        unitId,
        noteId: note.id,
        expectedRevision: note.revision,
        idempotencyKey: generateIdempotencyKey(),
      });
      setNotes((prev) => {
        const next = prev.filter((item) => item.id !== note.id);
        emitCounts(next, bookmarks);
        return next;
      });
      if (editingNoteId === note.id) {
        setEditingNoteId(null);
        setConflict(null);
      }
    } catch (err) {
      const parsed = parseExternalApiError(err, 'Không thể xóa ghi chú.');
      if (parsed.status === 409 || parsed.code === 'REVISION_CONFLICT') {
        const serverNote = (parsed.details?.note as ExternalUnitNoteDto | undefined) ?? null;
        const currentRevision = typeof parsed.details?.currentRevision === 'number'
          ? parsed.details.currentRevision
          : (serverNote?.revision ?? (note.revision ?? 1) + 1);
        setConflict({
          noteId: note.id,
          currentRevision,
          serverNote,
          message: 'Ghi chú vừa thay đổi trước khi xóa. Hãy tải bản mới nhất rồi thử lại.',
        });
      } else {
        setError(parsed.message);
      }
    } finally {
      setDeletingNoteId(null);
    }
  };

  const applyServerNoteFromConflict = () => {
    if (!conflict) return;
    if (conflict.serverNote) {
      const serverNote = conflict.serverNote;
      setNotes((prev) => {
        const next = prev.map((item) => (item.id === serverNote.id ? serverNote : item));
        emitCounts(next, bookmarks);
        return next;
      });
      setEditDraft(serverNote.content);
      setConflict(null);
    } else {
      void loadAll();
    }
  };

  if (isPublicPreviewAccess || !profileId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <FiLock className="shrink-0 text-base" />
          <span>Đăng ký khóa học để đồng bộ ghi chú và mốc video trên mọi thiết bị.</span>
        </div>
      </div>
    );
  }

  const capturedLabel = formatDuration(currentPositionSeconds);

  return (
    <div id="lesson-notes" className="space-y-7">
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 dark:bg-red-950/35 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => void loadAll()} className="underline">Thử lại</button>
        </div>
      ) : null}

      {/* Synced Video Bookmarks */}
      <section className="space-y-3 rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-black text-[#18243b] dark:text-white">
              <FiBookmark className="text-[#247d7e]" /> Mốc video đã lưu ({bookmarks.length})
            </h3>
            <p className="text-xs text-[#6f665f] dark:text-slate-400">
              Đánh dấu nhanh các đoạn quan trọng để tua lại khi ôn tập.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] px-2.5 py-1 text-xs font-bold text-[#414c61] hover:bg-slate-50 dark:border-[#34435a] dark:text-slate-300"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Đồng bộ
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            maxLength={120}
            value={newBookmarkLabel}
            disabled={creatingBookmark}
            onChange={(event) => setNewBookmarkLabel(event.target.value)}
            placeholder={`Nhãn mốc (mặc định: Mốc ${capturedLabel})`}
            className="min-w-[200px] flex-1 rounded-xl border border-[#d9cabc] bg-white px-3.5 py-2 text-sm outline-none focus:border-[#247d7e] dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
          />
          <button
            type="button"
            disabled={creatingBookmark}
            onClick={() => void handleCreateBookmark()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#247d7e] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1c6465] disabled:opacity-50"
          >
            <FiPlus /> {creatingBookmark ? 'Đang lưu...' : `Lưu mốc (${capturedLabel})`}
          </button>
        </div>

        {bookmarks.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9cabc] bg-[#fffaf4] py-1 pl-1.5 pr-2 dark:border-[#34435a] dark:bg-[#0b172b]"
              >
                <button
                  type="button"
                  onClick={() => onSeekVideo(bm.timestampSeconds)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#247d7e] px-2 py-0.5 font-mono text-xs font-black text-white hover:bg-[#1b6465]"
                >
                  <FiClock className="h-3 w-3" /> {formatDuration(bm.timestampSeconds)}
                </button>
                <button
                  type="button"
                  onClick={() => onSeekVideo(bm.timestampSeconds)}
                  className="max-w-[220px] truncate px-1 text-xs font-bold text-[#1e2b44] hover:underline dark:text-slate-200"
                >
                  {bm.label}
                </button>
                <button
                  type="button"
                  aria-label={`Xóa mốc ${bm.label}`}
                  disabled={deletingBookmarkId === bm.id}
                  onClick={() => void handleDeleteBookmark(bm.id)}
                  className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có mốc video nào được lưu.</p>
        )}
      </section>

      {/* Synced Notes CRUD */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-black text-[#18243b] dark:text-white">
            Ghi chú bài học ({notes.length})
          </h3>
          <p className="text-xs text-[#6f665f] dark:text-slate-400">
            Đồng bộ hai chiều với tài khoản CSCA-Course của bạn. Nhấn vào mốc thời gian để tua video tới đúng đoạn đó.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#29354b] dark:text-slate-200">
              <input
                type="checkbox"
                checked={usePlayerTimestamp}
                onChange={(event) => setUsePlayerTimestamp(event.target.checked)}
                className="h-4 w-4 accent-[#247d7e]"
              />
              Gắn mốc thời gian video hiện tại ({capturedLabel})
            </label>
          </div>
          <textarea
            rows={3}
            value={newNoteContent}
            disabled={creatingNote}
            onChange={(event) => setNewNoteContent(event.target.value)}
            placeholder="Ghi lại công thức, ý chính hoặc điểm cần lưu ý..."
            className="w-full rounded-xl border border-[#d9cabc] bg-white p-3.5 text-sm outline-none focus:border-[#247d7e] focus:ring-4 focus:ring-[#247d7e]/10 dark:border-[#34435a] dark:bg-[#071426] dark:text-slate-100"
          />
          <button
            type="button"
            disabled={creatingNote || !newNoteContent.trim()}
            onClick={() => void handleCreateNote()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#247d7e] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#1c6465] disabled:opacity-50"
          >
            <FiSave /> {creatingNote ? 'Đang lưu...' : 'Lưu ghi chú'}
          </button>
        </div>

        {notes.length > 0 ? (
          <ul className="space-y-3">
            {notes.map((item) => {
              const isEditing = editingNoteId === item.id;
              const isConflicted = conflict?.noteId === item.id;

              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-[#34435a] dark:bg-[#101e33]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSeekVideo(item.timestampSeconds)}
                        className="rounded-md bg-[#247d7e] px-2.5 py-0.5 font-mono text-xs font-black text-white hover:bg-[#1c6465]"
                      >
                        {formatDuration(item.timestampSeconds)}
                      </button>
                      {item.revision !== undefined ? (
                        <span className="text-[11px] font-bold text-[#8b8178] dark:text-slate-500">
                          v{item.revision}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {(item.updatedAt || item.createdAt) ? (
                        <span className="text-xs text-[#8b8178] dark:text-slate-500">
                          {new Date((item.updatedAt || item.createdAt)!).toLocaleString('vi-VN')}
                        </span>
                      ) : null}
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(item.id);
                            setEditDraft(item.content);
                            setConflict(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] px-2.5 py-1 text-xs font-bold text-[#29354b] hover:bg-slate-50 dark:border-[#34435a] dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <FiEdit2 className="h-3 w-3" /> Sửa
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={deletingNoteId === item.id}
                        onClick={() => void handleDeleteNote(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <FiTrash2 className="h-3 w-3" /> Xóa
                      </button>
                    </div>
                  </div>

                  {isConflicted && conflict ? (
                    <div role="alert" className="mt-3 space-y-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100">
                      <div className="flex items-start gap-2 font-black">
                        <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600" />
                        <span>{conflict.message} (Phiên bản máy chủ: v{conflict.currentRevision})</span>
                      </div>
                      {conflict.serverNote ? (
                        <div className="rounded-lg border border-amber-200 bg-white/80 p-2.5 dark:border-amber-900/60 dark:bg-slate-950/50">
                          <p className="font-bold text-amber-800 dark:text-amber-300">Nội dung mới nhất trên máy chủ:</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#18243b] dark:text-slate-100">
                            {conflict.serverNote.content}
                          </p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={applyServerNoteFromConflict}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 font-black text-white hover:bg-amber-700"
                        >
                          Tải bản mới từ máy chủ
                        </button>
                        {isEditing ? (
                          <button
                            type="button"
                            disabled={savingEditId === item.id}
                            onClick={() => void handleSaveEdit(item, conflict.currentRevision)}
                            className="rounded-lg border border-amber-500 bg-white px-3 py-1.5 font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:bg-slate-900 dark:text-amber-200"
                          >
                            Ghi đè bằng nội dung của tôi
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        value={editDraft}
                        disabled={savingEditId === item.id}
                        onChange={(event) => setEditDraft(event.target.value)}
                        className="w-full rounded-xl border border-[#247d7e] bg-white p-3 text-sm outline-none dark:bg-[#071426] dark:text-slate-100"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditDraft('');
                            setConflict(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#d8c8b9] px-3 py-1.5 text-xs font-bold text-[#6f665f] dark:border-[#34435a] dark:text-slate-300"
                        >
                          <FiX /> Hủy
                        </button>
                        <button
                          type="button"
                          disabled={savingEditId === item.id || !editDraft.trim()}
                          onClick={() => void handleSaveEdit(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#247d7e] px-3.5 py-1.5 text-xs font-black text-white disabled:opacity-50"
                        >
                          <FiCheck /> {savingEditId === item.id ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2.5 whitespace-pre-wrap text-[#29354b] dark:text-slate-200">{item.content}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chưa có ghi chú nào cho bài học này.
          </p>
        )}
      </section>
    </div>
  );
}
