// Runtime-overridable backend config. Defaults come from Vite env vars but
// the user can override them at /settings (stored in localStorage) so the
// deployed frontend can point at any reachable backend without a rebuild.
const LS_BASE = "screener.apiBaseUrl";
const LS_KEY = "screener.apiKey";

const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000";
const envKey = (import.meta.env.VITE_API_KEY as string | undefined) ?? "";

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

export function getApiKey(): string {
  if (isBrowser()) {
    const stored = window.localStorage.getItem(LS_KEY);
    if (stored != null) return stored;
  }
  return envKey;
}

export function setApiBaseUrl(v: string) {
  if (!isBrowser()) return;
  if (v) window.localStorage.setItem(LS_BASE, v);
  else window.localStorage.removeItem(LS_BASE);
}

export function setApiKey(v: string) {
  if (!isBrowser()) return;
  if (v) window.localStorage.setItem(LS_KEY, v);
  else window.localStorage.removeItem(LS_KEY);
}

export const defaults = { envBase, envKey };
