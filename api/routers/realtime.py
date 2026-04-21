"""Realtime events via Server-Sent Events.

Infrastruttura minimale in-memory: qualsiasi router può chiamare `publish(type, payload)`
dopo una mutazione, e tutti i client connessi a `/realtime/stream` la ricevono come
evento SSE. Il frontend la converte in un CustomEvent `jarvis:<type>` che le pagine
ascoltano per ricaricarsi.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/realtime", tags=["realtime"])

# Lista di code dei client connessi. Ogni client ha la sua coda;
# publish() fa un fan-out scrivendo su tutte.
_subscribers: list[asyncio.Queue[str]] = []


def publish(event_type: str, payload: dict[str, Any] | None = None) -> None:
    """Invia un evento a tutti i client SSE connessi. Safe da chiamare sync o async.

    Non blocca mai: se una coda è piena (client lento), il messaggio viene scartato per
    quel client.
    """
    data = json.dumps({"type": event_type, "payload": payload or {}})
    message = f"event: {event_type}\ndata: {data}\n\n"
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        if q in _subscribers:
            _subscribers.remove(q)
    if _subscribers:
        logger.debug("SSE publish %s → %d subscribers", event_type, len(_subscribers))


async def _event_stream(request: Request):
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=64)
    _subscribers.append(q)
    logger.info("SSE client connesso (totale: %d)", len(_subscribers))
    try:
        # Messaggio iniziale di hello così il client sa che la connessione è viva
        yield "event: hello\ndata: {}\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(q.get(), timeout=25.0)
                yield msg
            except asyncio.TimeoutError:
                # Heartbeat ogni 25s per tenere viva la connessione dietro proxy/nginx
                yield ": keepalive\n\n"
    finally:
        if q in _subscribers:
            _subscribers.remove(q)
        logger.info("SSE client disconnesso (totale: %d)", len(_subscribers))


@router.get("/stream")
async def stream(request: Request):
    return StreamingResponse(
        _event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disabilita buffering su nginx
            "Connection": "keep-alive",
        },
    )
