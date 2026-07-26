# Honey Garden CRM

Gestionale web multi-tenant per agenzie che gestiscono più account creator su OnlyFans.
Applicazione full-stack reale: frontend Next.js, backend NestJS, database PostgreSQL via Prisma,
autenticazione JWT con sessioni server-side, RBAC, audit log immutabile, architettura a provider
per il collegamento degli account OnlyFans, Messages Pro con realtime WebSocket, AI pluggable.

Interfaccia in italiano (termini tecnici come Dashboard, PPV, Fan, Chatter, Owner, Admin, AI restano in inglese).

## 0. Stato reale del progetto — cosa è sviluppato, cosa richiede configurazione

Per non dichiarare come "attivo" ciò che non lo è, questa è la distinzione usata in tutto il prodotto:

| Livello | Significato |
|---|---|
| **Funzione sviluppata** | Codice reale, endpoint reali, UI reale. Nessun mock. |
| **Funzione configurata** | La funzione sviluppata richiede variabili d'ambiente (chiavi, segreti) per attivarsi. |
| **Provider collegato** | Le credenziali sono presenti e il provider ha risposto positivamente a un check di connessione. |
| **Dati sincronizzati** | È stata eseguita almeno una sincronizzazione reale con successo. |

**Completamente sviluppato e funzionante out-of-the-box** (nessuna chiave esterna richiesta):
autenticazione (login, refresh, logout, 2FA TOTP, reset password, blocco tentativi, sessioni/dispositivi),
organizzazioni multi-tenant con isolamento reale per `organizationId`, RBAC con ruoli di sistema
(Owner, Admin, Chatter Manager, Chatter) e ruoli personalizzati, gestione creator (profilo, prezzi,
personalità, note, documenti, team), architettura a provider OnlyFans (Manuale, Importazione CSV
già pienamente funzionanti), Messages Pro con conversazioni/messaggi reali e realtime via WebSocket,
Fan CRM, Media Vault (upload su disco locale), turni con clock-in/out, commissioni e riepilogo
finanziario con export CSV, automazioni con motore di esecuzione reale (limitato a 2 trigger),
notifiche in-app, audit log immutabile, analytics calcolate su dati reali del database.

**Sviluppato ma richiede una chiave/servizio esterno per diventare "collegato"**:
- **Provider OnlyFans esterni** (`PROVIDER_API_1`, `PROVIDER_API_2`): l'architettura a provider è
  completa (`connectAccount`, `syncFans`, `sendMessage`, ecc.) e chiama realmente un endpoint HTTP
  configurabile via `PROVIDER_API_x_BASE_URL` / `PROVIDER_API_x_API_KEY`. Senza queste variabili il
  CRM mostra esplicitamente **"Provider non configurato"** — non simula mai una connessione attiva.
  Nessun connettore ufficiale OnlyFans è incluso: va collegato un servizio/connettore compatibile
  autorizzato dall'agenzia (nel rispetto dei Termini di Servizio di OnlyFans).
- **AI** (suggerimenti in Messages Pro): richiede `AI_PROVIDER` + `AI_API_KEY`. Senza queste variabili
  l'endpoint risponde chiaramente che l'AI non è configurata, invece di inventare un suggerimento.
- **Email transazionali**: richiede `SMTP_HOST` e credenziali. Senza SMTP, le email (es. reset
  password) vengono solo loggate lato server, non inviate realmente.
- **Storage media S3-compatibile**: `docker-compose.yml` include MinIO, ma l'implementazione attuale
  del Media Vault salva su disco locale (`uploads/`); il passaggio a S3/MinIO è un'estensione del
  `MediaService` documentata nel codice, non ancora cablata di default.

**Volutamente limitato in questa versione** (per onestà sui tempi di sviluppo, non per omissione):
export PDF/Excel delle finanze (solo CSV), builder grafico delle automazioni (CRUD reale via API,
nessun editor visuale drag&drop), calendario turni in vista grafica (lista + clock-in/out reali),
notifiche push/Telegram (solo canale in-app e email), conversione in app desktop/mobile (struttura
compatibile con Capacitor/Electron/Tauri, non ancora integrata).

## 1. Stack tecnico

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, SWR, Socket.IO client, PWA (`next-pwa`).
- **Backend**: NestJS 10, REST + WebSocket (Socket.IO), class-validator, Passport JWT, Throttler, Bull/Schedule.
- **Database**: PostgreSQL + Prisma ORM (migrazioni reali incluse in `packages/database/prisma/migrations`).
- **Sicurezza**: bcrypt, AES-256-GCM per credenziali provider, cookie httpOnly/secure, CSRF via SameSite,
  Helmet + CSP, rate limiting, audit log immutabile, RBAC applicato lato server su ogni endpoint.

