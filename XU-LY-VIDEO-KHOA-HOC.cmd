@echo off
chcp 65001 >nul
title CSCA - Xu ly video khoa hoc
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\video\Start-CscaVideo.ps1"
set "CSCA_VIDEO_EXIT=%ERRORLEVEL%"
echo.
if not "%CSCA_VIDEO_EXIT%"=="0" (
  echo Xu ly chua hoan tat. Xem loi o phia tren.
) else (
  echo Da hoan tat.
)
echo.
pause
exit /b %CSCA_VIDEO_EXIT%
