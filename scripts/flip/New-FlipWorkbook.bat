@echo off
rem Tao file Excel FLIP. Chay tu cmd (o bat ky thu muc nao) hoac nhap dup. Server phai dang chay.
cd /d "%~dp0..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0New-FlipWorkbook.ps1" %*
echo.
pause
