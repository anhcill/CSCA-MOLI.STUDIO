# Video Day 1 QA checklist

## Migration review

- [ ] Apply migrations 052, 053, then 054 to a disposable PostgreSQL copy.
- [ ] Re-run 054 and confirm it is additive/idempotent.
- [ ] Confirm no table/column is dropped and existing course/user rows remain.
- [ ] Reject invalid status, resolution, negative size/duration and duplicate
      default rendition.
- [ ] Confirm deleting a user does not delete video; deleting an asset cascades
      only its variants/upload sessions.

## FFmpeg/HLS fixture review

- [ ] `ffmpeg` and `ffprobe` versions are recorded for the content team.
- [ ] 480p source creates 360p/480p only; 720p excludes 1080p; 1080p creates all.
- [ ] Portrait and odd-width sources produce even encoded dimensions.
- [ ] A silent source encodes without an invalid audio map.
- [ ] `master.m3u8` references every and only generated rendition.
- [ ] Variant playlists use six-second target segments and independent segments.
- [ ] GOP/keyframes align across renditions; seek and ABR switch keep timestamp.
- [ ] H.264/yuv420p video and AAC audio play in Safari and hls.js browsers.
- [ ] No source or output media file is committed to Git.

## Storage/upload security

- [ ] R2 bucket is private; public `r2.dev` is disabled.
- [ ] Credential is bucket-scoped and exists only in Railway/secure admin config.
- [ ] Keys match the documented prefix and reject traversal/backslashes.
- [ ] MIME, bytes, checksum, ETag and FFprobe metadata are verified server-side.
- [ ] Upload expiration/abort/complete are idempotent and rate-limited.
- [ ] Presigned upload URLs are absent from database, logs and analytics.

## Playback security

- [ ] Entitlement is reloaded from PostgreSQL for every playback session.
- [ ] Draft/deleted/not-ready/revoked/expired/wrong-subject requests return 403/404.
- [ ] Token verifies exact algorithm, `iss`, `aud`, `exp`, scope and asset prefix.
- [ ] Expired/tampered/wrong-user/prefix traversal tokens cannot load master,
      variant playlist or segment.
- [ ] Child playlist/segment authorization works via cookie or playlist rewrite;
      a master-only query token is not accepted as complete protection.
- [ ] Worker fails closed and never redirects to private R2.
- [ ] Tokens and R2 object keys are redacted from logs and public APIs.

## Browser and operations

- [ ] Production origins only in CORS; correct `media-src`/`connect-src` CSP.
- [ ] Correct HLS content types, range behavior and OPTIONS/HEAD responses.
- [ ] Segment caching cannot leak authorization or cache one user's token for another.
- [ ] Playback refresh rate limits do not interrupt normal long lessons.
- [ ] Monitor Worker/R2 request counts, cache ratio, storage, 401/403 and 5xx.
- [ ] Railway and Cloudflare budgets/alerts are configured before launch.

Day 1 does not include deployment, a running server, real encoding, R2 writes or
package installation.
