from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os, requests, anthropic
from dotenv import load_dotenv
import sqlite3
import shutil
from datetime import datetime, timedelta

load_dotenv(dotenv_path="/home/jarvis/api/.env")

router = APIRouter(prefix="/storage", tags=["storage"])
STORAGE_ROOT = "/home/jarvis/storage"
DB_PATH = "/home/jarvis/data/jarvis.db"
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-haiku-4-5-20251001"

SCHOOL_SUBJECTS = {
    'informatica': 'scuola/informatica', 'info': 'scuola/informatica',
    'sistemi': 'scuola/sistemi', 'reti': 'scuola/sistemi',
    'tpsi': 'scuola/tpsi', 'psicologia': 'scuola/tpsi',
    'gpoi': 'scuola/gpoi', 'gestione': 'scuola/gpoi',
    'italiano': 'scuola/italiano', 'storia': 'scuola/storia',
    'inglese': 'scuola/inglese', 'english': 'scuola/inglese',
    'personale': 'personale', 'mio': 'personale'
}

def classify_folder(keyword: str) -> str:
    kw = keyword.lower().strip()
    for key, folder in SCHOOL_SUBJECTS.items():
        if key in kw:
            return folder
    return "inbox"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def human_size(size):
    for unit in ["B","KB","MB","GB"]:
        if size < 1024: return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"

def build_tree(path, rel=""):
    items = []
    try:
        entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for e in entries:
            rel_path = os.path.join(rel, e.name) if rel else e.name
            if e.is_dir():
                items.append({"type":"folder","name":e.name,"path":rel_path,"children":build_tree(e.path, rel_path)})
            else:
                items.append({"type":"file","name":e.name,"path":rel_path,"size":human_size(e.stat().st_size)})
    except PermissionError:
        pass
    return items

def extract_text(full_path: str) -> str:
    """Estrae testo da file. Supporta PDF, testo, codice."""
    ext = full_path.rsplit(".", 1)[-1].lower() if "." in full_path else ""
    MAX = 40000  # max caratteri da inviare a Claude

    if ext == "pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(full_path)
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            return text[:MAX]
        except Exception as e:
            raise HTTPException(422, f"Impossibile leggere PDF: {e}")

    text_exts = {"txt","md","py","js","jsx","ts","tsx","json","csv","html","css","yaml","yml","sh","env","toml","ini","xml","sql","log"}
    if ext in text_exts:
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read(MAX)
        except Exception as e:
            raise HTTPException(422, f"Impossibile leggere file: {e}")

    raise HTTPException(415, f"Formato .{ext} non supportato per l'analisi")

# ========== MODELS ==========
class SendRequest(BaseModel):
    path: str

class UploadRequest(BaseModel):  # ← SENZA DECORATORE!
    file_id: str
    file_name: str
    chat_id: str

class AnalyzeRequest(BaseModel):
    path: str
    question: Optional[str] = None

class ClassifyRequest(BaseModel):  # ← MANCAVA QUESTA DEFINIZIONE
    chat_id: str
    text: str

# ========== ENDPOINTS ==========

@router.get("/files")
def list_files():
    if not os.path.exists(STORAGE_ROOT):
        return []
    return build_tree(STORAGE_ROOT)

@router.get("/download")
def download_file(path: str):
    full = os.path.realpath(os.path.join(STORAGE_ROOT, path))
    if not full.startswith(os.path.realpath(STORAGE_ROOT)):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")
    return FileResponse(full, filename=os.path.basename(full))

@router.post("/send-telegram")
def send_telegram(req: SendRequest):
    full = os.path.realpath(os.path.join(STORAGE_ROOT, req.path))
    if not full.startswith(os.path.realpath(STORAGE_ROOT)):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "8330494963")
    if not token:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN non configurato")
    with open(full, "rb") as f:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendDocument",
            data={"chat_id": chat_id}, files={"document": (os.path.basename(full), f)}, timeout=30)
    if not r.ok:
        raise HTTPException(500, f"Errore Telegram: {r.text}")
    return {"status": "ok", "filename": os.path.basename(full)}

