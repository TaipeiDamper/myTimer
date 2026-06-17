@echo off
title Aura Polygon Practice Launcher
cd /d "%~dp0polygon_practice"
start "PolygonPracticeServer" /min python -m http.server 8765
timeout /t 1 /nobreak >nul
start "" "http://localhost:8765/index.html"
