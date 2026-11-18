type CourseProfileMode = string | null | undefined;

const INTERNAL_PROFILE_WORDING = /\b(?:live\s*mirror|mirror|live\s*&\s*tự học)\b|bản ghi lớp live|kế thừa/i;

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
