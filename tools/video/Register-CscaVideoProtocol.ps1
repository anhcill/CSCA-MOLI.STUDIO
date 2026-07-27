[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$launcherPath = Join-Path $repositoryRoot "XU-LY-VIDEO-KHOA-HOC.cmd"

if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
  throw "Khong tim thay launcher: $launcherPath"
}

$protocolRoot = "HKCU:\Software\Classes\csca-video"
$commandKey = Join-Path $protocolRoot "shell\open\command"

New-Item -Path $protocolRoot -Force | Out-Null
Set-Item -Path $protocolRoot -Value "URL:CSCA Course Video Processor"
New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
New-Item -Path $commandKey -Force | Out-Null
Set-Item -Path $commandKey -Value ('"{0}" "%1"' -f $launcherPath)

Write-Host "Da dang ky giao thuc csca-video cho tai khoan Windows hien tai." -ForegroundColor Green
Write-Host "Launcher: $launcherPath"
