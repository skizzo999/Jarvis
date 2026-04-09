from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timedelta
import sqlite3, os, json, re, requests, anthropic
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv(dotenv_path="/home/jarvis/api/.env")

router = APIRouter(tags=["command"])

DB_PATH        = "/home/jarvis/data/jarvis.db"
RADICALE_URL   = "http://localhost:5232/matteo/calendar/"
RADICALE_AUTH  = HTTPBasicAuth("matteo", "Mlizzo06")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ANTHROPIC_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
MODEL          = "claude-haiku-4-5-20251001"  # ← AGGIUNTO: modello definito

# ── DB ────────────────────────────────────────────────────────────────────────

def get_db():
    return sqlite3.connect(DB_PATH)

def ensure_tables(cur):
    cur.execute("""CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL, content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise TEXT NOT NULL, weight_kg REAL NOT NULL,
        reps INTEGER, sets INTEGER, notes TEXT,
        logged_at TEXT DEFAULT (datetime('now')))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS body_weight (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight_kg REAL NOT NULL,
        logged_at TEXT DEFAULT (datetime('now')))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, remind_at TEXT, sent INTEGER DEFAULT 0)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS jarvis_config (
        key TEXT PRIMARY KEY, value TEXT)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS foods (
        name TEXT PRIMARY KEY, kcal_100g REAL, protein_100g REAL,
        carbs_100g REAL, fat_100g REAL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, logged_at TEXT,
        description TEXT, kcal REAL, protein REAL, carbs REAL, fat REAL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT,
        amount REAL, direction TEXT, category TEXT, note TEXT, account TEXT)""")

# ── ROUTING ───────────────────────────────────────────────────────────────────

HAS_NUMBER  = re.compile(r'\d')
FINANCE_KW  = re.compile(r'sald|spes|pagat|guadagnat|entrat|uscit|transazion|soldi|budget|costo|euro|€|incassat', re.I)
CALENDAR_KW = re.compile(r'calendar|event|agenda|appuntament|settiman|domani|domattina|quando|programm|impegn', re.I)
FITNESS_KW  = re.compile(r'palest|allenament|workout|fitness|scheda|muscol|progress|panca|squat|stacco|curl|press|dips|affondi|eserciz', re.I)
DIET_KW       = re.compile(r'mangi|prand|cen|colazion|spuntin|calori|macro|protein|carbo|grassi|kcal|pasto|cibo|mangiato', re.I)
FINANCE_EXACT = re.compile(r'speso|pagato|incassat|guadagnat|€|euro|ricaric|prelevat|carta|revolut|saldo', re.I)

def classify(text: str) -> str:
    if DIET_KW.search(text) and not FINANCE_EXACT.search(text):
        return "diet"
    if HAS_NUMBER.search(text):
        return "task"
    if FINANCE_KW.search(text):
        return "finance"
    if CALENDAR_KW.search(text):
        return "calendar"
    if FITNESS_KW.search(text):
        return "fitness"
    return "general"

# ── CONTEXT LOADERS ───────────────────────────────────────────────────────────

def get_today_workout():
    BASE_DATE = datetime(2026, 4, 7)
    ROTATION  = ["A", "C", "B", "riposo"]
    SCHEDA    = {"A": "Petto/Tricipiti/Spalle", "B": "Schiena/Bicipiti", "C": "Gambe/Glutei", "riposo": "Riposo"}
    delta = (datetime.now() - BASE_DATE).days
    day = ROTATION[delta % 4] if delta >= 0 else "riposo"
    return day, SCHEDA.get(day, "")

def ctx_finance(days=7) -> str:
    con = get_db(); cur = con.cursor()
    try:
        since = (datetime.now() - timedelta(days=days)).isoformat()
        cur.execute("""SELECT created_at, amount, direction, category, note, account
            FROM transactions WHERE created_at >= ? ORDER BY id DESC""", (since,))
        rows = cur.fetchall()
        cur.execute("SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='cash'")
        saldo_cash = cur.fetchone()[0]
        cur.execute("SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions WHERE account='revolut'")
        saldo_revolut = cur.fetchone()[0]
        header = f"Cash: €{saldo_cash:.2f} | Revolut: €{saldo_revolut:.2f}"
        if not rows:
            return f"{header}\nNessuna transazione negli ultimi {days} giorni."
        lines   = "\n".join(f"{r[0][:10]} {'+'if r[2]=='+'else'-'}€{r[1]:.0f} {r[3] or ''} {r[4] or ''} [{r[5] or 'cash'}]" for r in rows)
        tot_out = sum(r[1] for r in rows if r[2] == '-')
        tot_in  = sum(r[1] for r in rows if r[2] == '+')
        return f"{header}\nUltimi {days}gg — uscite €{tot_out:.0f}, entrate €{tot_in:.0f}\n{lines}"
    finally:
        con.close()

