'use client';

import { useCallback, useEffect, useState } from 'react';
import coursesApi from '@/lib/api/courses';
import type { CourseFileDto, LessonAssignmentDto, LessonSubmissionDto, LessonWorkDto } from '@/lib/types/courses';
import { CourseFilePicker } from './CourseFilePicker';
import { LessonQuestionPanel } from './LessonQuestionPanel';

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function fileSize(bytes: number) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function StoredFiles({ files, onDelete, deleting }: { files: CourseFileDto[]; onDelete: (id: number) => void; deleting: boolean }) {
  if (!files.length) return <p className="text-sm text-slate-500">Chưa có file.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((file) => (
        <div key={file.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {file.fileKind === 'image' ? <img src={file.url} alt={file.originalName} className="h-32 w-full object-cover" /> : null}
          <div className="p-3">
            <a href={file.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-bold text-indigo-700 dark:text-indigo-300">{file.originalName}</a>
            <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{file.fileKind === 'image' ? 'Ảnh' : 'Tài liệu'} {fileSize(file.sizeBytes)}</span><button type="button" disabled={deleting} onClick={() => onDelete(file.id)} className="font-bold text-red-600">Xóa</button></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmissionGrader({ submission, maxScore, onSaved }: { submission: LessonSubmissionDto; maxScore: number; onSaved: (score: number, feedback: string) => Promise<void> }) {
  const [score, setScore] = useState(submission.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.teacherFeedback || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="font-black">{submission.studentName || `Học viên #${submission.userId}`}</h4><p className="text-xs text-slate-500">{submission.studentEmail} · Nộp {new Date(submission.submittedAt).toLocaleString('vi-VN')}</p></div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${submission.status === 'graded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{submission.status === 'graded' ? 'Đã chấm' : 'Chờ chấm'}</span>
      </div>
      {submission.textContent ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">{submission.textContent}</p> : null}
      {submission.attachments.length ? <div className="mt-3"><StoredFiles files={submission.attachments} onDelete={() => undefined} deleting /></div> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-[150px_1fr_auto] md:items-end">
        <label className="text-sm font-bold">Điểm / {maxScore}<input type="number" min={0} max={maxScore} step="0.25" value={score} onChange={(e) => setScore(e.target.value)} className={fieldClass} /></label>
        <label className="text-sm font-bold">Nhận xét giáo viên<textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={fieldClass} placeholder="Điểm làm tốt và phần cần sửa..." /></label>
        <button type="button" disabled={saving || score === ''} onClick={async () => { const numeric = Number(score); if (!Number.isFinite(numeric) || numeric < 0 || numeric > maxScore) { setError(`Điểm phải từ 0 đến ${maxScore}.`); return; } try { setSaving(true); setError(''); await onSaved(numeric, feedback); } catch { setError('Không thể lưu điểm và nhận xét.'); } finally { setSaving(false); } }} className="rounded-lg bg-emerald-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu chấm bài'}</button>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
    </article>
  );
}

export function LessonWorkEditor({ courseId, lessonId, teacherMode = false }: { courseId: number; lessonId: number; teacherMode?: boolean }) {
  const [work, setWork] = useState<LessonWorkDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxScore, setMaxScore] = useState(10);
  const [published, setPublished] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = teacherMode
        ? await coursesApi.getTeachingLessonWork(courseId, lessonId)
        : await coursesApi.getLessonWork(courseId, lessonId);
      setWork(next);
      setTitle(next.assignment?.title || '');
      setInstructions(next.assignment?.instructions || '');
      setDueAt(next.assignment?.dueAt ? new Date(next.assignment.dueAt).toISOString().slice(0, 16) : '');
      setMaxScore(next.assignment?.maxScore || 10);
      setPublished(next.assignment?.isPublished === true);
      setError('');
    } catch { setError('Không thể tải tài liệu và bài tập của bài học.'); }
    finally { setLoading(false); }
  }, [courseId, lessonId, teacherMode]);

  useEffect(() => { void load(); }, [load]);
  const assignmentInput = () => ({ title: title.trim(), instructions: instructions.trim(), dueAt: dueAt ? new Date(dueAt).toISOString() : null, maxScore, isPublished: published });

  if (loading) return <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />;
  return (
    <section className="space-y-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-5 dark:border-violet-500/25 dark:bg-violet-950/15">
      <div><h3 className="text-lg font-black text-violet-950 dark:text-violet-200">{teacherMode ? 'Giao & chấm bài' : 'Tài liệu & bài tập của bài học'}</h3><p className="text-sm text-violet-800 dark:text-violet-300">Ảnh có thể tải hàng loạt hoặc dán bằng Ctrl+V. DOC, DOCX và PDF đều được hỗ trợ.</p></div>

      {!teacherMode ? <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/60">
        <h4 className="font-black">1. File học kèm theo bài</h4>
        <StoredFiles files={work?.resources || []} deleting={busy} onDelete={async (fileId) => { try { setBusy(true); await coursesApi.deleteLessonResource(courseId, lessonId, fileId); await load(); } finally { setBusy(false); } }} />
        <CourseFilePicker files={resourceFiles} onChange={setResourceFiles} disabled={busy} label="Chọn file tài liệu bài học" />
        <button type="button" disabled={busy || !resourceFiles.length} onClick={async () => { try { setBusy(true); setError(''); await coursesApi.uploadLessonResources(courseId, lessonId, resourceFiles); setResourceFiles([]); await load(); } catch { setError('Không thể tải file bài học. Kiểm tra định dạng/kích thước rồi thử lại.'); } finally { setBusy(false); } }} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">Tải {resourceFiles.length || ''} file lên bài học</button>
      </div> : null}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/60">
        <div><h4 className="font-black">{teacherMode ? '1. Giao bài cho học viên' : '2. Bài tập để học viên nộp'}</h4><p className="text-xs text-slate-500">Không bắt buộc có file đề. Giáo viên có thể chỉ nhập mô tả, hoặc tải/dán nhiều ảnh.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">Tên bài tập *<input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} placeholder="Ví dụ: Bài luyện tập sau video" /></label>
          <label className="text-sm font-bold">Hạn nộp (không bắt buộc)<input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldClass} /></label>
          <label className="text-sm font-bold">Thang điểm<input type="number" min={1} max={1000} step="0.25" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value) || 10)} className={fieldClass} /></label>
          <label className="flex items-end gap-2 pb-2 text-sm font-bold"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4" /> Mở bài tập cho học viên</label>
        </div>
        <label className="block text-sm font-bold">Yêu cầu bài làm<textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={fieldClass} placeholder="Mô tả yêu cầu, tiêu chí chấm..." /></label>
        <button type="button" disabled={busy || !title.trim()} onClick={async () => { try { setBusy(true); setError(''); if (teacherMode) await coursesApi.saveTeachingAssignment(courseId, lessonId, assignmentInput()); else await coursesApi.saveLessonAssignment(courseId, lessonId, assignmentInput()); await load(); } catch { setError('Không thể lưu bài tập.'); } finally { setBusy(false); } }} className="rounded-lg bg-violet-700 px-4 py-2 font-bold text-white disabled:opacity-50">{work?.assignment ? 'Lưu thay đổi bài tập' : 'Tạo bài tập'}</button>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <h5 className="mb-3 font-black">Ảnh / file đề đính kèm (không bắt buộc)</h5>
          <StoredFiles files={work?.assignment?.attachments || []} deleting={busy} onDelete={async (fileId) => { try { setBusy(true); if (teacherMode) await coursesApi.deleteTeachingAttachment(courseId, lessonId, fileId); else await coursesApi.deleteAssignmentAttachment(courseId, lessonId, fileId); await load(); } finally { setBusy(false); } }} />
          <div className="mt-3"><CourseFilePicker files={assignmentFiles} onChange={setAssignmentFiles} disabled={busy} label="Chọn hoặc dán ảnh/file đề" /></div>
          <button type="button" disabled={busy || !assignmentFiles.length || !title.trim()} onClick={async () => { try { setBusy(true); setError(''); if (teacherMode) { await coursesApi.saveTeachingAssignment(courseId, lessonId, assignmentInput()); await coursesApi.uploadTeachingAttachments(courseId, lessonId, assignmentFiles); } else { await coursesApi.saveLessonAssignment(courseId, lessonId, assignmentInput()); await coursesApi.uploadAssignmentAttachments(courseId, lessonId, assignmentFiles); } setAssignmentFiles([]); await load(); } catch { setError('Không thể tải ảnh/file đề. Hãy nhập tên bài tập rồi thử lại.'); } finally { setBusy(false); } }} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50 dark:bg-indigo-600">Tải {assignmentFiles.length || ''} ảnh/file đề</button>
        </div>
      </div>

      <div className="space-y-3">
        <div><h4 className="font-black">{teacherMode ? '2. Bài học viên đã nộp' : '3. Bài học viên đã nộp'} ({work?.assignment?.submissions?.length || 0})</h4><p className="text-xs text-slate-500">Mở ảnh/file, nhập điểm và nhận xét rồi lưu chấm bài.</p></div>
        {work?.assignment?.submissions?.length ? work.assignment.submissions.map((submission) => <SubmissionGrader key={submission.id} submission={submission} maxScore={work.assignment!.maxScore} onSaved={async (score, feedback) => { if (teacherMode) await coursesApi.gradeTeachingSubmission(courseId, lessonId, submission.id, score, feedback); else await coursesApi.gradeLessonSubmission(courseId, lessonId, submission.id, score, feedback); await load(); }} />) : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">Chưa có bài nộp.</p>}
      </div>
      <div className="border-t border-violet-200 pt-6 dark:border-violet-500/25">
        <LessonQuestionPanel courseId={courseId} lessonId={lessonId} teacherMode />
      </div>
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
    </section>
  );
}
