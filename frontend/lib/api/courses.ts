import axios from '@/lib/utils/axios';
import type {
  AdminCourseEnrollmentItemDto,
  AdminCourseEnrollmentQuery,
  AdminCourseEnrollmentsResponseDto,
  ApiPaginationDto,
  ApiSuccessEnvelope,
  CourseAdminDto,
  CourseAdminInput,
  CourseCatalogDto,
  CourseCatalogItemDto,
  CourseCatalogQuery,
  CourseDetailDto,
  CourseFileDto,
  CourseTeacherDto,
  CurriculumLessonDto,
  CurriculumLessonInput,
  CurriculumReorderInput,
  CurriculumSectionDto,
  CurriculumSectionInput,
  EnrollmentDto,
  GrantCourseEnrollmentInput,
  GrantCourseEnrollmentResultDto,
  LessonAssignmentDto,
  LessonAssignmentInput,
  LessonQuestionStatus,
  LessonQuestionThreadDto,
  LessonSubmissionDto,
  LessonWorkDto,
  PublishReadyResultDto,
  RevokeCourseEnrollmentResultDto,
  VipPackageDto,
} from '@/lib/types/courses';

export function slugifyVietnamese(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export function extractCourseApiError(err: unknown, fallback: string): string {
  const responseData = (err as {
    response?: {
      data?: {
        message?: string;
        code?: string;
        details?: unknown;
        error?: { message?: string; code?: string; details?: unknown };
      };
    };
  })?.response?.data;

  const details = responseData?.error?.details ?? responseData?.details;
  const code = responseData?.error?.code ?? responseData?.code;
  const rawMessage = responseData?.error?.message ?? responseData?.message;

  if (details && typeof details === 'object') {
    const info = details as Record<string, unknown>;
    const issues: string[] = [];
    if (info.publishedSections === 0 || info.missingPublishedSections === true) {
      issues.push('chưa có chương nào được bật hiển thị');
    }
    if (info.publishedLessons === 0 || info.missingPublishedLessons === true) {
      issues.push('chưa có bài học nào được bật hiển thị');
    }
    if (typeof info.unreadyVideoLessons === 'number' && info.unreadyVideoLessons > 0) {
      issues.push(`còn ${info.unreadyVideoLessons} bài video chưa gắn hoặc chưa xử lý xong video`);
    }
    if (Array.isArray(info.reasons) && info.reasons.length > 0) {
      const mapped = info.reasons.filter((r): r is string => typeof r === 'string');
      if (mapped.length > 0) issues.push(...mapped);
    }
    if (typeof info.reason === 'string' && info.reason.trim()) {
      issues.push(info.reason.trim());
    }
    if (issues.length > 0) {
      return `Chưa đủ điều kiện xuất bản: ${issues.join('; ')}.`;
    }
  }

  if (code === 'COURSE_SLUG_EXISTS' || code === 'DUPLICATE_SLUG') {
    return 'Đường dẫn URL (slug) này đã tồn tại. Vui lòng chọn đường dẫn khác.';
  }
  if (rawMessage && typeof rawMessage === 'string' && rawMessage.trim()) {
    return rawMessage;
  }
  return fallback;
}

function unwrapData<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('INVALID_API_RESPONSE');
  }
  return (payload as ApiSuccessEnvelope<T>).data;
}

