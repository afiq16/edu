@echo off
title EduCheck Local Server (http://localhost:8080)
echo ========================================================
echo   EduCheck - Local Server Starting...
echo ========================================================
echo.
echo Opening EduCheck at http://localhost:8080 ...
echo Keep this window OPEN while using the application.
echo.
start http://localhost:8080
powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