def ctx_calendar(days=7) -> str:
    try:
        body = """<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"/></C:comp-filter></C:filter>
</C:calendar-query>"""
        r = requests.request("REPORT", RADICALE_URL, data=body, auth=RADICALE_AUTH,
            headers={"Content-Type": "application/xml; charset=utf-8", "Depth": "1"}, timeout=5)
        if r.status_code not in [200, 207]:
            return "Calendario non disponibile."
        ical_blocks = re.findall(r"<[^:]+:calendar-data[^>]*>(.*?)</[^:]+:calendar-data>", r.text, re.DOTALL)
        events = []
        today  = datetime.now().date()
        cutoff = today + timedelta(days=days)
        for block in ical_blocks:
            block = block.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
            vm = re.search(r"BEGIN:VEVENT(.*?)END:VEVENT", block, re.DOTALL)
            if not vm: continue
            vevent = vm.group(0)
            def pv(k):
                m = re.search(rf"^{k}[^:]*:(.+?)(?=\r?\n[^\s]|\Z)", vevent, re.MULTILINE | re.DOTALL)
                return re.sub(r"\r?\n[ \t]", "", m.group(1)).strip() if m else ""
            summary = pv("SUMMARY"); dtstart_raw = pv(r"DTSTART(?:;[^:]*)?")
            if not summary: continue
            dtstart = dtstart_raw.split(":")[-1] if ":" in dtstart_raw else dtstart_raw
            try:
                dt = datetime.strptime(dtstart[:15], "%Y%m%dT%H%M%S") if "T" in dtstart else datetime.strptime(dtstart[:8], "%Y%m%d")
                if today <= dt.date() <= cutoff:
                    events.append((dt, summary))
            except: pass
        events.sort(key=lambda e: e[0])
        # Aggiungi promemoria dal DB SQLite
        try:
            import sqlite3 as _sq
            _conn = _sq.connect("/home/jarvis/data/jarvis.db")
            _cur = _conn.cursor()
            _cutoff_iso = cutoff.strftime("%Y-%m-%dT23:59:59")
            _today_iso = today.isoformat()
            _cur.execute(
                "SELECT title, remind_at FROM reminders WHERE sent=0 AND remind_at >= ? AND remind_at <= ? ORDER BY remind_at",
                (_today_iso, _cutoff_iso)
            )
            for _row in _cur.fetchall():
                try:
                    _dt = datetime.fromisoformat(_row[1])
                    events.append((_dt, f"🔔 {_row[0]}"))
                except: pass
            _conn.close()
            events.sort(key=lambda e: e[0])
        except: pass
        if not events:
            return f"Nessun evento nei prossimi {days} giorni."
        return "\n".join(f"{e[0].strftime('%d/%m %H:%M')} — {e[1]}" for e in events[:15])
    except:
        return "Calendario non disponibile."

def ctx_diet() -> str:
    con = get_db(); cur = con.cursor()
    try:
        cur.execute("SELECT name, kcal_100g, protein_100g, carbs_100g, fat_100g FROM foods ORDER BY name")
        foods = cur.fetchall()
        foods_lines = "\n".join(f"  {f[0]}: {f[1]}kcal {f[2]}g prot {f[3]}g carbo {f[4]}g grassi" for f in foods)
        today = datetime.now().date().isoformat()
        cur.execute("SELECT description, kcal, protein, carbs, fat FROM meals WHERE logged_at >= ? ORDER BY logged_at", (today,))
        meals = cur.fetchall()
        if meals:
            meals_lines = "\n".join(f"  {m[0]}: {m[1]:.0f}kcal {m[2]:.0f}g P {m[3]:.0f}g C {m[4]:.0f}g F" for m in meals)
            tot_kcal = sum(m[1] for m in meals)
            tot_p    = sum(m[2] for m in meals)
            tot_c    = sum(m[3] for m in meals)
            tot_f    = sum(m[4] for m in meals)
            meals_section = f"Pasti oggi:\n{meals_lines}\nTotale: {tot_kcal:.0f}kcal | P:{tot_p:.0f}g C:{tot_c:.0f}g F:{tot_f:.0f}g\nTarget: 2330kcal | P:160g C:265g F:70g"
        else:
            meals_section = "Pasti oggi: nessuno ancora.\nTarget: 2330kcal | P:160g C:265g F:70g"
        return f"DATABASE CIBI (per 100g):\n{foods_lines}\n\n{meals_section}"
    finally:
        con.close()

