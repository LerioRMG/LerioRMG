@echo off
REM Avvia l'API in modalita' produzione su Windows (richiede build precedente).
cd /d "%~dp0\.."

call npm run db:migrate:deploy
if errorlevel 1 exit /b %errorlevel%

call npm run start
