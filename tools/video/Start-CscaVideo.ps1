[CmdletBinding()]
param(
  [string]$InputPath,
  [int]$CourseId,
  [int]$LessonId,
  [string]$AssetKey,
  [int]$AssetId,
  [string]$ProcessingCode,
  [string]$LaunchUri,
  [int]$CleanupAssetId,
  [ValidateSet("360p", "480p", "720p", "1080p")][string[]]$Renditions,
  [switch]$DryRun,
  [switch]$Configure
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$encoderPath = Join-Path $PSScriptRoot "New-CscaHls.ps1"
$publisherPath = Join-Path $PSScriptRoot "Publish-CscaHls.mjs"
$localDirectory = Join-Path $PSScriptRoot ".local"
$configPath = Join-Path $localDirectory "video-helper.json"
$workRoot = Join-Path $repositoryRoot ".video-work"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Read-Required([string]$Prompt, [string]$CurrentValue = "") {
  if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) { return $CurrentValue.Trim() }
  while ($true) {
    $value = (Read-Host $Prompt).Trim()
    if ($value) { return $value }
    Write-Host "Khong duoc de trong." -ForegroundColor Yellow
  }
}

function Read-PositiveId([string]$Prompt, [int]$CurrentValue = 0) {
  if ($CurrentValue -gt 0) { return $CurrentValue }
  while ($true) {
    $value = Read-Host $Prompt
    $parsed = 0
    if ([int]::TryParse($value, [ref]$parsed) -and $parsed -gt 0) { return $parsed }
    Write-Host "Hay nhap mot so lon hon 0." -ForegroundColor Yellow
  }
}

function Import-ProcessingCode([string]$Value) {
  $parts = $Value.Trim() -split ":", 4
  if ($parts.Count -ne 4 -or
      $parts[0] -notmatch "^[1-9]\d*$" -or
      $parts[1] -notmatch "^[1-9]\d*$" -or
      $parts[2] -notmatch "^[1-9]\d*$" -or
      $parts[3] -notmatch "^[A-Za-z0-9_-]+$") {
    throw "Ma xu ly mot cham khong hop le."
  }
  return [pscustomobject]@{
    CourseId = [int]$parts[0]
    LessonId = [int]$parts[1]
    AssetId = [int]$parts[2]
    AssetKey = $parts[3]
  }
}

function Read-YesNo([string]$Prompt, [bool]$DefaultYes = $true) {
  $suffix = if ($DefaultYes) { "[Y/n]" } else { "[y/N]" }
  $answer = (Read-Host "$Prompt $suffix").Trim().ToLowerInvariant()
  if (-not $answer) { return $DefaultYes }
  return $answer -in @("y", "yes", "c", "co")
}

function Remove-LocalAssetWork([int]$TargetAssetId) {
  if ($TargetAssetId -le 0) { throw "Asset ID can don khong hop le." }

  $resolvedWorkRoot = [IO.Path]::GetFullPath($workRoot)
  if (-not (Test-Path -LiteralPath $resolvedWorkRoot -PathType Container)) {
    Write-Host "May nay chua co thu muc HLS tam de don." -ForegroundColor Green
    return
  }

  $expectedName = "asset-$TargetAssetId"
  $expectedPrefix = "$expectedName-"
  $targets = @(
    Get-ChildItem -LiteralPath $resolvedWorkRoot -Directory -Force |
      Where-Object {
        $_.Name -eq $expectedName -or $_.Name.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)
      }
  )

  if ($targets.Count -eq 0) {
    Write-Host "Khong tim thay file HLS tam cua Asset #$TargetAssetId tren may nay." -ForegroundColor Green
    return
  }

  $totalBytes = [int64]0
  foreach ($target in $targets) {
    if (($target.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Tu choi don lien ket thu muc: $($target.FullName)"
    }

    $resolvedTarget = [IO.Path]::GetFullPath($target.FullName)
    $targetParent = [IO.Path]::GetDirectoryName($resolvedTarget)
    if (-not [string]::Equals($targetParent, $resolvedWorkRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $target.Name -notmatch "^asset-$TargetAssetId(?:-\d{8}-\d{6})?$") {
      throw "Tu choi xoa duong dan khong an toan: $resolvedTarget"
    }

    $targetBytes = [int64]((
      Get-ChildItem -LiteralPath $resolvedTarget -File -Recurse -Force |
        Measure-Object -Property Length -Sum
    ).Sum)
    $totalBytes += $targetBytes
    Write-Host ("  {0} ({1:N1} MiB)" -f $resolvedTarget, ($targetBytes / 1MB))
  }

  Write-Host ""
  Write-Host "Chi xoa file HLS tam tren may. Video tren R2 va du lieu khoa hoc se duoc giu nguyen." -ForegroundColor Yellow
  if (-not (Read-YesNo ("Xoa {0} thu muc, giai phong khoang {1:N1} MiB? Khong the khoi phuc." -f $targets.Count, ($totalBytes / 1MB)) $false)) {
    Write-Host "Da huy, khong co file nao bi xoa." -ForegroundColor Yellow
    return
  }

  foreach ($target in $targets) {
    Remove-Item -LiteralPath $target.FullName -Recurse -Force
  }
  Write-Host ("Da xoa {0} thu muc HLS tam cua Asset #{1}, giai phong khoang {2:N1} MiB." -f $targets.Count, $TargetAssetId, ($totalBytes / 1MB)) -ForegroundColor Green
}

function Select-VideoFile {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Chon video khoa hoc"
  $dialog.Filter = "Video MP4 hoac MOV (*.mp4;*.mov)|*.mp4;*.mov"
  $dialog.Multiselect = $false
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Ban chua chon video."
  }
  return $dialog.FileName
}

