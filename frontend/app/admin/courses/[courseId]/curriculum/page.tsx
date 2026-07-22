'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/layout/AdminLayout';
import { VideoUploadPanel } from '@/components/courses/VideoUploadPanel';
import coursesApi from '@/lib/api/courses';
import type { CourseAdminDto, CurriculumLessonDto, CurriculumSectionDto, LessonType } from '@/lib/types/courses';

function SectionEditor({ courseId, section, reload }: { courseId: number; section: CurriculumSectionDto; reload: () => Promise<void> }) {
  const [sectionTitle, setSectionTitle] = useState(section.title);
  const [sectionPublished, setSectionPublished] = useState(section.isPublished === true);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('video');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const updateSection = async () => {
    if (!sectionTitle.trim()) return;
    try { setSaving(true); setError(''); await coursesApi.updateSection(courseId, section.id, { title: sectionTitle.trim(), isPublished: sectionPublished }); await reload(); }
    catch { setError('Không thể cập nhật chương.'); }
    finally { setSaving(false); }
  };
  const addLesson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!lessonTitle.trim() || !lessonSlug.trim()) return;
    try {
      setSaving(true); setError('');
      await coursesApi.createLesson(courseId, { sectionId: section.id, title: lessonTitle.trim(), slug: lessonSlug.trim(), lessonType, sortOrder: section.lessons.length + 1, isFreePreview: false, isRequired: true });
      setLessonTitle(''); setLessonSlug(''); await reload();
    } catch { setError('Không thể thêm bài học. Kiểm tra slug rồi thử lại.'); }
    finally { setSaving(false); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <input aria-label="Tên chương" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2 text-lg font-black" />
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={sectionPublished} onChange={(event) => setSectionPublished(event.target.checked)} /> Xuất bản chương</label>
        <button type="button" onClick={() => void updateSection()} disabled={saving || (sectionTitle.trim() === section.title && sectionPublished === (section.isPublished === true))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-40">Lưu chương</button>
      </div>
      <div className="border-t border-slate-100">
        {!section.lessons.length ? <p className="p-5 text-sm text-slate-500">Chưa có bài học.</p> : section.lessons.map((lesson) => <LessonEditor key={lesson.id} courseId={courseId} lesson={lesson} reload={reload} />)}
      </div>
      <form onSubmit={addLesson} className="grid gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_auto]">
        <label className="text-sm font-bold">Tên bài<input required value={lessonTitle} onChange={(e) => { setLessonTitle(e.target.value); if (!lessonSlug) setLessonSlug(e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
        <label className="text-sm font-bold">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={lessonSlug} onChange={(e) => setLessonSlug(e.target.value.toLowerCase())} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
        <label className="text-sm font-bold">Loại<select value={lessonType} onChange={(e) => setLessonType(e.target.value as LessonType)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="video">Video</option><option value="article">Bài viết</option><option value="document">Tài liệu</option><option value="quiz">Bài kiểm tra</option></select></label>
        <button disabled={saving} className="self-end rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">+ Thêm bài</button>
      </form>
      {error ? <p role="alert" className="px-5 pb-4 text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
}

function LessonEditor({ courseId, lesson, reload }: { courseId: number; lesson: CurriculumLessonDto; reload: () => Promise<void> }) {
  const [title, setTitle] = useState(lesson.title);
  const [published, setPublished] = useState(lesson.isPublished === true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!title.trim()) return;
    try { setSaving(true); setError(''); await coursesApi.updateLesson(courseId, lesson.id, { title: title.trim(), isPublished: published }); await reload(); }
    catch { setError('Không thể cập nhật bài học.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <input aria-label={`Tên bài ${lesson.title}`} value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 font-semibold hover:border-slate-300 focus:border-indigo-500 focus:outline-none" />
        <span className="text-xs font-bold uppercase text-slate-500">{lesson.lessonType}</span>
        <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Xuất bản bài</label>
        <button type="button" onClick={() => void save()} disabled={saving || (title.trim() === lesson.title && published === (lesson.isPublished === true))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Lưu</button>
        {lesson.lessonType === 'video' ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">{expanded ? 'Đóng video' : 'Quản lý video'}</button> : null}
      </div>
      {error ? <p role="alert" className="px-5 pb-3 text-sm text-red-600">{error}</p> : null}
      {expanded && lesson.lessonType === 'video' ? <div className="px-5 pb-5"><VideoUploadPanel courseId={courseId} lessonId={lesson.id} onUploaded={async (videoAssetId) => { await coursesApi.updateLesson(courseId, lesson.id, { videoAssetId }); await reload(); }} /></div> : null}
    </div>
  );
}

export default function CourseCurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const id = Number(courseId);
  const [course, setCourse] = useState<CourseAdminDto | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Mã khóa học không hợp lệ.'); setLoading(false); return; }
    try { setError(''); setCourse(await coursesApi.getAdminCourse(id)); }
    catch { setError('Không thể tải chương trình học.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const addSection = async () => {
    if (!title.trim() || !course) return;
    try { setSaving(true); setError(''); await coursesApi.createSection(id, { title: title.trim(), sortOrder: course.curriculum.length + 1 }); setTitle(''); await load(); }
    catch { setError('Không thể thêm chương.'); }
    finally { setSaving(false); }
  };
  return (
    <AdminLayout title="Chương trình khóa học" description={course?.title || 'CSCA Learning'}>
      <Link href={`/admin/courses/${id}`} className="mb-5 inline-block font-bold text-indigo-700">← Thông tin khóa học</Link>
      {loading ? <div className="h-80 animate-pulse rounded-3xl bg-slate-200" aria-label="Đang tải chương trình" /> : !course ? <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">{error || 'Không có dữ liệu.'}</div> : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
            <input aria-label="Tên chương mới" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên chương mới" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2" />
            <button type="button" onClick={() => void addSection()} disabled={saving || !title.trim()} className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white disabled:opacity-50">+ Thêm chương</button>
          </div>
          {error ? <p role="alert" className="text-red-600">{error}</p> : null}
          {!course.curriculum.length ? <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">Chưa có chương. Hãy tạo chương đầu tiên.</div> : course.curriculum.map((section) => <SectionEditor key={section.id} courseId={id} section={section} reload={load} />)}
        </div>
      )}
    </AdminLayout>
  );
}
