import type { Broker } from "./api";

// A broker's status is the outcome of the last real login attempt the backend made (usually
// by the worker, when it fetched data) -- not a live check. So it has three states, and the
// "how long ago" matters: a Breeze token that expired overnight still shows the last success
// until something next tries to use it.
export type BrokerAuthState = "ok" | "failed" | "unknown";

export function brokerAuthState(b: Broker): BrokerAuthState {
  if (!b.last_auth_at) return "unknown";
  return b.authenticated ? "ok" : "failed";
}

export const AUTH_DOT_CLASS: Record<BrokerAuthState, string> = {
  ok: "bg-pass",
  failed: "bg-fail",
  unknown: "bg-muted-foreground/50",
};

export const AUTH_TEXT_CLASS: Record<BrokerAuthState, string> = {
  ok: "text-pass",
  failed: "text-fail",
  unknown: "text-muted-foreground",
};

export const AUTH_LABEL: Record<BrokerAuthState, string> = {
  ok: "Authed",
  failed: "Failed",
  unknown: "Not checked",
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "3 hours ago", "just now" -- coarse on purpose, it's a staleness hint. */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}

/** One-line description for tooltips / aria-labels. */
export function brokerStatusText(b: Broker): string {
  const missing = b.missing_credentials?.length
    ? ` — missing ${b.missing_credentials.join(", ")}`
    : "";
  const state = brokerAuthState(b);
  if (state === "unknown") return `${b.name}: not checked yet${missing}`;
  const when = formatAgo(b.last_auth_at!);
  if (state === "ok") return `${b.name}: last login succeeded ${when}${missing}`;
  return `${b.name}: last login failed ${when}${b.last_auth_error ? ` — ${b.last_auth_error}` : ""}${missing}`;
}
