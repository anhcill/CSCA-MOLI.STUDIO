import axios from '@/lib/utils/axios';
import { formatSyncedLessonTitle } from '@/lib/coursePresentation';
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
  ExternalVideoPlaybackTokenDto,
  ExternalVideoProgressDto,
  ExternalVideoProgressInput,
  ExternalFileDownloadProgress,
  ExternalFileStreamResult,
  ExternalQuizDetailDto,
  ExternalQuizEssayAttachmentDto,
  ExternalQuizItemDto,
  ExternalQuizAttemptDto,
  ExternalQuizQuestionDto,
  ExternalQuizSubmitResponseDto,
  ExternalUnitQuizDto,
  ExternalAssignmentDetailDto,
  ExternalAssignmentSubmissionDto,
  ExternalUnitNoteDto,
  ExternalUnitBookmarkDto,
  ExternalQaThreadDto,
  ExternalQaStatus,
} from '@/lib/types/courses';

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface GroupQuestionContext {
  groupId?: string | number | null;
  groupKind?: string | null;
  groupType?: string | null;
  passageText?: string;
  passageTextCn?: string | null;
  passageTextEn?: string | null;
  passageImageUrl?: string | null;
  clozeMode?: string | null;
  linkedOptions?: Array<{ key?: string; id?: string; label?: string; text: string; textCn?: string | null; textEn?: string | null }>;
}

