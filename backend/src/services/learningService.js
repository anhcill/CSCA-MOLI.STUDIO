const courseRepository = require("../repositories/courseRepository");
const learningRepository = require("../repositories/learningRepository");
const courseService = require("./courseService");
const { CourseApiError } = require("../utils/courseResponses");
const { mapCourse, mapEnrollment, mapLesson, mapProgress, toFiniteNumber } = require("../utils/courseContract");

function progressSummary(row) {
  const totalLessons = toFiniteNumber(row?.total_lessons ?? row?.progress_total_lessons);
  const completedLessons = toFiniteNumber(row?.completed_lessons);
  return {
    completedLessons,
    totalLessons,
    completionPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 10000) / 100 : 0,
    lastLessonId: row?.last_lesson_id == null ? null : toFiniteNumber(row.last_lesson_id),
    lastLessonTitle: row?.last_lesson_title || null,
    lastPositionSeconds: toFiniteNumber(row?.last_position_seconds ?? row?.progress_last_position_seconds),
  };
}

function catalogCourse(row, progress = null) {
  // Enrollment list rows contain `e.*`; explicitly restore the aliased course ID
  // before using the shared course mapper so enrollment.id can never leak as course.id.
  const course = mapCourse({
    ...row,
    id: row.catalog_course_id ?? row.id,
    status: row.course_status ?? row.status,
  });
  return {
    id: course.id,
    externalKey: course.externalKey,
    slug: course.slug,
    title: course.title,
    shortDescription: course.shortDescription,
    subjectCode: course.subjectCode,
    level: course.level,
    thumbnailUrl: course.thumbnailUrl,
    accessType: course.accessType,
    priceVnd: row.price_vnd == null ? null : course.priceVnd,
    compareAtPriceVnd: course.compareAtPriceVnd,
    isFeatured: course.isFeatured,
    isNew: course.isNew,
    isHot: course.isHot,
    ratingAvg: course.ratingAvg,
    ratingCount: course.ratingCount,
    enrolledCount: course.enrolledCount,
    totalSections: course.totalSections,
    totalLessons: course.totalLessons,
    totalDurationSeconds: course.totalDurationSeconds,
    instructor: null,
    progress,
    publishedAt: course.publishedAt,
    contentUpdatedAt: course.contentUpdatedAt,
  };
}

function curriculum(sections, lessons) {
  const mapped = courseService.buildCurriculum(sections, lessons);
  return mapped.map((section) => {
    const mappedLessons = section.lessons.map((lesson) => ({
      id: lesson.id,
      externalKey: lesson.externalKey,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      lessonType: lesson.lessonType,
      sortOrder: lesson.sortOrder,
      durationSeconds: lesson.estimatedDurationSeconds,
      isFreePreview: lesson.isFreePreview,
      isRequired: lesson.isRequired,
      isLocked: false,
      progressStatus: lesson.progress?.status || "not_started",
    }));
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      totalDurationSeconds: mappedLessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0),
      lessons: mappedLessons,
    };
  });
}

async function listMyEnrollments(user) {
  const rows = await learningRepository.listUserEnrollments(user.id);
  return rows
    .filter((row) => courseService.hasEntitlement(user, row, row))
    .map((row) => {
      const progress = progressSummary(row);
      return {
        enrollment: {
          ...mapEnrollment(row),
          courseSlug: row.slug,
          progress,
        },
        course: catalogCourse(row, progress),
      };
    });
}

async function getLearningCourse(courseIdValue, user) {
  const { course, enrollment } = await courseService.requireLearningAccess(courseIdValue, user);
  const [{ sections, lessons }, row] = await Promise.all([
    courseRepository.listCurriculum(course.id, { userId: user.id, includeContent: false }),
    learningRepository.getCourseProgress(user.id, course.id),
  ]);
  return {
    course: catalogCourse(course, progressSummary(row)),
    enrollment: { ...mapEnrollment(enrollment), courseSlug: course.slug, progress: progressSummary(row) },
    curriculum: curriculum(sections, lessons),
  };
}

async function getLearningLesson(lessonIdValue, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  const { course, enrollment } = await courseService.requireLearningAccess(lesson.course_id, user);
  const [{ sections, lessons }, resources, navigation, progressRow] = await Promise.all([
    courseRepository.listCurriculum(course.id, { userId: user.id, includeContent: true }),
    learningRepository.listLessonResources(lesson.id),
    learningRepository.getLessonNavigation(course.id, lesson.id),
    learningRepository.getCourseProgress(user.id, course.id),
  ]);
  const fullLesson = mapLesson(lessons.find((item) => String(item.id) === String(lesson.id)) || lesson);
  return {
    course: {
      id: toFiniteNumber(course.id), slug: course.slug, title: course.title,
      subjectCode: course.subject_code, thumbnailUrl: course.thumbnail_url,
    },
    enrollment: { ...mapEnrollment(enrollment), courseSlug: course.slug, progress: progressSummary(progressRow) },
    curriculum: curriculum(sections, lessons),
    lesson: {
      id: fullLesson.id,
      externalKey: fullLesson.externalKey,
      slug: fullLesson.slug,
      title: fullLesson.title,
      summary: fullLesson.summary,
      lessonType: fullLesson.lessonType,
      sortOrder: fullLesson.sortOrder,
      durationSeconds: fullLesson.estimatedDurationSeconds,
      isFreePreview: fullLesson.isFreePreview,
      isRequired: fullLesson.isRequired,
      isLocked: false,
      progressStatus: fullLesson.progress?.status || "not_started",
      contentHtml: fullLesson.contentHtml,
      resources: resources.map((item) => ({
        id: toFiniteNumber(item.id), title: item.title,
        kind: item.resource_type === "link" ? "link" : "file",
        // Material delivery needs its own entitlement-checked endpoint; do not invent
        // or expose a storage URL from this metadata response.
        url: item.url || "",
      })),
      previousLessonId: navigation.previous_lesson_id == null ? null : toFiniteNumber(navigation.previous_lesson_id),
      nextLessonId: navigation.next_lesson_id == null ? null : toFiniteNumber(navigation.next_lesson_id),
    },
  };
}

