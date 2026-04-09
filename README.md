# 🤖 Jarvis — Personal Autonomous Assistant

> AI-first personal assistant controllabile via Telegram e Dashboard web.  
> Self-hosted · FastAPI · n8n · Claude API · React

-----

## Demo

<!-- Screenshot dashboard -->

<!-- ![Dashboard](docs/dashboard.png) -->

<!-- Video demo Telegram -->

<!-- [▶ Guarda il demo](https://link-al-video) -->

*Screenshot e video in arrivo.*

-----

## Cosa fa

Jarvis riceve comandi in **linguaggio naturale** via Telegram, li interpreta con AI e agisce — registra dati, genera report, organizza file, manda notifiche. Tutto aggiornato in tempo reale su una dashboard web.

|Modulo           |Funzione                                                                   |
|-----------------|---------------------------------------------------------------------------|
|💰 Cash Flow      |Traccia entrate/uscite in linguaggio naturale, grafici e report su Telegram|
|📅 Calendario     |Crea e gestisce eventi Notion scrivendo su Telegram                        |
|🗂️ Smart Storage  |Upload file → AI li categorizza e organizza automaticamente                |
|🔍 File Analyzer  |Analizza PDF, codice, immagini, Excel e restituisce riassunti strutturati  |
|🔔 Notifiche      |Report automatici mattutini, reminder eventi, alert su soglie              |
|💪 Fitness Tracker|Allenamento, dieta, macro AI, peso corporeo — tutto tracciato e graficato  |

-----

## Architettura

```
Telegram / Dashboard
        ↓
       n8n          ← orchestrazione flussi, webhook
        ↓
    Claude API      ← NL → JSON strutturato { action, params }
        ↓
     FastAPI        ← esecuzione azioni, CRUD, logica
        ↓
    PostgreSQL      ← persistenza dati
        ↓
  React Dashboard   ← grafici, tabelle, controlli (Recharts + Tailwind)
```

-----

## Stack

|Layer        |Tecnologia                                |
|-------------|------------------------------------------|
|Orchestratore|n8n self-hosted (Docker)                  |
|AI Engine    |Claude API                                |
|Backend      |Python 3.11 + FastAPI                     |
|Database     |SQLite → PostgreSQL                       |
|Frontend     |React + Vite + Recharts + TailwindCSS     |
|Proxy        |Nginx + SSL (Certbot)                     |
|Deploy       |Server Linux self-hosted, systemd + Docker|

-----

## Installazione

> Prerequisiti: Docker, Python 3.11+, Node.js 18+

```bash
# Clona il repo
git clone https://github.com/skizzo999/Jarvis.git
cd Jarvis

# Copia e configura le variabili d'ambiente
cp .env.example .env
# → inserisci API key Claude, token Telegram, credenziali DB

# Avvia i servizi
docker compose up -d

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

-----

## Variabili d’ambiente

Crea un file `.env` nella root basandoti su `.env.example`:

```env
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=
DATABASE_URL=
NOTION_TOKEN=
```

⚠️ Non committare mai il file `.env`.

-----

## Moduli — stato attuale

- [x] Modulo 0 — Cash Flow + Grafici
- [x] Modulo 1 — Calendario Notion
- [x] Modulo 2 — Smart Storage
- [x] Modulo 3 — File Analyzer
- [x] Modulo 4 — Dashboard Pro
- [x] Modulo 5 — Notifiche & Scheduler
- [x] Modulo 6 — Fitness Tracker

-----

## Licenza

Questo progetto è privato. Tutti i diritti riservati.
