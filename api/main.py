import logging
import os
import sqlite3
import time

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path="/home/matteo/Jarvis/.env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("jarvis")

from routers import transactions, events
from routers.server_router  import router as server_router
from routers.storage_router import router as storage_router
from routers.command_router import router as command_router
from routers.fitness_router import router as fitness_router

app = FastAPI(title="Jarvis API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    logger.info("%s %s → %d (%.0fms)", request.method, request.url.path, response.status_code, ms)
    return response

app.include_router(transactions.router)
app.include_router(events.router)
app.include_router(server_router)
app.include_router(storage_router)
app.include_router(command_router)
app.include_router(fitness_router)

@app.get("/")
def root():
    return {"status": "ok", "version": "2.0"}

@app.get("/health")
def health():
    checks: dict = {}

    try:
        conn = sqlite3.connect("/home/matteo/Jarvis/data/jarvis.db")
        conn.execute("SELECT 1")
        conn.close()
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e}"

    checks["storage"] = "ok" if os.path.isdir("/home/matteo/Jarvis/storage") else "missing"

    ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if ok else "degraded", "checks": checks}
