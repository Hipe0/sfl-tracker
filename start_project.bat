@echo off
echo ===================================================
echo Starting SFL Tracker (Frontend ^& Backend)...
echo Please wait while the servers are starting up.
echo ===================================================

cd /d "%~dp0"
npm run dev

echo.
echo If the servers stopped, press any key to close this window.
pause >nul
