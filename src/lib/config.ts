// Runtime-overridable backend config. The default comes from a Vite env var but
// the user can override it at /settings (stored in localStorage) so the deployed
// frontend can point at any reachable backend without a rebuild.
//
// There is deliberately no API key here: anything baked into this bundle (or stored in
// localStorage) is readable by anyone who can load the app, and the backend's X-API-Key
// bypasses the instance login. The browser authenticates with the login session cookie
// only; X-API-Key is for non-browser callers (CLI/curl/scripts).
const LS_BASE = "screener.apiBaseUrl";

const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getApiBaseUrl(): string {
  if (isBrowser()) {
    const stored = window.localStorage.getItem(LS_BASE);
    if (stored) return stored.replace(/\/+$/, "");
  }
  return envBase.replace(/\/+$/, "");
}

export function setApiBaseUrl(v: string) {
  if (!isBrowser()) return;
  if (v) window.localStorage.setItem(LS_BASE, v);
  else window.localStorage.removeItem(LS_BASE);
}

export const defaults = { envBase };
