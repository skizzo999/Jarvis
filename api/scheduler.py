#!/usr/bin/env python3
"""
Jarvis Scheduler — Modulo 5
Notifiche proattive: briefing mattutino (07:00) + resoconto serale (23:00) + reminder checker (ogni minuto)
"""
import logging, os, requests
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from config import API_BASE, API_KEY, LOGS_DIR, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

_AUTH_HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}

TELEGRAM_TOKEN = TELEGRAM_BOT_TOKEN

os.makedirs(LOGS_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(str(LOGS_DIR / "scheduler.log")),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger("jarvis-scheduler")


def send_telegram(text: str):
    """Invia un messaggio Telegram direttamente via Bot API."""
    if not TELEGRAM_TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN non configurato, skip send")
        return
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"},
            timeout=10
        )
        if r.status_code != 200:
            log.error(f"Telegram error {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.error(f"send_telegram exception: {e}")


def call_report(prompt: str) -> str:
    """Chiama /command/report e ritorna il testo del briefing."""
    try:
        r = requests.post(
            f"{API_BASE}/command/report",
            json={"text": prompt, "chat_id": TELEGRAM_CHAT_ID},
            headers=_AUTH_HEADERS,
            timeout=30,
        )
        r.raise_for_status()
        return r.json().get("reply", "Errore: risposta vuota")
    except Exception as e:
        log.error(f"call_report exception: {e}")
        return f"⚠️ Errore nel generare il report: {e}"


def morning_briefing():
    """07:00 — Briefing mattutino: piano della giornata."""
    log.info("▶ Briefing mattutino")
    reply = call_report(
        "Buongiorno Matteo! Genera il briefing mattutino: "
        "cosa c'è oggi in calendario, che scheda di allenamento tocca, "
        "saldo attuale, e 1-2 cose importanti da non dimenticare. "
        "Formato: breve, diretto, per Telegram."
    )
    send_telegram(reply)
    log.info("✅ Briefing inviato")


def evening_recap():
    """23:00 — Resoconto serale: com'è andata la giornata."""
    log.info("▶ Resoconto serale")
    reply = call_report(
        "Buonanotte Matteo! Genera il resoconto serale: "
        "cosa hai mangiato oggi e come stai sui macro, "
        "hai fatto palestra?, quanto hai speso oggi, "
        "cosa c'è domani in agenda. Sii diretto e conciso."
    )
    send_telegram(reply)
    log.info("✅ Resoconto inviato")


def check_reminders():
    """Ogni minuto — controlla i promemoria in scadenza e li invia."""
    try:
        r = requests.get(f"{API_BASE}/events/reminders/pending", headers=_AUTH_HEADERS, timeout=5)
        if r.status_code != 200:
            return
        reminders = r.json()
        for rem in reminders:
            log.info(f"⏰ Promemoria: {rem['title']}")
            send_telegram(f"⏰ *Promemoria:* {rem['title']}")
            requests.post(f"{API_BASE}/events/reminders/{rem['id']}/sent", headers=_AUTH_HEADERS, timeout=5)
    except Exception as e:
        log.debug(f"check_reminders: {e}")


if __name__ == "__main__":
    scheduler = BlockingScheduler(timezone="Europe/Rome")

    scheduler.add_job(morning_briefing, CronTrigger(hour=7, minute=0, timezone="Europe/Rome"), id="morning")
    scheduler.add_job(evening_recap,    CronTrigger(hour=23, minute=0, timezone="Europe/Rome"), id="evening")
    scheduler.add_job(check_reminders,  "interval", minutes=1, id="reminders")

    log.info(f"🚀 Jarvis Scheduler avviato — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    log.info(f"   Briefing: 07:00 | Resoconto: 23:00 | Reminder check: ogni minuto")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler fermato")
