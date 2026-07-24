import { getApiBaseUrl, getApiKey } from "./config";

// ============================================================
// Types (mirroring the backend OpenAPI contract). Kept intentionally loose
// where the backend returns free-form indicator columns.
// ============================================================

export type RunStatus = "queued" | "running" | "completed" | "failed";
export type ScreenMode = "outperforming" | "chandemo" | "custom" | string;

export interface Universe {
  id: string | number;
  name: string;
  content_hash: string;
  member_count: number;
  created_at: string;
  tickers?: string[];
}

export interface Broker {
  name: string;
  authenticated: boolean;
  rate_limit_per_minute: number;
}

export interface ModeInfo {
  mode: ScreenMode;
  description: string;
}

export interface IndicatorInfo {
  name: string;
  needs_benchmark: boolean;
  output_fields: string[];
  default_config: Record<string, unknown>;
}

export type ResultRow = Record<string, unknown> & {
  Ticker: string;
  Status?: string;
  Passed?: boolean;
  Crossover?: boolean;
  Exit_Crossover?: boolean;
};

export interface ScreenRun {
  run_id: string;
  status: RunStatus;
  mode: ScreenMode;
  broker: string;
  universe: { name?: string; member_count?: number; tickers?: string[] } | null;
  started_at: string | null;
  finished_at: string | null;
  data_start_at: string | null;
  data_end_at: string | null;
  error: string | null;
  results: ResultRow[];
  passed_tickers: string[];
}

// ============================================================
// Condition builder types (custom mode)
// ============================================================

export type ConditionRef = { indicator: string; field: string } | { value: number };
export type ConditionLeaf = { left: ConditionRef; op: string; right: ConditionRef };
export type ConditionBranch = { op: "AND" | "OR"; conditions: ConditionNode[] };
export type ConditionNode = ConditionLeaf | ConditionBranch;

export interface RunScreenBase {
  mode: ScreenMode;
  broker?: string;
  universe_name?: string;
  tickers?: string[];
  start_date?: string;
  end_date?: string;
}

export interface RunScreenCustom extends RunScreenBase {
  mode: "custom";
  interval: string;
  indicators: Array<{ name: string; period?: number } & Record<string, unknown>>;
  conditions: ConditionNode;
}

export type RunScreenBody = RunScreenBase | RunScreenCustom;

// ============================================================
// HTTP client
// ============================================================

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(res: Response): Promise<never> {
  let detail = "";
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") detail = data.detail;
    else if (Array.isArray(data?.detail)) detail = data.detail.map((d: any) => d.msg ?? JSON.stringify(d)).join("; ");
    else if (data) detail = JSON.stringify(data);
  } catch {
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
  }
  throw new ApiError(res.status, detail || res.statusText);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const key = getApiKey();
  if (key) headers.set("X-API-Key", key);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  // Universes
  listUniverses: () => request<Universe[]>("/universes"),
  getUniverse: (name: string) => request<Universe>(`/universes/${encodeURIComponent(name)}`),
  createUniverse: (body: { name: string; tickers: string[] }) =>
    request<Universe>("/universes", { method: "POST", body: JSON.stringify(body) }),
  uploadUniverseCsv: (file: File, name?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    return request<Universe>("/universes/upload", { method: "POST", body: fd });
  },

  // Screens
  listModes: () => request<ModeInfo[]>("/screens/modes"),
  listIndicators: () => request<IndicatorInfo[]>("/screens/indicators"),
  runScreen: (body: RunScreenBody) =>
    request<ScreenRun>("/screens/run", { method: "POST", body: JSON.stringify(body) }),
  getRun: (runId: string) => request<ScreenRun>(`/screens/${encodeURIComponent(runId)}`),
  exportRunUrl: (runId: string) => `${getApiBaseUrl()}/screens/${encodeURIComponent(runId)}/export`,

  // Brokers
  listBrokers: () => request<Broker[]>("/brokers"),
  getBroker: (name: string) => request<Broker>(`/brokers/${encodeURIComponent(name)}/status`),
  reauthBroker: (name: string) =>
    request<Broker>(`/brokers/${encodeURIComponent(name)}/reauth`, { method: "POST" }),

  // Utility: download blob (with API key header) then trigger browser save
  downloadExport: async (runId: string) => {
    const headers = new Headers();
    const key = getApiKey();
    if (key) headers.set("X-API-Key", key);
    const res = await fetch(api.exportRunUrl(runId), { headers });
    if (!res.ok) await parseError(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screen-${runId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// Track recent runs client-side (there's no backend list endpoint).
const RECENT_KEY = "screener.recentRuns";
export interface RecentRun {
  run_id: string;
  mode: string;
  broker: string;
  universe: string;
  submitted_at: string;
}
export function recordRecentRun(r: RecentRun) {
  if (typeof window === "undefined") return;
  try {
    const existing: RecentRun[] = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    const next = [r, ...existing.filter((x) => x.run_id !== r.run_id)].slice(0, 50);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
export function getRecentRuns(): RecentRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
