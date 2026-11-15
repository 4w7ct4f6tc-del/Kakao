@echo off
chcp 65001 >nul
title KAkAo
cd /d "%~dp0"

echo.
echo   ==============================
echo      KAkAo  -  One click start
echo   ==============================
echo.

REM 1) Already built? Just open the EXE.
if exist "app\build\windows\x64\runner\Release\kakao.exe" (
  echo Opening KAkAo...
  start "" "app\build\windows\x64\runner\Release\kakao.exe"
  exit /b 0
)

REM 2) Downloaded release ZIP next to this file? (from GitHub Actions)
if exist "KAkAo-windows\kakao.exe" (
  start "" "KAkAo-windows\kakao.exe"
  exit /b 0
)

REM 3) Build from source with Flutter.
where flutter >nul 2>nul
if errorlevel 1 (
  echo Flutter is not installed. Opening the install page...
  echo Install Flutter, then double-click start.bat again.
  start "" "https://docs.flutter.dev/get-started/install/windows/desktop"
  pause
  exit /b 1
)

set "DEFINES="
if exist "kakao.config.bat" call "kakao.config.bat"
if defined KAKAO_API set "DEFINES=%DEFINES% --dart-define=KAKAO_API=%KAKAO_API%"
if defined KAKAO_WEB set "DEFINES=%DEFINES% --dart-define=KAKAO_WEB=%KAKAO_WEB%"

cd app
echo Getting packages...
call flutter pub get || goto :fail
echo Building KAkAo for Windows (first time takes a few minutes)...
call flutter build windows --release %DEFINES% || goto :fail
start "" "build\windows\x64\runner\Release\kakao.exe"
exit /b 0

:fail
echo.
echo Build failed. Run "flutter doctor" and install "Desktop development with C++" in Visual Studio.
pause
exit /b 1