def ctx_fitness() -> str:
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    try:
        cur.execute("""SELECT exercise, weight_kg, reps, sets, logged_at
            FROM workout_logs WHERE id IN (SELECT MAX(id) FROM workout_logs GROUP BY exercise)
            ORDER BY exercise""")
        weights = cur.fetchall()
        cur.execute("SELECT weight_kg, logged_at FROM body_weight ORDER BY id DESC LIMIT 1")
        bw = cur.fetchone()
        lines = []
        if bw:
            lines.append(f"Peso corporeo: {bw[0]}kg ({bw[1][:10]})")
        if weights:
            lines += [f"{w[0]}: {w[1]}kg ×{w[2] or '?'} ×{w[3] or '?'} ({w[4][:10]})" for w in weights]
        else:
            lines.append("Nessun workout registrato.")
        return "\n".join(lines)
    finally:
        con.close()

def ctx_minimal() -> str:
    now = datetime.now()
    day, desc = get_today_workout()
    con = get_db(); cur = con.cursor()
    try:
        cur.execute("SELECT COALESCE(SUM(CASE WHEN direction='+' THEN amount ELSE -amount END),0) FROM transactions")
        saldo = cur.fetchone()[0]
    except:
        saldo = 0
    finally:
        con.close()
    return f"{now.strftime('%d/%m/%Y %H:%M')} | Giorno {day} ({desc}) | Saldo €{saldo:.2f}"

def build_rich_context() -> str:
    day, desc = get_today_workout()
    fin = ctx_finance(7)
    cal = ctx_calendar(3)
    fit = ctx_fitness()
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    try:
        now = datetime.now().isoformat()
        cur.execute("SELECT title, remind_at FROM reminders WHERE sent=0 AND remind_at > ? ORDER BY remind_at LIMIT 3", (now,))
        reminders = cur.fetchall()
    finally:
        con.close()
    rem = "\n".join(f"{r[1][:16]} — {r[0]}" for r in reminders) if reminders else "Nessuno"
    return f"""━ REPORT {datetime.now().strftime('%d/%m %H:%M')} ━
Giorno: {day} ({desc})

FINANZE:
{fin}

CALENDARIO:
{cal}

FITNESS:
{fit}

PROMEMORIA:
{rem}
━━━━━━━━━━━━━━━━━━━━"""

# ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────

TASK_PROMPT = """Sei Jarvis, assistente di Matteo (19 anni, Italia).
Esegui l'azione e rispondi con UNA SOLA RIGA. Niente spiegazioni.
Formato: ✅ [conferma breve]
Data/ora attuale: {now}

Azioni (tag DOPO la risposta):
add_transaction: <action>{{"type":"add_transaction","params":{{"amount":N,"direction":"+"|"-","note":"S","category":"S","account":"cash"|"revolut"}}}}</action>
log_meal: <action>{{"type":"log_meal","params":{{"description":"S","kcal":N,"protein":N,"carbs":N,"fat":N}}}}</action>
add_food: <action>{{"type":"add_food","params":{{"name":"S","kcal_100g":N,"protein_100g":N,"carbs_100g":N,"fat_100g":N}}}}</action>
log_workout: <action>{{"type":"log_workout","params":{{"exercise":"S","weight_kg":N,"reps":N,"sets":N}}}}</action>
log_body_weight: <action>{{"type":"log_body_weight","params":{{"weight_kg":N}}}}</action>
set_reminder: <action>{{"type":"set_reminder","params":{{"title":"S","remind_at":"YYYY-MM-DDTHH:MM:SS"}}}}</action>
add_event: <action>{{"type":"add_event","params":{{"title":"S","start":"YYYY-MM-DDTHH:MM:SS","end":"YYYY-MM-DDTHH:MM:SS"}}}}</action>
delete_event: <action>{{"type":"delete_event","params":{{"uid":"S"}}}}</action>
delete_record: <action>{{"type":"delete_record","params":{{"entity":"transazione|pasto|allenamento|promemoria|peso|evento","filters":{{...}},"limit":1}}}}</action>"""

