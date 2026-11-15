export const CSCA_SUBJECT_CODES = [
  'MATH',
  'PHYSICS',
  'CHEMISTRY',
  'CHINESE_SCI',
  'CHINESE_SOC',
] as const;

export type CscaSubjectCode = (typeof CSCA_SUBJECT_CODES)[number];
export type CourseAccessType = 'free' | 'package' | 'vip' | 'premium' | 'contact' | 'private';
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
  id: number | string;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
}

export interface CourseProfileSummaryDto {
  id: number;
  remoteProfileId: string | null;
  externalOfferingId: string | null;
  mode: 'MIRROR' | 'INDEPENDENT';
  badgeLabel: string | null;
  status: 'active' | 'inactive' | 'archived' | 'tombstoned';
  checkoutReady: boolean;
  managementClassId: string | null;
  sourceLiveClassId: string | null;
  allowFileDownload: boolean;
  deviceLimit: number;
  enforceTrustedDevices: boolean;
}

export interface CoursePackageSummaryDto {
  id: number;
  name: string;
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
  packages: CoursePackageSummaryDto[];
  priceVnd: number | null;
  compareAtPriceVnd: number | null;
  isFeatured: boolean;
  isNew: boolean;
  isHot: boolean;
  ratingAvg: number;
  ratingCount: number;
  ownershipStatus?: string;
  ownershipLabel?: string | null;
  owned?: boolean;
  canPurchase?: boolean;
  blockCode?: string | null;
  canLaunchCourse?: boolean;
  courseOfferingId?: string | null;
  ssoTargetPath?: string | null;
  isExternalOnly?: boolean;
  learningDestination?: string;
  contentOrigin?: 'moly_native' | 'csca_course';
  remoteCourseId?: string | null;
  checkoutReady?: boolean;
  profiles?: CourseProfileSummaryDto[];
  firstUnitHref?: string | null;
  firstUnitSlug?: string | null;
  activeProfileId?: string | null;
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
  status?: CourseStatus;
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
  ownershipStatus?: string;
  ownershipLabel?: string | null;
  owned?: boolean;
  canPurchase?: boolean;
  blockCode?: string | null;
  canLaunchCourse?: boolean;
  courseOfferingId?: string | null;
  ssoTargetPath?: string | null;
  isExternalOnly?: boolean;
  learningDestination?: string;
  checkoutReady?: boolean;
}

export interface CurriculumLessonDto {
  id: number | string;
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
  estimatedDurationSeconds?: number;
  unitProjectionId?: number;
  unitType?: 'lesson' | 'class_session';
  remoteUnitId?: string;
  profileId?: string | null;
  profileProjectionId?: number | null;
  href?: string | null;
  isPublicPreview?: boolean;
  videoPartCount?: number;
  hasTheory?: boolean;
  vocabCount?: number;
  formulaCount?: number;
  fileCount?: number;
  quizCount?: number;
  assignmentCount?: number;
}

export interface CurriculumSectionDto {
  id: number | string;
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
  projectedProfiles?: ProjectedProfileSummaryDto[];
  activeProfileId?: string | null;
  activeProfileProjectionId?: number | null;
  firstUnitHref?: string | null;
}

export interface EnrollmentDto {
  id: number;
  courseId: number;
  courseSlug: string;
  status: EnrollmentStatus;
  source: 'free' | 'package' | 'vip' | 'premium' | 'admin' | 'coupon' | 'external';
  startsAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  isExternalOnly?: boolean;
  learningDestination?: string;
  firstUnitHref?: string | null;
  firstUnitSlug?: string | null;
  activeProfileId?: string | null;
  progress: CourseProgressSummaryDto | null;
}

export interface MyLearningItemDto {
  enrollment: EnrollmentDto;
  course: CourseCatalogItemDto;
}

export interface LearningLessonDto extends Omit<CurriculumLessonDto, 'id'> {
  id: number;
  contentHtml: string | null;
  resources: LessonResourceDto[];
  assignment: LessonAssignmentDto | null;
  previousLessonId: number | null;
  nextLessonId: number | null;
}

export interface LessonResourceDto {
  id: number;
  title: string;
  kind: 'file' | 'link';
  url: string;
  originalName?: string;
  mimeType?: string | null;
  fileKind?: 'image' | 'document' | 'link';
  sizeBytes?: number;
}