function clampSeconds(value, duration) {
  const seconds = Math.max(0, Math.floor(toFiniteNumber(value)));
  return duration > 0 ? Math.min(seconds, duration) : seconds;
}

const MAX_WATCHED_DELTA_SECONDS = 60;

function watchedDelta(body, existingWatchedSeconds, duration) {
  let delta;
  if (body.watchedDeltaSeconds != null) {
    delta = Math.floor(toFiniteNumber(body.watchedDeltaSeconds));
  } else if (body.watchedSeconds != null) {
    // Legacy clients sent a cumulative counter. Convert only its forward movement
    // into a bounded delta; a seek/resume position is never treated as watch time.
    const legacyTotal = clampSeconds(body.watchedSeconds, duration);
    delta = legacyTotal - existingWatchedSeconds;
  } else {
    delta = 0;
  }
  const bounded = Math.min(MAX_WATCHED_DELTA_SECONDS, Math.max(0, delta));
  return duration > 0 ? Math.min(bounded, Math.max(0, duration - existingWatchedSeconds)) : bounded;
}

async function updateLessonProgress(lessonIdValue, body, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  await courseService.requireLearningAccess(lesson.course_id, user);

  const duration = Math.max(0, toFiniteNumber(lesson.estimated_duration_seconds));
  const position = clampSeconds(body.positionSeconds ?? body.lastPositionSeconds, duration);
  const existing = await learningRepository.findProgress(user.id, lesson.id);
  const existingWatched = Math.max(0, toFiniteNumber(existing?.watched_seconds));
  const watchedIncrement = watchedDelta(body, existingWatched, duration);
  const watchedTotal = duration > 0
    ? Math.min(duration, existingWatched + watchedIncrement)
    : existingWatched + watchedIncrement;
  const maxPosition = Math.max(position, toFiniteNumber(existing?.max_position_seconds));
  const completionPct = duration > 0 ? Math.min(100, Math.round((watchedTotal / duration) * 10000) / 100) : 0;
  let status = completionPct >= 85 && lesson.lesson_type === "video"
    ? "completed"
    : (position > 0 || watchedTotal > 0 ? "in_progress" : "not_started");
  if (existing?.status === "completed") status = "completed";

  return mapProgress(await learningRepository.upsertProgress({
    userId: user.id, courseId: toFiniteNumber(lesson.course_id), lessonId: lesson.id,
    status, watchedDeltaSeconds: watchedIncrement, maxPositionSeconds: maxPosition,
    lastPositionSeconds: position, completionPct, durationSeconds: duration,
    autoCompleteVideo: lesson.lesson_type === "video",
  }));
}

async function completeLesson(lessonIdValue, user) {
  const lessonId = courseService.positiveInteger(lessonIdValue, "lessonId");
  const lesson = await learningRepository.findPublishedLesson(lessonId);
  if (!lesson) throw new CourseApiError(404, "LESSON_NOT_FOUND", "Lesson not found.");
  await courseService.requireLearningAccess(lesson.course_id, user);
  const existing = await learningRepository.findProgress(user.id, lesson.id);
  if (existing?.status === "completed") return mapProgress(existing);
  if (lesson.lesson_type === "video" && toFiniteNumber(existing?.completion_pct) < 85) {
    throw new CourseApiError(400, "VIDEO_COMPLETION_THRESHOLD_NOT_MET", "Video completion requires at least 85 percent watched.");
  }
  if (lesson.lesson_type === "quiz") {
    throw new CourseApiError(409, "QUIZ_COMPLETION_REQUIRES_ATTEMPT", "Quiz completion is managed by the quiz attempt flow.");
  }
  return mapProgress(await learningRepository.upsertProgress({
    userId: user.id, courseId: toFiniteNumber(lesson.course_id), lessonId: lesson.id,
    status: "completed", watchedDeltaSeconds: 0,
    maxPositionSeconds: toFiniteNumber(existing?.max_position_seconds),
    lastPositionSeconds: toFiniteNumber(existing?.last_position_seconds), completionPct: 100,
    durationSeconds: toFiniteNumber(lesson.estimated_duration_seconds), autoCompleteVideo: false,
  }));
}

async function getCourseProgress(courseIdValue, user) {
  const { course } = await courseService.requireLearningAccess(courseIdValue, user);
  return { courseId: toFiniteNumber(course.id), ...progressSummary(await learningRepository.getCourseProgress(user.id, course.id)) };
}

module.exports = {
  listMyEnrollments, getLearningCourse, getLearningLesson,
  updateLessonProgress, completeLesson, getCourseProgress,
};
