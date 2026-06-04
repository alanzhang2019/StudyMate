@echo off
setlocal
cd /d %~dp0

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install Node.js ^>= 20
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Please install Node.js ^>= 20
  pause
  exit /b 1
)

if not exist node_modules (
  npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

node --import tsx "%~dp0src\startup\runStartup.ts"
if errorlevel 1 (
  echo Startup failed. Check `startup-backend.log` or `startup-frontend.log` in this folder.
  pause
  exit /b 1
)