function Get-SourceVideoHeight([string]$VideoPath, [string]$ProbePath) {
  $heightText = & $ProbePath -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 $VideoPath
  if ($LASTEXITCODE -ne 0) { throw "Khong doc duoc do phan giai video." }
  $height = 0
  if (-not [int]::TryParse(($heightText | Select-Object -First 1), [ref]$height) -or $height -le 0) {
    throw "Video khong co luong hinh hop le."
  }
  return $height
}

function Select-VideoRenditions([int]$SourceHeight) {
  $allProfiles = @(
    [pscustomobject]@{ Name = "360p"; Height = 360 },
    [pscustomobject]@{ Name = "480p"; Height = 480 },
    [pscustomobject]@{ Name = "720p"; Height = 720 },
    [pscustomobject]@{ Name = "1080p"; Height = 1080 }
  )
  $available = @($allProfiles | Where-Object { $_.Height -le $SourceHeight })
  if (-not $available) {
    throw "Video nguon ${SourceHeight}p thap hon muc toi thieu 360p."
  }

  Write-Step "Chon chat luong can xuat"
  Write-Host "Video nguon: ${SourceHeight}p. Chi cac muc khong vuot qua video nguon moi duoc chon."
  for ($index = 0; $index -lt $available.Count; $index++) {
    Write-Host "  [$($index + 1)] $($available[$index].Name)"
  }
  Write-Host "Co the chon mot hoac nhieu muc. Vi du: 2,3"

  while ($true) {
    $answer = (Read-Host "Nhap so chat luong (Enter = tat ca muc tren)").Trim()
    if (-not $answer) { return @($available.Name) }

    $selected = [System.Collections.Generic.List[string]]::new()
    $valid = $true
    foreach ($token in ($answer -split "[,\s]+")) {
      if (-not $token) { continue }
      $choice = 0
      if (-not [int]::TryParse($token, [ref]$choice) -or $choice -lt 1 -or $choice -gt $available.Count) {
        $valid = $false
        break
      }
      $name = $available[$choice - 1].Name
      if (-not $selected.Contains($name)) { $selected.Add($name) }
    }
    if ($valid -and $selected.Count -gt 0) { return @($selected) }
    Write-Host "Lua chon khong hop le. Hay nhap cac so trong danh sach, cach nhau bang dau phay." -ForegroundColor Yellow
  }
}

