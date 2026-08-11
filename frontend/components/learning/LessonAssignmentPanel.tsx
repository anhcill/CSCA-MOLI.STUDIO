'use client';

import { useState } from 'react';
import { FiCheckCircle, FiClock, FiDownload, FiSend } from 'react-icons/fi';
import learningApi from '@/lib/api/learning';
import type { CourseFileDto, LessonAssignmentDto } from '@/lib/types/courses';
import { CourseFilePicker } from '@/components/courses/CourseFilePicker';

function StoredAttachment({ file }: { file: CourseFileDto }) {
  return (
    <a href={file.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#ddcfc2] bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#34435a] dark:bg-[#101e33]">
      {file.fileKind === 'image' ? <img src={file.url} alt={file.originalName} className="h-40 w-full object-cover" /> : null}
      <div className="flex items-center justify-between gap-2 p-3 font-bold text-[#237879] dark:text-[#6ac6bd]"><span className="truncate">{file.originalName}</span><FiDownload className="shrink-0" /></div>
    </a>
  );
}

export function LessonAssignmentPanel({ lessonId, initialAssignment }: { lessonId: number; initialAssignment: LessonAssignmentDto }) {
  const [assignment, setAssignment] = useState(initialAssignment);
  const [textContent, setTextContent] = useState(initialAssignment.submission?.textContent || '');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submission = assignment.submission;
  const dueLabel = assignment.dueAt ? new Date(assignment.dueAt).toLocaleString('vi-VN') : null;

  const submit = async () => {
    if (!textContent.trim() && !files.length) {
      setError('Hãy nhập nội dung hoặc chọn ít nhất một ảnh/file bài làm.');
      return;
    }
    try {
      setSubmitting(true); setError('');
      const next = await learningApi.submitAssignment(lessonId, textContent.trim(), files);
      setAssignment((current) => ({ ...current, submission: next }));
      setFiles([]);
    } catch { setError('Chưa thể nộp bài. Kiểm tra file (tối đa 25 MB/file) và thử lại.'); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#d9cabc] bg-[#fffdf9] p-5 dark:border-[#34435a] dark:bg-[#101e33]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-[#ad2033]">Bài tập</p><h2 className="mt-1 text-xl font-black text-[#202c43] dark:text-[#f2e4cf]">{assignment.title}</h2></div>
          <div className="text-right text-xs font-bold text-[#786f68] dark:text-slate-400"><p>Thang điểm: {assignment.maxScore}</p>{dueLabel ? <p className="mt-1 inline-flex items-center gap-1"><FiClock /> Hạn {dueLabel}</p> : <p className="mt-1">Không giới hạn hạn nộp</p>}</div>
        </div>
        {assignment.instructions ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{assignment.instructions}</p> : null}
        {assignment.attachments.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assignment.attachments.map((file) => <StoredAttachment key={file.id} file={file} />)}</div> : null}
      </div>

      {submission ? (
        <div className={`rounded-2xl border p-5 ${submission.status === 'graded' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="inline-flex items-center gap-2 font-black"><FiCheckCircle /> {submission.status === 'graded' ? 'Giáo viên đã chấm' : 'Đã nộp — đang chờ giáo viên chấm'}</h3><span className="text-xs font-bold">{new Date(submission.submittedAt).toLocaleString('vi-VN')}</span></div>
          {submission.status === 'graded' ? <div className="mt-4 rounded-xl bg-white/80 p-4 dark:bg-slate-950/40"><p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{submission.score} / {assignment.maxScore} điểm</p><p className="mt-2 whitespace-pre-wrap"><strong>Nhận xét giáo viên:</strong> {submission.teacherFeedback || 'Giáo viên chưa để lại nhận xét.'}</p></div> : null}
          {submission.attachments.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{submission.attachments.map((file) => <StoredAttachment key={file.id} file={file} />)}</div> : null}
          <p className="mt-3 text-xs">Bạn có thể nộp lại bên dưới. Bài mới sẽ thay bài cũ và quay về trạng thái chờ chấm.</p>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-[#d9cabc] bg-[#fffdf9] p-5 dark:border-[#34435a] dark:bg-[#101e33]">
        <h3 className="font-black">{submission ? 'Nộp lại bài' : 'Nộp bài của bạn'}</h3>
        <label className="block text-sm font-bold">Nội dung trả lời (không bắt buộc nếu có file)<textarea rows={5} value={textContent} disabled={submitting} onChange={(event) => setTextContent(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d9cabc] bg-white p-4 font-normal outline-none focus:border-[#258886] focus:ring-4 focus:ring-[#258886]/10 dark:border-[#34435a] dark:bg-[#071426]" placeholder="Nhập lời giải, ghi chú cho giáo viên..." /></label>
        <CourseFilePicker files={files} onChange={setFiles} disabled={submitting} label="Chọn hoặc dán ảnh/PDF/DOC bài làm" />
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
        <button type="button" disabled={submitting || (!textContent.trim() && !files.length)} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-[#ad2033] px-5 py-3 font-black text-white disabled:opacity-50"><FiSend /> {submitting ? 'Đang tải và nộp...' : submission ? 'Nộp lại bài' : 'Nộp bài cho giáo viên'}</button>
      </div>
    </section>
  );
}
