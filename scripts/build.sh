#!/usr/bin/env bash
# Build di produzione per database (client Prisma), API e Web.
set -e
cd "$(dirname "$0")/.."

npm install
npm run db:generate
npm run build
