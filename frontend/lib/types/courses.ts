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

export interface CourseCommerceOfferDto {
  id: number;
  type: 'video' | 'combo';
  name: string;
  priceVnd: number;
  originalPriceVnd: number | null;
  requiresSubjectChoice: boolean;
}

export interface CourseProgressSummaryDto {
  completedLessons: number;
  totalLessons: number;
  completionPct: number;
  watchedSeconds?: number;
  lastLessonId: number | string | null;
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
  commerceOffers?: CourseCommerceOfferDto[];
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
  resumeUnitHref?: string | null;
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
  resumeUnitHref?: string | null;
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

export interface AdminCurriculumLessonDto extends Omit<CurriculumLessonDto, 'id'> {
  id: number;
}

export interface AdminCurriculumSectionDto extends Omit<CurriculumSectionDto, 'id' | 'lessons'> {
  id: number;
  lessons: AdminCurriculumLessonDto[];
}

export interface CourseAdminDto extends Omit<CourseDetailDto, 'curriculum'> {
  curriculum: AdminCurriculumSectionDto[];
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
  isSlide?: boolean;
  allowDownloadOverride?: boolean | null;
  revision?: number;
  updatedAt?: string | null;
}

export type ExternalQuizReviewPolicy =
  | 'immediate'
  | 'after_due'
  | 'after_graded'
  | 'never'
  | 'embargoed'
  | string;

export interface ExternalQuizEssayConfigDto {
  enabled: boolean;
  maxScore: number;
  prompt?: string;
}

export interface ExternalQuizEssayAttachmentDto {
  assetId: string;
  id?: string;
  name: string;
  size?: number;
  mimeType?: string;
  url?: string;
  uploadedAt?: string;
}

export interface ExternalQuizEssayAnswerDto {
  text?: string;
  notes?: string;
  attachments?: ExternalQuizEssayAttachmentDto[];
}

export interface ExternalUnitQuizDto {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  essayConfig?: ExternalQuizEssayConfigDto | null;
  activityScope?: string | null;
  durationMinutes?: number | null;
  passingScore?: number | null;
  attemptsCount?: number;
  attemptsUsed?: number;
  attemptLimit?: number | null;
  isCompleted?: boolean;
  bestScore?: number | null;
  maxScore?: number | null;
  reviewPolicy?: ExternalQuizReviewPolicy | null;
  canViewSolution?: boolean;
  hasSolution?: boolean;
  paperFileId?: string | null;
  solutionFileId?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  dueDate?: string | null;
  embargoUntil?: string | null;
}

export interface ExternalAssignmentRubricItemDto {
  id?: string;
  criterion: string;
  description?: string | null;
  maxPoints?: number | null;
}

export interface ExternalUnitAssignmentDto {
  id: string;
  title: string;
  description?: string | null;
  maxScore?: number | null;
  dueDate?: string | null;
  isSubmitted?: boolean;
  score?: number | null;
  gradedAt?: string | null;
  teacherFeedback?: string | null;
  rubric?: ExternalAssignmentRubricItemDto[] | string | null;
}

export interface ExternalUnitNoteDto {
  id: string;
  timestampSeconds: number;
  content: string;
  revision?: number;
  createdAt: string | null;
  updatedAt?: string | null;
}

export interface ExternalUnitBookmarkDto {
  id: string;
  timestampSeconds: number;
  label: string;
  videoAssetId?: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
}

export type ExternalQaStatus = 'open' | 'answered' | 'resolved';

export interface ExternalQaMessageDto {
  id: string;
  threadId?: string;
  authorId?: string | number | null;
  authorName: string;
  authorRole?: 'student' | 'teacher' | 'admin' | string;
  isTeacher?: boolean;
  isMine?: boolean;
  body: string;
  createdAt: string | null;
  updatedAt?: string | null;
}

export interface ExternalQaThreadDto {
  id: string;
  unitId?: string;
  title: string;
  body?: string;
  status: ExternalQaStatus;
  unreadCount?: number;
  hasUnread?: boolean;
  isUnread?: boolean;
  revision?: number;
  authorName?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messages?: ExternalQaMessageDto[];
  replies?: ExternalQaMessageDto[];
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
  bookmarks?: ExternalUnitBookmarkDto[];
  qaThreads?: ExternalQaThreadDto[];
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
  isAdmin?: boolean;
  canReviewFreely?: boolean;
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

export interface ExternalVideoPlaybackTokenDto {
  playbackSessionId: string;
  deliveryType: string;
  videoAssetId: string;
  unitId: string;
  unitType?: 'lesson' | 'class_session';
  profileId: string;
  courseId: string;
  title: string;
  embedUrl: string;
  hlsPlaylistUrl?: string | null;
  thumbnailUrl?: string | null;
  availableResolutions?: string[];
  durationSeconds: number;
  expiresAt: string;
  ttlSeconds: number;
  watermark?: {
    label?: string;
    userId?: string | number;
    externalUserId?: string;
    ipAddress?: string | null;
  } | null;
  resumePositionSeconds: number;
  watchProgress?: {
    lastPositionSeconds: number;
    watchedSeconds: number;
    completionPercent: number;
    isCompleted: boolean;
    completedAt?: string | null;
    lastHeartbeatAt?: string | null;
  } | null;
  unitProgress?: {
    totalDurationSeconds: number;
    watchedSeconds: number;
    completionPercent: number;
    isCompleted: boolean;
    partCount?: number;
    completedPartCount?: number;
  } | null;
  unitProjectionId?: number;
  projectionSlug?: string;
  deviceSlot?: {
    id?: number;
    deviceName?: string;
  } | null;
}

export interface ExternalVideoProgressInput {
  currentTimeSeconds: number;
  watchedDeltaSeconds: number;
  durationSeconds?: number | null;
  clientSequence?: number;
  eventTimestamp?: string;
}

export interface ExternalVideoProgressDto {
  stale: boolean;
  ignoredReason: string | null;
  videoAssetId: string;
  unitId: string;
  unitType?: 'lesson' | 'class_session';
  profileId: string;
  courseId: string;
  lastPositionSeconds: number;
  watchedSeconds: number;
  completionPercent: number;
  isVideoCompleted: boolean;
  isUnitCompleted: boolean;
  completedAt: string | null;
  lastHeartbeatAt: string | null;
  durationSeconds: number;
  clientSequence: number;
  syncRevision: number;
  unitProgress?: {
    totalDurationSeconds: number;
    watchedSeconds: number;
    completionPercent: number;
    isCompleted: boolean;
    partCount?: number;
    completedPartCount?: number;
  } | null;
  courseProgress?: ExternalWorkspaceProgressDto | null;
  units?: Array<{
    id: string;
    unitType?: 'lesson' | 'class_session';
    sessionNumber?: number;
    isLocked: boolean;
    isCompleted: boolean;
    progressPercent: number;
  }>;
  unitProjectionId?: number;
  projectionSlug?: string;
}

export interface ExternalFileDownloadProgress {
  phase: 'authenticating' | 'connecting' | 'downloading' | 'rendering';
  loadedBytes: number;
  totalBytes: number;
  percent: number | null;
}

export interface ExternalFileStreamResult {
  data: ArrayBuffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface ExternalQuizOptionDto {
  id?: string;
  key?: string;
  label?: string;
  text: string;
  textCn?: string | null;
  textEn?: string | null;
  imageUrl?: string | null;
  isCorrect?: boolean;
}

export type ExternalQuizQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'reading_item'
  | 'fill_blank_item'
  | 'fill_blank'
  | 'short_answer'
  | 'essay'
  | 'translation'
  | string;

export interface ExternalQuizQuestionDto {
  id: string;
  questionId?: string;
  position?: number;
  sortOrder?: number;
  groupId?: string | number | null;
  groupKind?: string | null;
  groupType?: string | null;
  passageText?: string | null;
  passageTextCn?: string | null;
  passageTextEn?: string | null;
  passageImageUrl?: string | null;
  clozeMode?: string | null;
  linkedOptions?: ExternalQuizOptionDto[];
  questionType: ExternalQuizQuestionType;
  prompt: string;
  questionText?: string;
  questionTextCn?: string | null;
  questionTextEn?: string | null;
  promptHtml?: string | null;
  points?: number;
  options?: ExternalQuizOptionDto[];
  correctAnswer?: unknown;
  explanation?: string | null;
  explanationCn?: string | null;
  explanationEn?: string | null;
  imageUrl?: string | null;
  explanationImageUrl?: string | null;
  subQuestionNumber?: number | null;
  userAnswer?: unknown;
  studentAnswer?: unknown;
  isCorrect?: boolean | null;
  isGraded?: boolean | null;
  earnedPoints?: number | null;
  essayFeedback?: string | null;
  teacherAttachments?: Array<{ name?: string; originalFilename?: string; url?: string; mimeType?: string }> | null;
}

export interface ExternalQuizItemDto {
  id: string;
  kind: 'question' | 'reading_group' | 'fill_blank_group' | string;
  groupType?: string | null;
  passageText?: string | null;
  passageTextCn?: string | null;
  passageTextEn?: string | null;
  passageImageUrl?: string | null;
  clozeMode?: string | null;
  linkedOptions?: ExternalQuizOptionDto[];
  question?: ExternalQuizQuestionDto;
  questions: ExternalQuizQuestionDto[];
}

export interface ExternalQuizAttemptDto {
  id: string;
  quizId?: string;
  attemptNumber?: number;
  status: 'in_progress' | 'submitted' | 'graded' | 'expired' | string;
  startedAt?: string | null;
  expiresAt?: string | null;
  submittedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  percent?: number | null;
  isPassed?: boolean | null;
  answers?: Record<string, unknown>;
  remainingSeconds?: number | null;
}

export interface ExternalQuizResultDto {
  score: number;
  maxScore: number;
  percent?: number;
  percentage?: number;
  isPassed: boolean;
  passed?: boolean;
  correctCount?: number;
  totalQuestions?: number;
  canViewSolution?: boolean;
  solutionFileId?: string | null;
  hasSolution?: boolean;
  reviewPolicy?: ExternalQuizReviewPolicy | null;
  embargoUntil?: string | null;
  essay?: Record<string, unknown> | null;
  essayGrade?: Record<string, unknown> | null;
  items?: ExternalQuizItemDto[];
  questions?: ExternalQuizQuestionDto[];
  review?: ExternalQuizQuestionDto[];
}

export interface ExternalQuizDetailDto {
  quiz: ExternalUnitQuizDto;
  items?: ExternalQuizItemDto[];
  questions: ExternalQuizQuestionDto[];
  activeAttempt?: ExternalQuizAttemptDto | null;
  attempts?: ExternalQuizAttemptDto[];
  latestAttempt?: ExternalQuizAttemptDto | null;
  latestResult?: ExternalQuizResultDto | null;
  attemptsCount?: number;
  maxAttempts?: number | null;
  canStartAttempt?: boolean;
  attemptsRemaining?: number | null;
  isAdminBypass?: boolean;
  canReviewFreely?: boolean;
  canViewSolution?: boolean;
  reviewPolicy?: ExternalQuizReviewPolicy | null;
  embargoUntil?: string | null;
  solutionEmbargoedReason?: string | null;
  reviewItems?: ExternalQuizQuestionDto[];
  reviewItemGroups?: ExternalQuizItemDto[];
}

export interface ExternalQuizSubmitResponseDto {
  attempt: ExternalQuizAttemptDto;
  result: ExternalQuizResultDto;
  unlockedNextUnitId?: string | null;
  nextUnitType?: string | null;
  unitProgress?: {
    totalDurationSeconds?: number;
    watchedSeconds?: number;
    completionPercent: number;
    isCompleted: boolean;
    isVideoCompleted?: boolean;
    isQuizCompleted?: boolean;
  } | null;
  courseProgress?: ExternalWorkspaceProgressDto | null;
  units?: Array<{
    id: string;
    unitType?: 'lesson' | 'class_session';
    sessionNumber?: number;
    isLocked: boolean;
    isCompleted: boolean;
    progressPercent: number;
  }>;
  canViewSolution?: boolean;
}

export interface ExternalAssignmentAttachmentDto {
  id?: string;
  fileName?: string;
  originalName?: string;
  originalFilename?: string;
  assetKind?: string;
  mimeType?: string | null;
  sizeBytes?: number;
  url?: string | null;
  fileKind?: string;
}

export interface ExternalAssignmentSubmissionDto {
  id: string;
  assignmentId?: string;
  status: 'submitted' | 'graded' | 'returned' | 'draft' | string;
  contentText?: string | null;
  textContent?: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore?: number | null;
  teacherFeedback?: string | null;
  gradedAt?: string | null;
  attachments?: ExternalAssignmentAttachmentDto[];
  files?: ExternalAssignmentAttachmentDto[];
  assets?: ExternalAssignmentAttachmentDto[];
}

export interface ExternalAssignmentDetailDto {
  assignment: ExternalUnitAssignmentDto & {
    instructions?: string | null;
    allowFileUpload?: boolean;
    allowTextSubmission?: boolean;
    attachments?: ExternalAssignmentAttachmentDto[];
  };
  submission?: ExternalAssignmentSubmissionDto | null;
  submissions?: ExternalAssignmentSubmissionDto[];
}
