# 🤖 Jarvis — Personal Autonomous Assistant

> AI-first personal assistant controlled via Telegram and a web Dashboard.
> Self-hosted · FastAPI · n8n · Claude API · React

-----

## Demo

<!-- Dashboard screenshot -->

<!-- ![Dashboard](docs/dashboard.png) -->

<!-- Telegram demo video -->

<!-- [▶ Watch the demo](https://link-to-video) -->

*Screenshots and video coming soon.*

-----

## What it does

Jarvis receives commands in **natural language** via Telegram, interprets them with AI, and acts — logs data, generates reports, organizes files, sends notifications. Everything updates in real time on a web dashboard.

| Module             | Function                                                                                  |
|--------------------|-------------------------------------------------------------------------------------------|
| 💰 Cash Flow        | Track income and expenses in natural language, with charts and Telegram reports           |
| 📅 Calendar         | Create and manage events on a Radicale CalDAV server via Telegram                         |
| 🗂️ Smart Storage    | Upload a file → AI categorizes and organizes it · move, delete, universal preview         |
| 🔍 File Analyzer    | Analyzes PDFs, code, text and markdown files — styled Markdown response with highlights   |
| 🔔 Notifications    | Morning briefings, event reminders, scheduler-driven alerts                               |
| 💪 Fitness Tracker  | Workouts, diet, AI macro tracking, body weight — all logged and charted                   |

-----

## Architecture

```
Telegram / Dashboard
        ↓
       n8n          ← flow orchestration, webhooks
        ↓
    Claude API      ← NL → structured JSON { action, params }
        ↓
     FastAPI        ← action execution, CRUD, business logic
        ↓
     SQLite         ← local persistence
        ↓
  React Dashboard   ← charts, tables, controls (Recharts + CSS variables)
```

-----

## Stack

| Layer        | Technology                                |
|--------------|-------------------------------------------|
| Orchestrator | n8n self-hosted (Docker)                  |
| AI Engine    | Claude API (Anthropic)                    |
| Backend      | Python 3.11 + FastAPI + slowapi           |
| Database     | SQLite (centralised schema + migrations)  |
| Calendar     | Radicale CalDAV (Docker, port 5232)       |
| Frontend     | React + Vite + Recharts                   |
| Proxy        | Nginx + SSL (Certbot) · Cloudflare Tunnel |
| Deploy       | Self-hosted Linux server, systemd + Docker|

-----

## Getting Started

> Prerequisites: Docker, Python 3.11+, Node.js 18+

```bash
# Clone the repository
git clone https://github.com/skizzo999/Jarvis.git
cd Jarvis

# Copy and configure environment variables
cp .env.example .env
# → fill in Claude API key, Telegram token, Radicale credentials

# Start services (n8n, Radicale)
docker compose up -d

# Backend
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Dashboard
cd ../dashboard
npm install
npm run dev
```

-----

## Environment Variables

Create a `.env` file in the root based on `.env.example`:

```env
ANTHROPIC_API_KEY=        # Anthropic API key
CLAUDE_MODEL=             # e.g. claude-haiku-4-5
TELEGRAM_BOT_TOKEN=       # Telegram bot token
TELEGRAM_CHAT_ID=         # Your Telegram chat ID
RADICALE_USER=matteo      # Radicale CalDAV username
RADICALE_PASS=            # Radicale CalDAV password
JARVIS_API_KEY=           # Optional: enables X-API-Key auth on /api/*
CORS_ORIGINS=             # Comma-separated list of allowed origins
```

⚠️ Never commit your `.env` file.

-----

## Security

- **Optional API key auth** — set `JARVIS_API_KEY` to require `X-API-Key` header on `/api/*`. Localhost (`127.0.0.1`, `::1`) is always exempt, so n8n/scheduler keep working. Auth is disabled when the variable is empty.
- **Rate limiting** via `slowapi` on sensitive endpoints (`/command` 60/min, `/storage/analyze` 20/min, `/storage/upload-web` 30/min).
- **Path-traversal guards** on every storage operation (download, move, delete, upload) — all paths resolved against `STORAGE_ROOT`.
- **Per-chat conversation history** — `conversation_history` is scoped by `chat_id` so Telegram chat, dashboard chat, and other clients don't bleed into each other.

-----

## Modules — current status

- [x] Module 0 — Cash Flow + Charts
- [x] Module 1 — CalDAV Calendar
- [x] Module 2 — Smart Storage (upload, move, delete, universal preview)
- [x] Module 3 — File Analyzer (Claude + Markdown rendering)
- [x] Module 4 — Pro Dashboard
- [x] Module 5 — Notifications & Scheduler
- [x] Module 6 — Fitness Tracker

-----

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/health` | System health check (DB, storage, scheduler) |
| POST | `/command` | Natural language command → Claude → actions |
| POST | `/command/audio` | Voice file → Whisper → `/command` |
| POST | `/command/report` | Scheduled briefing/recap |
| GET  | `/transactions/report?period=today\|week\|month` | Finance report |
| POST | `/transactions` | Add transaction |
| GET  | `/events/list` | Upcoming CalDAV events |
| POST | `/events/` | Create calendar event |
| GET  | `/events/reminders/pending` | Pending reminders |
| GET  | `/fitness/meals/today` | Today's meals + macro totals |
| POST | `/fitness/meal` | Log meal |
| POST | `/fitness/log` | Log workout |
| GET  | `/fitness/last` | Last weight per exercise |
| GET  | `/storage/files` | Storage file tree |
| GET  | `/storage/download?path=...&inline=0\|1` | Download file (inline for preview) |
| POST | `/storage/upload` | Upload file from Telegram |
| POST | `/storage/upload-web` | Upload from dashboard (multipart) |
| POST | `/storage/analyze` | AI file analysis (PDF/text/code) |
| POST | `/storage/classify` | Move pending file to subject folder |
| POST | `/storage/move` | Move a file between storage folders |
| POST | `/storage/delete` | Delete a file from storage |
| POST | `/storage/send-telegram` | Push a stored file to Telegram |

-----

## Dashboard — Files module

The **Files page** mirrors the storage backend in the browser:

- Universal preview modal — images, **PDF (inline iframe)**, video, audio, text, **rendered markdown**
- Inline **AI modal** with custom Markdown renderer: headings (H1–H6), tables, lists, `**bold**`, `*italic*`, `==highlight==`, `++underline++`, `~~strike~~`, `` `code` `` — each styled with the module's color palette
- Per-file actions: preview, AI analysis, download, send to Telegram, **move**, **delete**
- Upload from browser with per-folder targeting

-----

## Project layout

```
Jarvis/
├── api/                  FastAPI backend
│   ├── main.py           app entrypoint (lifespan + schema init)
│   ├── config.py         centralized paths, env vars, CORS
│   ├── security.py       API-key middleware + rate limiter
│   ├── db/schema.py      unified schema (tables, migrations, indices)
│   ├── routers/          /command, /transactions, /events, /fitness, /storage
│   ├── scheduler.py      APScheduler (briefings, reminders)
│   └── tests/            smoke tests
├── dashboard/            React + Vite
│   └── src/modules/      cashflow / calendar / files / fitness / settings
├── storage/              file storage root (mounted volume)
├── radicale/             Radicale CalDAV data
├── data/                 SQLite databases
├── JarvisWorkFlow/       n8n workflow exports
└── docker-compose.yml
```

-----

## License

This project is private. All rights reserved.
