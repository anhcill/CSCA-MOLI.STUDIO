# CSCA HLS encoder

## Cach de nhat tren Windows

FFmpeg must be installed once. From the repository root, double-click:

```text
XU-LY-VIDEO-KHOA-HOC.cmd
```

The Vietnamese wizard selects the MP4/MOV file and accepts the one-click
processing code shown by Admin, then encodes, validates and uploads the asset.
The code combines the course ID, lesson ID, asset ID and HLS key so the operator
only copies one value. On first publish the wizard asks for R2 configuration.
The R2 secret is protected with Windows DPAPI for the current Windows account.
After the upload, return to Admin and click `Kiem tra va hoan tat video`; the
browser's existing Admin session securely calls Railway finalization, so the
operator never copies an Admin access token into PowerShell.

Generated HLS work is retained under `.video-work/asset-<id>` so an interrupted
run can continue without encoding again. Both local configuration and work
outputs are gitignored. After the video has been finalized and playback has
been checked, Admin's `Don HLS tam tren may` button opens the desktop helper,
shows the matching local folders and their size, and asks for confirmation
before deleting them. This cleanup never deletes the R2 objects or course data.

For a no-copy workflow on Windows, run `DANG-KY-CONG-CU-VIDEO.cmd` once. It
registers the per-user `csca-video:` URL protocol and points it at the repository
launcher. Admin can then open the helper with the processing code already
attached by clicking `Mo cong cu xu ly tren may`. No administrator elevation is
required; the copy button remains available as a fallback.

Before encoding, the Windows wizard shows the resolutions supported by the
source and lets the operator choose one or more renditions. For example, a
1080p source can be published as only 1080p, or as 480p + 720p, without
generating 360p. Pressing Enter keeps the original behavior and generates every
supported rendition. `New-CscaHls.ps1` never upscales beyond the source height,
aligns keyframes to six-second segments, and asks FFmpeg to produce a VOD
`master.m3u8`.

Preview the generated FFmpeg command without encoding:

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out -PrintCommand
```

Encode locally (never on the Express API process):

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out
```

Choose renditions directly for non-interactive use:

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out -Renditions 480p,720p
```

Requirements: `ffmpeg` and `ffprobe` available on `PATH`. The script does not
upload to R2. Review the output playlists and then upload the whole directory
without renaming relative paths.

Validate the generated directory without uploading:

```powershell
node .\tools\video\Publish-CscaHls.mjs --directory .\out --course-id 12 --lesson-id 48 --asset-key "<assetExternalKey>" --dry-run
```

`Publish-CscaHls.mjs` uploads the validated directory directly to the dedicated
private R2 bucket and can call Railway's protected finalize endpoint. See
`docs/HLS_PUBLISH_DAY5.md` for credentials, command examples, and verification
behavior.

If an upload is interrupted, run the same command again with `--resume`.
The publisher stores a SHA-256 checksum as object metadata and skips only an
object whose remote size and checksum both match the local file. Uploads use
three barriers: all segments first, rendition playlists second, and
`master.m3u8` last. See `docs/HLS_OPERATIONS_DAY6.md` for recovery and staged
R2/Railway verification.