function catalogItem(raw: CourseCatalogItemDto & { progressPct?: number }): CourseCatalogItemDto {
  return {
    ...raw,
    packages: Array.isArray(raw.packages)
      ? raw.packages
          .map((pkg) => ({ id: Number(pkg.id), name: String(pkg.name ?? '') }))
          .filter((pkg) => Number.isSafeInteger(pkg.id) && pkg.id > 0)
      : [],
    priceVnd: raw.priceVnd ?? null,
    compareAtPriceVnd: raw.compareAtPriceVnd ?? null,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    instructor: raw.instructor ?? null,
    progress: raw.progress ?? (raw.progressPct !== undefined
      ? {
          completedLessons: 0,
          totalLessons: raw.totalLessons ?? 0,
          completionPct: raw.progressPct,
          lastLessonId: null,
          lastLessonTitle: null,
          lastPositionSeconds: 0,
        }
      : null),
    publishedAt: raw.publishedAt ?? null,
    contentUpdatedAt: raw.contentUpdatedAt ?? null,
  };
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? item : (item as { content?: unknown })?.content)
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function courseDetail(raw: CourseDetailDto & {
  description?: string;
  access?: CourseDetailDto['access'] & { denialCode?: string | null };
}): CourseDetailDto {
  const item = catalogItem(raw);
  return {
    ...raw,
    ...item,
    descriptionHtml: raw.descriptionHtml ?? raw.description ?? '',
    outcomes: textList(raw.outcomes),
    requirements: textList(raw.requirements),
    suitableFor: textList(raw.suitableFor),
    certificateEnabled: raw.certificateEnabled === true,
    curriculum: Array.isArray(raw.curriculum) ? raw.curriculum : [],
    access: {
      accessType: raw.access?.accessType ?? raw.accessType,
      canEnroll: raw.access?.canEnroll === true,
      canLearn: raw.access?.canLearn === true,
      isEnrolled: raw.access?.isEnrolled === true,
      reasonCode: raw.access?.reasonCode ?? raw.access?.denialCode ?? null,
      ctaLabel: raw.access?.ctaLabel ?? (raw.access?.canLearn ? 'Tiếp tục học' : 'Đăng ký học'),
    },
  };
}

type AdminLessonRaw = Partial<CurriculumLessonDto> & {
  estimatedDurationSeconds?: number;
};

type AdminSectionRaw = Omit<Partial<CurriculumSectionDto>, 'lessons'> & {
  lessons?: AdminLessonRaw[];
};

type AdminRaw = Omit<Partial<CourseAdminDto>, 'curriculum'> & {
  description?: string | null;
  sections?: AdminSectionRaw[];
  curriculum?: AdminSectionRaw[];
};

