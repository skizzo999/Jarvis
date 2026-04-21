"""
Jarvis — config centralizzata.
Unico punto di verità per path, credenziali, costanti di runtime.
Tutti i router e gli script devono importare da qui, non hardcodare.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# ── Percorsi base ─────────────────────────────────────────────────────────────
BASE_DIR = Path(os.getenv("JARVIS_BASE_DIR", "/home/matteo/Jarvis"))
API_DIR = BASE_DIR / "api"
DATA_DIR = BASE_DIR / "data"
STORAGE_ROOT = Path(os.getenv("JARVIS_STORAGE_ROOT", BASE_DIR / "storage"))
LOGS_DIR = BASE_DIR / "logs"
INBOX_DIR = BASE_DIR / "inbox"

DB_PATH = os.getenv("JARVIS_DB_PATH", str(DATA_DIR / "jarvis.db"))

# ── Env loading ───────────────────────────────────────────────────────────────
# Un solo punto di caricamento. `main.py` lo chiama all'avvio; gli altri moduli
# possono importare questo file senza dover ricaricare .env.
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=str(ENV_PATH), override=False)

# ── Anthropic ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("JARVIS_MODEL", "claude-haiku-4-5-20251001")

# ── Telegram ──────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "8330494963")

# ── Radicale CalDAV ───────────────────────────────────────────────────────────
# Niente fallback hardcoded sulla password: se manca, il codice fallisce presto.
RADICALE_USER = os.getenv("RADICALE_USER", "matteo")
RADICALE_PASS = os.getenv("RADICALE_PASS")
RADICALE_HOST = os.getenv("RADICALE_HOST", "http://localhost:5232")
RADICALE_URL = f"{RADICALE_HOST.rstrip('/')}/{RADICALE_USER}/calendar/"

# ── API / auth ────────────────────────────────────────────────────────────────
API_BASE = os.getenv("JARVIS_API_BASE", "http://localhost:8000")
# Se impostato, richiesto come header `X-API-Key` (o `Authorization: Bearer <key>`)
# su tutti gli endpoint scrittori. Se vuoto → auth disabilitata (dev mode).
API_KEY = os.getenv("JARVIS_API_KEY", "")

# Origini autorizzate per CORS. Accetta lista separata da virgole.
# Default: localhost per dev + dominio produzione Matteo.
_default_origins = "http://localhost:5173,http://localhost:8000,https://jarvis.matteolizzo.it"
CORS_ORIGINS = [o.strip() for o in os.getenv("JARVIS_CORS_ORIGINS", _default_origins).split(",") if o.strip()]

# ── Fitness target (costanti personali) ───────────────────────────────────────
FITNESS_TARGET = {
    "kcal": 2330,
    "protein": 160,
    "carbs": 265,
    "fat": 70,
    "weight_kg": 77,
}
WORKOUT_ROTATION_START = "2026-04-07"