@router.post("/upload")  # ← DECORATORE CORRETTO SULLA FUNZIONE
async def upload_from_telegram(data: UploadRequest):
    """
    Scarica un file da Telegram e lo salva in inbox/.
    Registra il file come 'pending' per il timeout di 5s.
    Chiamato da n8n.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN non configurato")
    
    # 1. Ottieni file_path da Telegram
    r = requests.get(
        f"https://api.telegram.org/bot{token}/getFile?file_id={data.file_id}",
        timeout=10
    )
    if not r.ok:
        raise HTTPException(400, f"Errore Telegram API: {r.text}")
    
    file_path = r.json().get("result", {}).get("file_path")
    if not file_path:
        raise HTTPException(400, "file_path non trovato")
    
    # 2. Download del file
    download_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    r = requests.get(download_url, timeout=30)
    if not r.ok:
        raise HTTPException(400, f"Impossibile scaricare: {r.text}")
    
    # 3. Salva in inbox
    inbox = os.path.join(STORAGE_ROOT, "inbox")
    os.makedirs(inbox, exist_ok=True)
    local_path = os.path.join(inbox, data.file_name)
    
    with open(local_path, "wb") as f:
        f.write(r.content)
    
    # 4. Registra come pending (per il timeout)
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            upload_time TEXT NOT NULL
        )
    """)
    conn.execute(
        "INSERT INTO pending_files (chat_id, filename, upload_time) VALUES (?, ?, ?)",
        (data.chat_id, data.file_name, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    
    return {
        "status": "ok",
        "message": f"📥 File '{data.file_name}' salvato in Inbox. Rispondi 'Scuola', 'Mio' o materia entro 5s.",
        "filename": data.file_name
    }

@router.post("/classify")  # ← QUESTO MANCAVA NEL TUO CODICE!
def classify_pending(req: ClassifyRequest):
    """
    Gestisce la risposta dell'utente per spostare un file pending.
    Timeout: 5 secondi dall'upload.
    """
    conn = get_db()
    cur = conn.cursor()
    
    # Recupera l'ultimo file pending per questo chat_id
    cur.execute("""
        SELECT filename, upload_time FROM pending_files 
        WHERE chat_id = ? ORDER BY upload_time DESC LIMIT 1
    """, (req.chat_id,))
    row = cur.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(404, "Nessun file in attesa")
    
    filename = row['filename']
    upload_time = datetime.fromisoformat(row['upload_time'])
    
    # ⏱️ Controllo timeout 5 secondi
    if datetime.now() - upload_time > timedelta(seconds=5):
        cur.execute("DELETE FROM pending_files WHERE chat_id = ?", (req.chat_id,))
        conn.commit()
        conn.close()
        return {
            "status": "timeout",
            "message": "⏰ Timeout. File rimasto in Inbox.",
            "filename": filename
        }
    
    # 🎯 Classifica in base alla keyword
    target = classify_folder(req.text)
    if target == "inbox":
        conn.close()
        raise HTTPException(400, f"Categoria non riconosciuta. Usa: {', '.join(SCHOOL_SUBJECTS.keys())}")
    
    # 📦 Sposta il file
    source = os.path.join(STORAGE_ROOT, "inbox", filename)
    dest_dir = os.path.join(STORAGE_ROOT, target)
    dest = os.path.join(dest_dir, filename)
    
    os.makedirs(dest_dir, exist_ok=True)
    shutil.move(source, dest)
    
    # 🧹 Pulisci pending
    cur.execute("DELETE FROM pending_files WHERE chat_id = ?", (req.chat_id,))
    conn.commit()
    conn.close()
    
    return {
        "status": "ok",
        "message": f"✅ '{filename}' → /{target}",
        "filename": filename,
        "destination": target
    }

@router.post("/analyze")
def analyze_file(req: AnalyzeRequest):
    """Analizza un file con Claude. Se question è None, genera un riassunto."""
    if not ANTHROPIC_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY non configurata")
    full = os.path.realpath(os.path.join(STORAGE_ROOT, req.path))
    if not full.startswith(os.path.realpath(STORAGE_ROOT)):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")

    text = extract_text(full)
    filename = os.path.basename(full)
    question = req.question or "Fai un riassunto chiaro e strutturato di questo documento. Evidenzia i punti chiave."

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=(
            "Sei Jarvis, assistente di Matteo. Analizza il documento fornito e rispondi in modo preciso e diretto. "
            "Italiano. Niente intro generiche. Vai subito al punto. Usa markdown minimale se utile."
        ),
        messages=[{
            "role": "user",
            "content": f"File: {filename}\n\n---\n{text}\n---\n\nDomanda: {question}"
        }]
    )
    return {
        "filename": filename,
        "question": question,
        "answer": response.content[0].text,
        "chars_analyzed": len(text),
    }