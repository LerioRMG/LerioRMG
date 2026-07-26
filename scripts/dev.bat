@echo off
REM Avvia Honey Garden CRM in modalita' sviluppo su Windows (API + Web).
cd /d "%~dp0\.."

if not exist .env (
  echo File .env non trovato: lo creo da .env.example. Ricordati di valorizzare i segreti prima del deploy.
  copy .env.example .env
)

call npm install
if errorlevel 1 exit /b %errorlevel%

call npm run db:generate
if errorlevel 1 exit /b %errorlevel%

call npm run dev