QUERY_PROMPT = """Sei Jarvis, assistente vocale e testuale di Matteo (19 anni, Italia).
Ricevi messaggi già trascritti da audio (pipeline voce→testo automatica). Rispondi come se fosse testo normale.
Data/ora attuale: {now}
Rispondi direttamente con i dati. Niente intro, niente padding. Solo il dato richiesto.
Italiano. Telegram markdown (*grassetto* _corsivo_). Emoji solo se utile."""

DIET_PROMPT = """Sei Jarvis, assistente di Matteo (19 anni, Italia).
Se il messaggio descrive un pasto o qualcosa mangiato → calcola i macro dal database cibi (o stima se non c'è) e logga con log_meal. Risposta: 1 riga con i macro.
Se è una domanda sulla dieta → rispondi con i dati. Zero padding.
Italiano. Target: 2330kcal | P:160g C:265g F:70g

Azioni (tag DOPO la risposta):
log_meal: <action>{{"type":"log_meal","params":{{"description":"S","kcal":N,"protein":N,"carbs":N,"fat":N}}}}</action>
add_food: <action>{{"type":"add_food","params":{{"name":"S","kcal_100g":N,"protein_100g":N,"carbs_100g":N,"fat_100g":N}}}}</action>"""

REPORT_PROMPT = """Sei Jarvis, assistente personale di Matteo Lizzo (19 anni, studente, Italia).
Scheda: A(Petto/Tricipiti/Spalle) B(Schiena/Bicipiti) C(Gambe/Glutei) rotazione A→riposoC→camminataB→riposo→camminata dal 07/04/2026.
Target: 2330kcal, 160g prot, 265g carbo, 70g grassi, peso target 77kg.
Genera un briefing conciso e strutturato per Telegram. Italiano, diretto, emoji con moderazione."""

# ── PARSING / ESECUZIONE AZIONI ───────────────────────────────────────────────

def parse_actions(reply: str):
    matches = re.findall(r"<action>(.*?)</action>", reply, re.DOTALL)
    clean   = re.sub(r"<action>.*?</action>", "", reply, flags=re.DOTALL).strip()
    actions = []
    for m in matches:
        try: actions.append(json.loads(m.strip()))
        except: pass
    return clean, actions

def execute_delete(params: dict) -> str:
    """Eliminazione unificata e sicura per tutte le entità."""
    entity = params.get("entity", "").lower()
    filters = params.get("filters", {})
    limit = params.get("limit", 1)

    # Eventi CalDAV
    if entity == "evento":
        uid = filters.get("uid")
        if not uid:
            return "⚠️ Per eliminare un evento serve l'UID."
        try:
            requests.delete(f"{RADICALE_URL}{uid}.ics", auth=RADICALE_AUTH)
            return f"✅ Evento eliminato dal calendario."
        except Exception as e:
            return f"Errore eliminazione evento: {e}"

    ENTITY_MAP = {
        "transazione": ("transactions", "created_at"),
        "pasto": ("meals", "logged_at"),
        "allenamento": ("workout_logs", "logged_at"),
        "promemoria": ("reminders", "remind_at"),
        "peso": ("body_weight", "logged_at")
    }

    if entity not in ENTITY_MAP:
        return f"❌ Entità '{entity}' non supportata."

    table, time_col = ENTITY_MAP[entity]
    con = get_db()
    cur = con.cursor()

    conditions, values = [], []
    if "periodo" in filters:
        p = filters["periodo"]
        if p == "oggi": conditions.append(f"DATE({time_col}) = DATE('now')")
        elif p == "ieri": conditions.append(f"DATE({time_col}) = DATE('now', '-1 day')")
        elif p == "settimana": conditions.append(f"{time_col} >= datetime('now', '-7 days')")
    else:
        for k, v in filters.items():
            if k == "periodo": continue
            conditions.append(f"{k} = ?")
            values.append(v)

    if not conditions:
        con.close()
        return "⚠️ Specifica un periodo o un criterio per sicurezza."

    where_clause = " AND ".join(conditions)

    try:
        if limit == 1:
            cur.execute(f"SELECT id FROM {table} WHERE {where_clause} ORDER BY {time_col} DESC LIMIT 1", values)
            row = cur.fetchone()
            if not row:
                con.close()
                return f"⚠️ Nessun {entity} trovato con questi criteri."
            cur.execute(f"DELETE FROM {table} WHERE id = ?", (row[0],))
            con.commit()
            con.close()
            return f"✅ Eliminato ultimo {entity} corrispondente."
        else:
            cur.execute(f"DELETE FROM {table} WHERE {where_clause}", values)
            deleted = cur.rowcount
            con.commit()
            con.close()
            return f"✅ Eliminati {deleted} record di tipo {entity}."
    except Exception as e:
        con.close()
        return f"Errore DB: {e}"

