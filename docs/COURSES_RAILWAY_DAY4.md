# CSCA Courses — Railway Day 4

Day 4 connects the existing course modules to the Express application behind a
fail-closed feature flag. It does not run migrations, start a server, build, or
deploy anything.

## Route mounts

The routes below only exist when `CSCA_COURSES_ENABLED=true` (exact lowercase
value):

| Mount | Purpose |
| --- | --- |
| `/api/courses` | Public catalog/landing and authenticated enrollment |
| `/api/me` | Current learner enrollments |
| `/api/learning` | Learning room, progress, completion and playback session |
| `/api/admin/courses` | Course administration |
| `/api/admin/course-media` | Private R2 upload session lifecycle |

An unset, empty, or `false` flag disables every mount. Any other value is a
configuration error and stops startup instead of accidentally exposing a
partially configured feature. Course route modules are not required while the
flag is disabled.

## Railway rollout order

1. Back up the production PostgreSQL database and note the restore point.
2. Keep `CSCA_COURSES_ENABLED=false` during the database rollout.
3. Apply migrations in this exact order:
   - `database/migrations/052_csca_courses_core.sql`
   - `database/migrations/053_csca_course_progress.sql`
   - `database/migrations/054_csca_video_assets.sql`
4. Verify the new tables, constraints and migration records in PostgreSQL.
5. Configure the dedicated private video R2 credentials, gateway URL, playback
   issuer/audience/secret, TTLs and allowed frontend origins from
   `backend/.env.example`. Do not reuse the material/PDF bucket in production.
6. Configure the Cloudflare Worker with the same playback secret, issuer,
   audience and the intentional `VIDEO_ALLOWED_ORIGINS` list.
7. Deploy the code while the feature flag is still false and check the existing
   health endpoint and non-course APIs.
8. Set `CSCA_COURSES_ENABLED=true`, redeploy, then perform authenticated smoke
   tests for catalog, enrollment, learning, progress, playback and admin upload.

Rollback the application by setting the flag back to `false`. Database rollback
must follow the migration rollback policy and should not delete production data
automatically.

## Security and traffic controls

- Public course GETs are not given an extra strict limiter; they retain the
  application-wide API limiter.
- Enrollment, progress/completion, playback session, admin writes and media
  uploads have separate configurable limits. `OPTIONS` is always skipped, and
  the admin write limiter skips `GET`/`HEAD`.
- Rate-limit responses use the normal error envelope:
  `{ "success": false, "code": "RATE_LIMITED", "message": "..." }`.
- `VIDEO_GATEWAY_BASE_URL` contributes only its validated HTTP(S) origin to CSP
  `connect-src` and `media-src`; production requires HTTPS. Invalid values are
  omitted rather than widening CSP. `blob:` is allowed only in `media-src` for
  browser HLS playback.
- Keep the R2 bucket private. Browser playback goes through the gateway, never a
  public R2 URL or the Railway API process.

## Pre-enable checklist

- [ ] Migrations 052 → 053 → 054 applied successfully.
- [ ] `VIDEO_GATEWAY_BASE_URL` is HTTPS in production and contains no credentials.
- [ ] Playback secret is random, at least 32 bytes, and matches the Worker.
- [ ] Issuer and audience match on Railway and Worker.
- [ ] Worker origins list contains only intended frontend origins.
- [ ] Private R2 access and gateway Range/HLS behavior have been verified.
- [ ] Admin permission `content.manage` has been tested.
- [ ] Rate limits are suitable for the expected Railway traffic.
- [ ] Only then set `CSCA_COURSES_ENABLED=true`.
