from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os, requests, anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path="/home/jarvis/api/.env")

router = APIRouter(prefix="/storage", tags=["storage"])
STORAGE_ROOT = "/home/jarvis/storage"
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-haiku-4-5-20251001"

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

class SendRequest(BaseModel):
    path: str

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

class AnalyzeRequest(BaseModel):
    path: str
    question: Optional[str] = None

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
