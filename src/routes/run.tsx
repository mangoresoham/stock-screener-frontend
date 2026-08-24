import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Loader2, Play } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ConditionBuilder } from "@/components/condition-builder";
import { api, ApiError, type ConditionNode } from "@/lib/api";

export const Route = createFileRoute("/run")({
  head: () => ({
    meta: [
      { title: "Run Screen — Stock Screener" },
      { name: "description", content: "Configure and submit a stock screen against a saved universe or an ad-hoc ticker list." },
      { property: "og:title", content: "Run Screen — Stock Screener" },
      { property: "og:description", content: "Configure and submit a stock screen against a saved universe or an ad-hoc ticker list." },
    ],
  }),
  component: RunPage,
});

const schema = z
  .object({
    mode: z.string().min(1),
    broker: z.string().min(1),
    source: z.enum(["universe", "tickers"]),
    universe_name: z.string().optional(),
    tickers_raw: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    interval: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.source === "universe" && !v.universe_name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["universe_name"], message: "Select a universe" });
    }
    if (v.source === "tickers") {
      const list = (v.tickers_raw ?? "")
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (list.length === 0)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tickers_raw"], message: "Enter at least one ticker" });
    }
    const hasStart = !!v.start_date;
    const hasEnd = !!v.end_date;
    if (hasStart !== hasEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "Provide both start and end, or neither" });
    }
    if (hasStart && hasEnd && v.start_date! >= v.end_date!) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "End must be after start" });
    }
    if (v.mode === "custom" && !v.interval) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["interval"], message: "Interval required for custom mode" });
    }
  });

type FormValues = z.infer<typeof schema>;

