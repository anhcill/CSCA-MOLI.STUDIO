import axios from '@/lib/utils/axios';
import type {
  ApiSuccessEnvelope,
  CourseProgressDto,
  CurriculumLessonDto,
  CurriculumSectionDto,
  LearningCourseDto,
  LearningLessonDto,
  LearningRoomDto,
  LessonProgressDto,
  MyLearningItemDto,
  PlaybackSessionDto,
  UpdateLessonProgressInput,
  LessonSubmissionDto,
  LessonQuestionThreadDto,
  ExternalCourseWorkspaceDto,
  ExternalUnitDetailDto,
} from '@/lib/types/courses';

function unwrapData<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('INVALID_API_RESPONSE');
  }
  return (payload as ApiSuccessEnvelope<T>).data;
}

function lesson(raw: LearningLessonDto & {
  estimatedDurationSeconds?: number;
  progress?: LessonProgressDto | null;
}): LearningLessonDto {
  return {
    ...raw,
    durationSeconds: raw.durationSeconds ?? raw.estimatedDurationSeconds ?? 0,
    isLocked: raw.isLocked === true,
    progressStatus: raw.progressStatus ?? raw.progress?.status ?? 'not_started',
    contentHtml: raw.contentHtml ?? null,
    resources: Array.isArray(raw.resources) ? raw.resources : [],
    assignment: raw.assignment ?? null,
    previousLessonId: raw.previousLessonId ?? null,
    nextLessonId: raw.nextLessonId ?? null,
  };
}

function curriculum(sections: CurriculumSectionDto[]): CurriculumSectionDto[] {
  return sections.map((section) => ({
    ...section,
    totalDurationSeconds: section.totalDurationSeconds ?? 0,
    lessons: (section.lessons ?? []).map((item) => lesson(item as LearningLessonDto)),
  }));
}

export const learningApi = {
  async getMyLearning(): Promise<MyLearningItemDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<MyLearningItemDto[]>>('/me/course-enrollments');
    const items = unwrapData<MyLearningItemDto[]>(response.data);
    return Array.isArray(items) ? items : [];
  },

  async getLearningCourse(courseId: number): Promise<LearningCourseDto> {
    const response = await axios.get<ApiSuccessEnvelope<LearningCourseDto>>(
      `/learning/courses/${encodeURIComponent(courseId)}`,
    );
    const data = unwrapData<LearningCourseDto>(response.data);
    return { ...data, curriculum: curriculum(data.curriculum ?? []) };
  },

  async getLesson(lessonId: number): Promise<LearningRoomDto> {
    const response = await axios.get<ApiSuccessEnvelope<LearningRoomDto>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}`,
    );
    const room = unwrapData<LearningRoomDto>(response.data);
    return {
      ...room,
      curriculum: curriculum(room.curriculum ?? []),
      lesson: lesson(room.lesson),
    };
  },

  async getCourseProgress(courseId: number): Promise<CourseProgressDto> {
    const response = await axios.get<ApiSuccessEnvelope<CourseProgressDto>>(
      `/learning/courses/${encodeURIComponent(courseId)}/progress`,
    );
    return unwrapData(response.data);
  },

  async getRoom(courseSlug: string, lessonId: number): Promise<LearningRoomDto> {
    const room = await this.getLesson(lessonId);
    if (room.course.slug !== courseSlug) throw new Error('LESSON_COURSE_MISMATCH');
    const flattened = room.curriculum.flatMap((section) => section.lessons);
    const index = flattened.findIndex((item) => item.id === lessonId);
    const normalizedLesson = {
      ...room.lesson,
      previousLessonId: room.lesson.previousLessonId ?? (typeof flattened[index - 1]?.id === 'number' ? (flattened[index - 1]!.id as number) : null),
      nextLessonId: room.lesson.nextLessonId ?? (typeof flattened[index + 1]?.id === 'number' ? (flattened[index + 1]!.id as number) : null),
    };
    return { ...room, lesson: normalizedLesson };
  },

  async createPlaybackSession(lessonId: number): Promise<PlaybackSessionDto> {
    const response = await axios.post<ApiSuccessEnvelope<PlaybackSessionDto>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/playback-session`,
    );
    return unwrapData(response.data);
  },

  async updateProgress(
    lessonId: number,
    input: UpdateLessonProgressInput,
    options: { keepalive?: boolean } = {},
  ): Promise<LessonProgressDto> {
    const response = await axios.put<ApiSuccessEnvelope<LessonProgressDto>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/progress`,
      input,
      options.keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : undefined,
    );
    return unwrapData(response.data);
  },

  async completeLesson(lessonId: number): Promise<LessonProgressDto> {
    const response = await axios.post<ApiSuccessEnvelope<LessonProgressDto>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/complete`,
    );
    return unwrapData(response.data);
  },

  async submitAssignment(lessonId: number, textContent: string, files: File[]): Promise<LessonSubmissionDto> {
    const payload = new FormData();
    payload.append('textContent', textContent);
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<LessonSubmissionDto>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/submission`,
      payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async getLessonQuestions(lessonId: number): Promise<LessonQuestionThreadDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/questions`,
    );
    return unwrapData(response.data);
  },

  async createLessonQuestion(lessonId: number, subject: string, body: string, files: File[]): Promise<LessonQuestionThreadDto[]> {
    const payload = new FormData();
    payload.append('subject', subject);
    payload.append('body', body);
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/questions`, payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async replyLessonQuestion(lessonId: number, threadId: number, body: string, files: File[]): Promise<LessonQuestionThreadDto[]> {
    const payload = new FormData();
    payload.append('body', body);
    files.forEach((file) => payload.append('files', file));
    const response = await axios.post<ApiSuccessEnvelope<LessonQuestionThreadDto[]>>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/questions/${encodeURIComponent(threadId)}/replies`, payload,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return unwrapData(response.data);
  },

  async getExternalCourseWorkspace({
    courseSlugOrId,
    profileId = null,
    unitId = null,
  }: {
    courseSlugOrId: string | number;
    profileId?: string | null;
    unitId?: string | number | null;
  }): Promise<ExternalCourseWorkspaceDto> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalCourseWorkspaceDto>>(
      `/learning/external/courses/${encodeURIComponent(String(courseSlugOrId))}/workspace`,
      {
        params: {
          ...(profileId ? { profileId } : {}),
          ...(unitId != null && String(unitId).trim() ? { unitId: String(unitId) } : {}),
        },
      },
    );
    return unwrapData(response.data);
  },

  async getExternalUnitDetail({
    profileId,
    unitId,
    courseId = null,
  }: {
    profileId: string;
    unitId: string | number;
    courseId?: string | number | null;
  }): Promise<ExternalUnitDetailDto> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalUnitDetailDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}`,
      {
        params: courseId != null ? { courseId: String(courseId) } : undefined,
      },
    );
    return unwrapData(response.data);
  },
};

export default learningApi;
