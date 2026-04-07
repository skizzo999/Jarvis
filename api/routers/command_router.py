from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime
import sqlite3, os, json, anthropic

router = APIRouter(tags=["command"])

DB_PATH = "/home/jarvis/data/jarvis.db"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── helpers DB ──────────────────────────────────────────────────────────────

def get_db():
    return sqlite3.connect(DB_PATH)

def ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS conversation_history (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            role      TEXT NOT NULL,
            content   TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS workout_logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise   TEXT NOT NULL,
            weight_kg  REAL NOT NULL,
            reps       INTEGER,
            sets       INTEGER,
            notes      TEXT,
            logged_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

# ── contesto giornaliero per il system prompt ────────────────────────────────

def build_context() -> str:
    con = get_db()
    cur = con.cursor()
    ensure_tables(cur)

    # saldo attuale
    cur.execute("""
        SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END), 0)
        FROM transactions
    """)
    row = cur.fetchone()
    saldo = row[0] if row else 0

    # prossimo evento (da events se esistesse in db — fallback: non disponibile)
    # gli eventi sono su Radicale, non SQLite, quindi non li leggiamo qui

    # allenamento di oggi (rotazione A-C-B-riposo da 2026-04-07)
    BASE_DATE = datetime(2026, 4, 7)
    ROTATION = ["A", "C", "B", "riposo"]
    delta = (datetime.now() - BASE_DATE).days
    workout_today = ROTATION[delta % 4] if delta >= 0 else "riposo"

    # ultimi pesi
    cur.execute("""
        SELECT exercise, weight_kg, reps, sets, logged_at
        FROM workout_logs
        WHERE id IN (
            SELECT MAX(id) FROM workout_logs GROUP BY exercise
        )
        ORDER BY exercise
    """)
    last_weights = cur.fetchall()
    con.close()

    weights_str = ""
    if last_weights:
        weights_str = "\n".join(
            f"  - {r[0]}: {r[1]}kg × {r[2]} reps × {r[3]} serie ({r[4][:10]})"
            for r in last_weights
        )
    else:
        weights_str = "  Nessun allenamento registrato ancora."

    today_str = datetime.now().strftime("%A %d %B %Y, ore %H:%M")

    return f"""Oggi è {today_str}.
Allenamento di oggi: Giorno {workout_today}.
Saldo attuale: €{saldo:.2f}.

Ultimi pesi registrati:
{weights_str}"""

# ── system prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Sei Jarvis, l'assistente personale di Matteo. Parli sempre in italiano, in modo diretto e conciso.

Matteo ha 19 anni, studia, si allena con una scheda A/B/C e tiene traccia delle sue finanze.

Puoi eseguire azioni concrete. Quando Matteo ti chiede di fare qualcosa che rientra in queste categorie, rispondi SEMPRE con un JSON alla fine del messaggio nel formato:
<action>{"type": "TIPO", "params": {...}}</action>

Tipi di azione disponibili:
- add_transaction: params = {amount: numero positivo, direction: "+"|"-", note: stringa, category: stringa}
- add_event: params = {title: stringa, start: "YYYY-MM-DDTHH:MM:SS", end: "YYYY-MM-DDTHH:MM:SS" (opzionale), description: stringa (opzionale)}
- log_workout: params = {exercise: stringa, weight_kg: numero, reps: numero, sets: numero, notes: stringa (opzionale)}
- set_reminder: params = {title: stringa, remind_at: "YYYY-MM-DDTHH:MM:SS"}

Se non c'è nessuna azione da eseguire, non includere il tag <action>.

Esempi:
Matteo: "ho speso 15 euro per la pizza"
Tu: "Registrato! €15 di uscita per pizza. <action>{"type": "add_transaction", "params": {"amount": 15, "direction": "-", "note": "pizza", "category": "cibo"}}</action>"

Matteo: "oggi alla panca ho fatto 80kg per 5 ripetizioni per 3 serie"
Tu: "Ottimo lavoro! Registrato. <action>{"type": "log_workout", "params": {"exercise": "panca", "weight_kg": 80, "reps": 5, "sets": 3}}</action>"

Matteo: "ricordami di studiare domani alle 9"
Tu: "Fatto! Promemoria impostato per domani alle 9. <action>{"type": "set_reminder", "params": {"title": "Studiare", "remind_at": "DOMANI_DATA_T09:00:00"}}</action>"

Se Matteo fa una domanda, rispondi semplicemente senza action tag. Sii breve."""

# ── cronologia conversazione ─────────────────────────────────────────────────

def get_history(limit: int = 10) -> list[dict]:
    con = get_db()
    cur = con.cursor()
    ensure_tables(cur)
    cur.execute("""
        SELECT role, content FROM conversation_history
        ORDER BY id DESC LIMIT ?
    """, (limit,))
    rows = cur.fetchall()
    con.close()
    return [{"role": r[0], "content": r[1]} for r in reversed(rows)]

def save_message(role: str, content: str):
    con = get_db()
    cur = con.cursor()
    ensure_tables(cur)
    cur.execute(
        "INSERT INTO conversation_history (role, content) VALUES (?, ?)",
        (role, content)
    )
    # Mantieni solo gli ultimi 50 messaggi totali
    cur.execute("""
        DELETE FROM conversation_history
        WHERE id NOT IN (
            SELECT id FROM conversation_history ORDER BY id DESC LIMIT 50
        )
    """)
    con.commit()
    con.close()

# ── esecuzione azioni ────────────────────────────────────────────────────────

def execute_action(action: dict) -> str | None:
    """Esegue l'azione estratta dalla risposta di Claude. Ritorna messaggio di esito."""
    action_type = action.get("type")
    params = action.get("params", {})
    con = get_db()
    cur = con.cursor()
    ensure_tables(cur)

    try:
        if action_type == "add_transaction":
            cur.execute(
                "INSERT INTO transactions (created_at, amount, direction, category, note) VALUES (?,?,?,?,?)",
                (datetime.now().isoformat(), params["amount"], params.get("direction", "-"),
                 params.get("category", "altro"), params.get("note", ""))
            )
            con.commit()
            return "transazione salvata"

        elif action_type == "log_workout":
            cur.execute(
                "INSERT INTO workout_logs (exercise, weight_kg, reps, sets, notes) VALUES (?,?,?,?,?)",
                (params["exercise"], params["weight_kg"],
                 params.get("reps"), params.get("sets"), params.get("notes",""))
            )
            con.commit()
            return "allenamento salvato"

        elif action_type == "set_reminder":
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT, remind_at TEXT, sent INTEGER DEFAULT 0
                )
            """)
            cur.execute(
                "INSERT INTO reminders (title, remind_at) VALUES (?,?)",
                (params["title"], params["remind_at"])
            )
            con.commit()
            return "promemoria salvato"

        elif action_type == "add_event":
            # Chiama internamente la logica di Radicale
            import requests
            from requests.auth import HTTPBasicAuth
            RADICALE_URL = "http://localhost:5232/matteo/calendar/"
            RADICALE_AUTH = HTTPBasicAuth("matteo", "Mlizzo06")
            uid = datetime.now().strftime("%Y%m%dT%H%M%S") + "@jarvis"
            start = params["start"].replace("-","").replace(":","").split(".")[0]
            end_raw = params.get("end", params["start"])
            end = end_raw.replace("-","").replace(":","").split(".")[0]
            ical = f"""BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:{uid}\r\nSUMMARY:{params['title']}\r\nDTSTART:{start}\r\nDTEND:{end}\r\nDESCRIPTION:{params.get('description','')}\r\nEND:VEVENT\r\nEND:VCALENDAR"""
            requests.request("MKCOL", RADICALE_URL, auth=RADICALE_AUTH)
            requests.put(RADICALE_URL + uid + ".ics", data=ical, auth=RADICALE_AUTH,
                         headers={"Content-Type": "text/calendar"})
            return "evento salvato"

    except Exception as e:
        return f"errore azione: {e}"
    finally:
        con.close()

import re

def parse_action(reply: str) -> tuple[str, dict | None]:
    """Estrae il tag <action>...</action> dalla risposta e lo rimuove dal testo."""
    match = re.search(r"<action>(.*?)</action>", reply, re.DOTALL)
    if not match:
        return reply.strip(), None
    clean_reply = reply[:match.start()].strip()
    try:
        action = json.loads(match.group(1).strip())
        return clean_reply, action
    except Exception:
        return clean_reply, None

# ── endpoint principale ──────────────────────────────────────────────────────

class CommandIn(BaseModel):
    text: str

@router.post("/command")
async def command(body: CommandIn):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY non configurata")

    user_text = body.text.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Testo vuoto")

    # Costruisci contesto + cronologia
    context = build_context()
    history = get_history(limit=10)

    messages = history + [{"role": "user", "content": user_text}]

    # Chiama Claude
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT + "\n\n--- Contesto attuale ---\n" + context,
        messages=messages,
    )

    raw_reply = response.content[0].text
    clean_reply, action = parse_action(raw_reply)

    # Salva nella cronologia
    save_message("user", user_text)
    save_message("assistant", clean_reply)

    # Esegui azione se presente
    action_result = None
    if action:
        action_result = execute_action(action)

    return {
        "reply": clean_reply,
        "action": action.get("type") if action else None,
        "action_result": action_result,
    }


# ── endpoint audio (Whisper) ─────────────────────────────────────────────────

@router.post("/command/audio")
async def command_audio(file: UploadFile = File(...)):
    """Riceve un file audio, trascrive con Whisper, passa a Claude."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(status_code=501, detail="faster-whisper non installato. Esegui: pip install faster-whisper")

    import tempfile, shutil

    # Salva file temporaneo
    suffix = "." + (file.filename.split(".")[-1] if file.filename else "ogg")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Trascrivi
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(tmp_path, language="it")
        text = " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        os.unlink(tmp_path)

    if not text:
        return {"reply": "Non ho capito l'audio, puoi ripetere?", "transcription": ""}

    # Passa a Claude esattamente come il comando testuale
    result = await command(CommandIn(text=text))
    result["transcription"] = text
    return result
