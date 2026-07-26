#!/usr/bin/env bash
# Avvia l'API in modalità produzione (richiede una build precedente con scripts/build.sh).
set -e
cd "$(dirname "$0")/.."

npm run db:migrate:deploy
npm run start