type AdminListResponse = {
  items: AdminRaw[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

function adminCourse(raw: AdminRaw): CourseAdminDto {
  const sections = raw.sections ?? raw.curriculum ?? [];
  const curriculum: CurriculumSectionDto[] = sections.map((section) => ({
    id: Number(section.id),
    title: section.title ?? '',
    description: section.description ?? null,
    sortOrder: section.sortOrder ?? 0,
    totalDurationSeconds: section.totalDurationSeconds ?? 0,
    isPublished: section.isPublished === true,
    lessons: (section.lessons ?? []).map((lesson) => {
      const resolvedDuration = lesson.durationSeconds ?? lesson.estimatedDurationSeconds ?? 0;
      return {
        id: Number(lesson.id),
        externalKey: lesson.externalKey ?? '',
        slug: lesson.slug ?? '',
        title: lesson.title ?? '',
        summary: lesson.summary ?? null,
        lessonType: lesson.lessonType ?? 'video',
        sortOrder: lesson.sortOrder ?? 0,
        durationSeconds: resolvedDuration,
        estimatedDurationSeconds: lesson.estimatedDurationSeconds ?? resolvedDuration,
        isFreePreview: lesson.isFreePreview === true,
        isRequired: lesson.isRequired !== false,
        isLocked: false,
        progressStatus: 'not_started',
        isPublished: lesson.isPublished === true,
        videoAssetId: lesson.videoAssetId ?? null,
        contentHtml: lesson.contentHtml ?? null,
      };
    }),
  }));
  return {
    id: Number(raw.id),
    externalKey: raw.externalKey ?? '',
    slug: raw.slug ?? '',
    title: raw.title ?? '',
    shortDescription: raw.shortDescription ?? '',
    descriptionHtml: raw.descriptionHtml ?? raw.description ?? '',
    subjectCode: raw.subjectCode ?? 'MATH',
    level: raw.level ?? 'basic',
    thumbnailUrl: raw.thumbnailUrl ?? null,
    accessType: raw.accessType ?? 'free',
    priceVnd: raw.priceVnd ?? null,
    compareAtPriceVnd: raw.compareAtPriceVnd ?? null,
    packages: Array.isArray(raw.packages)
      ? raw.packages.map((pkg) => ({ id: Number(pkg.id), name: String(pkg.name ?? '') }))
      : [],
    packageIds: Array.isArray(raw.packageIds)
      ? raw.packageIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
      : [],
    isFeatured: raw.isFeatured === true,
    isNew: raw.isNew === true,
    isHot: raw.isHot === true,
    ratingAvg: raw.ratingAvg ?? 0,
    ratingCount: raw.ratingCount ?? 0,
    enrolledCount: raw.enrolledCount ?? 0,
    totalSections: raw.totalSections ?? curriculum.length,
    totalLessons: raw.totalLessons ?? curriculum.reduce((sum, section) => sum + section.lessons.length, 0),
    totalDurationSeconds: raw.totalDurationSeconds ?? 0,
    instructor: raw.instructor ?? null,
    progress: null,
    publishedAt: raw.publishedAt ?? null,
    contentUpdatedAt: raw.contentUpdatedAt ?? null,
    certificateEnabled: raw.certificateEnabled === true,
    curriculum,
    outcomes: [],
    requirements: [],
    suitableFor: [],
    access: {
      accessType: raw.accessType ?? 'free',
      canEnroll: false,
      canLearn: false,
      isEnrolled: false,
      reasonCode: null,
      ctaLabel: '',
    },
    status: raw.status ?? 'draft',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

function adminInput(input: Partial<CourseAdminInput>): Record<string, unknown> {
  return { ...input };
}

export const coursesApi = {
  async getTeacherOptions(): Promise<CourseTeacherDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<CourseTeacherDto[]>>('/admin/courses/teacher-options');
    return unwrapData(response.data);
  },

  async getCourseTeachers(courseId: number): Promise<CourseTeacherDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<CourseTeacherDto[]>>(`/admin/courses/${encodeURIComponent(courseId)}/teachers`);
    return unwrapData(response.data);
  },

  async replaceCourseTeachers(courseId: number, userIds: number[]): Promise<CourseTeacherDto[]> {
    const response = await axios.put<ApiSuccessEnvelope<CourseTeacherDto[]>>(
      `/admin/courses/${encodeURIComponent(courseId)}/teachers`,
      { userIds },
    );
    return unwrapData(response.data);
  },

  async getActivePackages(): Promise<VipPackageDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<VipPackageDto[]>>('/vip/packages');
    return unwrapData<VipPackageDto[]>(response.data).filter((pkg) => pkg.is_active !== false);
  },

  async getCatalog(query: CourseCatalogQuery = {}): Promise<CourseCatalogDto> {
    const response = await axios.get<ApiSuccessEnvelope<CourseCatalogDto>>('/courses', { params: query });
    const catalog = unwrapData<CourseCatalogDto>(response.data);
    return { ...catalog, items: (catalog.items ?? []).map(catalogItem) };
  },

  async getCourse(slug: string): Promise<CourseDetailDto> {
    const response = await axios.get<ApiSuccessEnvelope<CourseDetailDto>>(
      `/courses/${encodeURIComponent(slug)}`,
    );
    return courseDetail(unwrapData(response.data));
  },

  async enroll(courseId: number): Promise<EnrollmentDto> {
    const response = await axios.post<ApiSuccessEnvelope<EnrollmentDto>>(
      `/courses/${encodeURIComponent(courseId)}/enroll`,
    );
    return unwrapData(response.data);
  },

  async getAdminCourses(query: CourseCatalogQuery = {}): Promise<CourseCatalogDto & { items: CourseAdminDto[] }> {
    const { pageSize } = query;
    const response = await axios.get<ApiSuccessEnvelope<AdminListResponse>>('/admin/courses', {
      params: {
        page: query.page,
        limit: pageSize,
        subjectCode: query.subjectCode,
        status: query.status,
        q: query.search,
      },
    });
    const data = unwrapData<AdminListResponse>(response.data);
    const items = data.items.map(adminCourse);
    const pagination = data.pagination;
    return {
      items,
      page: pagination.page,
      pageSize: pagination.limit,
      totalItems: pagination.total,
      totalPages: pagination.totalPages,
    };
  },

  async getAdminCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.get<ApiSuccessEnvelope<AdminRaw>>(`/admin/courses/${encodeURIComponent(courseId)}`);
    return adminCourse(unwrapData(response.data));
  },

  async createCourse(input: CourseAdminInput): Promise<CourseAdminDto> {
    const response = await axios.post<ApiSuccessEnvelope<AdminRaw>>('/admin/courses', adminInput(input));
    return adminCourse(unwrapData(response.data));
  },

  async updateCourse(courseId: number, input: Partial<CourseAdminInput>): Promise<CourseAdminDto> {
    const response = await axios.patch<ApiSuccessEnvelope<AdminRaw>>(`/admin/courses/${encodeURIComponent(courseId)}`, adminInput(input));
    return adminCourse(unwrapData(response.data));
  },

  async createSection(courseId: number, input: CurriculumSectionInput): Promise<CurriculumSectionDto> {
    const response = await axios.post<ApiSuccessEnvelope<CurriculumSectionDto>>(`/admin/courses/${encodeURIComponent(courseId)}/sections`, input);
    return unwrapData(response.data);
  },

  async createLesson(courseId: number, input: CurriculumLessonInput): Promise<CurriculumLessonDto> {
    const response = await axios.post<ApiSuccessEnvelope<CurriculumLessonDto>>(`/admin/courses/${encodeURIComponent(courseId)}/lessons`, input);
    return unwrapData(response.data);
  },

  async updateSection(courseId: number, sectionId: number, input: Partial<CurriculumSectionInput>): Promise<CurriculumSectionDto> {
    const response = await axios.patch<ApiSuccessEnvelope<CurriculumSectionDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}`,
      input,
    );
    return unwrapData(response.data);
  },

  async updateLesson(courseId: number, lessonId: number, input: Partial<CurriculumLessonInput>): Promise<CurriculumLessonDto> {
    const response = await axios.patch<ApiSuccessEnvelope<CurriculumLessonDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
      input,
    );
    return unwrapData(response.data);
  },

  async deleteSection(courseId: number, sectionId: number): Promise<{ deleted: boolean }> {
    const response = await axios.delete<ApiSuccessEnvelope<{ deleted: boolean }>>(
      `/admin/courses/${encodeURIComponent(courseId)}/sections/${encodeURIComponent(sectionId)}`,
    );
    return unwrapData(response.data);
  },

  async deleteLesson(courseId: number, lessonId: number): Promise<{ deleted: boolean }> {
    const response = await axios.delete<ApiSuccessEnvelope<{ deleted: boolean }>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
    );
    return unwrapData(response.data);
  },

  async reorderCurriculum(courseId: number, input: CurriculumReorderInput): Promise<CourseAdminDto> {
    const response = await axios.put<ApiSuccessEnvelope<AdminRaw>>(
      `/admin/courses/${encodeURIComponent(courseId)}/curriculum/reorder`,
      input,
    );
    return adminCourse(unwrapData(response.data));
  },

  async publishReadyCurriculum(courseId: number): Promise<PublishReadyResultDto> {
    const response = await axios.post<ApiSuccessEnvelope<{
      publishedSections: number;
      publishedLessons: number;
      skippedVideoLessons: number;
      course: AdminRaw;
    }>>(`/admin/courses/${encodeURIComponent(courseId)}/publish-ready`);
    const raw = unwrapData<{
      publishedSections?: number;
      publishedLessons?: number;
      skippedVideoLessons?: number;
      course: AdminRaw;
    }>(response.data);
    return {
      publishedSections: Number(raw.publishedSections ?? 0),
      publishedLessons: Number(raw.publishedLessons ?? 0),
      skippedVideoLessons: Number(raw.skippedVideoLessons ?? 0),
      course: adminCourse(raw.course),
    };
  },

  async getCourseEnrollments(
    courseId: number,
    query: AdminCourseEnrollmentQuery = {},
  ): Promise<AdminCourseEnrollmentsResponseDto> {
    const response = await axios.get<ApiSuccessEnvelope<{
      items?: AdminCourseEnrollmentItemDto[];
      pagination?: ApiPaginationDto;
    } | AdminCourseEnrollmentItemDto[]>>(
      `/admin/courses/${encodeURIComponent(courseId)}/enrollments`,
      { params: query },
    );
    const data = unwrapData<{
      items?: AdminCourseEnrollmentItemDto[];
      pagination?: ApiPaginationDto;
    } | AdminCourseEnrollmentItemDto[]>(response.data);
    if (Array.isArray(data)) {
      return {
        items: data,
        pagination: response.data.pagination ?? { page: 1, limit: data.length || 20, total: data.length, totalPages: 1 },
      };
    }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      pagination: data.pagination ?? response.data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 },
    };
  },

  async grantCourseEnrollments(
    courseId: number,
    input: GrantCourseEnrollmentInput,
  ): Promise<GrantCourseEnrollmentResultDto> {
    const response = await axios.post<ApiSuccessEnvelope<GrantCourseEnrollmentResultDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/enrollments/grant`,
      input,
    );
    return unwrapData(response.data);
  },

  async revokeCourseEnrollment(
    courseId: number,
    enrollmentId: number,
    reason?: string,
  ): Promise<RevokeCourseEnrollmentResultDto> {
    const response = await axios.post<ApiSuccessEnvelope<RevokeCourseEnrollmentResultDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(enrollmentId)}/revoke`,
      { reason },
    );
    return unwrapData(response.data);
  },

  async getTeachingCourses(query: CourseCatalogQuery = {}): Promise<CourseCatalogDto> {
    const { pageSize } = query;
    const response = await axios.get<ApiSuccessEnvelope<AdminListResponse>>('/admin/course-teaching', {
      params: { page: query.page, limit: pageSize, subjectCode: query.subjectCode, q: query.search },
    });
    const data = unwrapData<AdminListResponse>(response.data);
    const items = data.items.map(adminCourse);
    const pagination = data.pagination;
    return { items, page: pagination.page, pageSize: pagination.limit, totalItems: pagination.total, totalPages: pagination.totalPages };
  },

  async getTeachingCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.get<ApiSuccessEnvelope<AdminRaw>>(`/admin/course-teaching/${encodeURIComponent(courseId)}`);
    return adminCourse(unwrapData(response.data));
  },

  async getLessonWork(courseId: number, lessonId: number): Promise<LessonWorkDto> {
    const response = await axios.get<ApiSuccessEnvelope<LessonWorkDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/work`,
    );
    return unwrapData(response.data);
  },

  async getTeachingLessonWork(courseId: number, lessonId: number): Promise<LessonWorkDto> {
    const response = await axios.get<ApiSuccessEnvelope<LessonWorkDto>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/work`,
    );
    return unwrapData(response.data);
  },

  async uploadLessonResources(courseId: number, lessonId: number, files: File[]): Promise<CourseFileDto[]> {
    const payload = new FormData();
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<CourseFileDto[]>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/resources`,
      payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async deleteLessonResource(courseId: number, lessonId: number, resourceId: number): Promise<void> {
    await axios.delete(`/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/resources/${encodeURIComponent(resourceId)}`);
  },

  async saveLessonAssignment(courseId: number, lessonId: number, input: LessonAssignmentInput): Promise<LessonAssignmentDto> {
    const response = await axios.put<ApiSuccessEnvelope<LessonAssignmentDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment`,
      input,
    );
    return unwrapData(response.data);
  },

  async saveTeachingAssignment(courseId: number, lessonId: number, input: LessonAssignmentInput): Promise<LessonAssignmentDto> {
    const response = await axios.put<ApiSuccessEnvelope<LessonAssignmentDto>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment`,
      input,
    );
    return unwrapData(response.data);
  },

  async uploadAssignmentAttachments(courseId: number, lessonId: number, files: File[]): Promise<CourseFileDto[]> {
    const payload = new FormData();
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<CourseFileDto[]>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment/attachments`,
      payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async uploadTeachingAttachments(courseId: number, lessonId: number, files: File[]): Promise<CourseFileDto[]> {
    const payload = new FormData();
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<CourseFileDto[]>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment/attachments`,
      payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async deleteAssignmentAttachment(courseId: number, lessonId: number, attachmentId: number): Promise<void> {
    await axios.delete(`/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment/attachments/${encodeURIComponent(attachmentId)}`);
  },

  async deleteTeachingAttachment(courseId: number, lessonId: number, attachmentId: number): Promise<void> {
    await axios.delete(`/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/assignment/attachments/${encodeURIComponent(attachmentId)}`);
  },

  async gradeLessonSubmission(courseId: number, lessonId: number, submissionId: number, score: number, feedback: string): Promise<LessonSubmissionDto> {
    const response = await axios.patch<ApiSuccessEnvelope<LessonSubmissionDto>>(
      `/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/submissions/${encodeURIComponent(submissionId)}/grade`,
      { score, feedback },
    );
    return unwrapData(response.data);
  },

  async gradeTeachingSubmission(courseId: number, lessonId: number, submissionId: number, score: number, feedback: string): Promise<LessonSubmissionDto> {
    const response = await axios.patch<ApiSuccessEnvelope<LessonSubmissionDto>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/submissions/${encodeURIComponent(submissionId)}/grade`,
      { score, feedback },
    );
    return unwrapData(response.data);
  },

  async getTeachingLessonQuestions(courseId: number, lessonId: number): Promise<LessonQuestionThreadDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/questions`,
    );
    return unwrapData(response.data);
  },

  async replyTeachingLessonQuestion(courseId: number, lessonId: number, threadId: number, body: string, files: File[]): Promise<LessonQuestionThreadDto[]> {
    const payload = new FormData();
    payload.append('body', body);
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/questions/${encodeURIComponent(threadId)}/replies`,
      payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async updateTeachingQuestionStatus(courseId: number, lessonId: number, threadId: number, status: LessonQuestionStatus): Promise<LessonQuestionThreadDto[]> {
    const response = await axios.patch<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/admin/course-teaching/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/questions/${encodeURIComponent(threadId)}/status`,
      { status },
    );
    return unwrapData(response.data);
  },

  async publishCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.post<ApiSuccessEnvelope<AdminRaw>>(
      `/admin/courses/${encodeURIComponent(courseId)}/publish`,
    );
    return adminCourse(unwrapData(response.data));
  },

  async unpublishCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.post<ApiSuccessEnvelope<AdminRaw>>(
      `/admin/courses/${encodeURIComponent(courseId)}/unpublish`,
    );
    return adminCourse(unwrapData(response.data));
  },

  async archiveCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.post<ApiSuccessEnvelope<AdminRaw>>(
      `/admin/courses/${encodeURIComponent(courseId)}/archive`,
    );
    return adminCourse(unwrapData(response.data));
  },
};

export default coursesApi;
