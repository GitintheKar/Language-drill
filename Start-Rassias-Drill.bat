@echo off
title Rassias Verb Drill - Local Dev Server
cd /d "%~dp0"
echo ========================================================
echo   Dartmouth Rassias Verb Drill (French ^& Spanish)
echo   Starting local Vite server and opening browser...
echo   (Close this window or press Ctrl+C to stop the server)
echo ========================================================
echo.
call npm.cmd run dev -- --open
pause
