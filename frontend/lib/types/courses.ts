export const CSCA_SUBJECT_CODES = [
  'MATH',
  'PHYSICS',
  'CHEMISTRY',
  'CHINESE_SCI',
  'CHINESE_SOC',
] as const;

export type CscaSubjectCode = (typeof CSCA_SUBJECT_CODES)[number];
export type CourseAccessType = 'free' | 'vip' | 'premium' | 'contact' | 'private';
export type CourseLevel = 'basic' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'review' | 'published' | 'archived';
export type LessonType = 'video' | 'article' | 'document' | 'quiz';
export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type EnrollmentStatus = 'active' | 'expired' | 'revoked' | 'completed';
export type HlsResolution = '360p' | '480p' | '720p' | '1080p';

export interface ApiPaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  pagination?: ApiPaginationDto;
  message?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  code: string;
  message: string;
  details?: unknown;
}

export interface CourseInstructorDto {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
}

export interface CourseProgressSummaryDto {
  completedLessons: number;
  totalLessons: number;
  completionPct: number;
  lastLessonId: number | null;
  lastLessonTitle: string | null;
  lastPositionSeconds: number;
}

export interface CourseCatalogItemDto {
  id: number;
  externalKey: string;
  slug: string;
  title: string;
  shortDescription: string;
  subjectCode: CscaSubjectCode;
  level: CourseLevel;
  thumbnailUrl: string | null;
  accessType: CourseAccessType;
  priceVnd: number | null;
  compareAtPriceVnd: number | null;
  isFeatured: boolean;
  isNew: boolean;
  isHot: boolean;
  ratingAvg: number;
  ratingCount: number;
  enrolledCount: number;
  totalSections: number;
  totalLessons: number;
  totalDurationSeconds: number;
  instructor: CourseInstructorDto | null;
  progress: CourseProgressSummaryDto | null;
  publishedAt: string | null;
  contentUpdatedAt: string | null;
}

export interface CourseCatalogQuery {
  page?: number;
  pageSize?: number;
  subjectCode?: CscaSubjectCode;
  accessType?: CourseAccessType;
  level?: CourseLevel;
  sort?: 'newest' | 'popular' | 'rating';
  search?: string;
}

export interface CourseCatalogDto {
  items: CourseCatalogItemDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CourseAccessDto {
  accessType: CourseAccessType;
  canEnroll: boolean;
  canLearn: boolean;
  isEnrolled: boolean;
  reasonCode: string | null;
  ctaLabel: string;
}

export interface CurriculumLessonDto {
  id: number;
  externalKey: string;
  slug: string;
  title: string;
  summary: string | null;
  lessonType: LessonType;
  sortOrder: number;
  durationSeconds: number;
  isFreePreview: boolean;
  isRequired: boolean;
  isLocked: boolean;
  progressStatus: LessonProgressStatus;
  /** Admin-only fields are omitted by public curriculum responses. */
  isPublished?: boolean;
  videoAssetId?: number | null;
  contentHtml?: string | null;
}

export interface CurriculumSectionDto {
  id: number;
  title: string;
  description: string | null;
  sortOrder: number;
  totalDurationSeconds: number;
  lessons: CurriculumLessonDto[];
  isPublished?: boolean;
}

export interface CourseDetailDto extends CourseCatalogItemDto {
  descriptionHtml: string;
  outcomes: string[];
  requirements: string[];
  suitableFor: string[];
  certificateEnabled: boolean;
  access: CourseAccessDto;
  curriculum: CurriculumSectionDto[];
}

export interface EnrollmentDto {
  id: number;
  courseId: number;
  courseSlug: string;
  status: EnrollmentStatus;
  source: 'free' | 'vip' | 'premium' | 'admin' | 'coupon';
  startsAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  progress: CourseProgressSummaryDto;
}

export interface MyLearningItemDto {
  enrollment: EnrollmentDto;
  course: CourseCatalogItemDto;
}

export interface LearningLessonDto extends CurriculumLessonDto {
  contentHtml: string | null;
  resources: LessonResourceDto[];
  previousLessonId: number | null;
  nextLessonId: number | null;
}

export interface LessonResourceDto {
  id: number;
  title: string;
  kind: 'file' | 'link';
  url: string;
}

export interface LearningRoomDto {
  course: Pick<CourseDetailDto, 'id' | 'slug' | 'title' | 'subjectCode' | 'thumbnailUrl'>;
  enrollment: EnrollmentDto;
  curriculum: CurriculumSectionDto[];
  lesson: LearningLessonDto;
}

export interface LearningCourseDto {
  course: Pick<CourseDetailDto, 'id' | 'slug' | 'title' | 'subjectCode' | 'thumbnailUrl'>;
  enrollment: EnrollmentDto;
  curriculum: CurriculumSectionDto[];
}

export interface CourseProgressDto extends CourseProgressSummaryDto {
  courseId: number;
}

export interface LessonProgressDto {
  lessonId: number;
  status: LessonProgressStatus;
  watchedSeconds: number;
  maxPositionSeconds: number;
  lastPositionSeconds: number;
  completionPct: number;
  updatedAt: string;
}

export interface UpdateLessonProgressInput {
  positionSeconds: number;
  /** Time genuinely played since the previous accepted update; the server owns the cumulative total. */
  watchedDeltaSeconds: number;
}

export interface HlsVariantDto {
  resolution: HlsResolution;
  width: number;
  height: number;
  bitrateKbps: number;
  isReady: boolean;
}

export interface PlaybackSessionDto {
  sessionId: string;
  lessonId: number;
  deliveryType: 'hls';
  manifestUrl: string;
  expiresAt: string;
  variants: HlsVariantDto[];
  resumePositionSeconds: number;
}

export interface CourseAdminInput {
  title: string;
  slug: string;
  shortDescription: string;
  descriptionHtml: string;
  subjectCode: CscaSubjectCode;
  level: CourseLevel;
  accessType: CourseAccessType;
  thumbnailUrl?: string | null;
  priceVnd?: number | null;
  compareAtPriceVnd?: number | null;
  certificateEnabled?: boolean;
}

export interface CourseAdminDto extends CourseDetailDto {
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCourseListItemDto extends CourseCatalogItemDto {
  status: CourseStatus;
  updatedAt: string;
}

export interface CurriculumSectionInput {
  title: string;
  description?: string | null;
  sortOrder: number;
  isPublished?: boolean;
}

export interface CurriculumLessonInput {
  sectionId: number;
  title: string;
  slug: string;
  lessonType: LessonType;
  summary?: string | null;
  sortOrder: number;
  isFreePreview: boolean;
  isRequired: boolean;
  isPublished?: boolean;
  videoAssetId?: number | null;
  contentHtml?: string | null;
}


export interface VideoUploadSessionDto {
  sessionId: string;
  assetExternalKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface VideoUploadCompleteDto {
  sessionId: string;
  videoAssetId: number;
  status: 'processing';
  alreadyCompleted: boolean;
}

export interface CreateVideoUploadInput {
  courseId: number;
  lessonId: number;
  contentType: 'video/mp4' | 'video/quicktime';
  sizeBytes: number;
  checksumSha256: string;
}
