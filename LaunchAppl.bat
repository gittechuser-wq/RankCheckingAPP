@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   Keyword Mapping Tool
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Please install Node.js from https://nodejs.org/ and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not installed or not available in PATH.
  echo Please reinstall Node.js from https://nodejs.org/ and try again.
  echo.
  pause
  exit /b 1
)

if exist "node_modules" (
  echo Required packages found. Skipping installation.
  echo.
) else (
  echo Required packages not found.
  echo Installing packages now. This may take a few minutes...
  call npm install --cache .\.npm-cache
  if errorlevel 1 (
    echo.
    echo Installation failed. Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
  )
)

echo Starting the application...
echo.
echo The app will open at: http://localhost:5173
echo Keep this window open while using the tool.
echo.

start "" "http://localhost:5173"
call npm run dev -- --port 5173

pause
