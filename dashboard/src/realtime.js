// Realtime bridge: apre una connessione SSE a /api/realtime/stream e ripubblica
// ogni evento come CustomEvent `jarvis:<type>` sul window. Le pagine si
// iscrivono con `window.addEventListener("jarvis:tx.created", handler)`.
//
// Auto-reconnect con backoff in caso di drop. Una sola connessione per tab.

import { getApiKey } from "./api.js";

let es = null;
let retryTimer = null;
let retryDelay = 1000;

const KNOWN_EVENTS = [
  "tx.created", "tx.updated", "tx.deleted",
  "event.created", "event.deleted",
  "reminder.created",
  "fitness.workout", "fitness.weight", "fitness.meal", "fitness.food",
  "storage.changed",
  "record.deleted",
];

function dispatch(type, data) {
  window.dispatchEvent(new CustomEvent(`jarvis:${type}`, { detail: data }));
}

export function startRealtime() {
  if (es) return;
  const key = getApiKey();
  const url = `/api/realtime/stream${key ? `?key=${encodeURIComponent(key)}` : ""}`;
  try {
    es = new EventSource(url);
  } catch {
    scheduleReconnect();
    return;
  }

  es.onopen = () => { retryDelay = 1000; };

  es.onerror = () => {
    try { es?.close(); } catch {}
    es = null;
    scheduleReconnect();
  };

  KNOWN_EVENTS.forEach(type => {
    es.addEventListener(type, (e) => {
      let data = {};
      try { data = JSON.parse(e.data); } catch {}
      dispatch(type, data.payload || {});
    });
  });

  es.addEventListener("hello", () => {
    dispatch("connected", {});
  });
}

function scheduleReconnect() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(retryDelay * 2, 15000);
    startRealtime();
  }, retryDelay);
}
