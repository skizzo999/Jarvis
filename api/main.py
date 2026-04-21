import logging
import os
import sqlite3
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from config import API_KEY, CORS_ORIGINS, DB_PATH, STORAGE_ROOT
from db.schema import init_schema
from security import api_key_middleware, limiter

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    auth_state = "enabled" if API_KEY else "disabled (set JARVIS_API_KEY to enable)"
    logger.info("Jarvis API ready (db=%s, auth=%s)", DB_PATH, auth_state)
    yield


app = FastAPI(title="Jarvis API", version="2.1", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth middleware — aggiunto PRIMA del logger così le richieste 401 vengono loggate con status 401
app.middleware("http")(api_key_middleware)


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
    return {"status": "ok", "version": "2.1"}

@app.get("/health")
def health():
    checks: dict = {}

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("SELECT 1")
        conn.close()
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e}"

    checks["storage"] = "ok" if os.path.isdir(STORAGE_ROOT) else "missing"

    ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if ok else "degraded", "checks": checks}
