[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$FfmpegPath = "ffmpeg",
  [string]$FfprobePath = "ffprobe",
  [ValidateSet("fast", "medium", "slow")][string]$Preset = "medium",
  [ValidateSet("360p", "480p", "720p", "1080p")][string[]]$Renditions,
  [switch]$PrintCommand
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
  throw "Input video does not exist: $InputPath"
}

$probeArgs = @(
  "-v", "error", "-select_streams", "v:0",
  "-show_entries", "stream=width,height,r_frame_rate:format=duration",
  "-of", "json", $InputPath
)
$probeJson = & $FfprobePath @probeArgs
if ($LASTEXITCODE -ne 0) { throw "ffprobe failed with exit code $LASTEXITCODE" }
$probe = $probeJson | ConvertFrom-Json
$video = $probe.streams | Select-Object -First 1
if (-not $video -or [int]$video.height -le 0) { throw "No usable video stream was found" }

$audioProbe = & $FfprobePath -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 $InputPath
$hasAudio = $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($audioProbe -join ""))

$allProfiles = @(
  [pscustomobject]@{ Name = "360p"; Height = 360; Bandwidth = 650000; MaxRate = "750k"; Buffer = "1000k" },
  [pscustomobject]@{ Name = "480p"; Height = 480; Bandwidth = 1000000; MaxRate = "1150k"; Buffer = "1500k" },
  [pscustomobject]@{ Name = "720p"; Height = 720; Bandwidth = 2200000; MaxRate = "2500k"; Buffer = "3300k" },
  [pscustomobject]@{ Name = "1080p"; Height = 1080; Bandwidth = 4500000; MaxRate = "5000k"; Buffer = "6750k" }
)
$requestedNames = @($Renditions | Where-Object { $_ } | Select-Object -Unique)
$profiles = @($allProfiles | Where-Object {
  $_.Height -le [int]$video.height -and
  ($requestedNames.Count -eq 0 -or $_.Name -in $requestedNames)
})
$profiles = @($profiles)

if (-not $profiles) {
  if ($requestedNames.Count -gt 0) {
    throw "None of the selected renditions can be created from source height $($video.height)p"
  }
  throw "Source height $($video.height)p is below the minimum supported rendition (360p)"
}

$unavailableNames = @($requestedNames | Where-Object { $_ -notin $profiles.Name })
if ($unavailableNames.Count -gt 0) {
  throw "Selected rendition(s) exceed source height $($video.height)p: $(($unavailableNames) -join ', ')"
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$splitLabels = ($profiles | ForEach-Object { "[v$($_.Height)]" }) -join ""
$filters = @("[0:v]split=$($profiles.Count)$splitLabels")
foreach ($profile in $profiles) {
  $filters += "[v$($profile.Height)]scale=-2:$($profile.Height):flags=lanczos[v$($profile.Height)out]"
}

$ffmpegArgs = @("-hide_banner", "-y", "-i", $InputPath, "-filter_complex", ($filters -join ";"))
$streamMap = @()
for ($index = 0; $index -lt $profiles.Count; $index++) {
  $profile = $profiles[$index]
  $ffmpegArgs += @("-map", "[v$($profile.Height)out]")
  if ($hasAudio) { $ffmpegArgs += @("-map", "0:a:0") }
  $ffmpegArgs += @(
    "-c:v:$index", "libx264", "-preset:v:$index", $Preset,
    "-b:v:$index", "$([math]::Floor($profile.Bandwidth / 1000))k",
    "-maxrate:v:$index", $profile.MaxRate, "-bufsize:v:$index", $profile.Buffer
  )
  if ($hasAudio) { $streamMap += "v:$index,a:$index" }
  else { $streamMap += "v:$index" }
}

$frameRateParts = [string]$video.r_frame_rate -split "/"
$fps = if ($frameRateParts.Count -eq 2 -and [double]$frameRateParts[1] -ne 0) {
  [double]$frameRateParts[0] / [double]$frameRateParts[1]
} else { 30.0 }
$gop = [math]::Max(1, [math]::Round($fps * 6))

$ffmpegArgs += @("-pix_fmt", "yuv420p", "-g", "$gop", "-keyint_min", "$gop", "-sc_threshold", "0")
if ($hasAudio) { $ffmpegArgs += @("-c:a", "aac", "-b:a", "128k", "-ac", "2") }
$segmentPattern = (Join-Path $resolvedOutput "v%v\segment_%06d.ts").Replace("\", "/")
$variantPlaylist = (Join-Path $resolvedOutput "v%v\index.m3u8").Replace("\", "/")
$ffmpegArgs += @(
  "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod",
  "-hls_flags", "independent_segments+temp_file",
  "-hls_segment_filename", $segmentPattern,
  "-master_pl_name", "master.m3u8", "-var_stream_map", ($streamMap -join " "),
  $variantPlaylist
)

Write-Host "Source: $($video.width)x$($video.height), audio=$hasAudio, duration=$($probe.format.duration)s"
Write-Host "Renditions: $(($profiles.Name) -join ', ')"
if ($PrintCommand) {
  $printableArgs = $ffmpegArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
  Write-Output ((@($FfmpegPath) + @($printableArgs)) -join " ")
  exit 0
}

if ($PSCmdlet.ShouldProcess($resolvedOutput, "Create CSCA HLS rendition set")) {
  New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
  for ($index = 0; $index -lt $profiles.Count; $index++) {
    New-Item -ItemType Directory -Force -Path (Join-Path $resolvedOutput "v$index") | Out-Null
  }
  & $FfmpegPath @ffmpegArgs
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed with exit code $LASTEXITCODE" }
}
