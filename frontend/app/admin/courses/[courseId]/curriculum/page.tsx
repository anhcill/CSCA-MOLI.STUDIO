'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiEdit2,
  FiEye,
  FiFileText,
  FiFilm,
  FiHelpCircle,
  FiPlus,
  FiTrash2,
  FiZap,
} from 'react-icons/fi';
import AdminLayout from '@/components/layout/AdminLayout';
import { VideoUploadPanel } from '@/components/courses/VideoUploadPanel';
import { LessonWorkEditor } from '@/components/courses/LessonWorkEditor';
import coursesApi, { extractCourseApiError, slugifyVietnamese } from '@/lib/api/courses';
import type {
  CourseAdminDto,
  CurriculumLessonDto,
  CurriculumSectionDto,
  LessonType,
} from '@/lib/types/courses';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import { CourseWorkspaceHeader } from '../../_components/CourseAdminForm';

const editorFieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20';

const LESSON_TYPE_META: Record<LessonType, { label: string; icon: React.ReactNode }> = {
  video: { label: 'Bài giảng Video', icon: <FiFilm className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> },
  article: { label: 'Bài đọc / Lý thuyết', icon: <FiFileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> },
  document: { label: 'Tài liệu đính kèm', icon: <FiFileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> },
  quiz: { label: 'Bài kiểm tra', icon: <FiHelpCircle className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" /> },
};

function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  if (!s) return '0 phút';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem} giây`;
  return rem > 0 ? `${m}p ${rem}s` : `${m} phút`;
}

function SectionEditor({
  courseId,
  section,
  sectionIndex,
  totalSections,
  onMoveSection,
  reload,
}: {
  courseId: number;
  section: CurriculumSectionDto;
  sectionIndex: number;
  totalSections: number;
  onMoveSection: (direction: -1 | 1) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [sectionTitle, setSectionTitle] = useState(section.title);
  const [sectionPublished, setSectionPublished] = useState(section.isPublished === true);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [customLessonSlug, setCustomLessonSlug] = useState(false);
  const [lessonType, setLessonType] = useState<LessonType>('video');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSectionTitle(section.title);
    setSectionPublished(section.isPublished === true);
  }, [section.id, section.title, section.isPublished]);

  const updateSectionTitle = async () => {
    if (!sectionTitle.trim()) return;
    try {
      setSaving(true);
      setError('');
      await coursesApi.updateSection(courseId, section.id, {
        title: sectionTitle.trim(),
        isPublished: sectionPublished,
      });
      await reload();
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể lưu tên chương.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSectionPublished = async (nextChecked: boolean) => {
    setSectionPublished(nextChecked);
    try {
      setSaving(true);
      setError('');
      await coursesApi.updateSection(courseId, section.id, {
        title: sectionTitle.trim() || section.title,
        isPublished: nextChecked,
      });
      await reload();
    } catch (err) {
      setSectionPublished(!nextChecked);
      setError(extractCourseApiError(err, 'Không thể bật/tắt hiển thị chương.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async () => {
    const lessonWarning =
      section.lessons.length > 0
        ? `\nChương này đang có ${section.lessons.length} bài học bên trong.`
        : '';
    if (
      !window.confirm(
        `Bạn chắc chắn muốn xóa chương "${section.title}"?${lessonWarning}\nThao tác này không thể hoàn tác.`,
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      setError('');
      await coursesApi.deleteSection(courseId, section.id);
      await reload();
    } catch (err) {
      setError(
        extractCourseApiError(
          err,
          'Không thể xóa chương. Nếu chương còn video đang gắn, hãy xóa các bài học bên trong trước.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const moveLesson = async (lessonIndex: number, direction: -1 | 1) => {
    const targetIndex = lessonIndex + direction;
    if (targetIndex < 0 || targetIndex >= section.lessons.length) return;
    const ids = section.lessons.map((l) => l.id);
    const [moved] = ids.splice(lessonIndex, 1);
    ids.splice(targetIndex, 0, moved);
    try {
      setSaving(true);
      setError('');
      await coursesApi.reorderCurriculum(courseId, {
        sections: [{ sectionId: section.id, lessonIds: ids }],
      });
      await reload();
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể đổi thứ tự bài học.'));
    } finally {
      setSaving(false);
    }
  };

  const addLesson = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedSlug = slugifyVietnamese(lessonSlug || lessonTitle);
    if (!lessonTitle.trim() || !normalizedSlug) {
      setError('Vui lòng nhập tên bài giảng hợp lệ.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await coursesApi.createLesson(courseId, {
        sectionId: section.id,
        title: lessonTitle.trim(),
        slug: normalizedSlug,
        lessonType,
        sortOrder: section.lessons.length + 1,
        isFreePreview: false,
        isRequired: true,
      });
      setLessonTitle('');
      setLessonSlug('');
      setCustomLessonSlug(false);
      await reload();
    } catch (err) {
      setError(
        extractCourseApiError(
          err,
          'Không thể thêm bài học. Tên hoặc đường dẫn bài học có thể bị trùng trong khóa này.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const titleDirty = sectionTitle.trim() !== section.title;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Section Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Chương {sectionIndex + 1}
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <button
              type="button"
              title="Đưa chương lên trên"
              disabled={saving || sectionIndex === 0}
              onClick={() => void onMoveSection(-1)}
              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Đưa chương xuống dưới"
              disabled={saving || sectionIndex >= totalSections - 1}
              onClick={() => void onMoveSection(1)}
              className="border-l border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FiArrowDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            aria-label="Tên chương"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-black text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {titleDirty ? (
            <button
              type="button"
              onClick={() => void updateSectionTitle()}
              disabled={saving || !sectionTitle.trim()}
              className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Lưu tên chương
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Auto-saving visibility switch */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-950">
            <input
              type="checkbox"
              checked={sectionPublished}
              disabled={saving}
              onChange={(event) => void toggleSectionPublished(event.target.checked)}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            <span
              className={
                sectionPublished
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {sectionPublished ? 'Đang hiển thị chương' : 'Chương đang ẩn (nháp)'}
            </span>
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleDeleteSection()}
            title="Xóa chương này"
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <FiTrash2 className="h-3.5 w-3.5" />
            Xóa chương
          </button>
        </div>
      </div>

      {/* Lessons List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {!section.lessons.length ? (
          <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Chương này chưa có bài giảng nào. Hãy điền tên bài bên dưới để thêm bài đầu tiên!
          </p>
        ) : (
          section.lessons.map((lesson, idx) => (
            <LessonEditor
              key={lesson.id}
              courseId={courseId}
              lesson={lesson}
              lessonIndex={idx}
              totalLessonsInSection={section.lessons.length}
              onMoveLesson={(dir) => moveLesson(idx, dir)}
              reload={reload}
            />
          ))
        )}
      </div>

      {/* Add Lesson Quick Form */}
      <form
        onSubmit={addLesson}
        className="border-t border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-950/60"
      >
        <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          + Thêm bài học mới vào Chương {sectionIndex + 1}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2.2fr_1.2fr_auto]">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Tên bài giảng <span className="text-red-500">*</span>
              <input
                required
                placeholder="VD: Bài 1 - Hàm số và Đồ thị trọng tâm"
                value={lessonTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  setLessonTitle(val);
                  if (!customLessonSlug) {
                    setLessonSlug(slugifyVietnamese(val));
                  }
                }}
                className={editorFieldClass}
              />
            </label>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate font-mono">URL: /{lessonSlug || 'tu-dong-tao'}</span>
              <button
                type="button"
                onClick={() => setCustomLessonSlug((v) => !v)}
                className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {customLessonSlug ? 'Ẩn URL' : 'Sửa URL'}
              </button>
            </div>
            {customLessonSlug ? (
              <input
                required
                value={lessonSlug}
                onChange={(e) => setLessonSlug(slugifyVietnamese(e.target.value))}
                placeholder="bai-1-ham-so"
                className={`${editorFieldClass} font-mono text-xs`}
              />
            ) : null}
          </div>

          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Loại bài học
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value as LessonType)}
              className={editorFieldClass}
            >
              <option value="video">🎬 Bài giảng Video (Bunny Stream)</option>
              <option value="article">📖 Bài viết / Lý thuyết</option>
              <option value="document">📎 Tài liệu PDF / Đính kèm</option>
              <option value="quiz">📝 Bài kiểm tra</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving || !lessonTitle.trim()}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:mt-5"
          >
            <FiPlus className="h-4 w-4" />
            Thêm bài
          </button>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function LessonEditor({
  courseId,
  lesson,
  lessonIndex,
  totalLessonsInSection,
  onMoveLesson,
  reload,
}: {
  courseId: number;
  lesson: CurriculumLessonDto;
  lessonIndex: number;
  totalLessonsInSection: number;
  onMoveLesson: (direction: -1 | 1) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const resolvedInitialDuration = lesson.estimatedDurationSeconds ?? lesson.durationSeconds ?? 0;

  const [expanded, setExpanded] = useState(lesson.lessonType === 'video' && !lesson.videoAssetId);
  const [title, setTitle] = useState(lesson.title);
  const [slug, setSlug] = useState(lesson.slug);
  const [lessonType, setLessonType] = useState<LessonType>(lesson.lessonType);
  const [summary, setSummary] = useState(lesson.summary ?? '');
  const [contentHtml, setContentHtml] = useState(lesson.contentHtml ?? '');
  const [durationSeconds, setDurationSeconds] = useState<number>(
    Number.isFinite(resolvedInitialDuration) ? resolvedInitialDuration : 0,
  );
  const [durationDirty, setDurationDirty] = useState(false);
  const [freePreview, setFreePreview] = useState(lesson.isFreePreview);
  const [required, setRequired] = useState(lesson.isRequired);
  const [published, setPublished] = useState(lesson.isPublished === true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [error, setError] = useState('');

  // Keep state synchronized whenever parent reloads lesson data (e.g. after Bunny sync updates real duration!)
  useEffect(() => {
    const nextDuration = lesson.estimatedDurationSeconds ?? lesson.durationSeconds ?? 0;
    if (!durationDirty) {
      setDurationSeconds(Number.isFinite(nextDuration) ? nextDuration : 0);
    }
    setPublished(lesson.isPublished === true);
  }, [
    lesson.id,
    lesson.durationSeconds,
    lesson.estimatedDurationSeconds,
    lesson.isPublished,
    lesson.videoAssetId,
    durationDirty,
  ]);

  const quickTogglePublish = async (nextPublished: boolean) => {
    setPublished(nextPublished);
    try {
      setSaving(true);
      setError('');
      await coursesApi.updateLesson(courseId, lesson.id, { isPublished: nextPublished });
      await reload();
    } catch (err) {
      setPublished(!nextPublished);
      setError(extractCourseApiError(err, 'Chưa thể bật hiển thị bài học này (kiểm tra xem video đã xử lý xong chưa).'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (
      !window.confirm(
        `Xóa bài học "${lesson.title}"?\nTài liệu và tiến độ gắn với bài này sẽ bị xóa. Không thể hoàn tác.`,
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      setError('');
      await coursesApi.deleteLesson(courseId, lesson.id);
      await reload();
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể xóa bài học. Nếu còn video đang gắn, hãy xóa video trước.'));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const normalizedSlug = slugifyVietnamese(slug || title);
    if (!title.trim() || !normalizedSlug) {
      setError('Vui lòng nhập đầy đủ Tên bài và Đường dẫn slug.');
      return;
    }
    const safeDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0 ? Math.round(durationSeconds) : 0;
    try {
      setSaving(true);
      setError('');
      setSavedNotice('');
      await coursesApi.updateLesson(courseId, lesson.id, {
        title: title.trim(),
        slug: normalizedSlug,
        lessonType,
        summary: summary.trim() || null,
        contentHtml: contentHtml.trim() || null,
        estimatedDurationSeconds: safeDuration,
        isFreePreview: freePreview,
        isRequired: required,
        isPublished: published,
      });
      setSlug(normalizedSlug);
      setDurationDirty(false);
      await reload();
      setSavedNotice('Đã lưu bài học!');
      setTimeout(() => setSavedNotice(''), 2500);
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể cập nhật bài học. Kiểm tra dữ liệu và thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  const typeMeta = LESSON_TYPE_META[lesson.lessonType] || LESSON_TYPE_META.video;
  const displayedDuration = lesson.durationSeconds || lesson.estimatedDurationSeconds || 0;

  return (
    <div className="transition">
      {/* Lesson Row Summary */}
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 sm:self-center">
          <button
            type="button"
            title="Đưa bài lên trên"
            disabled={saving || lessonIndex === 0}
            onClick={() => void onMoveLesson(-1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:text-slate-300"
          >
            <FiArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Đưa bài xuống dưới"
            disabled={saving || lessonIndex >= totalLessonsInSection - 1}
            onClick={() => void onMoveLesson(1)}
            className="border-l border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            <FiArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400">#{lessonIndex + 1}</span>
            <p className="truncate font-bold text-slate-900 dark:text-slate-100">{lesson.title}</p>
            {lesson.isFreePreview ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                Học thử miễn phí
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
              {typeMeta.icon}
              {typeMeta.label}
            </span>

            {displayedDuration > 0 ? (
              <span className="text-slate-500 dark:text-slate-400">
                · ⏱ {formatDurationShort(displayedDuration)}
              </span>
            ) : null}

            {lesson.lessonType === 'video' ? (
              lesson.videoAssetId ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ✓ Đã gắn Video (#{lesson.videoAssetId})
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  ⚠️ Chưa tải video lên
                </span>
              )
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick 1-click Publish Toggle */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={published}
              disabled={saving}
              onChange={(e) => void quickTogglePublish(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-emerald-600"
            />
            <span
              className={
                published
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {published ? 'Hiển thị' : 'Nháp'}
            </span>
          </label>

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              expanded
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                : lesson.lessonType === 'video' && !lesson.videoAssetId
                  ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700'
            }`}
          >
            <FiEdit2 className="h-3.5 w-3.5" />
            {expanded
              ? 'Thu gọn'
              : lesson.lessonType === 'video'
                ? lesson.videoAssetId
                  ? 'Sửa bài & Video'
                  : 'Đăng Video ngay'
                : 'Chỉnh sửa bài'}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleDeleteLesson()}
            title="Xóa bài học này"
            className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 disabled:opacity-40 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Lesson Detail & Video Uploader */}
      {expanded ? (
        <div className="space-y-5 border-t border-slate-100 bg-slate-50/70 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/60">
          {lessonType === 'video' ? (
            <div>
              <VideoUploadPanel
                courseId={courseId}
                lessonId={lesson.id}
                currentVideoAssetId={lesson.videoAssetId}
                onUploaded={async (videoAssetId) => {
                  await coursesApi.updateLesson(courseId, lesson.id, { videoAssetId });
                  await reload();
                }}
                onDeleted={async () => {
                  await reload();
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Tên bài học
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={editorFieldClass}
              />
            </label>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Đường dẫn URL (Slug)
              <input
                required
                value={slug}
                onChange={(e) => setSlug(slugifyVietnamese(e.target.value))}
                className={`${editorFieldClass} font-mono`}
              />
            </label>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Loại bài học
              <select
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value as LessonType)}
                className={editorFieldClass}
              >
                <option value="video">🎬 Bài giảng Video</option>
                <option value="article">📖 Bài viết / Lý thuyết</option>
                <option value="document">📎 Tài liệu đính kèm</option>
                <option value="quiz">📝 Bài kiểm tra</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Thời lượng bài học (phút — Bunny tự cập nhật khi xử lý xong)
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={Math.ceil((Number.isFinite(durationSeconds) ? durationSeconds : 0) / 60)}
                  onChange={(e) => {
                    const mins = Math.max(0, Number(e.target.value) || 0);
                    setDurationSeconds(mins * 60);
                    setDurationDirty(true);
                  }}
                  className={editorFieldClass}
                />
                {durationSeconds > 0 ? (
                  <span className="mt-1.5 shrink-0 rounded-lg bg-slate-200/70 px-2.5 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    = {formatDurationShort(durationSeconds)}
                  </span>
                ) : null}
              </div>
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            Tóm tắt ngắn gọn bài giảng (hiển thị dưới tiêu đề bài)
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={editorFieldClass}
              placeholder="Mô tả trọng tâm kiến thức của bài giảng này..."
            />
          </label>

          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
            {lessonType === 'article'
              ? 'Nội dung bài đọc chi tiết (hỗ trợ HTML)'
              : 'Ghi chú bài giảng / Công thức cần nhớ dưới video (tùy chọn)'}
            <textarea
              rows={5}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              className={editorFieldClass}
              placeholder="Nhập ghi chú kiến thức, link slide hoặc hướng dẫn học tập cho học viên..."
            />
          </label>

          <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={freePreview}
                onChange={(e) => setFreePreview(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <FiEye className="h-3.5 w-3.5 text-sky-600" />
              Cho phép học thử miễn phí (khách chưa mua vẫn xem được bài này)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              Bài học bắt buộc để tính tiến độ khóa học
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              Hiển thị bài học cho học viên
            </label>
          </div>

          <LessonWorkEditor courseId={courseId} lessonId={lesson.id} />

          {error ? (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : '💾 Lưu thông tin bài học'}
            </button>
            {savedNotice ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <FiCheckCircle className="h-4 w-4" />
                {savedNotice}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CourseCurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const id = Number(courseId);
  const user = useAuthStore((state) => state.user);
  const isGlobalAdmin = hasPermission(user, '*');

  const [course, setCourse] = useState<CourseAdminDto | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingReady, setPublishingReady] = useState(false);
  const [readyNotice, setReadyNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError('Mã khóa học không hợp lệ.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      setCourse(await coursesApi.getAdminCourse(id));
    } catch {
      setError('Không thể tải chương trình học.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const readiness = useMemo(() => {
    const sections = course?.curriculum ?? [];
    const totalSections = sections.length;
    const publishedSections = sections.filter((s) => s.isPublished === true).length;
    const allLessons = sections.flatMap((s) => s.lessons);
    const totalLessons = allLessons.length;
    const publishedLessons = allLessons.filter((l) => l.isPublished === true).length;
    const videoLessons = allLessons.filter((l) => l.lessonType === 'video');
    const attachedVideoLessons = videoLessons.filter((l) => Boolean(l.videoAssetId)).length;
    const missingVideoLessons = videoLessons.length - attachedVideoLessons;
    const hasDraftItems = publishedSections < totalSections || publishedLessons < totalLessons;
    return {
      totalSections,
      publishedSections,
      totalLessons,
      publishedLessons,
      totalVideoLessons: videoLessons.length,
      attachedVideoLessons,
      missingVideoLessons,
      hasDraftItems,
    };
  }, [course]);

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !course) return;
    try {
      setSaving(true);
      setError('');
      await coursesApi.createSection(id, {
        title: title.trim(),
        sortOrder: course.curriculum.length + 1,
        isPublished: true,
      });
      setTitle('');
      await load();
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể thêm chương mới.'));
    } finally {
      setSaving(false);
    }
  };

  const moveSection = async (sectionIndex: number, direction: -1 | 1) => {
    if (!course) return;
    const targetIndex = sectionIndex + direction;
    if (targetIndex < 0 || targetIndex >= course.curriculum.length) return;
    const sectionIds = course.curriculum.map((s) => s.id);
    const [moved] = sectionIds.splice(sectionIndex, 1);
    sectionIds.splice(targetIndex, 0, moved);
    try {
      setSaving(true);
      setError('');
      const updated = await coursesApi.reorderCurriculum(id, { sectionIds });
      setCourse(updated);
    } catch (err) {
      setError(extractCourseApiError(err, 'Không thể đổi thứ tự chương.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublishAllReady = async () => {
    if (publishingReady) return;
    try {
      setPublishingReady(true);
      setError('');
      setReadyNotice('');
      const result = await coursesApi.publishReadyCurriculum(id);
      setCourse(result.course);
      const skippedMsg =
        result.skippedVideoLessons > 0
          ? ` (Bỏ qua ${result.skippedVideoLessons} bài video chưa gắn hoặc chưa xử lý xong video).`
          : ' Tất cả bài học đã sẵn sàng để xuất bản khóa học!';
      setReadyNotice(
        `✨ Đã bật hiển thị ${result.publishedSections} chương và ${result.publishedLessons} bài học!${skippedMsg}`,
      );
    } catch (err) {
      setError(extractCourseApiError(err, 'Chưa thể bật hiển thị tự động các chương/bài học.'));
    } finally {
      setPublishingReady(false);
    }
  };

  return (
    <AdminLayout
      title={course ? `Chương trình: ${course.title}` : 'Chương trình & Đăng Video'}
      description="Xây dựng danh sách chương, tải video bài giảng lên Bunny Stream và bật hiển thị"
    >
      {loading ? (
        <div
          className="h-80 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
          aria-label="Đang tải chương trình"
        />
      ) : !course ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          {error || 'Không có dữ liệu khóa học.'}
        </div>
      ) : (
        <div className="space-y-6">
          <CourseWorkspaceHeader
            course={course}
            activeTab="curriculum"
            onCourseUpdated={setCourse}
            showTeachersTab={isGlobalAdmin}
          />

          {/* Publish Readiness Checklist Card */}
          <section className="rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-indigo-50/50 p-5 shadow-sm dark:border-teal-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  Kiểm tra sẵn sàng xuất bản
                </p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    📚 Chương hiển thị:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      {readiness.publishedSections}/{readiness.totalSections}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    📝 Bài hiển thị:{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                      {readiness.publishedLessons}/{readiness.totalLessons}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    🎬 Bài Video đã gắn tệp:{' '}
                    <strong
                      className={
                        readiness.missingVideoLessons > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }
                    >
                      {readiness.attachedVideoLessons}/{readiness.totalVideoLessons}
                    </strong>
                  </span>
                </div>
                {readiness.missingVideoLessons > 0 ? (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <FiAlertTriangle className="h-4 w-4 shrink-0" />
                    Còn {readiness.missingVideoLessons} bài Video chưa gắn video. Hãy mở bài đó và tải tệp lên Bunny Stream.
                  </p>
                ) : null}
              </div>

              {readiness.totalLessons > 0 ? (
                <button
                  type="button"
                  disabled={publishingReady}
                  onClick={() => void handlePublishAllReady()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  <FiZap className="h-4 w-4" />
                  {publishingReady
                    ? 'Đang bật hiển thị...'
                    : '✨ Bật hiển thị tất cả chương & bài đã sẵn sàng'}
                </button>
              ) : null}
            </div>

            {readyNotice ? (
              <div
                role="status"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                {readyNotice}
              </div>
            ) : null}
          </section>

          {/* Add New Section Form */}
          <form
            onSubmit={addSection}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row"
          >
            <input
              aria-label="Tên chương mới"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên chương mới (VD: Chương 1: Đại số & Giải tích cơ bản)..."
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <FiPlus className="h-4 w-4" />
              Thêm chương học
            </button>
          </form>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </div>
          ) : null}

          {!course.curriculum.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-base font-bold text-slate-700 dark:text-slate-200">
                Khóa học chưa có chương học nào.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Hãy nhập tên chương vào ô phía trên và bấm <strong>“+ Thêm chương học”</strong> để bắt đầu tải video bài giảng!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {course.curriculum.map((section, idx) => (
                <SectionEditor
                  key={section.id}
                  courseId={id}
                  section={section}
                  sectionIndex={idx}
                  totalSections={course.curriculum.length}
                  onMoveSection={(dir) => moveSection(idx, dir)}
                  reload={load}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
