@echo off
REM Build di produzione su Windows (database, API, Web).
cd /d "%~dp0\.."

call npm install
if errorlevel 1 exit /b %errorlevel%

call npm run db:generate
if errorlevel 1 exit /b %errorlevel%

call npm run build
