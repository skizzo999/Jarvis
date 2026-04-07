from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os, requests

router = APIRouter(prefix="/storage", tags=["storage"])

STORAGE_ROOT = "/home/jarvis/storage"

def human_size(size):
    for unit in ["B","KB","MB","GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"

def build_tree(path, rel=""):
    items = []
    try:
        entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
        for e in entries:
            rel_path = os.path.join(rel, e.name) if rel else e.name
            if e.is_dir():
                items.append({
                    "type": "folder",
                    "name": e.name,
                    "path": rel_path,
                    "children": build_tree(e.path, rel_path),
                })
            else:
                items.append({
                    "type": "file",
                    "name": e.name,
                    "path": rel_path,
                    "size": human_size(e.stat().st_size),
                })
    except PermissionError:
        pass
    return items

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

    # Legge il token dal file .env o variabile d'ambiente
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "8330494963")

    if not token:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN non configurato")

    with open(full, "rb") as f:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendDocument",
            data={"chat_id": chat_id},
            files={"document": (os.path.basename(full), f)},
            timeout=30,
        )
    if not r.ok:
        raise HTTPException(500, f"Errore Telegram: {r.text}")
    return {"status": "ok", "filename": os.path.basename(full)}
