# HLS publish workflow — Day 5

Day 5 closes the local-encoding path without running FFmpeg inside Railway. The trusted admin machine encodes and uploads HLS; Railway verifies the private R2 objects and performs the database transition to `ready`.

## End-to-end sequence

1. In Admin Courses, create a video lesson and upload its MP4/MOV source.
2. Record the returned numeric asset ID and `assetExternalKey` shown as the HLS processing key.
3. Encode the same source locally:

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out
```

4. Give the local process a least-privilege R2 token for the dedicated video bucket. Put the admin bearer token in an environment variable rather than a command argument so it is not stored in shell history:

```powershell
$env:VIDEO_R2_ENDPOINT = "https://<account>.r2.cloudflarestorage.com"
$env:VIDEO_R2_BUCKET = "moly-course-videos"
$env:VIDEO_R2_ACCESS_KEY_ID = "..."
$env:VIDEO_R2_SECRET_ACCESS_KEY = "..."
$env:CSCA_ADMIN_TOKEN = "..."

node .\tools\video\Publish-CscaHls.mjs `
  --directory .\out `
  --course-id 12 `
  --lesson-id 48 `
  --asset-key "<assetExternalKey>" `
  --asset-id 73 `
  --api-base-url "https://your-railway-api.example.com"
```

Use `--dry-run` first to validate the directory without reading credentials, uploading, or calling Railway. Clear the credential variables after the operation.

## Finalize endpoint

`POST /api/admin/course-media/assets/:assetId/hls/finalize` requires authentication and `content.manage`.

Optional body:

```json
{ "manifestVersion": "hls-v1" }
```

Railway derives the R2 prefix from the database asset; the client cannot supply an object key. It then:

- reads and strictly parses `master.m3u8`;
- accepts only the encoder layout `vN/index.m3u8` plus `segment_NNNNNN.ts`;
- rejects traversal, external URI, encrypted playlist, unsupported resolution and malformed VOD playlist;
- reads every variant playlist and checks duration agreement within 2% or one second;
- performs bounded-concurrency HEAD checks for every referenced segment;
- rejects missing/empty segments and more than 20,000 segment objects;
- replaces variant metadata and marks the asset `ready` in one PostgreSQL transaction;
- attaches the asset to its original lesson and refreshes course duration.

No R2 key, R2 credential, admin token or signed playback URL is returned.

## Operational notes

- Re-running finalize is idempotent in effect: objects are reverified and variant rows are transactionally replaced.
- Uploading files alone does not make a video playable. The finalize call must succeed.
- A course remains unpublishable while any published video lesson lacks a verified `ready` asset.
- Do not run the publisher on an untrusted/student machine. The local R2 credential can write course video objects.
- Day 5 does not automatically delete a partially uploaded HLS directory. Re-run the publisher with the same asset key to overwrite immutable outputs, then finalize again.