export interface CourseFileDto {
  id: number;
  originalName: string;
  title?: string;
  mimeType: string;
  fileKind: 'image' | 'document';
  kind?: 'file' | 'link';
  url: string;
  sizeBytes: number;
}

export interface LessonSubmissionDto {
  id: number;
  assignmentId: number;
  userId: number;
  studentName: string | null;
  studentEmail: string | null;
  textContent: string;
  status: 'submitted' | 'graded';
  submittedAt: string;
  score: number | null;
  teacherFeedback: string;
  gradedAt: string | null;
  attachments: CourseFileDto[];
}

export interface LessonAssignmentDto {
  id: number;
  lessonId: number;
  title: string;
  instructions: string;
  dueAt: string | null;
  maxScore: number;
  isPublished: boolean;
  attachments: CourseFileDto[];
  submission?: LessonSubmissionDto | null;
  submissions?: LessonSubmissionDto[];
}

export interface LessonWorkDto {
  resources: CourseFileDto[];
  assignment: LessonAssignmentDto | null;
}

export type LessonQuestionStatus = 'open' | 'answered' | 'resolved';

export interface LessonQuestionMessageDto {
  id: number;
  authorId: number;
  authorKind: 'student' | 'teacher';
  authorName: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  attachments: CourseFileDto[];
}

export interface LessonQuestionThreadDto {
  id: number;
  lessonId: number;
  subject: string;
  status: LessonQuestionStatus;
  studentId: number;
  studentName: string;
  studentEmail: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  messages: LessonQuestionMessageDto[];
}

export interface LessonAssignmentInput {
  title: string;
  instructions: string;
  dueAt: string | null;
  maxScore: number;
  isPublished: boolean;
}

export interface CourseTeacherDto {
  id: number;
  name: string;
  email: string;
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
  viewerCode?: string;
  sessionId: string;
  lessonId: number;
  deliveryType: 'hls' | 'bunny';
  embedUrl?: string;
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
  /** Payment packages that unlock this course when accessType is "package". */
  packageIds: number[];
  thumbnailUrl?: string | null;
  priceVnd?: number | null;
  compareAtPriceVnd?: number | null;
  certificateEnabled?: boolean;
}

export interface CourseAdminDto extends CourseDetailDto {
  packageIds: number[];
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
  estimatedDurationSeconds?: number;
}

export interface VipPackageDto {
  id: number;
  name: string;
  tier: string;
  duration_days: number;
  price: number;
  allowed_subjects?: string[];
  requires_subject_choice?: boolean;
  is_active: boolean;
}

