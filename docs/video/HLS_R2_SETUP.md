# HLS + private R2 setup (Day 1 contract)

## Data path

```text
Admin machine: source -> FFmpeg -> HLS directory -> direct R2 upload
Learner: hls.js -> Cloudflare Worker gateway -> private R2
Railway API: entitlement check -> short-lived playback token
```

Express/Railway must not proxy playlists or segments. The R2 bucket must remain
private and its `r2.dev` public URL must be disabled.

## Object keys

```text
private/courses/{courseId}/lessons/{lessonId}/{assetExternalKey}/source/{uuid}.mp4
private/courses/{courseId}/lessons/{lessonId}/{assetExternalKey}/hls/master.m3u8
private/courses/{courseId}/lessons/{lessonId}/{assetExternalKey}/hls/v0/index.m3u8
private/courses/{courseId}/lessons/{lessonId}/{assetExternalKey}/hls/v0/segment_000001.ts
```

Database/API responses for catalog and curriculum must never expose these keys.
The gateway token carries only an allowed HLS prefix; the Worker rejects path
traversal and any request outside that prefix.

## Environment placeholders

Configure these as Railway service variables; do not commit their values:

```dotenv
VIDEO_R2_ACCOUNT_ID=
VIDEO_R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
VIDEO_R2_ACCESS_KEY_ID=
VIDEO_R2_SECRET_ACCESS_KEY=
VIDEO_R2_BUCKET=csca-video-private
VIDEO_GATEWAY_BASE_URL=https://video.example.com
VIDEO_PLAYBACK_TOKEN_SECRET=at-least-32-random-bytes
VIDEO_PLAYBACK_TOKEN_ISSUER=csca-api
VIDEO_PLAYBACK_TOKEN_AUDIENCE=csca-video-gateway
VIDEO_PLAYBACK_TTL_SECONDS=14400
VIDEO_UPLOAD_TTL_SECONDS=900
```

Use a dedicated video bucket credential limited to the bucket. Do not reuse the
existing material/PDF variables. Rotate credentials if they enter a log, client
bundle, screenshot, or Git history.

## Playback gateway

Before Railway issues a session it must authenticate the user, reload the
course/enrollment/tier/subject entitlement from PostgreSQL, confirm that the
lesson and video are published/ready, and rate-limit refreshes. The token should
use HS256 (or asymmetric signing later), a random `jti`, `iss`, `aud`, `sub`,
`exp`, `scope=video:read`, `videoAssetId`, and the exact asset prefix. Four hours
is the initial TTL (accepted range: 15 minutes to 6 hours), so a normal lesson
does not stop halfway through. The API may later add a refresh flow before expiry.

The Worker must verify signature, algorithm, issuer, audience, expiry and scope;
normalize/decode the requested path once; reject `..`, backslashes, encoded path
separators and prefix mismatches; then fetch from its R2 binding. Fail closed
with 401/403. Do not redirect to R2 and do not log query-string tokens.

Day 2 uses the Worker implementation in `workers/video-gateway`: it rewrites
every child playlist/segment URI (including quoted HLS `URI` attributes) with
the same short-lived query token. A bare query token on `master.m3u8` would not
protect relative requests, so playlist rewriting must remain enabled. Gateway
observability must not record URLs or query strings containing these tokens.

## CORS, CSP and headers

- Allow only the production CSCA frontend origins (and explicit local origins
  in development), never `*` with credentials.
- Gateway CORS methods: `GET`, `HEAD`, `OPTIONS`; expose `Content-Length`,
  `Content-Range`, `Accept-Ranges`, `ETag`.
- CSP: add the gateway origin to `media-src` and `connect-src`.
- Serve `.m3u8` as `application/vnd.apple.mpegurl` and `.ts` as `video/mp2t`.
- Cache immutable segments with a long public edge TTL only when the cache key
  cannot mix authorization decisions. Keep private/tokenized playlists short or
  non-cacheable. Never include the bearer token in a shared cache key/log.

## Upload and publish rules

Validate MIME, extension, maximum size and SHA-256. A successful upload is not
proof of a valid video: verify with `HEAD` and trusted FFprobe output. Publish an
asset only when `master.m3u8` and at least the expected 720p rendition are ready
(or the highest non-upscaled rendition for a source below 720p). Presigned URLs
and playback tokens are ephemeral and are never stored in PostgreSQL.

## Request/cost expectation

At six seconds per segment, one watched hour is roughly 600 segment requests,
plus playlist refreshes. R2 storage grows by the sum of all renditions. Worker
and R2 request pricing/quotas change, so check Cloudflare's current dashboard and
official pricing before launch; instrument requests, storage bytes, 4xx/5xx and
cache hit ratio. Set Railway and Cloudflare spending alerts. Encoding locally
keeps FFmpeg CPU off Railway for the initial 50-75 video scale.

## Deferred dependency

The Day 1 backend deliberately ships a placeholder storage adapter. When direct
uploads are implemented, add `@aws-sdk/client-s3` and
`@aws-sdk/s3-request-presigner` (or a reviewed SigV4 implementation) in a
separate package change. Do not use the existing PDF stream proxy for HLS.
