import { format, parseISO } from "date-fns";

// Always render absolute timestamps — recency matters in a finance tool and
// "2 hours ago" hides whether data is still valid.
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return iso;
  }
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return iso;
  }
}

export function fmtNumber(v: unknown, opts: { digits?: number } = {}): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  const digits = opts.digits ?? 2;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtCell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return fmtNumber(v);
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
}
