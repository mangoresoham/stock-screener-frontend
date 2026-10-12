import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/** Global stock search: a header trigger (a search box, or an icon when `compact`) plus
 *  Ctrl/⌘+K from anywhere. Results come from the backend, which ranks symbol-prefix
 *  matches first, so cmdk's own client-side filtering is switched off. */
export function StockSearch({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    // Only the full-size instance owns the shortcut, so the compact (mobile) one rendered
    // alongside it doesn't toggle a second dialog.
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  const hits = useQuery({
    queryKey: ["instrument-search", debounced],
    queryFn: () => api.searchInstruments(debounced),
    enabled: open && debounced.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const rows = debounced ? (hits.data ?? []) : [];

  const go = (symbol: string) => {
    setOpen(false);
    setQ("");
    void navigate({ to: "/stocks/$symbol", params: { symbol } });
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          aria-label="Search stocks"
          onClick={() => setOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <Search className="size-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-56 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-xs text-muted-foreground hover:text-foreground lg:w-64"
        >
          <Search aria-hidden className="size-3.5" />
          <span className="flex-1 text-left">Search stocks…</span>
          <kbd className="rounded border px-1 font-mono text-[10px]">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Search stocks</DialogTitle>
          <Command shouldFilter={false} className="[&_[cmdk-input]]:h-12">
            <CommandInput value={q} onValueChange={setQ} placeholder="Symbol, e.g. RELIANCE" />
            <CommandList className="max-h-[min(360px,50dvh)]">
              {debounced && !hits.isFetching && rows.length === 0 && <CommandEmpty>No matching stock.</CommandEmpty>}
              {!debounced && <div className="px-3 py-6 text-center text-xs text-muted-foreground">Type a symbol to search.</div>}
              {rows.length > 0 && (
                <CommandGroup heading="Stocks">
                  {rows.map((h) => (
                    <CommandItem key={h.symbol} value={h.symbol} onSelect={() => go(h.symbol)} className="gap-3">
                      <span className="font-mono font-medium">{h.symbol}</span>
                      {h.name && <span className="truncate text-xs text-muted-foreground">{h.name}</span>}
                      <span
                        className={cn(
                          "ml-auto shrink-0 text-[11px]",
                          h.last_bar_date ? "text-muted-foreground" : "text-warn",
                        )}
                      >
                        {h.last_bar_date ? `data to ${fmtDay(h.last_bar_date)}` : "no price data yet"}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