def execute_action(action: dict) -> str:
    t = action.get("type"); params = action.get("params", {})
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    try:
        if t == "add_transaction":
            cur.execute("INSERT INTO transactions (created_at,amount,direction,category,note,account) VALUES (?,?,?,?,?,?)",
                (datetime.now().isoformat(), params["amount"], params.get("direction", "-"),
                 params.get("category", "altro"), params.get("note", ""), params.get("account", "cash")))
            con.commit()
        elif t == "log_workout":
            cur.execute("INSERT INTO workout_logs (exercise,weight_kg,reps,sets,notes,logged_at) VALUES (?,?,?,?,?,?)",
                (params["exercise"].lower().strip(), params["weight_kg"],
                 params.get("reps"), params.get("sets"), params.get("notes", ""), datetime.now().isoformat()))
            con.commit()
        elif t == "log_body_weight":
            cur.execute("INSERT INTO body_weight (weight_kg,logged_at) VALUES (?,?)",
                (params["weight_kg"], datetime.now().isoformat()))
            con.commit()
        elif t == "set_reminder":
            cur.execute("INSERT INTO reminders (title,remind_at) VALUES (?,?)",
                (params["title"], params["remind_at"]))
            con.commit()
        elif t == "add_event":
            uid   = datetime.now().strftime("%Y%m%dT%H%M%S") + "@jarvis"
            start = params["start"].replace("-", "").replace(":", "").split(".")[0]
            end   = params.get("end", params["start"]).replace("-", "").replace(":", "").split(".")[0]
            ical  = (f"BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n"
                     f"UID:{uid}\r\nSUMMARY:{params['title']}\r\n"
                     f"DTSTART:{start}\r\nDTEND:{end}\r\n"
                     f"DESCRIPTION:{params.get('description', '')}\r\nEND:VEVENT\r\nEND:VCALENDAR")
            requests.request("MKCOL", RADICALE_URL, auth=RADICALE_AUTH)
            requests.put(RADICALE_URL + uid + ".ics", data=ical, auth=RADICALE_AUTH,
                         headers={"Content-Type": "text/calendar"})
        elif t == "delete_event":
            uid = params.get("uid", "")
            if uid and "/" not in uid and ".." not in uid:
                requests.delete(RADICALE_URL + uid + ".ics", auth=RADICALE_AUTH)
        elif t == "log_meal":
            cur.execute("INSERT INTO meals (logged_at,description,kcal,protein,carbs,fat) VALUES (?,?,?,?,?,?)",
                (datetime.now().isoformat(), params.get("description",""), params.get("kcal",0),
                 params.get("protein",0), params.get("carbs",0), params.get("fat",0)))
            con.commit()
        elif t == "add_food":
            cur.execute("INSERT OR REPLACE INTO foods (name,kcal_100g,protein_100g,carbs_100g,fat_100g) VALUES (?,?,?,?,?)",
                (params["name"].lower().strip(), params.get("kcal_100g",0), params.get("protein_100g",0),
                 params.get("carbs_100g",0), params.get("fat_100g",0)))
            con.commit()
        elif t == "send_file":
            chat_id = params.get("chat_id")
            if not chat_id:
                cur.execute("SELECT value FROM jarvis_config WHERE key='last_chat_id'")
                row = cur.fetchone(); chat_id = row[0] if row else None
            path = params.get("path", "")
            if chat_id and TELEGRAM_TOKEN and path and os.path.exists(path):
                with open(path, "rb") as f:
                    requests.post(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument",
                        data={"chat_id": chat_id}, files={"document": f})
        elif t == "delete_record":
            return execute_delete(params)  # ← AGGIUNTO: chiamata alla funzione di eliminazione
        return "ok"
    except Exception as e:
        return f"errore: {e}"
    finally:
        con.close()

