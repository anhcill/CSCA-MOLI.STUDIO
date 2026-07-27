@echo off
chcp 65001 >nul
title CSCA - Dang ky cong cu video
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\video\Register-CscaVideoProtocol.ps1"
set "CSCA_REGISTER_EXIT=%ERRORLEVEL%"
echo.
if not "%CSCA_REGISTER_EXIT%"=="0" (
  echo Dang ky chua thanh cong. Xem loi o phia tren.
) else (
  echo Da dang ky. Nut "Mo cong cu xu ly" tren Admin da san sang.
)
echo.
pause
exit /b %CSCA_REGISTER_EXIT%
