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
  // key_name -> ISO timestamp of when it was last set via PUT /brokers/{name}/credentials
  // (e.g. { session_token: "2026-07-28T21:00:00Z" }) -- never the actual value.
  credentials_updated_at?: Record<string, string> | null;
}

export interface CredentialHint {
  key_name: string;
  // A masked partial hint (e.g. "••••••••7sck") -- at most the last 4 characters, never
  // the real value. See GET /brokers/{name}/credentials/{key_name}/reveal's docstring.
  hint: string;
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

// The backend sends run_id as a JSON integer (Pydantic `run_id: int`), not a string --
// keep this accurate rather than coercing at every call site. Route params (URL segments)
// are always strings regardless, so `String(run.run_id)` is used wherever one is needed
// for navigation/display-as-text.
export interface ScreenRun {
  run_id: number;
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

// GET /screens (the "Past Runs" list) -- run-level metadata only, no per-ticker results;
// fetch ScreenRun (above) via getRun() for those.
export interface ScreenRunSummary {
  run_id: number;
  status: RunStatus;
  mode: ScreenMode;
  broker: string;
  universe: { id: number; name: string; member_count: number; created_at: string };
  started_at: string;
  finished_at: string | null;
  data_start_at: string;
  data_end_at: string;
  error: string | null;
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
  // `benchmark` is required for any indicator whose IndicatorInfo.needs_benchmark is
  // true (currently only Comparative_RS) and must be omitted otherwise -- the backend
  // (src/screener/custom_spec.py) validates the key set exactly, not just presence.
  indicators: Array<{ name: string; period?: number; benchmark?: string }>;
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
  listRuns: () => request<ScreenRunSummary[]>("/screens"),
  runScreen: (body: RunScreenBody) =>
    request<ScreenRun>("/screens/run", { method: "POST", body: JSON.stringify(body) }),
  getRun: (runId: string) => request<ScreenRun>(`/screens/${encodeURIComponent(runId)}`),
  exportRunUrl: (runId: string) => `${getApiBaseUrl()}/screens/${encodeURIComponent(runId)}/export`,
  // Deletes one run's metadata + results only -- never touches fetched OHLCV/instrument
  // data (see the backend's ScreenRunRepository.delete_run() docstring for why that's
  // structurally guaranteed). No bulk endpoint on the backend; multi-delete just calls
  // this once per selected id (see routes/runs.tsx).
  deleteRun: (runId: number) => request<void>(`/screens/${runId}`, { method: "DELETE" }),

  // Brokers
  listBrokers: () => request<Broker[]>("/brokers"),
  getBroker: (name: string) => request<Broker>(`/brokers/${encodeURIComponent(name)}/status`),
  reauthBroker: (name: string) =>
    request<Broker>(`/brokers/${encodeURIComponent(name)}/reauth`, { method: "POST" }),
  // Stores credential value(s) (encrypted at rest server-side) and immediately
  // re-authenticates with them -- the response reflects whether they actually worked,
  // not just "saved". Never send back the values themselves; Broker.credentials_updated_at
  // only ever exposes *when* each key was last set.
  updateBrokerCredentials: (name: string, credentials: Record<string, string>) =>
    request<Broker>(`/brokers/${encodeURIComponent(name)}/credentials`, {
      method: "PUT",
      body: JSON.stringify({ credentials }),
    }),
  // On-demand only (never fetched passively) -- a masked partial hint for one already-
  // stored credential, e.g. to confirm "yes, that's the key I meant to paste" without
  // exposing it outright.
  getCredentialHint: (name: string, keyName: string) =>
    request<CredentialHint>(
      `/brokers/${encodeURIComponent(name)}/credentials/${encodeURIComponent(keyName)}/reveal`
    ),

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
