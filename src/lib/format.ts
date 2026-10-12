// Always render absolute timestamps — recency matters in a finance tool and
// "2 hours ago" hides whether data is still valid. sv-SE locale formats as
// "yyyy-MM-dd HH:mm:ss" in the viewer's local time.
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("sv-SE");
}

export function fmtNumber(v: unknown, opts: { digits?: number } = {}): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  const digits = opts.digits ?? 2;
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Indicator values span ratios like Comparative RS (~0.05) and oscillators (~50): keep four
// decimals below 1 so the small ones don't collapse to "0.05"/"0.00".
export function fmtValue(v: number | null | undefined): string {
  if (v == null) return "—";
  return fmtNumber(v, { digits: Math.abs(v) < 1 ? 4 : 2 });
}

export function fmtCell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return fmtNumber(v);
  if (typeof v === "boolean") return v ? "✓" : "✗";
  return String(v);
}