function Convert-SecureStringToPlainText([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Test-HttpUrl([string]$Value) {
  $uri = $null
  return [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -and
    $uri.Scheme -in @("http", "https") -and -not [string]::IsNullOrWhiteSpace($uri.Host)
}

function Save-Configuration {
  Write-Step "Cau hinh ket noi (chi can lam lan dau)"
  Write-Host "Lay thong tin R2 trong Cloudflare. Khoa bi mat se duoc Windows ma hoa cho tai khoan hien tai."
  $endpoint = Read-Required "VIDEO_R2_ENDPOINT"
  $bucket = Read-Required "VIDEO_R2_BUCKET"
  $accessKeyId = Read-Required "VIDEO_R2_ACCESS_KEY_ID"
  $secret = Read-Host "VIDEO_R2_SECRET_ACCESS_KEY" -AsSecureString

  if (-not (Test-HttpUrl $endpoint)) { throw "VIDEO_R2_ENDPOINT khong phai URL hop le." }
  if ($secret.Length -eq 0) { throw "VIDEO_R2_SECRET_ACCESS_KEY khong duoc de trong." }

  New-Item -ItemType Directory -Force -Path $localDirectory | Out-Null
  $config = [ordered]@{
    endpoint = $endpoint.TrimEnd("/")
    bucket = $bucket
    accessKeyId = $accessKeyId
    protectedSecretAccessKey = ConvertFrom-SecureString $secret
  }
  $json = $config | ConvertTo-Json
  [IO.File]::WriteAllText($configPath, $json, (New-Object Text.UTF8Encoding($false)))
  Write-Host "Da luu cau hinh an toan tai tools\video\.local." -ForegroundColor Green
  return [pscustomobject]$config
}

function Get-Configuration {
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    return Save-Configuration
  }
  $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
  if (-not $config.endpoint -or -not $config.bucket -or -not $config.accessKeyId -or
      -not $config.protectedSecretAccessKey) {
    throw "File cau hinh video bi thieu thong tin. Chay lai voi -Configure."
  }
  return $config
}

function Resolve-Tool([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [Environment]::GetEnvironmentVariable("Path", "User")
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "Khong tim thay $Name. Hay dong cua so nay, mo lai va thu lai."
  }
  return $command.Source
}

try {
  Set-Location $repositoryRoot
  Write-Host "CSCA - TRO LY XU LY VIDEO KHOA HOC" -ForegroundColor Magenta
  Write-Host "Cong cu se tu encode, kiem tra va upload R2."

  if ($LaunchUri) {
    $decodedLaunchUri = [Uri]::UnescapeDataString($LaunchUri).Trim()
    if ($decodedLaunchUri -match "^csca-video:cleanup:([1-9]\d*)/?$") {
      $CleanupAssetId = [int]$Matches[1]
    } elseif ($decodedLaunchUri -match "^csca-video:(.+)$") {
      $ProcessingCode = $Matches[1].Trim()
    } else {
      throw "Lien ket mo cong cu khong hop le."
    }
  }

  if ($CleanupAssetId -gt 0) {
    Write-Step "Don file HLS tam cua Asset #$CleanupAssetId"
    Remove-LocalAssetWork $CleanupAssetId
    exit 0
  }

  if ($Configure) {
    Save-Configuration | Out-Null
    exit 0
  }

  Write-Step "Kiem tra cong cu"
  $ffmpegPath = Resolve-Tool "ffmpeg"
  $ffprobePath = Resolve-Tool "ffprobe"
  $nodePath = Resolve-Tool "node"
  Write-Host "FFmpeg: $ffmpegPath" -ForegroundColor Green

  if (-not $InputPath) { $InputPath = Select-VideoFile }
  $InputPath = [System.IO.Path]::GetFullPath($InputPath)
  if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Khong tim thay video: $InputPath"
  }
  if ([IO.Path]::GetExtension($InputPath).ToLowerInvariant() -notin @(".mp4", ".mov")) {
    throw "Chi ho tro file MP4 hoac MOV."
  }

  Write-Step "Nhap thong tin ma trang Admin hien thi"
  if (-not $ProcessingCode -and
      ($CourseId -le 0 -or $LessonId -le 0 -or $AssetId -le 0 -or -not $AssetKey)) {
    $ProcessingCode = (Read-Host "Dan MA XU LY MOT CHAM tu trang Admin (Enter de nhap 4 muc rieng)").Trim()
  }
  if ($ProcessingCode) {
    $processing = Import-ProcessingCode $ProcessingCode
    $CourseId = $processing.CourseId
    $LessonId = $processing.LessonId
    $AssetId = $processing.AssetId
    $AssetKey = $processing.AssetKey
    Write-Host "Da doc ma: Course #$CourseId, Lesson #$LessonId, Asset #$AssetId" -ForegroundColor Green
  } else {
    $CourseId = Read-PositiveId "Course ID" $CourseId
    $LessonId = Read-PositiveId "Lesson ID" $LessonId
    $AssetId = Read-PositiveId "Asset ID (so sau chu Asset #)" $AssetId
    $AssetKey = Read-Required "Khoa xu ly HLS" $AssetKey
  }
  if ($AssetKey -notmatch "^[A-Za-z0-9_-]+$") { throw "Khoa xu ly HLS khong hop le." }

  New-Item -ItemType Directory -Force -Path $workRoot | Out-Null
  $outputDirectory = Join-Path $workRoot "asset-$AssetId"
  $masterPlaylist = Join-Path $outputDirectory "master.m3u8"
  $resume = $false

  if (Test-Path -LiteralPath $masterPlaylist -PathType Leaf) {
    $resume = Read-YesNo "Da co ket qua cua Asset #$AssetId. Dung lai de tiep tuc nhanh hon?"
    if (-not $resume) {
      $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
      $outputDirectory = Join-Path $workRoot "asset-$AssetId-$stamp"
    }
  }

  if (-not $resume) {
    $sourceHeight = Get-SourceVideoHeight $InputPath $ffprobePath
    if (-not $Renditions -or $Renditions.Count -eq 0) {
      $Renditions = Select-VideoRenditions $sourceHeight
    }
    $invalidRenditions = @($Renditions | Where-Object { [int]($_ -replace "p$", "") -gt $sourceHeight })
    if ($invalidRenditions.Count -gt 0) {
      throw "Khong the xuat $(($invalidRenditions) -join ', ') tu video nguon ${sourceHeight}p."
    }
    Write-Host "Se xuat: $(($Renditions) -join ', ')" -ForegroundColor Green

    Write-Step "Dang chuyen video thanh HLS"
    Write-Host "Buoc nay co the mat nhieu phut va dung nhieu CPU. Khong dong cua so."
    & $encoderPath `
      -InputPath $InputPath `
      -OutputDirectory $outputDirectory `
      -FfmpegPath $ffmpegPath `
      -FfprobePath $ffprobePath `
      -Renditions $Renditions
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg khong hoan tat." }
  } else {
    Write-Host "Bo qua encode, dung lai ket qua: $outputDirectory" -ForegroundColor Green
  }

  Write-Step "Kiem tra tat ca playlist va doan video"
  $validationArgs = @(
    $publisherPath,
    "--directory", $outputDirectory,
    "--course-id", "$CourseId",
    "--lesson-id", "$LessonId",
    "--asset-key", $AssetKey,
    "--dry-run"
  )
  & $nodePath @validationArgs
  if ($LASTEXITCODE -ne 0) { throw "Ket qua HLS khong hop le." }

  if ($DryRun) {
    Write-Host "Che do thu: khong upload va khong goi Railway." -ForegroundColor Yellow
    exit 0
  }

  $config = Get-Configuration
  $protectedSecret = ConvertTo-SecureString $config.protectedSecretAccessKey
  $env:VIDEO_R2_ENDPOINT = $config.endpoint
  $env:VIDEO_R2_BUCKET = $config.bucket
  $env:VIDEO_R2_ACCESS_KEY_ID = $config.accessKeyId
  $env:VIDEO_R2_SECRET_ACCESS_KEY = Convert-SecureStringToPlainText $protectedSecret

  Write-Step "Upload video HLS len R2"
  $publishArgs = @(
    $publisherPath,
    "--directory", $outputDirectory,
    "--course-id", "$CourseId",
    "--lesson-id", "$LessonId",
    "--asset-key", $AssetKey,
    "--resume"
  )
  & $nodePath @publishArgs
  if ($LASTEXITCODE -ne 0) { throw "Upload R2 khong hoan tat." }

  Write-Step "THANH CONG"
  Write-Host "Da upload xong Asset #$AssetId." -ForegroundColor Green
  Write-Host "Quay lai trang Admin va bam 'KIEM TRA VA HOAN TAT VIDEO'." -ForegroundColor Yellow
  Write-Host "Thu muc tam duoc giu lai de co the khoi phuc: $outputDirectory"
} catch {
  Write-Host ""
  Write-Host "LOI: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Thu muc da encode (neu co) van duoc giu lai; chay lai se co the tiep tuc." -ForegroundColor Yellow
  exit 1
} finally {
  $env:VIDEO_R2_SECRET_ACCESS_KEY = $null
}
