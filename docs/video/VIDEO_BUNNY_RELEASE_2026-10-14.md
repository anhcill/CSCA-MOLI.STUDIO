# Bunny release preparation - 2026-10-14

## Configuration and database

- Railway project `csca moly`, service `CSCA-MOLI.STUDIO`, production.
- Library 779163: read-only provider API probe returned HTTP 200, zero videos.
- Library ID, library API key and embed token key stored only in Railway variables.
- Bunny and video commerce enabled for the next deployment; video sales disabled.
- Vercel's public upload feature flag is configured in `frontend/vercel.json`.
- Migrations 067-070 applied in one transaction with a 5-second lock timeout and
  60-second statement timeout. All four existing migration checks passed.
- A local, Git-ignored snapshot preserves six enrollments, six video assets and
  43 affected-table constraint definitions before migration. This is a targeted
  snapshot, not a complete database backup.

## Browser protection

- Server supplies a viewer code without exposing email or phone in the overlay.
- Moving watermark is retained by container fullscreen and mobile expansion.
- Embedded fullscreen/PiP is denied; native HLS disables PiP and remote playback.
- Hidden/pagehide events pause and cover the player, requiring a manual return.
- Print output conceals the player. Screenshot shortcuts cover it only when the
  browser actually delivers the keyboard event.
- These are removable client-side deterrents, not DRM, OS capture detection or
  guaranteed recording prevention. Iframe keyboard events do not bubble to the
  parent page. Android/iOS devices and real Bunny playback still need verification.

## Validation

- 103 Node backend tests and 20 Jest tests passed.
- Browser runner passed progress, refresh, revocation, moving watermark,
  fullscreen fallback, hidden shielding, print concealment and delivered-key
  tests at mobile and desktop viewport sizes. Provider/API were mocked.
- Production frontend Webpack build passed, including TypeScript and all 156
  static pages. Git-triggered deployments are checked after pushing the release.
- Unrelated local authentication edits and the report generator are excluded.

## First live video

Upload a short authorized sample through course admin, select Bunny Stream, wait
for ready and test playback with an enrolled account. Verify signed embed expiry,
domain restrictions and direct-file rejection in Bunny, plus physical Android and
iPhone playback/fullscreen. Library currently has no sample, so real upload and
playback are not yet confirmed. Keep video sales off until payment and playback
acceptance checks in VIDEO_COMMERCE_RELEASE_CHECKLIST.md are complete.
