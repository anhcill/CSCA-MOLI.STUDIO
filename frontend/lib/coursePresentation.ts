type CourseProfileMode = string | null | undefined;

const INTERNAL_PROFILE_WORDING = /\b(?:live\s*mirror|mirror|live\s*&\s*tự học)\b|bản ghi lớp live|kế thừa/i;

export const SUBJECT_DEFAULT_COVERS: Record<string, string> = {
  MATH: '/images/banner/campus-01.jpg',
  PHYSICS: '/images/banner/campus-07.jpg',
  CHEMISTRY: '/images/banner/campus-04.jpg',
  CHINESE_SCI: '/images/banner/campus-09.jpg',
  CHINESE_SOC: '/images/banner/campus-12.jpg',
};

const DEFAULT_FALLBACK_COVER = '/images/banner/campus-14.jpg';

export function resolveCourseCoverImage(
  thumbnailUrl: string | null | undefined,
  subjectCode?: string | null,
): string {
  const explicit = String(thumbnailUrl || '').trim();
  if (explicit) return explicit;
  const code = String(subjectCode || '').trim().toUpperCase();
  return SUBJECT_DEFAULT_COVERS[code] || DEFAULT_FALLBACK_COVER;
}

export function publicCourseModeLabel(mode: CourseProfileMode): string {
  return String(mode || '').toUpperCase() === 'MIRROR'
    ? 'Khóa học video'
    : 'Khóa học tự học';
}

export function publicCourseProfileLabel(
  value: string | null | undefined,
  mode: CourseProfileMode,
): string {
  const label = String(value || '').trim();
  if (!label || INTERNAL_PROFILE_WORDING.test(label)) {
    return publicCourseModeLabel(mode);
  }
  return label;
}
