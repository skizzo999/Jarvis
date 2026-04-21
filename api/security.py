"""
Jarvis — autenticazione API key + rate limiting.

Policy:
- Se `JARVIS_API_KEY` è vuoto → auth disabilitata (dev mode). Tutti gli endpoint sono aperti.
- Se è settato → ogni richiesta deve portare `X-API-Key: <key>` (o
  `Authorization: Bearer <key>`). Localhost è sempre esente così lo scheduler
  interno funziona senza configurare la chiave.
- Paths esenti: `/`, `/health`, docs OpenAPI (`/docs`, `/openapi.json`,
  `/redoc`), preflight CORS (OPTIONS).

Rate limiting: slowapi in-memory, per IP. Limiti più stretti su `/command`
(hitta Claude API = costi reali).
"""
import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import API_KEY

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

EXEMPT_PATHS = {"/", "/health", "/docs", "/redoc", "/openapi.json"}
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _extract_key(request: Request) -> str | None:
    key = request.headers.get("x-api-key")
    if key:
        return key.strip()
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def api_key_middleware(request: Request, call_next):
    # Auth disabilitata se nessuna chiave configurata
    if not API_KEY:
        return await call_next(request)

    if request.method == "OPTIONS" or request.url.path in EXEMPT_PATHS:
        return await call_next(request)

    # Trust localhost (scheduler interno + dev)
    client_host = request.client.host if request.client else ""
    if client_host in LOCAL_HOSTS:
        return await call_next(request)

    provided = _extract_key(request)
    if provided != API_KEY:
        logger.warning("unauthorized request: %s %s from %s", request.method, request.url.path, client_host)
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid API key"},
        )

    return await call_next(request)
