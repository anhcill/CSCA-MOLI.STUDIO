'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiDownload, FiHelpCircle, FiMessageCircle, FiSend } from 'react-icons/fi';
import coursesApi from '@/lib/api/courses';
import learningApi from '@/lib/api/learning';
import type { CourseFileDto, LessonQuestionStatus, LessonQuestionThreadDto } from '@/lib/types/courses';
import { CourseFilePicker } from './CourseFilePicker';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-500/10';

const statusMeta: Record<LessonQuestionStatus, { label: string; className: string }> = {
  open: { label: 'Chờ giáo viên', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  answered: { label: 'Đã trả lời', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  resolved: { label: 'Đã xử lý', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

function AttachmentList({ files }: { files: CourseFileDto[] }) {
  if (!files.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((file) => file.fileKind === 'image' ? (
        <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
          <img src={file.url} alt={file.originalName} className="h-28 w-full object-cover" />
          <span className="block truncate px-2 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">{file.originalName}</span>
        </a>
      ) : (
        <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-violet-300">
          <FiDownload className="shrink-0" /><span className="truncate">{file.originalName}</span>
        </a>
      ))}
    </div>
  );
}

export function LessonQuestionPanel({ lessonId, courseId, teacherMode = false }: { lessonId: number; courseId?: number; teacherMode?: boolean }) {
  const [threads, setThreads] = useState<LessonQuestionThreadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [questionBody, setQuestionBody] = useState('');
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [replyThreadId, setReplyThreadId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    try {
      const data = teacherMode
        ? await coursesApi.getTeachingLessonQuestions(Number(courseId), lessonId)
        : await learningApi.getLessonQuestions(lessonId);
      setThreads(data);
      setError('');
    } catch {
      setError('Không thể tải danh sách hỏi đáp. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, teacherMode]);

  useEffect(() => { void load(); }, [load]);

  const sendReply = async (threadId: number) => {
    if (!replyBody.trim() && !replyFiles.length) return;
    try {
      setBusy(true);
      setError('');
      const data = teacherMode
        ? await coursesApi.replyTeachingLessonQuestion(Number(courseId), lessonId, threadId, replyBody, replyFiles)
        : await learningApi.replyLessonQuestion(lessonId, threadId, replyBody, replyFiles);
      setThreads(data);
      setReplyBody('');
      setReplyFiles([]);
      setReplyThreadId(null);
    } catch {
      setError('Không thể gửi phản hồi. Hãy kiểm tra nội dung/file rồi thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><FiHelpCircle className="text-[#ad2033]" /> Hỏi đáp bài học</h3>
          <p className="text-xs text-slate-500">{teacherMode ? 'Trả lời câu hỏi của học viên được phân công trong khóa học này.' : 'Câu hỏi của bạn chỉ hiển thị cho bạn và giáo viên phụ trách.'}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">{threads.length} câu hỏi</span>
      </div>

      {!teacherMode ? (
        <div className="space-y-3 rounded-xl border border-[#ddcfc2] bg-[#fffdf9] p-4 dark:border-slate-700 dark:bg-slate-950/60">
          <label className="block text-sm font-black">Tiêu đề câu hỏi *<input value={subject} maxLength={255} onChange={(event) => setSubject(event.target.value)} className={`mt-1 ${fieldClass}`} placeholder="Ví dụ: Em chưa hiểu bước biến đổi ở phút 12:30" /></label>
          <label className="block text-sm font-black">Nội dung<textarea rows={4} value={questionBody} maxLength={20000} onChange={(event) => setQuestionBody(event.target.value)} className={`mt-1 ${fieldClass}`} placeholder="Mô tả phần bạn chưa hiểu hoặc dán ảnh bài làm bên dưới..." /></label>
          <CourseFilePicker files={questionFiles} onChange={setQuestionFiles} disabled={busy} label="Chọn hoặc dán ảnh/file" />
          <button type="button" disabled={busy || !subject.trim() || (!questionBody.trim() && !questionFiles.length)} onClick={async () => {
            try {
              setBusy(true); setError('');
              const data = await learningApi.createLessonQuestion(lessonId, subject, questionBody, questionFiles);
              setThreads(data); setSubject(''); setQuestionBody(''); setQuestionFiles([]);
            } catch { setError('Không thể gửi câu hỏi. Hãy kiểm tra nội dung/file rồi thử lại.'); }
            finally { setBusy(false); }
          }} className="inline-flex items-center gap-2 rounded-lg bg-[#ad2033] px-4 py-2.5 font-black text-white disabled:opacity-50"><FiSend /> {busy ? 'Đang gửi...' : 'Gửi câu hỏi'}</button>
        </div>
      ) : null}

      <div className="space-y-4">
        {threads.length ? threads.map((thread) => {
          const meta = statusMeta[thread.status];
          const replying = replyThreadId === thread.id;
          return (
            <article key={thread.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
                <div className="min-w-0"><h4 className="font-black text-slate-900 dark:text-white">{thread.subject}</h4>{teacherMode ? <p className="text-xs text-slate-500">{thread.studentName} · {thread.studentEmail}</p> : null}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
              </header>
              <div className="space-y-3 p-4">
                {thread.messages.map((message) => (
                  <div key={message.id} className={`rounded-xl border p-3 ${message.authorKind === 'teacher' ? 'ml-0 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/25 sm:ml-8' : 'mr-0 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50 sm:mr-8'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong className={message.authorKind === 'teacher' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}>{message.authorKind === 'teacher' ? `Giáo viên · ${message.authorName}` : message.authorName}</strong><time className="text-slate-400">{new Date(message.createdAt).toLocaleString('vi-VN')}</time></div>
                    {message.body ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{message.body}</p> : null}
                    <AttachmentList files={message.attachments} />
                  </div>
                ))}

                {replying ? (
                  <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                    <textarea autoFocus rows={4} value={replyBody} maxLength={20000} onChange={(event) => setReplyBody(event.target.value)} className={fieldClass} placeholder={teacherMode ? 'Nhập câu trả lời cho học viên...' : 'Nhập câu hỏi bổ sung...'} />
                    <CourseFilePicker files={replyFiles} onChange={setReplyFiles} disabled={busy} label="Đính kèm ảnh/file" />
                    <div className="flex gap-2"><button type="button" disabled={busy || (!replyBody.trim() && !replyFiles.length)} onClick={() => void sendReply(thread.id)} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 font-black text-white disabled:opacity-50"><FiSend /> Gửi</button><button type="button" disabled={busy} onClick={() => { setReplyThreadId(null); setReplyBody(''); setReplyFiles([]); }} className="rounded-lg border border-slate-300 px-4 py-2 font-bold dark:border-slate-700">Hủy</button></div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setReplyThreadId(thread.id)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-violet-700"><FiMessageCircle /> {teacherMode ? 'Trả lời học viên' : 'Hỏi thêm'}</button>
                    {teacherMode && thread.status !== 'resolved' ? <button type="button" disabled={busy} onClick={async () => { try { setBusy(true); setThreads(await coursesApi.updateTeachingQuestionStatus(Number(courseId), lessonId, thread.id, 'resolved')); } catch { setError('Không thể đổi trạng thái câu hỏi.'); } finally { setBusy(false); } }} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"><FiCheckCircle /> Đánh dấu đã xử lý</button> : null}
                    {teacherMode && thread.status === 'resolved' ? <button type="button" disabled={busy} onClick={async () => { try { setBusy(true); setThreads(await coursesApi.updateTeachingQuestionStatus(Number(courseId), lessonId, thread.id, 'open')); } catch { setError('Không thể mở lại câu hỏi.'); } finally { setBusy(false); } }} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-black text-amber-700 dark:border-amber-800 dark:text-amber-300">Mở lại</button> : null}
                  </div>
                )}
              </div>
            </article>
          );
        }) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{teacherMode ? 'Chưa có học viên đặt câu hỏi cho bài này.' : 'Bạn chưa có câu hỏi nào. Hãy gửi câu hỏi đầu tiên khi cần giáo viên hỗ trợ.'}</div>}
      </div>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
    </section>
  );
}