export interface VideoUploadSessionDto {
  sessionId: string;
  videoAssetId: number;
  assetExternalKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface VideoAssetDeleteDto {
  assetId: number;
  courseId: number;
  lessonId: number;
  status: 'deleted';
  detached: boolean;
  alreadyDeleted: boolean;
  deletedObjectCount: number;
}

export interface VideoUploadCompleteDto {
  sessionId: string;
  videoAssetId: number;
  status: 'processing';
  alreadyCompleted: boolean;
}

export interface VideoHlsFinalizeDto {
  assetId: number;
  status: 'ready';
  durationSeconds: number;
  variants: HlsVariantDto[];
}

export interface CreateVideoUploadInput {
  courseId: number;
  lessonId: number;
  contentType: 'video/mp4' | 'video/quicktime';
  sizeBytes: number;
  checksumSha256: string;
}

export interface CurriculumReorderInput {
  sectionIds?: number[];
  sections?: Array<{
    sectionId: number;
    lessonIds: number[];
  }>;
}

export interface PublishReadyResultDto {
  publishedSections: number;
  publishedLessons: number;
  skippedVideoLessons: number;
  course: CourseAdminDto;
}

export interface AdminCourseEnrollmentItemDto {
  id: number;
  userId: number;
  fullName: string | null;
  email: string;
  username: string | null;
  source: string;
  status: EnrollmentStatus | string;
  progressPercent: number;
  completedLessonsCount: number;
  enrolledAt: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
}

export interface AdminCourseEnrollmentsResponseDto {
  items: AdminCourseEnrollmentItemDto[];
  pagination: ApiPaginationDto;
}

export interface AdminCourseEnrollmentQuery {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface GrantCourseEnrollmentInput {
  userIds?: number[];
  emails?: string[];
  durationDays?: number | null;
  expiresAt?: string | null;
  reason?: string;
}

export interface GrantCourseEnrollmentResultDto {
  grantedCount: number;
  grantedUsers: Array<{
    id: number;
    email: string;
    fullName: string | null;
    expiresAt: string | null;
  }>;
  notFoundEmails: string[];
}

export interface RevokeCourseEnrollmentResultDto {
  id: number;
  status: 'revoked';
}

export const CSCA_SUBJECT_LABELS: Record<CscaSubjectCode, string> = {
  MATH: 'Toán',
  PHYSICS: 'Vật lý',
  CHEMISTRY: 'Hóa học',
  CHINESE_SCI: 'Tiếng Trung Tự nhiên',
  CHINESE_SOC: 'Tiếng Trung Xã hội',
};

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  basic: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

export const COURSE_ACCESS_LABELS: Record<CourseAccessType, string> = {
  free: 'Miễn phí',
  contact: 'Cấp quyền / Liên hệ',
  package: 'Theo gói VIP',
  vip: 'Theo gói VIP',
  premium: 'Cao cấp',
  private: 'Riêng tư',
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
  review: 'Chờ duyệt',
  archived: 'Lưu trữ',
};

export interface ProjectedProfileSummaryDto {
  id: number;
  profileProjectionId: number;
  remoteProfileId: string;
  externalOfferingId: string;
  remoteCourseId?: string;
  mode: 'MIRROR' | 'INDEPENDENT';
  title: string | null;
  status: string;
  allowFileDownload?: boolean;
  deviceLimit?: number;
  capabilities?: {
    allowFileDownload?: boolean;
    deviceLimit?: number;
    canPlayVideo?: boolean;
    isPublicPreviewAccess?: boolean;
    [key: string]: unknown;
  };
}

export interface ExternalWorkspaceUnitSummaryDto {
  id: string;
  unitProjectionId: number;
  unitKey: string;
  unitType: 'lesson' | 'class_session';
  remoteUnitId: string;
  sectionId: string;
  sectionTitle: string;
  sectionSortOrder: number;
  sessionNumber: number;
  title: string;
  summary: string | null;
  sortOrder: number;
  durationSeconds: number;
  href: string;
  isPublished: boolean;
  isPublicPreview: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  watchedPercent: number;
  lockReason: string | null;
  videoPartCount: number;
  hasTheory: boolean;
  vocabCount: number;
  formulaCount: number;
  fileCount: number;
  quizCount: number;
  assignmentCount: number;
}

export interface ExternalVideoPartDto {
  id?: string;
  assetId?: string;
  placementId?: string;
  partId?: string;
  partNumber?: number;
  title: string;
  videoType?: string;
  isPublished?: boolean;
  provider?: string;
  playbackStatus?: string;
  durationSeconds?: number;
  thumbnailUrl?: string | null;
  embedUrl?: string | null;
  availableResolutions?: string[];
  watchProgress?: {
    lastPositionSeconds: number;
    watchedSeconds: number;
    completionPercent: number;
    isCompleted: boolean;
  } | null;
}

export interface ExternalUnitTimestampDto {
  timeSeconds?: number;
  seconds?: number;
  time?: string;
  label?: string;
  title?: string;
  description?: string;
}

export interface ExternalUnitTheoryDto {
  title: string | null;
  summary?: string | null;
  contentHtml: string | null;
  keyTakeaways?: string[];
  transcript?: string | null;
  timestamps?: ExternalUnitTimestampDto[];
}

export interface ExternalUnitVocabularyDto {
  id?: string;
  term: string;
  pinyin?: string | null;
  sinoVietnamese?: string | null;
  meaning: string;
  partOfSpeech?: string | null;
  exampleSentence?: string | null;
  exampleMeaning?: string | null;
  audioUrl?: string | null;
}

export interface ExternalUnitFormulaVariableDto {
  symbol?: string;
  name?: string;
  unit?: string;
  description?: string;
}

export interface ExternalUnitFormulaDto {
  id?: string;
  subject?: string | null;
  chapterName?: string | null;
  nameVi?: string | null;
  nameZh?: string | null;
  pinyin?: string | null;
  latexExpression: string;
  description?: string | null;
  variablesExplanation?: ExternalUnitFormulaVariableDto[];
}

export interface ExternalUnitFileDto {
  id: string;
  fileName: string;
  title: string;
  sizeBytes: number;
  mimeType: string | null;
  fileKind: string;
  allowView?: boolean;
  allowDownload?: boolean;
}

export interface ExternalUnitQuizDto {
  id: string;
  title: string;
  durationMinutes?: number | null;
  passingScore?: number;
  attemptsCount?: number;
  isCompleted?: boolean;
  bestScore?: number | null;
  maxScore?: number | null;
}

export interface ExternalUnitAssignmentDto {
  id: string;
  title: string;
  description?: string;
  maxScore?: number;
  dueDate?: string | null;
  isSubmitted?: boolean;
  score?: number | null;
}

export interface ExternalUnitNoteDto {
  id: string;
  timestampSeconds: number;
  content: string;
  createdAt: string | null;
}

export interface ExternalUnitDetailDto {
  id: string;
  unitProjectionId?: number;
  projectionSlug?: string;
  unitType?: 'lesson' | 'class_session';
  type?: 'lesson' | 'class_session';
  sectionId?: string | null;
  sectionTitle?: string | null;
  title: string;
  description?: string;
  sessionNumber?: number;
  isLocked?: boolean;
  lockReason?: string | null;
  requiredPrevUnitId?: string | null;
  requiredPrevUnitTitle?: string | null;
  requiredPrevUnitNumber?: number | null;
  isPublicPreview?: boolean;
  isPublicPreviewAccess?: boolean;
  video?: ExternalVideoPartDto | null;
  videos?: ExternalVideoPartDto[];
  watchProgress?: {
    lastPositionSeconds: number;
    watchedSeconds: number;
    durationSeconds: number;
    partCount: number;
    completionPercent: number;
    isCompleted: boolean;
    isVideoCompleted?: boolean;
    isQuizCompleted?: boolean;
  } | null;
  theory?: ExternalUnitTheoryDto | null;
  files?: ExternalUnitFileDto[];
  assignments?: ExternalUnitAssignmentDto[];
  quizzes?: ExternalUnitQuizDto[];
  vocabulary?: ExternalUnitVocabularyDto[];
  formulas?: ExternalUnitFormulaDto[];
  notes?: ExternalUnitNoteDto[];
}

export interface ExternalWorkspaceCapabilitiesDto {
  canPlayVideo?: boolean;
  canJoinLive?: boolean;
  canCheckIn?: boolean;
  showCalendar?: boolean;
  canSubmitAssignments?: boolean;
  allowFileDownload?: boolean;
  deviceLimit?: number;
  enforceTrustedDevices?: boolean;
  isPublicPreviewAccess?: boolean;
}

export interface ExternalWorkspaceSourceClassDto {
  id: string;
  title: string;
  status: string;
  instructorName: string | null;
}

export interface ExternalWorkspaceProgressDto {
  completedUnits: number;
  totalUnits: number;
  overallPercent: number;
}

export interface ExternalSelectedUnitLockDto {
  locked: boolean;
  code: string;
  reason: string | null;
  requiredPrevUnitTitle?: string | null;
}

export interface ExternalCourseWorkspaceDto {
  course: {
    id: number;
    slug: string;
    title: string;
    shortDescription: string;
    thumbnailUrl: string | null;
    contentOrigin: 'csca_course';
    remoteCourseId: string;
    ssoTargetPath: string;
  };
  profile: ProjectedProfileSummaryDto & {
    capabilities: ExternalWorkspaceCapabilitiesDto;
  };
  profiles: ProjectedProfileSummaryDto[];
  sourceClass: ExternalWorkspaceSourceClassDto | null;
  progress: ExternalWorkspaceProgressDto | null;
  isPublicPreviewAccess: boolean;
  delegatedSession: {
    expiresAt: string;
    ttlSeconds: number;
    scopes: string[];
  } | null;
  units: ExternalWorkspaceUnitSummaryDto[];
  activeUnit: ExternalUnitDetailDto | null;
  selectedUnitLock: ExternalSelectedUnitLockDto | null;
}