function normalizeQuizOptionEntry(rawOpt: unknown) {
  if (!rawOpt || typeof rawOpt !== 'object') return rawOpt;
  const opt = rawOpt as Record<string, unknown>;
  const text = typeof opt.text === 'string'
    ? opt.text
    : typeof opt.textCn === 'string'
      ? opt.textCn
      : typeof opt.text_cn === 'string'
        ? opt.text_cn
        : '';
  const textCn = typeof opt.textCn === 'string'
    ? opt.textCn
    : typeof opt.text_cn === 'string'
      ? opt.text_cn
      : null;
  const textEn = typeof opt.textEn === 'string'
    ? opt.textEn
    : typeof opt.text_en === 'string'
      ? opt.text_en
      : null;
  const imageUrl = typeof opt.imageUrl === 'string'
    ? opt.imageUrl
    : typeof opt.image_url === 'string'
      ? opt.image_url
      : null;
  return {
    ...opt,
    text,
    ...(textCn ? { textCn } : {}),
    ...(textEn ? { textEn } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function normalizeQuizQuestionEntry(
  rawEntry: Record<string, unknown>,
  fallbackIndex: number,
  groupCtx?: GroupQuestionContext,
): ExternalQuizQuestionDto {
  const rawId = rawEntry.id ?? rawEntry.questionId ?? rawEntry.question_id;
  const groupPassage = groupCtx?.passageText;
  const questionTextVal = typeof rawEntry.questionText === 'string'
    ? rawEntry.questionText
    : typeof rawEntry.question_text === 'string'
      ? rawEntry.question_text
      : undefined;
  const questionTextCnVal = typeof rawEntry.questionTextCn === 'string'
    ? rawEntry.questionTextCn
    : typeof rawEntry.question_text_cn === 'string'
      ? rawEntry.question_text_cn
      : null;
  const questionTextEnVal = typeof rawEntry.questionTextEn === 'string'
    ? rawEntry.questionTextEn
    : typeof rawEntry.question_text_en === 'string'
      ? rawEntry.question_text_en
      : null;
  const prompt = String(
    rawEntry.prompt
    ?? questionTextVal
    ?? questionTextCnVal
    ?? rawEntry.title
    ?? groupPassage
    ?? '',
  );
  const userAnswer = rawEntry.userAnswer !== undefined
    ? rawEntry.userAnswer
    : rawEntry.studentAnswer;
  const existingPassage = typeof rawEntry.passageText === 'string'
    ? rawEntry.passageText
    : typeof rawEntry.passage_text === 'string'
      ? rawEntry.passage_text
      : undefined;
  const existingPassageCn = typeof rawEntry.passageTextCn === 'string'
    ? rawEntry.passageTextCn
    : typeof rawEntry.passage_text_cn === 'string'
      ? rawEntry.passage_text_cn
      : undefined;
  const existingPassageEn = typeof rawEntry.passageTextEn === 'string'
    ? rawEntry.passageTextEn
    : typeof rawEntry.passage_text_en === 'string'
      ? rawEntry.passage_text_en
      : undefined;
  const explanationCnVal = typeof rawEntry.explanationCn === 'string'
    ? rawEntry.explanationCn
    : typeof rawEntry.explanation_cn === 'string'
      ? rawEntry.explanation_cn
      : null;
  const explanationEnVal = typeof rawEntry.explanationEn === 'string'
    ? rawEntry.explanationEn
    : typeof rawEntry.explanation_en === 'string'
      ? rawEntry.explanation_en
      : null;
  const rawOpts = (Array.isArray(rawEntry.options) ? rawEntry.options : []).map(normalizeQuizOptionEntry);
  const rawLinked = (
    Array.isArray(rawEntry.linkedOptions)
      ? rawEntry.linkedOptions
      : (Array.isArray(groupCtx?.linkedOptions) ? groupCtx.linkedOptions : [])
  ).map(normalizeQuizOptionEntry);
  const effectiveOptions = rawOpts.length > 0 ? rawOpts : rawLinked;

  return {
    ...(rawEntry as unknown as ExternalQuizQuestionDto),
    id: rawId != null ? String(rawId) : String(fallbackIndex + 1),
    prompt,
    questionText: questionTextVal ?? prompt,
    ...(questionTextCnVal ? { questionTextCn: questionTextCnVal } : {}),
    ...(questionTextEnVal ? { questionTextEn: questionTextEnVal } : {}),
    ...(explanationCnVal ? { explanationCn: explanationCnVal } : {}),
    ...(explanationEnVal ? { explanationEn: explanationEnVal } : {}),
    options: effectiveOptions as ExternalQuizQuestionDto['options'],
    ...(rawLinked.length > 0
      ? { linkedOptions: rawLinked as ExternalQuizQuestionDto['linkedOptions'] }
      : {}),
    ...(rawEntry.groupId !== undefined || groupCtx?.groupId !== undefined
      ? { groupId: (rawEntry.groupId ?? groupCtx?.groupId) as string | number | null }
      : {}),
    ...(rawEntry.groupKind || groupCtx?.groupKind
      ? { groupKind: String(rawEntry.groupKind || groupCtx?.groupKind) }
      : {}),
    ...(rawEntry.groupType || groupCtx?.groupType
      ? { groupType: String(rawEntry.groupType || groupCtx?.groupType) }
      : {}),
    ...(existingPassage || groupPassage
      ? { passageText: existingPassage ?? groupPassage }
      : {}),
    ...(existingPassageCn !== undefined || groupCtx?.passageTextCn !== undefined
      ? { passageTextCn: (existingPassageCn ?? groupCtx?.passageTextCn ?? null) as string | null }
      : {}),
    ...(existingPassageEn !== undefined || groupCtx?.passageTextEn !== undefined
      ? { passageTextEn: (existingPassageEn ?? groupCtx?.passageTextEn ?? null) as string | null }
      : {}),
    ...(rawEntry.passageImageUrl !== undefined || groupCtx?.passageImageUrl !== undefined
      ? { passageImageUrl: (rawEntry.passageImageUrl ?? groupCtx?.passageImageUrl ?? null) as string | null }
      : {}),
    ...(rawEntry.clozeMode !== undefined || groupCtx?.clozeMode !== undefined
      ? { clozeMode: (rawEntry.clozeMode ?? groupCtx?.clozeMode ?? null) as string | null }
      : {}),
    ...(userAnswer !== undefined
      ? { userAnswer: userAnswer as ExternalQuizQuestionDto['userAnswer'] }
      : {}),
    ...(rawEntry.studentAnswer !== undefined
      ? { studentAnswer: rawEntry.studentAnswer as ExternalQuizQuestionDto['studentAnswer'] }
      : {}),
  };
}

export function flattenExternalQuizItems(rawItems: unknown): ExternalQuizQuestionDto[] {
  if (!Array.isArray(rawItems)) return [];
  const flattened: ExternalQuizQuestionDto[] = [];

  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const groupPassage = typeof obj.passageText === 'string'
      ? obj.passageText
      : typeof obj.passage_text === 'string'
        ? obj.passage_text
        : typeof obj.groupTitle === 'string'
          ? obj.groupTitle
          : undefined;
    const groupPassageCn = typeof obj.passageTextCn === 'string'
      ? obj.passageTextCn
      : typeof obj.passage_text_cn === 'string'
        ? obj.passage_text_cn
        : null;
    const groupPassageEn = typeof obj.passageTextEn === 'string'
      ? obj.passageTextEn
      : typeof obj.passage_text_en === 'string'
        ? obj.passage_text_en
        : null;
    const groupLinked = Array.isArray(obj.linkedOptions)
      ? obj.linkedOptions
      : Array.isArray(obj.linked_options)
        ? obj.linked_options
        : [];
    const groupCtx: GroupQuestionContext = {
      groupId: (obj.id ?? obj.groupId ?? null) as string | number | null,
      groupKind: typeof obj.kind === 'string' ? obj.kind : null,
      groupType: typeof obj.groupType === 'string' ? obj.groupType : null,
      passageText: groupPassage,
      passageTextCn: groupPassageCn,
      passageTextEn: groupPassageEn,
      passageImageUrl: typeof obj.passageImageUrl === 'string' ? obj.passageImageUrl : null,
      clozeMode: typeof obj.clozeMode === 'string' ? obj.clozeMode : null,
      linkedOptions: groupLinked as GroupQuestionContext['linkedOptions'],
    };

    if (Array.isArray(obj.questions)) {
      for (const sub of obj.questions) {
        if (!sub || typeof sub !== 'object') continue;
        flattened.push(
          normalizeQuizQuestionEntry(sub as Record<string, unknown>, flattened.length, groupCtx),
        );
      }
      continue;
    }

    flattened.push(normalizeQuizQuestionEntry(obj, flattened.length));
  }

  return flattened;
}

function resolveItemGroupKind(groupKind?: string | null, groupType?: string | null, questionType?: string | null): 'reading_group' | 'fill_blank_group' | null {
  if (groupKind === 'reading_group' || groupType === 'reading_passage' || questionType === 'reading_item') {
    return 'reading_group';
  }
  if (groupKind === 'fill_blank_group' || groupType === 'fill_blank_pool' || questionType === 'fill_blank_item') {
    return 'fill_blank_group';
  }
  return null;
}

export function normalizeExternalQuizItems(rawItems: unknown): ExternalQuizItemDto[] {
  if (!Array.isArray(rawItems)) return [];
  const items: ExternalQuizItemDto[] = [];
  let runningCount = 0;
  const activeFlatGroups = new Map<string, ExternalQuizItemDto>();

  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;

    if (Array.isArray(obj.questions)) {
      const groupPassage = typeof obj.passageText === 'string'
        ? obj.passageText
        : typeof obj.passage_text === 'string'
          ? obj.passage_text
          : typeof obj.groupTitle === 'string'
            ? obj.groupTitle
            : undefined;
      const groupPassageCn = typeof obj.passageTextCn === 'string'
        ? obj.passageTextCn
        : typeof obj.passage_text_cn === 'string'
          ? obj.passage_text_cn
          : null;
      const groupPassageEn = typeof obj.passageTextEn === 'string'
        ? obj.passageTextEn
        : typeof obj.passage_text_en === 'string'
          ? obj.passage_text_en
          : null;
      const rawLinked = Array.isArray(obj.linkedOptions)
        ? obj.linkedOptions
        : Array.isArray(obj.linked_options)
          ? obj.linked_options
          : [];
      const linkedOptions = rawLinked.map(normalizeQuizOptionEntry) as ExternalQuizItemDto['linkedOptions'];
      const kind = resolveItemGroupKind(
        typeof obj.kind === 'string' ? obj.kind : null,
        typeof obj.groupType === 'string' ? obj.groupType : null,
        null,
      ) || 'reading_group';
      const groupCtx: GroupQuestionContext = {
        groupId: (obj.id ?? obj.groupId ?? null) as string | number | null,
        groupKind: kind,
        groupType: typeof obj.groupType === 'string' ? obj.groupType : (kind === 'fill_blank_group' ? 'fill_blank_pool' : 'reading_passage'),
        passageText: groupPassage,
        passageTextCn: groupPassageCn,
        passageTextEn: groupPassageEn,
        passageImageUrl: typeof obj.passageImageUrl === 'string' ? obj.passageImageUrl : null,
        clozeMode: typeof obj.clozeMode === 'string' ? obj.clozeMode : null,
        linkedOptions: linkedOptions as GroupQuestionContext['linkedOptions'],
      };
      const subQuestions = obj.questions
        .filter((sub): sub is Record<string, unknown> => Boolean(sub && typeof sub === 'object'))
        .map((sub) => {
          const normalized = normalizeQuizQuestionEntry(sub, runningCount, groupCtx);
          runningCount += 1;
          return normalized;
        });
      items.push({
        id: String(obj.id ?? obj.groupId ?? `group-${items.length + 1}`),
        kind,
        groupType: groupCtx.groupType,
        passageText: groupPassage ?? null,
        passageTextCn: groupPassageCn,
        passageTextEn: groupPassageEn,
        passageImageUrl: groupCtx.passageImageUrl ?? null,
        clozeMode: groupCtx.clozeMode ?? null,
        linkedOptions,
        questions: subQuestions,
      });
      continue;
    }

    const q = normalizeQuizQuestionEntry(obj, runningCount);
    runningCount += 1;
    const inferredKind = resolveItemGroupKind(q.groupKind, q.groupType, q.questionType);
    if (inferredKind && q.groupId != null) {
      const mapKey = `${inferredKind}:${String(q.groupId)}`;
      let grouped = activeFlatGroups.get(mapKey);
      if (!grouped) {
        grouped = {
          id: String(q.groupId),
          kind: inferredKind,
          groupType: q.groupType || (inferredKind === 'fill_blank_group' ? 'fill_blank_pool' : 'reading_passage'),
          passageText: q.passageText ?? null,
          passageTextCn: q.passageTextCn ?? null,
          passageTextEn: q.passageTextEn ?? null,
          passageImageUrl: q.passageImageUrl ?? null,
          clozeMode: q.clozeMode ?? null,
          linkedOptions: q.linkedOptions ?? [],
          questions: [],
        };
        activeFlatGroups.set(mapKey, grouped);
        items.push(grouped);
      }
      grouped.questions.push(q);
      continue;
    }

    items.push({
      id: q.id,
      kind: 'question',
      question: q,
      questions: [q],
    });
  }

  return items;
}

function normalizeExternalQuizResult(
  rawResult: unknown,
  fallbackQuestions?: ExternalQuizQuestionDto[],
  fallbackItems?: ExternalQuizItemDto[],
): ExternalQuizDetailDto['latestResult'] {
  if (!rawResult || typeof rawResult !== 'object') return null;
  const obj = rawResult as Record<string, unknown>;
  const review = flattenExternalQuizItems(obj.review);
  const explicitQuestions = flattenExternalQuizItems(obj.questions);
  const questions = explicitQuestions.length > 0
    ? explicitQuestions
    : review.length > 0
      ? review
      : (fallbackQuestions ?? []);
  const itemSource = Array.isArray(obj.items) && obj.items.length > 0
    ? obj.items
    : (Array.isArray(obj.review) && obj.review.length > 0
      ? obj.review
      : (Array.isArray(obj.questions) && obj.questions.length > 0 ? obj.questions : null));
  const items = itemSource ? normalizeExternalQuizItems(itemSource) : (fallbackItems ?? []);
  const isPassed = typeof obj.isPassed === 'boolean'
    ? obj.isPassed
    : typeof obj.passed === 'boolean'
      ? obj.passed
      : undefined;
  const percent = typeof obj.percent === 'number'
    ? obj.percent
    : typeof obj.percentage === 'number'
      ? obj.percentage
      : undefined;
  const rawAttemptId = obj.attemptId ?? obj.id;

  return {
    ...(obj as Record<string, unknown>),
    ...(rawAttemptId != null ? { attemptId: String(rawAttemptId) } : {}),
    ...(isPassed !== undefined ? { isPassed, passed: isPassed } : {}),
    ...(percent !== undefined ? { percent, percentage: percent } : {}),
    ...(review.length > 0 ? { review } : {}),
    ...(items.length > 0 ? { items } : {}),
    questions,
  } as unknown as ExternalQuizDetailDto['latestResult'];
}

function normalizeExternalAssignmentSubmission(
  rawSubmission: unknown,
): ExternalAssignmentSubmissionDto | null {
  if (!rawSubmission || typeof rawSubmission !== 'object') return null;
  const obj = rawSubmission as Record<string, unknown>;
  const rawAssets = Array.isArray(obj.assets)
    ? obj.assets
    : Array.isArray(obj.attachments)
      ? obj.attachments
      : [];
  const attachments = Array.isArray(obj.attachments) ? obj.attachments : rawAssets;
  const rawId = obj.id ?? obj.submissionId;

  return {
    ...(obj as unknown as ExternalAssignmentSubmissionDto),
    ...(rawId != null ? { id: String(rawId) } : {}),
    ...(obj.submissionId !== undefined || rawId != null
      ? { submissionId: String(obj.submissionId ?? rawId) }
      : {}),
    assets: rawAssets as ExternalAssignmentSubmissionDto['assets'],
    attachments: attachments as ExternalAssignmentSubmissionDto['attachments'],
  };
}

export interface ParsedExternalApiError {
  status: number | null;
  code: string | null;
  message: string;
  details: Record<string, unknown> | null;
}

export function parseExternalApiError(
  err: unknown,
  fallbackMessage = 'Không thể thực hiện thao tác. Vui lòng thử lại.',
): ParsedExternalApiError {
  if (err && typeof err === 'object') {
    const ax = err as {
      response?: {
        status?: number;
        data?: {
          code?: string;
          errorCode?: string;
          message?: string;
          details?: unknown;
          error?: { code?: string; errorCode?: string; message?: string; details?: unknown };
        };
      };
      message?: string;
    };
    const status = typeof ax.response?.status === 'number' ? ax.response.status : null;
    const rawData = ax.response?.data;
    const rawCode = rawData?.code
      || rawData?.errorCode
      || rawData?.error?.code
      || rawData?.error?.errorCode
      || null;
    const code = rawCode ? String(rawCode).toUpperCase() : null;
    const rawDetails = rawData?.details ?? rawData?.error?.details ?? null;
    const details = rawDetails && typeof rawDetails === 'object'
      ? (rawDetails as Record<string, unknown>)
      : null;
    const rawMessage = rawData?.message || rawData?.error?.message || ax.message || '';
    return {
      status,
      code,
      message: typeof rawMessage === 'string' && rawMessage.trim() ? rawMessage.trim() : fallbackMessage,
      details,
    };
  }
  return { status: null, code: null, message: fallbackMessage, details: null };
}

function parseContentDispositionFilename(header: string | undefined | null, fallbackName: string): string {
  if (!header || typeof header !== 'string') return fallbackName;
  const utf8Match = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
      if (decoded) return decoded;
    } catch {
      const rawUtf8 = utf8Match[1].trim().replace(/^"|"$/g, '');
      if (rawUtf8) return rawUtf8;
    }
  }
  const plainMatch = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(header);
  const raw = plainMatch?.[1] || plainMatch?.[2];
  if (raw) {
    const cleaned = raw.trim().replace(/^"|"$/g, '');
    if (cleaned) return cleaned;
  }
  return fallbackName;
}

