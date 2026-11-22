# HLS operations and integration QA — Day 6

Day 6 makes the local FFmpeg/R2 workflow recoverable and testable without
moving encoding into Railway. No migration, server, deployment, or real R2
mutation is required for the local test suite.

## Publisher safety

Before credentials are read, `Publish-CscaHls.mjs` now parses `master.m3u8`
and every referenced rendition playlist. It rejects missing or unreferenced
files, unsafe paths, unsupported renditions, encrypted playlists and rendition
duration drift.

Objects are committed in this order:

1. all `.ts` segments;
2. all rendition `index.m3u8` playlists;
3. `master.m3u8`.

This order prevents a newly visible playlist from referencing an object that
the same publish run has not uploaded yet. Each uploaded object receives a
lowercase SHA-256 metadata value named `sha256`.

## Resume an interrupted upload

Use exactly the same course ID, lesson ID, asset key and output directory:

```powershell
node .\tools\video\Publish-CscaHls.mjs `
  --directory .\out `
  --course-id 12 `
  --lesson-id 48 `
  --asset-key "<assetExternalKey>" `
  --asset-id 73 `
  --api-base-url "https://your-railway-api.example.com" `
  --resume
```

With `--resume`, the publisher performs `HEAD` and skips an object only when
both its byte length and `sha256` metadata match. Older objects without this
metadata are uploaded again. A failed upload never marks the asset ready;
finalization occurs only after all upload barriers complete.

Do not change IDs or the asset key while resuming. Do not delete the prefix of
an asset already used by a published lesson. Rotate the local write token if it
was exposed in terminal output or copied to an untrusted machine.

## Local regression suite

Run from `backend`:

```powershell
npm run test:hls
```

The suite covers strict manifest rejection, local directory validation,
segment/playlist/master upload barriers, checksum resume behavior and the
private video gateway token/path rules. It uses mocks and temporary files; it
does not contact R2 or Railway.

## Staged R2/Railway acceptance checklist

Run this only when migrations 052–054 are applied in the target environment
and the course feature flag is deliberately enabled:

1. Create a draft course and one unpublished video lesson.
2. Upload one short MP4/MOV source through Admin and record the returned asset
   ID and asset key.
3. Encode locally and run the publisher once with `--dry-run`.
4. Publish with a least-privilege token, interrupt once after several segments,
   then rerun with `--resume`.
5. Confirm the finalize response is `ready` and lists only expected variants.
6. Confirm direct bucket access is denied.
7. Confirm a valid learner can play, seek and resume through the Worker.
8. Confirm an expired or altered playback token cannot fetch either a playlist
   or a segment.
9. Confirm the API and browser never expose an R2 credential or private object
   key.
10. Keep the course draft until desktop/mobile playback and duration agree.

If finalization reports a missing or invalid object, leave the asset in
`processing`, correct or regenerate the local HLS directory, and rerun the same
publisher command with `--resume`. Do not manually set database readiness.
