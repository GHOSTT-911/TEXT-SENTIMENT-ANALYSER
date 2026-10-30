@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the app directly instead...
  start "" "index.html"
  pause
  exit /b
)
start "" http://localhost:3000
node backend\server.js
pause
