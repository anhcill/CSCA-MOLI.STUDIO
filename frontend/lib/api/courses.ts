import axios from '@/lib/utils/axios';
import type {
  ApiSuccessEnvelope,
  CourseAdminDto,
  CourseAdminInput,
  CourseCatalogDto,
  CourseCatalogItemDto,
  CourseCatalogQuery,
  CourseDetailDto,
  CurriculumLessonDto,
  CurriculumLessonInput,
  CurriculumSectionDto,
  CurriculumSectionInput,
  EnrollmentDto,
} from '@/lib/types/courses';

function unwrapData<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('INVALID_API_RESPONSE');
  }
  return (payload as ApiSuccessEnvelope<T>).data;
}

function catalogItem(raw: CourseCatalogItemDto & { progressPct?: number }): CourseCatalogItemDto {
  return {
    ...raw,
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
    lessons: (section.lessons ?? []).map((lesson) => ({
      id: Number(lesson.id), externalKey: lesson.externalKey ?? '', slug: lesson.slug ?? '',
      title: lesson.title ?? '', summary: lesson.summary ?? null,
      lessonType: lesson.lessonType ?? 'video', sortOrder: lesson.sortOrder ?? 0,
      durationSeconds: lesson.durationSeconds ?? lesson.estimatedDurationSeconds ?? 0,
      isFreePreview: lesson.isFreePreview === true, isRequired: lesson.isRequired !== false,
      isLocked: false, progressStatus: 'not_started',
      isPublished: lesson.isPublished === true,
      videoAssetId: lesson.videoAssetId ?? null,
      contentHtml: lesson.contentHtml ?? null,
    })),
  }));
  return {
    id: Number(raw.id), externalKey: raw.externalKey ?? '', slug: raw.slug ?? '', title: raw.title ?? '',
    shortDescription: raw.shortDescription ?? '', descriptionHtml: raw.descriptionHtml ?? raw.description ?? '',
    subjectCode: raw.subjectCode ?? 'MATH', level: raw.level ?? 'basic', thumbnailUrl: raw.thumbnailUrl ?? null,
    accessType: raw.accessType ?? 'free', priceVnd: raw.priceVnd ?? null, compareAtPriceVnd: raw.compareAtPriceVnd ?? null,
    isFeatured: raw.isFeatured === true, isNew: raw.isNew === true, isHot: raw.isHot === true,
    ratingAvg: raw.ratingAvg ?? 0, ratingCount: raw.ratingCount ?? 0, enrolledCount: raw.enrolledCount ?? 0,
    totalSections: raw.totalSections ?? curriculum.length,
    totalLessons: raw.totalLessons ?? curriculum.reduce((sum, section) => sum + section.lessons.length, 0),
    totalDurationSeconds: raw.totalDurationSeconds ?? 0, instructor: raw.instructor ?? null, progress: null,
    publishedAt: raw.publishedAt ?? null, contentUpdatedAt: raw.contentUpdatedAt ?? null,
    certificateEnabled: raw.certificateEnabled === true, curriculum,
    outcomes: [], requirements: [], suitableFor: [],
    access: { accessType: raw.accessType ?? 'free', canEnroll: false, canLearn: false, isEnrolled: false, reasonCode: null, ctaLabel: '' },
    status: raw.status ?? 'draft', createdAt: raw.createdAt ?? '', updatedAt: raw.updatedAt ?? '',
  };
}

function adminInput(input: Partial<CourseAdminInput>): Record<string, unknown> {
  return { ...input };
}

export const coursesApi = {
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

  async getAdminCourses(query: CourseCatalogQuery = {}): Promise<CourseCatalogDto> {
    const { pageSize, ...filters } = query;
    const response = await axios.get<ApiSuccessEnvelope<AdminListResponse>>('/admin/courses', {
      params: { page: query.page, limit: pageSize, subjectCode: query.subjectCode, q: query.search },
    });
    const data = unwrapData<AdminListResponse>(response.data);
    const items = data.items.map(adminCourse);
    const pagination = data.pagination;
    return { items, page: pagination.page, pageSize: pagination.limit, totalItems: pagination.total, totalPages: pagination.totalPages };
  },

  async getAdminCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.get<ApiSuccessEnvelope<CourseAdminDto>>(`/admin/courses/${encodeURIComponent(courseId)}`);
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

  async publishCourse(courseId: number): Promise<CourseAdminDto> {
    const response = await axios.post<ApiSuccessEnvelope<AdminRaw>>(
      `/admin/courses/${encodeURIComponent(courseId)}/publish`,
    );
    return adminCourse(unwrapData(response.data));
  },
};

export default coursesApi;