function decodeArrayBufferJson(buf: unknown): Record<string, unknown> | null {
  try {
    if (buf instanceof ArrayBuffer) {
      return JSON.parse(new TextDecoder().decode(new Uint8Array(buf))) as Record<string, unknown>;
    }
    if (ArrayBuffer.isView(buf)) {
      return JSON.parse(new TextDecoder().decode(buf)) as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

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
    timeoutMs = 60000,
    signal,
  }: {
    courseSlugOrId: string | number;
    profileId?: string | null;
    unitId?: string | number | null;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<ExternalCourseWorkspaceDto> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalCourseWorkspaceDto>>(
      `/learning/external/courses/${encodeURIComponent(String(courseSlugOrId))}/workspace`,
      {
        params: {
          ...(profileId ? { profileId } : {}),
          ...(unitId != null && String(unitId).trim() ? { unitId: String(unitId) } : {}),
        },
        timeout: timeoutMs,
        signal,
      },
    );
    const workspace = unwrapData<ExternalCourseWorkspaceDto>(response.data);
    return {
      ...workspace,
      units: workspace.units.map((unit) => ({ ...unit, title: formatSyncedLessonTitle(unit.title) })),
      activeUnit: workspace.activeUnit
        ? { ...workspace.activeUnit, title: formatSyncedLessonTitle(workspace.activeUnit.title) }
        : null,
    };
  },

  async getExternalUnitDetail({
    profileId,
    unitId,
    courseId = null,
    timeoutMs = 60000,
    signal,
  }: {
    profileId: string;
    unitId: string | number;
    courseId?: string | number | null;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<ExternalUnitDetailDto> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalUnitDetailDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}`,
      {
        params: courseId != null ? { courseId: String(courseId) } : undefined,
        timeout: timeoutMs,
        signal,
      },
    );
    return unwrapData(response.data);
  },

  async createExternalPlaybackToken({
    profileId,
    unitId,
    videoId,
    ttlSeconds = 60,
  }: {
    profileId: string;
    unitId: string | number;
    videoId: string | number;
    ttlSeconds?: number;
  }): Promise<ExternalVideoPlaybackTokenDto> {
    const response = await axios.post<ApiSuccessEnvelope<ExternalVideoPlaybackTokenDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/videos/${encodeURIComponent(String(videoId))}/playback-token`,
      { ttlSeconds },
    );
    return unwrapData(response.data);
  },

  async updateExternalVideoProgress({
    profileId,
    unitId,
    videoId,
    payload,
    keepalive = false,
  }: {
    profileId: string;
    unitId: string | number;
    videoId: string | number;
    payload: ExternalVideoProgressInput;
    keepalive?: boolean;
  }): Promise<ExternalVideoProgressDto> {
    const response = await axios.put<ApiSuccessEnvelope<ExternalVideoProgressDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/videos/${encodeURIComponent(String(videoId))}/progress`,
      payload,
      keepalive ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : undefined,
    );
    return unwrapData(response.data);
  },

  async fetchExternalFileStream({
    profileId,
    unitId,
    fileId,
    disposition = 'inline',
    fallbackFileName = 'document',
    knownSizeBytes = null,
    timeoutMs = 300000,
    onProgress,
    signal,
  }: {
    profileId: string;
    unitId: string | number;
    fileId: string | number;
    disposition?: 'inline' | 'attachment';
    fallbackFileName?: string;
    knownSizeBytes?: number | null;
    timeoutMs?: number;
    onProgress?: (progress: ExternalFileDownloadProgress) => void;
    signal?: AbortSignal;
  }): Promise<ExternalFileStreamResult> {
    const url = `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/files/${encodeURIComponent(String(fileId))}/stream`;
    const totalHint = Number.isFinite(Number(knownSizeBytes)) && Number(knownSizeBytes) > 0
      ? Number(knownSizeBytes)
      : 0;
    onProgress?.({
      phase: 'connecting',
      loadedBytes: 0,
      totalBytes: totalHint,
      percent: totalHint > 0 ? 0 : null,
    });

    const runRequest = () => axios.get<ArrayBuffer>(url, {
      params: { disposition },
      responseType: 'arraybuffer',
      withCredentials: true,
      timeout: timeoutMs,
      signal,
      onDownloadProgress: (progressEvent) => {
        const loadedBytes = Number(progressEvent.loaded || 0);
        const evtTotal = Number(progressEvent.total || 0);
        const totalBytes = evtTotal > 0 ? evtTotal : totalHint;
        const percent = totalBytes > 0
          ? Math.min(99, Math.max(0, Math.round((loadedBytes / totalBytes) * 100)))
          : (typeof progressEvent.progress === 'number'
            ? Math.min(99, Math.max(0, Math.round(progressEvent.progress * 100)))
            : null);
        onProgress?.({
          phase: 'downloading',
          loadedBytes,
          totalBytes,
          percent,
        });
      },
    });

    let response;
    try {
      response = await runRequest();
    } catch (err) {
      const axErr = err as { response?: { status?: number; data?: unknown } };
      const parsedBody = decodeArrayBufferJson(axErr.response?.data);
      if (parsedBody && axErr.response) {
        axErr.response.data = parsedBody;
      }
      if (axErr.response?.status === 401 && parsedBody?.code === 'TOKEN_EXPIRED') {
        // Trigger axios interceptor's single-flight JSON token refresh, then retry binary fetch once.
        await this.getExternalUnitDetail({ profileId, unitId, signal });
        try {
          response = await runRequest();
        } catch (retryErr) {
          const retryAx = retryErr as { response?: { data?: unknown } };
          const retryParsed = decodeArrayBufferJson(retryAx.response?.data);
          if (retryParsed && retryAx.response) {
            retryAx.response.data = retryParsed;
          }
          throw retryErr;
        }
      } else {
        throw err;
      }
    }

    const headers = response.headers || {};
    const mimeType = String(headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
    const resolvedName = parseContentDispositionFilename(headers['content-disposition'], fallbackFileName);
    const data = response.data instanceof ArrayBuffer ? response.data : new ArrayBuffer(0);
    onProgress?.({
      phase: 'rendering',
      loadedBytes: data.byteLength,
      totalBytes: Math.max(data.byteLength, totalHint),
      percent: 100,
    });
    return {
      data,
      mimeType,
      fileName: resolvedName,
      sizeBytes: data.byteLength,
    };
  },

  async downloadExternalFile({
    profileId,
    unitId,
    fileId,
    fallbackFileName = 'document',
  }: {
    profileId: string;
    unitId: string | number;
    fileId: string | number;
    fallbackFileName?: string;
  }): Promise<string> {
    const result = await this.fetchExternalFileStream({
      profileId,
      unitId,
      fileId,
      disposition: 'attachment',
      fallbackFileName,
    });
    const blob = new Blob([result.data], { type: result.mimeType || 'application/octet-stream' });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = result.fileName || fallbackFileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
    return result.fileName || fallbackFileName;
  },

  buildExternalFileViewerPath({
    courseSlug,
    profileId,
    unitId,
    fileId,
  }: {
    courseSlug: string;
    profileId: string;
    unitId: string | number;
    fileId: string | number;
  }): string {
    const query = new URLSearchParams({
      profileId: String(profileId),
      unitId: String(unitId),
    });
    return `/hoc/${encodeURIComponent(courseSlug)}/tai-lieu/${encodeURIComponent(String(fileId))}?${query.toString()}`;
  },

  async getExternalQuizDetail({
    profileId,
    unitId,
    quizId,
  }: {
    profileId: string;
    unitId: string | number;
    quizId: string | number;
  }): Promise<ExternalQuizDetailDto> {
    const response = await axios.get<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/quizzes/${encodeURIComponent(String(quizId))}`,
    );
    const raw = unwrapData<Record<string, unknown>>(response.data);
    const quiz = (raw.quiz as ExternalUnitQuizDto | undefined)
      || (raw as unknown as ExternalUnitQuizDto);
    const quizObj = (quiz ?? {}) as unknown as Record<string, unknown>;
    const rawItemSource = raw.items ?? quizObj.items ?? raw.questions ?? quizObj.questions;
    const questions = flattenExternalQuizItems(rawItemSource);
    const items = normalizeExternalQuizItems(rawItemSource);
    const attempts = Array.isArray(raw.attempts) ? (raw.attempts as ExternalQuizAttemptDto[]) : [];
    const attemptsCount = typeof raw.attemptsCount === 'number'
      ? raw.attemptsCount
      : typeof quizObj.attemptsUsed === 'number'
        ? quizObj.attemptsUsed
        : typeof quizObj.attemptsCount === 'number'
          ? quizObj.attemptsCount
          : typeof raw.attemptCount === 'number'
            ? raw.attemptCount
            : attempts.length;
    const isAdminBypass = raw.isAdminBypass === true;
    const canReviewFreely = raw.canReviewFreely === true;
    const hasFreeReviewBypass = isAdminBypass || canReviewFreely;
    const maxAttemptsRaw = hasFreeReviewBypass
      ? null
      : (raw.maxAttempts ?? quizObj.maxAttempts ?? quizObj.attemptLimit);
    const maxAttempts = typeof maxAttemptsRaw === 'number' ? maxAttemptsRaw : null;
    const attemptsRemaining = hasFreeReviewBypass
      ? null
      : typeof raw.attemptsRemaining === 'number'
        ? raw.attemptsRemaining
        : maxAttempts !== null
          ? Math.max(0, maxAttempts - attemptsCount)
          : null;
    const activeAttempt = (raw.activeAttempt as ExternalQuizAttemptDto | null | undefined) ?? null;
    const latestAttempt = (raw.latestAttempt as ExternalQuizAttemptDto | null | undefined)
      ?? (attempts[0] ?? null);
    const canStartAttempt = typeof raw.canStartAttempt === 'boolean'
      ? raw.canStartAttempt
      : hasFreeReviewBypass || attemptsRemaining === null || attemptsRemaining > 0 || activeAttempt !== null;
    const canViewSolution = hasFreeReviewBypass
      ? true
      : ((raw.canViewSolution as boolean | undefined)
        ?? (quizObj.canViewSolution as boolean | undefined));
    const reviewItems = Array.isArray(raw.reviewItems)
      ? flattenExternalQuizItems(raw.reviewItems)
      : undefined;
    const reviewItemGroups = Array.isArray(raw.reviewItems)
      ? normalizeExternalQuizItems(raw.reviewItems)
      : undefined;
    const normalizedQuiz: ExternalUnitQuizDto = {
      ...quiz,
      id: quizObj.id != null ? String(quizObj.id) : String(quizId),
      attemptsCount: typeof quizObj.attemptsCount === 'number' ? quizObj.attemptsCount : attemptsCount,
      attemptLimit: hasFreeReviewBypass
        ? null
        : (typeof quizObj.attemptLimit === 'number' || quizObj.attemptLimit === null
          ? quizObj.attemptLimit
          : maxAttempts),
      ...(canViewSolution !== undefined ? { canViewSolution } : {}),
    };
    const latestResult = normalizeExternalQuizResult(raw.latestResult, questions, items);

    return {
      ...(raw as unknown as ExternalQuizDetailDto),
      quiz: normalizedQuiz,
      items,
      questions,
      activeAttempt,
      attempts,
      latestAttempt,
      latestResult,
      attemptsRemaining,
      canStartAttempt,
      canViewSolution,
      isAdminBypass,
      canReviewFreely,
      ...(reviewItems ? { reviewItems } : {}),
      ...(reviewItemGroups ? { reviewItemGroups } : {}),
    };
  },

  async startExternalQuizAttempt({
    profileId,
    unitId,
    quizId,
    newAttempt = false,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    quizId: string | number;
    newAttempt?: boolean;
    idempotencyKey?: string;
  }): Promise<{
    attempt: ExternalQuizAttemptDto;
    quiz?: ExternalUnitQuizDto;
    items?: ExternalQuizItemDto[];
    questions?: ExternalQuizQuestionDto[];
  }> {
    const response = await axios.post<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/quizzes/${encodeURIComponent(String(quizId))}/attempts/start`,
      {
        newAttempt,
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<Record<string, unknown>>(response.data);
    const attempt = (raw.attempt as ExternalQuizAttemptDto | undefined)
      || (raw as unknown as ExternalQuizAttemptDto);
    const quizObj = raw.quiz as Record<string, unknown> | undefined;
    const questionSource = raw.items ?? quizObj?.items ?? raw.questions ?? quizObj?.questions;
    const questions = Array.isArray(questionSource)
      ? flattenExternalQuizItems(questionSource)
      : undefined;
    const items = Array.isArray(questionSource)
      ? normalizeExternalQuizItems(questionSource)
      : undefined;
    return {
      attempt,
      quiz: raw.quiz as ExternalUnitQuizDto | undefined,
      items,
      questions,
    };
  },

  async saveExternalQuizAnswers({
    profileId,
    unitId,
    attemptId,
    answers,
    questionId,
    answer,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    attemptId: string | number;
    answers?: Record<string, unknown>;
    questionId?: string;
    answer?: unknown;
    idempotencyKey?: string;
  }): Promise<ExternalQuizAttemptDto | Record<string, unknown>> {
    const response = await axios.put<ApiSuccessEnvelope<ExternalQuizAttemptDto | Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/quizzes/attempts/${encodeURIComponent(String(attemptId))}/answers`,
      {
        ...(answers !== undefined ? { answers } : {}),
        ...(questionId !== undefined ? { questionId } : {}),
        ...(answer !== undefined ? { answer } : {}),
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    return unwrapData(response.data);
  },

  async submitExternalQuizAttempt({
    profileId,
    unitId,
    attemptId,
    answers,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    attemptId: string | number;
    answers?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<ExternalQuizSubmitResponseDto> {
    const response = await axios.post<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/quizzes/attempts/${encodeURIComponent(String(attemptId))}/submit`,
      {
        ...(answers !== undefined ? { answers } : {}),
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<Record<string, unknown>>(response.data);
    const rawResultSource = (
      raw.result && typeof raw.result === 'object' ? raw.result : raw
    ) as Record<string, unknown>;
    const normalizedResult = normalizeExternalQuizResult(rawResultSource);
    const rawAttempt = raw.attempt && typeof raw.attempt === 'object'
      ? (raw.attempt as Record<string, unknown>)
      : raw;
    const normalizedAttempt: ExternalQuizAttemptDto = {
      ...(rawAttempt as unknown as ExternalQuizAttemptDto),
      id: String(rawAttempt.id ?? rawAttempt.attemptId ?? attemptId),
      status: String(rawAttempt.status ?? rawResultSource.status ?? 'submitted'),
    };
    const canViewSolution = (raw.canViewSolution as boolean | undefined)
      ?? (normalizedResult?.canViewSolution as boolean | undefined);

    return {
      ...(raw as unknown as ExternalQuizSubmitResponseDto),
      attempt: normalizedAttempt,
      result: normalizedResult as ExternalQuizSubmitResponseDto['result'],
      unitProgress: raw.unitProgress as ExternalQuizSubmitResponseDto['unitProgress'],
      courseProgress: raw.courseProgress as ExternalQuizSubmitResponseDto['courseProgress'],
      units: Array.isArray(raw.units)
        ? (raw.units as ExternalQuizSubmitResponseDto['units'])
        : undefined,
      canViewSolution,
    };
  },

  async uploadExternalQuizEssayAssets({
    profileId,
    unitId,
    quizId,
    files,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    quizId: string | number;
    files: File[];
    idempotencyKey?: string;
  }): Promise<ExternalQuizEssayAttachmentDto[]> {
    const formData = new FormData();
    const resolvedKey = idempotencyKey || generateIdempotencyKey();
    formData.append('idempotencyKey', resolvedKey);
    files.forEach((file) => {
      formData.append('files', file);
    });
    const response = await axios.post<ApiSuccessEnvelope<{ assets?: ExternalQuizEssayAttachmentDto[] }>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/quizzes/${encodeURIComponent(String(quizId))}/essay-assets`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': resolvedKey,
        },
        timeout: 120000,
      },
    );
    const raw = unwrapData<{ assets?: ExternalQuizEssayAttachmentDto[] }>(response.data);
    return Array.isArray(raw?.assets) ? raw.assets : [];
  },

  async getExternalAssignmentDetail({
    profileId,
    unitId,
    assignmentId,
  }: {
    profileId: string;
    unitId: string | number;
    assignmentId: string | number;
  }): Promise<ExternalAssignmentDetailDto> {
    const response = await axios.get<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/assignments/${encodeURIComponent(String(assignmentId))}`,
    );
    const raw = unwrapData<Record<string, unknown>>(response.data);
    const assignment = (raw.assignment as ExternalAssignmentDetailDto['assignment'] | undefined)
      || (raw as unknown as ExternalAssignmentDetailDto['assignment']);
    const submission = normalizeExternalAssignmentSubmission(
      raw.submission ?? (raw as { latestSubmission?: unknown }).latestSubmission ?? null,
    );
    const submissions = Array.isArray(raw.submissions)
      ? raw.submissions
        .map((item) => normalizeExternalAssignmentSubmission(item))
        .filter((item): item is ExternalAssignmentSubmissionDto => item !== null)
      : [];
    return {
      assignment,
      submission,
      submissions,
    };
  },

  async submitExternalAssignment({
    profileId,
    unitId,
    assignmentId,
    contentText,
    files = [],
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    assignmentId: string | number;
    contentText: string;
    files?: File[];
    idempotencyKey?: string;
  }): Promise<ExternalAssignmentSubmissionDto> {
    const idem = idempotencyKey || generateIdempotencyKey();
    const url = `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/assignments/${encodeURIComponent(String(assignmentId))}/submit`;

    let response;
    if (files.length > 0) {
      const form = new FormData();
      form.append('contentText', contentText);
      form.append('idempotencyKey', idem);
      files.forEach((file) => form.append('files', file));
      response = await axios.post<ApiSuccessEnvelope<{ submission?: ExternalAssignmentSubmissionDto } | ExternalAssignmentSubmissionDto>>(
        url,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
      );
    } else {
      response = await axios.post<ApiSuccessEnvelope<{ submission?: ExternalAssignmentSubmissionDto } | ExternalAssignmentSubmissionDto>>(
        url,
        { contentText, idempotencyKey: idem },
      );
    }
    const raw = unwrapData<Record<string, unknown>>(response.data);
    const rawSubmission = raw && typeof raw === 'object' && 'submission' in raw && raw.submission
      ? raw.submission
      : raw;
    return normalizeExternalAssignmentSubmission(rawSubmission) as ExternalAssignmentSubmissionDto;
  },

  async getExternalUnitNotes({
    profileId,
    unitId,
  }: {
    profileId: string;
    unitId: string | number;
  }): Promise<ExternalUnitNoteDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalUnitNoteDto[] | { notes?: ExternalUnitNoteDto[] }>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/notes`,
    );
    const raw = unwrapData<ExternalUnitNoteDto[] | { notes?: ExternalUnitNoteDto[] }>(response.data);
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw?.notes) ? raw.notes : [];
  },

  async createExternalUnitNote({
    profileId,
    unitId,
    timestampSeconds,
    content,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    timestampSeconds: number;
    content: string;
    idempotencyKey?: string;
  }): Promise<ExternalUnitNoteDto> {
    const response = await axios.post<ApiSuccessEnvelope<{ note?: ExternalUnitNoteDto } | ExternalUnitNoteDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/notes`,
      {
        timestampSeconds: Math.max(0, Math.floor(timestampSeconds)),
        content,
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ note?: ExternalUnitNoteDto } | ExternalUnitNoteDto>(response.data);
    if (raw && typeof raw === 'object' && 'note' in raw && raw.note) return raw.note;
    return raw as ExternalUnitNoteDto;
  },

  async updateExternalUnitNote({
    profileId,
    unitId,
    noteId,
    content,
    timestampSeconds,
    expectedRevision,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    noteId: string;
    content: string;
    timestampSeconds?: number;
    expectedRevision: number;
    idempotencyKey?: string;
  }): Promise<ExternalUnitNoteDto> {
    const response = await axios.put<ApiSuccessEnvelope<{ note?: ExternalUnitNoteDto } | ExternalUnitNoteDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/notes/${encodeURIComponent(noteId)}`,
      {
        content,
        ...(timestampSeconds !== undefined ? { timestampSeconds: Math.max(0, Math.floor(timestampSeconds)) } : {}),
        expectedRevision,
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ note?: ExternalUnitNoteDto } | ExternalUnitNoteDto>(response.data);
    if (raw && typeof raw === 'object' && 'note' in raw && raw.note) return raw.note;
    return raw as ExternalUnitNoteDto;
  },

  async deleteExternalUnitNote({
    profileId,
    unitId,
    noteId,
    expectedRevision,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    noteId: string;
    expectedRevision?: number;
    idempotencyKey?: string;
  }): Promise<Record<string, unknown>> {
    const response = await axios.delete<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/notes/${encodeURIComponent(noteId)}`,
      {
        data: {
          ...(expectedRevision !== undefined ? { expectedRevision } : {}),
          idempotencyKey: idempotencyKey || generateIdempotencyKey(),
        },
      },
    );
    return unwrapData(response.data);
  },

  async getExternalUnitBookmarks({
    profileId,
    unitId,
  }: {
    profileId: string;
    unitId: string | number;
  }): Promise<ExternalUnitBookmarkDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalUnitBookmarkDto[] | { bookmarks?: ExternalUnitBookmarkDto[] }>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/bookmarks`,
    );
    const raw = unwrapData<ExternalUnitBookmarkDto[] | { bookmarks?: ExternalUnitBookmarkDto[] }>(response.data);
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw?.bookmarks) ? raw.bookmarks : [];
  },

  async createExternalUnitBookmark({
    profileId,
    unitId,
    timestampSeconds,
    label,
    videoAssetId,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    timestampSeconds: number;
    label: string;
    videoAssetId?: string | null;
    idempotencyKey?: string;
  }): Promise<ExternalUnitBookmarkDto> {
    const response = await axios.post<ApiSuccessEnvelope<{ bookmark?: ExternalUnitBookmarkDto } | ExternalUnitBookmarkDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/bookmarks`,
      {
        timestampSeconds: Math.max(0, Math.floor(timestampSeconds)),
        label,
        ...(videoAssetId ? { videoAssetId } : {}),
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ bookmark?: ExternalUnitBookmarkDto } | ExternalUnitBookmarkDto>(response.data);
    if (raw && typeof raw === 'object' && 'bookmark' in raw && raw.bookmark) return raw.bookmark;
    return raw as ExternalUnitBookmarkDto;
  },

  async deleteExternalUnitBookmark({
    profileId,
    unitId,
    bookmarkId,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    bookmarkId: string;
    idempotencyKey?: string;
  }): Promise<Record<string, unknown>> {
    const response = await axios.delete<ApiSuccessEnvelope<Record<string, unknown>>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/bookmarks/${encodeURIComponent(bookmarkId)}`,
      {
        data: {
          idempotencyKey: idempotencyKey || generateIdempotencyKey(),
        },
      },
    );
    return unwrapData(response.data);
  },

  async getExternalUnitQa({
    profileId,
    unitId,
  }: {
    profileId: string;
    unitId: string | number;
  }): Promise<ExternalQaThreadDto[]> {
    const response = await axios.get<ApiSuccessEnvelope<ExternalQaThreadDto[] | { threads?: ExternalQaThreadDto[] }>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/qa`,
    );
    const raw = unwrapData<ExternalQaThreadDto[] | { threads?: ExternalQaThreadDto[] }>(response.data);
    if (Array.isArray(raw)) return raw;
    return Array.isArray(raw?.threads) ? raw.threads : [];
  },

  async createExternalUnitQaThread({
    profileId,
    unitId,
    title,
    body,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    title: string;
    body: string;
    idempotencyKey?: string;
  }): Promise<ExternalQaThreadDto> {
    const response = await axios.post<ApiSuccessEnvelope<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/qa`,
      {
        title,
        body,
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>(response.data);
    if (raw && typeof raw === 'object' && 'thread' in raw && raw.thread) return raw.thread;
    return raw as ExternalQaThreadDto;
  },

  async replyExternalUnitQaThread({
    profileId,
    unitId,
    threadId,
    body,
    expectedRevision,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    threadId: string;
    body: string;
    expectedRevision?: number;
    idempotencyKey?: string;
  }): Promise<ExternalQaThreadDto> {
    const response = await axios.post<ApiSuccessEnvelope<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/qa/${encodeURIComponent(threadId)}/replies`,
      {
        body,
        ...(expectedRevision !== undefined ? { expectedRevision } : {}),
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>(response.data);
    if (raw && typeof raw === 'object' && 'thread' in raw && raw.thread) return raw.thread;
    return raw as ExternalQaThreadDto;
  },

  async updateExternalUnitQaStatus({
    profileId,
    unitId,
    threadId,
    status,
    markRead,
    expectedRevision,
    idempotencyKey,
  }: {
    profileId: string;
    unitId: string | number;
    threadId: string;
    status: ExternalQaStatus;
    markRead?: boolean;
    expectedRevision?: number;
    idempotencyKey?: string;
  }): Promise<ExternalQaThreadDto> {
    const response = await axios.patch<ApiSuccessEnvelope<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>>(
      `/learning/external/offerings/${encodeURIComponent(profileId)}/units/${encodeURIComponent(String(unitId))}/qa/${encodeURIComponent(threadId)}/status`,
      {
        status,
        ...(markRead !== undefined ? { markRead } : {}),
        ...(expectedRevision !== undefined ? { expectedRevision } : {}),
        idempotencyKey: idempotencyKey || generateIdempotencyKey(),
      },
    );
    const raw = unwrapData<{ thread?: ExternalQaThreadDto } | ExternalQaThreadDto>(response.data);
    if (raw && typeof raw === 'object' && 'thread' in raw && raw.thread) return raw.thread;
    return raw as ExternalQaThreadDto;
  },
};

export default learningApi;
