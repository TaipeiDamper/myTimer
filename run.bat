@echo off
title Aura Timer Launcher
echo Starting Aura Timer Server...
cd /d "%~dp0"
call npm run dev
pause
