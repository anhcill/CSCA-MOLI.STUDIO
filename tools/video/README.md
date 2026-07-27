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
outputs are gitignored.

`New-CscaHls.ps1` probes the source video, selects only 360p/480p/720p/1080p
renditions that do not exceed the source height, aligns keyframes to six-second
segments, and asks FFmpeg to produce a VOD `master.m3u8`.

Preview the generated FFmpeg command without encoding:

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out -PrintCommand
```

Encode locally (never on the Express API process):

```powershell
.\tools\video\New-CscaHls.ps1 -InputPath .\lesson.mp4 -OutputDirectory .\out
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
