# Video upload Day 3

Day 3 adds an unmounted admin API for direct, private source-video uploads to the dedicated video R2 bucket. The Railway API validates ownership, creates the object key, and returns a short-lived presigned PUT URL. Credentials are never returned. The key is not returned as a separate field, although a presigned URL inherently contains its scoped object path.

## Environment

Set these only on the Railway API service:

```env
VIDEO_R2_ACCOUNT_ID=...
VIDEO_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
VIDEO_R2_ACCESS_KEY_ID=...
VIDEO_R2_SECRET_ACCESS_KEY=...
VIDEO_R2_BUCKET=csca-private-video
VIDEO_UPLOAD_TTL_SECONDS=900
```

Do not reuse the material/PDF bucket variables. The endpoint, credentials, and bucket are validated lazily when an upload request is made.

## API

Both endpoints require `authenticate` and `content.manage`. The router is intentionally not mounted on Day 3.

### `POST /api/admin/course-media/uploads`

```json
{
  "courseId": 12,
  "lessonId": 48,
  "contentType": "video/mp4",
  "sizeBytes": 734003200,
  "checksumSha256": "<64 lowercase hex characters>"
}
```

The API verifies that the lesson belongs to the course and takes `created_by` exclusively from the authenticated user. It generates the R2 key and returns `uploadUrl`, `method`, `requiredHeaders`, and expiry. The browser must send every returned header unchanged with the PUT request. `Content-Length` is intentionally not a required header because browsers cannot set it; exact size is checked by HEAD during completion.

Single PUT is capped at 4 GiB. Larger sources fail with `VIDEO_MULTIPART_REQUIRED`; multipart is deliberately deferred. The broader asset limit remains 20 GiB for that future workflow.

### `POST /api/admin/course-media/uploads/:sessionId/complete`

The API looks up only sessions created by the authenticated admin, rejects expired/terminal sessions, performs R2 HEAD, and compares size, MIME, and SHA-256 metadata. A successful transition atomically marks the session `completed` and asset `processing`. Repeating completion is idempotent.

R2/S3 HEAD does not calculate a SHA-256 hash. Integrity therefore depends on the checksum supplied by the admin client before upload and the signed `x-amz-meta-sha256` header. The API fails closed if the metadata is absent or different. For adversarial-client verification, a worker must stream and hash the object before encoding; this is outside Day 3.

## Client sequence

1. Calculate SHA-256 locally.
2. Request an upload session.
3. PUT the exact file with all returned headers.
4. Call complete once PUT succeeds.
5. Treat `processing` as queued for the future FFmpeg worker.

No secret, source object key, or R2 credentials should be logged or exposed to the frontend.
