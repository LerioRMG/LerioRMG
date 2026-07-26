#!/usr/bin/env bash
# Avvia Honey Garden CRM in modalità sviluppo (API + Web in parallelo).
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "File .env non trovato: lo creo da .env.example. Ricordati di valorizzare i segreti prima del deploy."
  cp .env.example .env
fi

npm install
npm run db:generate
npm run dev
