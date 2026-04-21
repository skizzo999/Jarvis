import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
import os, requests, anthropic
import sqlite3
import shutil
from datetime import datetime, timedelta

from config import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    DB_PATH,
    STORAGE_ROOT as _STORAGE_ROOT,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
)
from security import limiter

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["storage"])
STORAGE_ROOT = str(_STORAGE_ROOT)
ANTHROPIC_KEY = ANTHROPIC_API_KEY
MODEL = CLAUDE_MODEL

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
    path: str = Field(..., max_length=500)

class UploadRequest(BaseModel):
    file_id: str = Field(..., max_length=200)
    file_name: str = Field(..., max_length=255)
    chat_id: str = Field(..., max_length=50)

class AnalyzeRequest(BaseModel):
    path: str = Field(..., max_length=500)
    question: Optional[str] = Field(None, max_length=1000)

class ClassifyRequest(BaseModel):
    chat_id: str = Field(..., max_length=50)
    text: str = Field(..., max_length=200)

class MoveRequest(BaseModel):
    path: str = Field(..., max_length=500)
    dest_folder: str = Field(..., max_length=300)

class DeleteRequest(BaseModel):
    path: str = Field(..., max_length=500)

# ========== ENDPOINTS ==========

@router.get("/files")
def list_files():
    if not os.path.exists(STORAGE_ROOT):
        return []
    return build_tree(STORAGE_ROOT)

@router.get("/download")
def download_file(path: str, inline: int = 0):
    full = os.path.realpath(os.path.join(STORAGE_ROOT, path))
    if not full.startswith(os.path.realpath(STORAGE_ROOT)):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")
    disposition = "inline" if inline else "attachment"
    return FileResponse(
        full,
        filename=os.path.basename(full),
        content_disposition_type=disposition,
    )

@router.post("/send-telegram")
def send_telegram(req: SendRequest):
    full = os.path.realpath(os.path.join(STORAGE_ROOT, req.path))
    if not full.startswith(os.path.realpath(STORAGE_ROOT)):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN non configurato")
    with open(full, "rb") as f:
        r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendDocument",
            data={"chat_id": TELEGRAM_CHAT_ID}, files={"document": (os.path.basename(full), f)}, timeout=30)
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
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN non configurato")

    # 1. Ottieni file_path da Telegram
    r = requests.get(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getFile?file_id={data.file_id}",
        timeout=10
    )
    if not r.ok:
        raise HTTPException(400, f"Errore Telegram API: {r.text}")

    file_path = r.json().get("result", {}).get("file_path")
    if not file_path:
        raise HTTPException(400, "file_path non trovato")

    # 2. Download del file
    download_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
    r = requests.get(download_url, timeout=30)
    if not r.ok:
        raise HTTPException(400, f"Impossibile scaricare: {r.text}")
    
    # 3. Salva in inbox
    inbox = os.path.join(STORAGE_ROOT, "inbox")
    os.makedirs(inbox, exist_ok=True)
    local_path = os.path.join(inbox, data.file_name)
    
    with open(local_path, "wb") as f:
        f.write(r.content)
    logger.info("file salvato in inbox: %s (%.1f KB)", data.file_name, len(r.content) / 1024)

    # 4. Registra come pending (per il timeout). Schema gestito da init_schema in startup.
    conn = get_db()
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
    logger.info("file classificato: %s → %s", filename, target)

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
@limiter.limit("20/minute")
def analyze_file(request: Request, req: AnalyzeRequest):
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
            "Italiano. Niente intro generiche. Vai subito al punto.\n\n"
            "Usa questa sintassi markdown per strutturare la risposta:\n"
            "- `# Titolo`, `## Sottotitolo`, `### Sezione` per le intestazioni\n"
            "- `**grassetto**` per termini chiave\n"
            "- `*corsivo*` per enfasi leggera\n"
            "- `==evidenziato==` per concetti fondamentali da ricordare\n"
            "- `++sottolineato++` per definizioni importanti\n"
            "- `~~barrato~~` per errori da evitare\n"
            "- `` `codice` `` per termini tecnici o variabili\n"
            "- `- ` per liste\n"
            "- `---` per separare sezioni\n"
            "Usa queste evidenziazioni con parsimonia — devono aiutare a memorizzare, non distrarre."
        ),
        messages=[{
            "role": "user",
            "content": f"File: {filename}\n\n---\n{text}\n---\n\nDomanda: {question}"
        }]
    )
    answer = response.content[0].text
    logger.info("file analizzato: %s (%d chars) domanda: %.60s", filename, len(text), question)
    return {
        "filename": filename,
        "question": question,
        "answer": answer,
        "chars_analyzed": len(text),
    }

@router.post("/move")
def move_file(req: MoveRequest):
    """Sposta un file in un'altra cartella dentro STORAGE_ROOT."""
    safe_base = os.path.realpath(STORAGE_ROOT)
    src = os.path.realpath(os.path.join(STORAGE_ROOT, req.path))
    if not src.startswith(safe_base + os.sep) and src != safe_base:
        raise HTTPException(400, "Percorso sorgente non valido")
    if not os.path.isfile(src):
        raise HTTPException(404, "File non trovato")

    dest_dir = os.path.realpath(os.path.join(STORAGE_ROOT, req.dest_folder))
    if not (dest_dir == safe_base or dest_dir.startswith(safe_base + os.sep)):
        raise HTTPException(400, "Cartella destinazione non valida")

    os.makedirs(dest_dir, exist_ok=True)
    filename = os.path.basename(src)
    dest_path = os.path.join(dest_dir, filename)
    if os.path.exists(dest_path):
        raise HTTPException(409, f"'{filename}' esiste già in {req.dest_folder}")

    shutil.move(src, dest_path)
    logger.info("file spostato: %s → %s", filename, req.dest_folder)
    return {"status": "ok", "filename": filename, "destination": req.dest_folder}


@router.post("/delete")
def delete_file(req: DeleteRequest):
    """Elimina un file dallo storage."""
    safe_base = os.path.realpath(STORAGE_ROOT)
    full = os.path.realpath(os.path.join(STORAGE_ROOT, req.path))
    if not full.startswith(safe_base + os.sep):
        raise HTTPException(400, "Percorso non valido")
    if not os.path.isfile(full):
        raise HTTPException(404, "File non trovato")

    filename = os.path.basename(full)
    os.remove(full)
    logger.info("file eliminato: %s", req.path)
    return {"status": "ok", "filename": filename}


@router.post("/upload-web")
@limiter.limit("30/minute")
async def upload_web(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form("inbox"),
):
    """Upload diretto dal browser. Salva in STORAGE_ROOT/{folder}/."""
    safe_base = os.path.realpath(STORAGE_ROOT)
    dest_dir  = os.path.realpath(os.path.join(STORAGE_ROOT, folder))
    if not (dest_dir == safe_base or dest_dir.startswith(safe_base + os.sep)):
        raise HTTPException(400, "Cartella non valida")

    safe_name = os.path.basename(file.filename or "upload")
    if not safe_name:
        raise HTTPException(400, "Nome file non valido")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File troppo grande (max {MAX_UPLOAD_BYTES // (1024*1024)} MB)")

    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)

    logger.info("upload web: %s → %s (%.1f KB)", safe_name, folder, len(content) / 1024)
    return {"status": "ok", "filename": safe_name, "folder": folder, "size_kb": round(len(content)/1024, 1)}