## 2. Struttura del monorepo

```text
apps/
  web/        Next.js (frontend)
  api/        NestJS (backend REST + WebSocket)
packages/
  database/   Prisma schema, migrazioni, seed
  shared/     Costanti condivise (ruoli, permessi, sidebar) per il frontend
  config/     Riservato a configurazioni condivise future
scripts/      Script di sviluppo/build/produzione (bash + Windows .bat)
docker-compose.yml
.env.example
```

## 3. Requisiti

- Node.js ≥ 20
- npm ≥ 10 (workspaces)
- PostgreSQL ≥ 14 (locale, Docker, o gestito)
- Docker + Docker Compose (opzionale, per l'avvio containerizzato)

## 4. Avvio rapido (sviluppo locale, senza Docker)

```bash
cp .env.example .env
# Modifica .env: imposta almeno JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# CREDENTIALS_ENCRYPTION_KEY (64 caratteri hex), SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD,
# e DATABASE_URL puntato a un PostgreSQL raggiungibile.

npm install
npm run db:migrate      # applica le migrazioni Prisma
npm run db:seed         # crea organizzazione "Honey Garden", Owner, ruoli, creator demo
npm run dev             # avvia API (porta 3001) e Web (porta 3000) in parallelo
```

Apri **http://localhost:3000** — verrai reindirizzato al login.
API disponibile su **http://localhost:3001/api** (health check: `GET /api/health`).

In alternativa, sui rispettivi sistemi operativi:

```bash
./scripts/dev.sh      # Linux / macOS
scripts\dev.bat        # Windows
```

## 5. Avvio con Docker

```bash
cp .env.example .env
# Valorizza i segreti come al punto 4.
docker compose up --build
```

Il compose avvia: PostgreSQL, Redis, MinIO (storage S3-compatibile, pronto per usi futuri), API e Web.
Dopo il primo avvio, esegui migrazioni e seed dentro il container API:

```bash
docker compose exec api npm run db:migrate:deploy --workspace=@honey-garden/database
docker compose exec api npm run db:seed --workspace=@honey-garden/database
```

Frontend: **http://localhost:3000** — Backend: **http://localhost:3001/api**

## 6. Variabili d'ambiente

Vedi `.env.example` per l'elenco completo e commentato. Le principali:

| Variabile | Obbligatoria | Descrizione |
|---|---|---|
| `DATABASE_URL` | sì | Connessione PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | sì | Segreti per firmare i token (usa `openssl rand -hex 32`) |
| `CREDENTIALS_ENCRYPTION_KEY` | sì (per collegare provider) | Chiave AES-256-GCM (64 caratteri hex) per cifrare le credenziali dei provider OnlyFans |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | sì (per il seed) | Credenziali del primo Owner |
| `PROVIDER_API_1_*` / `PROVIDER_API_2_*` | no | Attivano i provider OnlyFans esterni |
| `AI_PROVIDER` / `AI_API_KEY` | no | Attivano i suggerimenti AI in Messages Pro |
| `SMTP_*` | no | Attivano l'invio reale di email transazionali |

**Nessun segreto reale è incluso nel repository.** `.env` è in `.gitignore`.

## 7. Database, migrazioni e seed

```bash
npm run db:migrate          # sviluppo: crea/applica migrazioni Prisma
npm run db:migrate:deploy   # produzione: applica le migrazioni esistenti senza generarne di nuove
npm run db:seed             # popola organizzazione Honey Garden, ruoli, permessi, Owner, dati demo
npm run db:studio           # Prisma Studio per ispezionare il database
```

Il seed crea:
- Organizzazione **Honey Garden**
- Ruoli di sistema: Owner, Amministratore, Chatter Manager, Chatter (con permessi granulari reali)
- L'utente **Owner** con le credenziali di `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`
- Utenti demo: `admin.demo@honeygarden.local`, `manager.demo@honeygarden.local`,
  `chatter.demo@honeygarden.local` (password: `DemoPassword123!`)
- Due **creator demo** (`Nayla (demo)`, `Sweet (demo)`) chiaramente marcate `isDemo: true` e
  cancellabili dalla UI/API — nessun dato OnlyFans reale, nessuna credenziale reale.

## 8. Test

```bash
npm run test        # unit test (guard RBAC, cifratura AES-256-GCM)
npm run test:e2e     # end-to-end contro un PostgreSQL reale: auth, refresh, RBAC,
                      # isolamento multi-tenant, CRUD creator, audit log, stato provider
```

I test e2e richiedono un PostgreSQL raggiungibile tramite `DATABASE_URL` (locale o
`docker compose up -d postgres`) e le migrazioni già applicate. Creano ed eliminano
organizzazioni di test isolate (prefisso `test-org-*`), senza toccare i dati del seed.

## 9. Build e produzione

```bash
npm run build   # build di packages/database (client Prisma), apps/api, apps/web
npm run start   # avvia l'API in produzione (richiede build + migrazioni deployate)
```

Per il frontend in produzione: `npm run start --workspace=@honey-garden/web` (dopo `npm run build`).

## 10. Deploy online

Opzioni supportate dalla struttura del progetto:
- **Docker** su qualsiasi VPS (Hetzner, DigitalOcean, AWS, ecc.) tramite `docker-compose.yml`.
- **Backend** su Railway/Render/qualsiasi host Docker, con PostgreSQL gestito.
- **Frontend** su Vercel (o altro host Next.js), puntando `NEXT_PUBLIC_API_URL` al backend.
- Reverse proxy Nginx + certificati TLS (Let's Encrypt) davanti a API e Web per pubblicare
  su un dominio reale (es. `crm.honeygarden.tld`).

Checklist minima per il primo deploy:
1. Provisiona PostgreSQL (gestito o container persistente) e imposta `DATABASE_URL`.
2. Genera segreti reali per `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`.
3. Imposta `APP_URL`/`COOKIE_DOMAIN` sul dominio reale (i cookie sono `Secure` in produzione).
4. Esegui `npm run db:migrate:deploy` e `npm run db:seed` una sola volta.
5. Configura eventuali provider OnlyFans/AI/SMTP solo quando le credenziali sono realmente disponibili.

## 11. Backup

Il database PostgreSQL è la sorgente di verità unica. Backup consigliato:

```bash
pg_dump "$DATABASE_URL" -F c -f backup-$(date +%Y%m%d).dump
# ripristino:
pg_restore -d "$DATABASE_URL" backup-YYYYMMDD.dump
```

I media caricati nel Media Vault risiedono in `apps/api/uploads/` (o nel bucket S3-compatibile,
una volta collegato): includerli nel backup.

## 12. Troubleshooting

- **"Provider non configurato"**: è il comportamento corretto quando `PROVIDER_API_1/2` o `AI_*`
  non sono impostate. Non è un errore: significa che quella funzione è sviluppata ma non ancora
  collegata a un servizio esterno.
- **Login fallisce sempre**: verifica che il seed sia stato eseguito e che `JWT_ACCESS_SECRET`
  non sia cambiato dopo aver emesso sessioni esistenti.
- **WebSocket di Messages Pro non si connette**: verifica che `APP_URL` nel backend corrisponda
  all'origine reale del frontend (usato per CORS e per l'origine del gateway Socket.IO).
- **Migrazioni non applicate**: `npm run db:migrate` in sviluppo, `npm run db:migrate:deploy` in
  produzione — non usare `db push` per ambienti condivisi.

## 13. Sicurezza (riepilogo)

Password con bcrypt (cost 12), sessioni server-side con refresh token ruotato e revocabile,
2FA TOTP opzionale, blocco account dopo tentativi falliti ripetuti, rate limiting su login e reset
password, cookie `httpOnly` + `Secure` (produzione) + `SameSite=Lax`, protezione CSRF via SameSite,
Helmet con Content-Security-Policy, validazione input server-side su ogni endpoint (class-validator),
query parametriche tramite Prisma (nessuna SQL injection), RBAC verificato lato server su ogni rotta,
isolamento multi-tenant per `organizationId` verificato in ogni query, audit log immutabile (nessun
endpoint di modifica/eliminazione esposto), credenziali provider cifrate con AES-256-GCM.

Nessun software è "invalicabile": questo elenco descrive le protezioni implementate, non una garanzia assoluta.

## 14. Priorità di sviluppo seguite

Fase 1 (fondamenta: monorepo, auth, org, RBAC, creator, audit) → Fase 2 (provider, multi-account,
fan, transazioni) → Fase 3 (Messages Pro, realtime) → Fase 4 (AI) → Fase 5 (analytics, finanze,
turni, automazioni, notifiche) → Fase 6 (PWA, Docker, hardening) sono tutte state affrontate in
questa consegna, con il livello di profondità descritto nella sezione 0.