# ── HISTORY (solo per query) ──────────────────────────────────────────────────

def get_history(limit=6):
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("SELECT role,content FROM conversation_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall(); con.close()
    return [{"role": r[0], "content": r[1]} for r in reversed(rows)]

def save_messages(user_text: str, assistant_text: str):
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT INTO conversation_history (role,content) VALUES (?,?)", ("user", user_text))
    cur.execute("INSERT INTO conversation_history (role,content) VALUES (?,?)", ("assistant", assistant_text))
    cur.execute("DELETE FROM conversation_history WHERE id NOT IN (SELECT id FROM conversation_history ORDER BY id DESC LIMIT 30)")
    con.commit(); con.close()

def save_chat_id(chat_id: str):
    con = get_db(); cur = con.cursor(); ensure_tables(cur)
    cur.execute("INSERT OR REPLACE INTO jarvis_config (key,value) VALUES (?,?)", ("last_chat_id", chat_id))
    con.commit(); con.close()

# ── ENDPOINT PRINCIPALE ───────────────────────────────────────────────────────

class CommandIn(BaseModel):
    text: str
    chat_id: str | None = None

@router.post("/command")
async def command(body: CommandIn):
    if not ANTHROPIC_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurata")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Testo vuoto")

    if body.chat_id:
        save_chat_id(body.chat_id)

    category = classify(text)
    client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    if category == "task":
        system   = TASK_PROMPT.format(now=datetime.now().strftime("%d/%m/%Y %H:%M"))
        messages = [{"role": "user", "content": text}]
        max_tok  = 150
    else:
        if category == "finance":
            context = ctx_finance(7)
            system_base = QUERY_PROMPT
        elif category == "calendar":
            context = ctx_calendar(7)
            system_base = QUERY_PROMPT
        elif category == "diet":
            context = ctx_diet()
            system_base = DIET_PROMPT
        elif category == "fitness":
            context = ctx_fitness()
            system_base = QUERY_PROMPT
        else:
            context = ctx_minimal()
            system_base = QUERY_PROMPT

        system   = system_base.format(now=datetime.now().strftime("%d/%m/%Y %H:%M")) + "\n\n" + context
        messages = get_history(6) + [{"role": "user", "content": text}]
        max_tok  = 400

    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tok,
        system=system,
        messages=messages,
    )

    raw_reply            = response.content[0].text
    clean_reply, actions = parse_actions(raw_reply)

    if category != "task":
        save_messages(text, clean_reply)

    results = [{"type": a.get("type"), "result": execute_action(a)} for a in actions]
    return {"reply": clean_reply, "actions": results}

# ── ENDPOINT AUDIO ────────────────────────────────────────────────────────────

@router.post("/command/audio")
async def command_audio(file: UploadFile = File(...), chat_id: str | None = None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise HTTPException(501, "faster-whisper non installato")
    import tempfile, shutil
    suffix = "." + (file.filename.split(".")[-1] if file.filename else "ogg")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp); tmp_path = tmp.name
    try:
        model       = WhisperModel("small", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(tmp_path, language="it")
        text        = " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        os.unlink(tmp_path)
    if not text:
        return {"reply": "Non ho capito l'audio, puoi ripetere?", "transcription": "", "actions": []}
    result = await command(CommandIn(text=text, chat_id=chat_id))
    result["transcription"] = text
    return result

# ── ENDPOINT REPORT (per lo scheduler) ───────────────────────────────────────

@router.post("/command/report")
async def report(body: CommandIn):
    """Usato dallo scheduler per i briefing mattutini/serali."""
    if not ANTHROPIC_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurata")
    if body.chat_id:
        save_chat_id(body.chat_id)
    context  = build_rich_context()
    client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        system=REPORT_PROMPT + "\n\n" + context,
        messages=[{"role": "user", "content": body.text}],
    )
    raw_reply            = response.content[0].text
    clean_reply, actions = parse_actions(raw_reply)
    results = [{"type": a.get("type"), "result": execute_action(a)} for a in actions]
    return {"reply": clean_reply, "actions": results}