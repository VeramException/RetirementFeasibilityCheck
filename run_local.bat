@echo off
echo Starting local server...

:: Start Python HTTP server in a new window
start "Local Server" python -m http.server 8000

:: Wait a moment for server to start
timeout /t 2 /nobreak >nul

:: Open browser to localhost
start http://localhost:8000

echo Server started at http://localhost:8000
echo Press Ctrl+C in the server window to stop the server