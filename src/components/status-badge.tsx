import { cn } from "@/lib/utils";
import type { RunStatus } from "@/lib/api";

const map: Record<RunStatus, { label: string; className: string; hint: string }> = {
  queued: {
    label: "Queued",
    className: "bg-muted text-muted-foreground border-border",
    hint: "waiting for a worker",
  },
  running: {
    label: "Running",
    className: "bg-signal/15 text-signal border-signal/40 animate-pulse",
    hint: "screening in progress",
  },
  completed: {
    label: "Completed",
    className: "bg-pass/15 text-pass border-pass/40",
    hint: "finished",
  },
  failed: {
    label: "Failed",
    className: "bg-fail/15 text-fail border-fail/40",
    hint: "run errored",
  },
};

export function StatusBadge({ status, showHint }: { status: RunStatus; showHint?: boolean }) {
  const m = map[status] ?? map.queued;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-mono uppercase tracking-wide",
          m.className,
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {m.label}
      </span>
      {showHint && <span className="text-xs text-muted-foreground">{m.hint}</span>}
    </span>
  );
}

export function PassFailBadge({ passed }: { passed: boolean | undefined }) {
  if (passed === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex w-14 justify-center rounded border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider",
        passed
          ? "bg-pass/15 text-pass border-pass/40"
          : "bg-fail/10 text-fail border-fail/30",
      )}
    >
      {passed ? "Pass" : "Fail"}
    </span>
  );
}

export function CrossoverBadge({ kind }: { kind: "buy" | "exit" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider",
        kind === "buy"
          ? "bg-signal/20 text-signal border-signal/50"
          : "bg-warn/20 text-warn border-warn/50",
      )}
      title={kind === "buy" ? "Signal turned on this period" : "Exit signal turned on this period"}
    >
      ★ {kind === "buy" ? "New" : "Exit"}
    </span>
  );
}