function RunPage() {
  const navigate = useNavigate();
  const modesQ = useQuery({ queryKey: ["modes"], queryFn: api.listModes });
  const indicatorsQ = useQuery({ queryKey: ["indicators"], queryFn: api.listIndicators });
  const universesQ = useQuery({ queryKey: ["universes"], queryFn: api.listUniverses });

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customIndicators, setCustomIndicators] = useState<
    Array<{ name: string; period: number; benchmark?: string }>
  >([]);
  const [conditions, setConditions] = useState<ConditionNode | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "outperforming",
      broker: "angel",
      source: "universe",
      interval: "1d",
    },
  });

  const mode = form.watch("mode");
  const source = form.watch("source");

  const availableIndicators = indicatorsQ.data ?? [];

  const toDateISO = (d?: string) => (d ? new Date(d).toISOString() : undefined);

  const submit = useMutation({
    mutationFn: async (v: FormValues) => {
      const tickers =
        v.source === "tickers"
          ? (v.tickers_raw ?? "")
              .split(/[\s,]+/)
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined;
      const base = {
        mode: v.mode,
        broker: v.broker,
        universe_name: v.source === "universe" ? v.universe_name : undefined,
        tickers,
        start_date: toDateISO(v.start_date),
        end_date: toDateISO(v.end_date),
      } as Record<string, unknown>;
      if (v.mode === "custom") {
        if (customIndicators.length === 0) throw new Error("Add at least one indicator");
        const missingBenchmark = customIndicators.find(
          (ind) => availableIndicators.find((x) => x.name === ind.name)?.needs_benchmark && !ind.benchmark?.trim(),
        );
        if (missingBenchmark) throw new Error(`${missingBenchmark.name} needs a benchmark ticker`);
        if (!conditions) throw new Error("Define at least one condition");
        Object.assign(base, {
          interval: v.interval,
          indicators: customIndicators,
          conditions,
        });
      }
      return api.runScreen(base as any);
    },
    onSuccess: (run) => {
      toast.success("Run queued", { description: `Run #${run.run_id}` });
      navigate({ to: "/runs/$runId", params: { runId: String(run.run_id) } });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.detail : (err as Error).message;
      toast.error("Failed to submit", { description: msg });
    },
  });

  const addCustomIndicator = () => {
    const first = availableIndicators[0];
    if (!first) return;
    const period = Number(first.default_config?.period ?? first.default_config?.cmo_period ?? 14);
    // "NIFTY" as the initial default matches what every mode used to hardcode before
    // this was configurable -- the backend now requires an explicit 'benchmark' key on
    // any needs_benchmark indicator entry (and rejects one on any other), so it must be
    // set here, not left for the backend to assume.
    const benchmark = first.needs_benchmark ? "NIFTY" : undefined;
    setCustomIndicators((prev) => [...prev, { name: first.name, period, benchmark }]);
  };

  const modes = useMemo(() => modesQ.data ?? [], [modesQ.data]);

  return (
    <AppShell>
      <form
        onSubmit={form.handleSubmit((v) => submit.mutate(v))}
        className="mx-auto max-w-3xl p-6 space-y-5 pb-24"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Run Screen</h1>
          <p className="text-xs text-muted-foreground">
            Submissions queue and run in the background. You'll be taken to the results screen to watch progress.
          </p>
        </div>

        {/* Source */}
        <Card className="p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Universe</Label>
          <div className="flex gap-2 text-xs">
            {(["universe", "tickers"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => form.setValue("source", s)}
                className={`px-3 py-1 rounded border font-mono ${
                  source === s ? "border-signal bg-signal/15 text-signal" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "universe" ? "Saved universe" : "Paste tickers"}
              </button>
            ))}
          </div>
          {source === "universe" ? (
            <Controller
              control={form.control}
              name="universe_name"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 font-mono text-xs">
                    <SelectValue placeholder={universesQ.isLoading ? "Loading…" : "Select universe"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(universesQ.data ?? []).map((u) => (
                      <SelectItem key={u.name} value={u.name} className="font-mono text-xs">
                        {u.name} · {u.member_count}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Textarea
              placeholder="RELIANCE, TCS, INFY  (comma or newline separated)"
              className="font-mono text-xs min-h-24"
              {...form.register("tickers_raw")}
            />
          )}
          <FieldError name="universe_name" form={form} />
          <FieldError name="tickers_raw" form={form} />
        </Card>

        {/* Mode + broker */}
        <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mode</Label>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {modes.map((m) => (
                      <SelectItem key={m.mode} value={m.mode} className="font-mono text-xs">
                        {m.mode}
                      </SelectItem>
                    ))}
                    {modes.length === 0 && (
                      <>
                        <SelectItem value="outperforming" className="font-mono text-xs">outperforming</SelectItem>
                        <SelectItem value="chandemo" className="font-mono text-xs">chandemo</SelectItem>
                        <SelectItem value="custom" className="font-mono text-xs">custom</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {modes.find((m) => m.mode === mode)?.description && (
              <p className="text-xs text-muted-foreground">{modes.find((m) => m.mode === mode)?.description}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Broker</Label>
            <Controller
              control={form.control}
              name="broker"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 font-mono text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="angel" className="font-mono text-xs">angel</SelectItem>
                    <SelectItem value="breeze" className="font-mono text-xs">breeze</SelectItem>
                    <SelectItem value="yahoo" className="font-mono text-xs">yahoo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </Card>

        {/* Custom mode */}
        {mode === "custom" && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Indicators</Label>
              <Button type="button" size="sm" variant="outline" onClick={addCustomIndicator} className="h-7 text-xs">
                Add indicator
              </Button>
            </div>
            <div className="space-y-2">
              {customIndicators.map((ind, i) => {
                const needsBenchmark = availableIndicators.find((x) => x.name === ind.name)?.needs_benchmark;
                return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={ind.name}
                    onValueChange={(name) => {
                      const spec = availableIndicators.find((x) => x.name === name);
                      const period = Number(spec?.default_config?.period ?? spec?.default_config?.cmo_period ?? ind.period);
                      // Rebuilt from scratch (not spread from the old entry) so a
                      // leftover 'benchmark' from the previous indicator never survives
                      // a switch to one that doesn't use it -- the backend rejects a
                      // stray benchmark key just as strictly as a missing required one.
                      const benchmark = spec?.needs_benchmark ? (ind.benchmark ?? "NIFTY") : undefined;
                      setCustomIndicators((prev) => prev.map((p, j) => (j === i ? { name, period, benchmark } : p)));
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 font-mono text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableIndicators.map((x) => (
                        <SelectItem key={x.name} value={x.name} className="font-mono text-xs">
                          {x.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="h-8 w-24 font-mono text-xs"
                    value={ind.period}
                    onChange={(e) =>
                      setCustomIndicators((prev) =>
                        prev.map((p, j) => (j === i ? { ...p, period: Number(e.target.value) } : p)),
                      )
                    }
                  />
                  {needsBenchmark && (
                    <Input
                      type="text"
                      className="h-8 w-28 font-mono text-xs"
                      placeholder="Benchmark (e.g. NIFTY)"
                      value={ind.benchmark ?? ""}
                      onChange={(e) =>
                        setCustomIndicators((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, benchmark: e.target.value.toUpperCase() } : p)),
                        )
                      }
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => setCustomIndicators((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                </div>
                );
              })}
              {customIndicators.length === 0 && (
                <p className="text-xs text-muted-foreground">No indicators added yet.</p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</Label>
              <ConditionBuilder
                value={conditions}
                onChange={setConditions}
                indicators={availableIndicators.filter((i) => customIndicators.some((c) => c.name === i.name))}
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Interval</Label>
              <Input className="h-8 w-32 font-mono text-xs" {...form.register("interval")} placeholder="1d" />
              <FieldError name="interval" form={form} />
            </div>
          </Card>
        )}

        {/* Advanced */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`size-3 transition-transform ${advancedOpen ? "" : "-rotate-90"}`} />
              Advanced (date window)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
                <Input type="datetime-local" className="h-9 font-mono text-xs" {...form.register("start_date")} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
                <Input type="datetime-local" className="h-9 font-mono text-xs" {...form.register("end_date")} />
                <FieldError name="end_date" form={form} />
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-t">
          <Button
            type="submit"
            size="lg"
            disabled={submit.isPending}
            className="w-full h-11 text-sm font-medium bg-signal text-signal-foreground hover:bg-signal/90"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {submit.isPending ? "Submitting…" : "Queue screen"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function FieldError({ name, form }: { name: keyof FormValues; form: ReturnType<typeof useForm<FormValues>> }) {
  const msg = form.formState.errors[name]?.message as string | undefined;
  if (!msg) return null;
  return <p className="text-xs text-fail">{msg}</p>;
}
