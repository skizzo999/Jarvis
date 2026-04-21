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

|Module           |Function                                                                       |
|-----------------|-------------------------------------------------------------------------------|
|💰 Cash Flow      |Track income and expenses in natural language, with charts and Telegram reports|
|📅 Calendar       |Create and manage Notion events by writing on Telegram                         |
|🗂️ Smart Storage  |Upload a file → AI categorizes and organizes it automatically                  |
|🔍 File Analyzer  |Analyzes PDFs, code, images, Excel files and returns structured summaries      |
|🔔 Notifications  |Automatic morning reports, event reminders, threshold alerts                   |
|💪 Fitness Tracker|Workouts, diet, AI macro tracking, body weight — all logged and charted        |

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
    PostgreSQL      ← data persistence
        ↓
  React Dashboard   ← charts, tables, controls (Recharts + Tailwind)
```

-----

## Stack

|Layer       |Technology                                |
|------------|------------------------------------------|
|Orchestrator|n8n self-hosted (Docker)                  |
|AI Engine   |Claude API                                |
|Backend     |Python 3.11 + FastAPI                     |
|Database    |SQLite → PostgreSQL                       |
|Frontend    |React + Vite + Recharts + TailwindCSS     |
|Proxy       |Nginx + SSL (Certbot)                     |
|Deploy      |Self-hosted Linux server, systemd + Docker|

-----

## Getting Started

> Prerequisites: Docker, Python 3.11+, Node.js 18+

```bash
# Clone the repository
git clone https://github.com/skizzo999/Jarvis.git
cd Jarvis

# Copy and configure environment variables
cp .env.example .env
# → fill in Claude API key, Telegram token, DB credentials

# Start services
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

## Environment Variables

Create a `.env` file in the root based on `.env.example`:

```env
ANTHROPIC_API_KEY=        # Anthropic API key
TELEGRAM_BOT_TOKEN=       # Telegram bot token
TELEGRAM_CHAT_ID=         # Your Telegram chat ID
RADICALE_USER=matteo      # Radicale CalDAV username
RADICALE_PASS=            # Radicale CalDAV password
```

⚠️ Never commit your `.env` file.

-----

## Modules — current status

- [x] Module 0 — Cash Flow + Charts
- [x] Module 1 — Notion Calendar
- [x] Module 2 — Smart Storage
- [x] Module 3 — File Analyzer
- [x] Module 4 — Pro Dashboard
- [x] Module 5 — Notifications & Scheduler
- [x] Module 6 — Fitness Tracker

-----

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | System health check (DB, storage) |
| POST | `/command` | Natural language command → Claude → actions |
| POST | `/command/audio` | Voice file → Whisper → /command |
| POST | `/command/report` | Scheduled briefing/recap |
| GET | `/transactions/report?period=today\|week\|month` | Finance report |
| POST | `/transactions` | Add transaction |
| GET | `/events/list` | Upcoming CalDAV events |
| POST | `/events/` | Create calendar event |
| GET | `/fitness/meals/today` | Today's meals + macro totals |
| POST | `/fitness/meal` | Log meal |
| POST | `/fitness/log` | Log workout |
| GET | `/fitness/last` | Last weight per exercise |
| GET | `/storage/files` | Storage file tree |
| POST | `/storage/upload` | Upload file from Telegram |
| POST | `/storage/analyze` | AI file analysis |

-----

## License

This project is private. All rights reserved.
