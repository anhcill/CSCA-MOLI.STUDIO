# Video gateway Day 2

## Security contract

Railway authenticates the learner and checks enrollment/entitlement before
calling `createPlaybackSession`. Its HS256 JWT and the Worker use the same
secret, issuer (`csca-api`) and audience (`csca-video-gateway`). Required claims
are `sub`, `lessonId`, `videoAssetId`, `assetPrefix`, `scope=video:read`, `jti`,
`iss`, `aud`, and `exp`. The exact signed prefix is the only R2 namespace a
request may access.

The gateway accepts only `/hls/{normalized-relative-path}`. It rejects traversal,
backslashes, encoded separators, unknown extensions, external playlist URIs,
invalid signature/algorithm/context/scope and expired tokens. Authorization is
fail-closed. Playlist URI rewriting propagates the same short-lived token to
rendition playlists, segments and `URI="..."` HLS attributes.

## Response policy

- Only allow origins in `VIDEO_ALLOWED_ORIGINS`; never use wildcard credentials.
- Support `GET`, `HEAD`, `OPTIONS` and byte Range responses.
- Playlists use `private, no-store`; immutable media uses private browser cache.
- Worker Cache API is deliberately unused, so authorization cannot be bypassed
  by a shared cached object.
- Return generic errors. Do not log request URLs, query strings, JWTs, signed R2
  prefixes, or object keys.

## Pre-deploy checklist

- [ ] R2 bucket is private and public `r2.dev` access is disabled.
- [ ] `VIDEO_BUCKET` is bound to the dedicated video bucket.
- [ ] Railway and Worker secrets match and contain at least 32 random bytes.
- [ ] Issuer/audience match on both services.
- [ ] Production and intentional development origins are the only allowlist entries.
- [ ] Worker request logging/analytics does not capture query strings.
- [ ] Custom gateway domain is present in frontend CSP `media-src` and `connect-src`.
- [ ] Test invalid/expired/tampered JWT, traversal, forbidden origin, HEAD and Range.
- [ ] Test master -> rendition -> segment playback for every produced resolution.
- [ ] Rotate the shared secret with an overlap plan before production rotation.

Day 2 does not deploy, install packages, start servers or expose the bucket.
