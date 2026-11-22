# CSCA Course API Contract (Day 6)

Status: canonical course, learner, playback and admin routers plus resumable local HLS publishing/finalization are implemented. `index.js` mounts all course routes only when `CSCA_COURSES_ENABLED=true`; the flag defaults to `false` until migrations 052–054 are applied. Day 6 does not run migrations, build, start a server, or deploy.

## Invariants

- CSCA subjects: `MATH`, `PHYSICS`, `CHEMISTRY`, `CHINESE_SCI`, `CHINESE_SOC`.
- API JSON is `camelCase`; PostgreSQL remains `snake_case`.
- Database resource IDs are returned as JSON numbers. Slugs and `externalKey` are strings.
- The server derives the user, tier, subject entitlement, enrollment and completion percentage. Client authorization fields are ignored.
- Private R2 keys and playback manifests are never returned by these endpoints.
- Every learner read/write checks both an active enrollment and the current server-side entitlement. Admin-created `contact`/`private` enrollments remain the exception defined by their enrollment source.

Success uses `{ "success": true, "data": ... }`. Errors use `{ "success": false, "code": "...", "message": "..." }`.

## Public course router — mount at `/api/courses`

### `GET /api/courses`

Public catalog, with optional authentication. Supported query values are `subjectCode`, `accessType`, `page`, and `pageSize` (`1..50`; legacy `limit` is also accepted). `data` is a `CourseCatalogDto`:

```json
{
  "success": true,
  "data": { "items": [], "page": 1, "pageSize": 12, "totalItems": 0, "totalPages": 0 }
}
```

### `GET /api/courses/:slug`

Returns `CourseDetailDto`: published landing metadata, access state, string-array outcomes/requirements and public curriculum. Lesson content and video/material IDs remain hidden. DTO fields use `descriptionHtml`, `durationSeconds`, and `access.reasonCode`.

### `POST /api/courses/:courseId/enroll`

Requires authentication. Returns `EnrollmentDto`, including `courseSlug` and a progress summary. It is idempotent for an active enrollment. Free, VIP and Premium enrollment is allowed only after current entitlement validation. Contact/private enrollment is admin-only; revoked enrollment is never self-reactivated.

## My account router — mount at `/api/me`

### `GET /api/me/course-enrollments`

Returns `MyLearningItemDto[]`. Expired/revoked enrollments and courses no longer covered by the user's current entitlement are omitted. Each item includes `enrollment.progress` and matching `course.progress` summaries.

## Learner router — mount at `/api/learning`

All endpoints require authentication.

### `GET /api/learning/courses/:courseId`

Returns the enrolled course, enrollment/progress summary and published curriculum. It does not return playback authorization.

### `GET /api/learning/lessons/:lessonId`

The lesson determines its course server-side; the client cannot pair a lesson with another course. Returns `LearningRoomDto`: course identity, enrollment, curriculum, selected lesson content/resources, and previous/next published lesson IDs.

### `PUT /api/learning/lessons/:lessonId/progress`

Request:

```json
{ "positionSeconds": 385, "watchedDeltaSeconds": 10, "durationSeconds": 900 }
```

`watchedDeltaSeconds` is elapsed playback since the previous flush, not the resume position.
The server bounds it to `0..60` seconds per request and adds it atomically to stored watch time;
seeking forward therefore cannot complete a video. Legacy cumulative `watchedSeconds` is accepted
temporarily, but only its positive, bounded difference from stored watch time is counted.
`durationSeconds` and any client completion percentage are ignored. Positions are non-negative and
clamped to the server's lesson duration. Maximum position, watched time, percentage and completed
status are monotonic. Video completion is derived from stored watched time at 85%.

### `POST /api/learning/lessons/:lessonId/complete`

Idempotently completes article/document lessons. A video must already have at least 85% stored completion. Quiz completion is rejected with `QUIZ_COMPLETION_REQUIRES_ATTEMPT` until the quiz-attempt flow owns it.

### `GET /api/learning/courses/:courseId/progress`

Returns progress derived from published required lessons, including last lesson/resume position. `lesson_progress` remains the source of truth.

### `POST /api/learning/lessons/:lessonId/playback-session`

Creates a short-lived, entitlement-checked HLS playback session. The lesson determines its
course server-side. Only a published video lesson with a `ready` asset, a valid master manifest,
and at least one ready HLS variant is accepted. The response is a `PlaybackSessionDto`:

```json
{
  "sessionId": "756040bf-4f31-48bf-91c8-1f379ca793fa",
  "lessonId": 42,
  "deliveryType": "hls",
  "manifestUrl": "https://video.example.com/hls/master.m3u8?token=...",
  "expiresAt": "2026-07-17T14:00:00.000Z",
  "variants": [
    { "resolution": "720p", "width": 1280, "height": 720, "bitrateKbps": 2800, "isReady": true }
  ],
  "resumePositionSeconds": 385
}
```

Neither the R2 object key nor asset prefix is returned as a standalone field. Stable failures
include `LESSON_NOT_FOUND`, `LESSON_NOT_VIDEO`, `VIDEO_NOT_READY`, and
`VIDEO_PLAYBACK_UNAVAILABLE`. The Railway-issued HS256 JWT uses the same issuer, audience,
scope and asset-prefix contract verified by the Day 2 Cloudflare Worker.

## Conditional mounting

After migrations 052–054 are approved and applied, set `CSCA_COURSES_ENABLED=true`. The application then mounts:

```js
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/me", require("./routes/meCourseRoutes"));
app.use("/api/learning", require("./routes/learningRoutes"));
app.use("/api/admin/courses", require("./routes/adminCourseRoutes"));
app.use("/api/admin/course-media", require("./routes/courseMediaRoutes"));
```

Enrollment, progress/completion, playback, admin writes and media uploads have dedicated rate limits in addition to the global API limiter. See `ADMIN_COURSES_DAY4.md` for the CMS contract and `COURSES_RAILWAY_DAY4.md` for rollout order. Do not expose the removed Day 1 aliases under `/api/courses/:courseId/learn` or `/api/courses/:courseId/lessons/...`.

## Day 5 HLS finalization

`POST /api/admin/course-media/assets/:assetId/hls/finalize` requires `content.manage`. It derives the private prefix from the asset record, validates the master playlist, every rendition playlist and every referenced segment, then transactionally registers variants and changes the asset to `ready`. Request bodies may provide only a short `manifestVersion`; object keys and readiness metadata are never trusted from the client. See `HLS_PUBLISH_DAY5.md`.

## Day 6 publishing safety and QA

The local publisher validates playlist contents before reading credentials,
uploads segments before rendition playlists and the master playlist last, and
supports checksum-safe `--resume`. These changes do not add a public API or
weaken the protected finalize boundary. See `HLS_OPERATIONS_DAY6.md`.
