// Jarvis API client helper.
//
// Intercetta automaticamente tutte le chiamate `fetch` verso `/api/*` e
// aggiunge l'header `X-API-Key` se l'utente ha salvato una chiave in
// localStorage. In questo modo non serve modificare i singoli componenti
// quando Matteo abilita `JARVIS_API_KEY` lato server.
//
// Chiave: `jarvis_api_key` in localStorage.
// - Set:    localStorage.setItem('jarvis_api_key', '...')  — o dalla Settings page.
// - Unset:  localStorage.removeItem('jarvis_api_key')
//
// Se nessuna chiave è presente, il comportamento è identico a `fetch` standard.

const API_KEY_STORAGE = "jarvis_api_key";
export const API_URL = "/api";

export function getApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    /* storage bloccato */
  }
}

function isApiRequest(input) {
  const url = typeof input === "string" ? input : input?.url || "";
  return url.startsWith("/api/") || url.startsWith(API_URL + "/");
}

export function installApiInterceptor() {
  if (typeof window === "undefined" || window.__jarvisApiInterceptor) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init = {}) {
    if (!isApiRequest(input)) {
      return originalFetch(input, init);
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      return originalFetch(input, init);
    }
    const headers = new Headers(init.headers || {});
    if (!headers.has("X-API-Key")) {
      headers.set("X-API-Key", apiKey);
    }
    return originalFetch(input, { ...init, headers });
  };

  window.__jarvisApiInterceptor = true;
}

// Wrapper tipato per chi preferisce un API esplicita
export async function apiFetch(path, init = {}) {
  const url = path.startsWith("/") ? path : `${API_URL}/${path}`;
  const headers = new Headers(init.headers || {});
  const apiKey = getApiKey();
  if (apiKey && !headers.has("X-API-Key")) headers.set("X-API-Key", apiKey);
  return fetch(url, { ...init, headers });
}
