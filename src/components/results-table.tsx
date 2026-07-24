import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ResultRow, ScreenMode } from "@/lib/api";
import { fmtCell, fmtNumber } from "@/lib/format";
import { CrossoverBadge, PassFailBadge } from "./status-badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Group {
  header: string;
  fields: { key: string; label: string; kind?: "number" | "bool" | "text"; digits?: number }[];
}

const outperformingGroups: Group[] = [
  { header: "Price", fields: [{ key: "Latest_Close", label: "Close", kind: "number" }] },
  {
    header: "RSI",
    fields: [
      { key: "Stock_RSI", label: "Stock", kind: "number" },
      { key: "Nifty_RSI", label: "Nifty", kind: "number" },
      { key: "RSI_Passed", label: "✓", kind: "bool" },
    ],
  },
  {
    header: "ATR",
    fields: [
      { key: "ATR_Pct", label: "%", kind: "number" },
      { key: "ATR_Passed", label: "✓", kind: "bool" },
    ],
  },
  {
    header: "Comparative RS",
    fields: [
      { key: "Comparative_RS", label: "CRS", kind: "number" },
      { key: "Comparative_RS_Passed", label: "✓", kind: "bool" },
    ],
  },
];

const chandemoGroups: Group[] = [
  { header: "Price", fields: [{ key: "Latest_Close", label: "Close", kind: "number" }] },
  {
    header: "CMO",
    fields: [
      { key: "Monthly_CMO", label: "Monthly", kind: "number" },
      { key: "Weekly_CMO", label: "Weekly", kind: "number" },
    ],
  },
  {
    header: "Flags",
    fields: [
      { key: "Watch", label: "Watch", kind: "bool" },
      { key: "Buy", label: "Buy", kind: "bool" },
      { key: "Exit", label: "Exit", kind: "bool" },
    ],
  },
];

function buildGroups(mode: ScreenMode, rows: ResultRow[]): Group[] {
  if (mode === "outperforming") return outperformingGroups;
  if (mode === "chandemo") return chandemoGroups;
  // custom: derive from row keys, skip known control columns
  const skip = new Set(["Ticker", "Status", "Passed", "Crossover", "Exit_Crossover"]);
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) if (!skip.has(k)) keys.add(k);
  // group by indicator prefix (Indicator_field)
  const byIndicator = new Map<string, string[]>();
  for (const k of keys) {
    const idx = k.indexOf("_");
    const ind = idx > 0 ? k.slice(0, idx) : k;
    if (!byIndicator.has(ind)) byIndicator.set(ind, []);
    byIndicator.get(ind)!.push(k);
  }
  return [...byIndicator.entries()].map(([ind, fields]) => ({
    header: ind,
    fields: fields.map((k) => ({ key: k, label: k.slice(ind.length + 1) || k, kind: "number" as const })),
  }));
}

export function ResultsTable({ rows, mode }: { rows: ResultRow[]; mode: ScreenMode }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "Passed", desc: true }]);
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => buildGroups(mode, rows), [mode, rows]);

  const columns = useMemo<ColumnDef<ResultRow>[]>(() => {
    const cols: ColumnDef<ResultRow>[] = [
      {
        id: "Passed",
        accessorFn: (r) => (r.Status?.toString().startsWith("Error") ? -1 : r.Passed ? 1 : 0),
        header: "Pass",
        cell: ({ row }) => {
          const r = row.original;
          const err = r.Status?.toString().startsWith("Error");
          if (err) {
            return (
              <span className="inline-flex rounded border border-fail/30 bg-fail/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-fail">
                Err
              </span>
            );
          }
          return <PassFailBadge passed={Boolean(r.Passed)} />;
        },
        size: 60,
      },
      {
        id: "Ticker",
        accessorKey: "Ticker",
        header: "Ticker",
        cell: ({ row }) => (
          <span className="font-mono font-medium">{String(row.original.Ticker ?? "")}</span>
        ),
      },
      {
        id: "Signal",
        header: "Signal",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-1">
              {r.Crossover ? <CrossoverBadge kind="buy" /> : null}
              {r.Exit_Crossover ? <CrossoverBadge kind="exit" /> : null}
            </div>
          );
        },
      },
    ];
    for (const g of groups) {
      cols.push({
        id: `group-${g.header}`,
        header: g.header,
        columns: g.fields.map((f) => ({
          id: f.key,
          accessorKey: f.key,
          header: f.label,
          cell: ({ getValue }) => {
            const v = getValue();
            if (f.kind === "bool") {
              if (v === true) return <span className="text-pass font-mono">✓</span>;
              if (v === false) return <span className="text-fail/70 font-mono">✗</span>;
              return <span className="text-muted-foreground">—</span>;
            }
            if (f.kind === "number") return <span className="tabular font-mono">{fmtNumber(v, { digits: f.digits ?? 2 })}</span>;
            return <span>{fmtCell(v)}</span>;
          },
        })),
      });
    }
    cols.push({
      id: "Status",
      accessorKey: "Status",
      header: "Status",
      cell: ({ getValue }) => {
        const v = String(getValue() ?? "");
        const err = v.startsWith("Error");
        return (
          <span className={cn("text-xs", err ? "text-fail" : "text-muted-foreground")}>{v || "—"}</span>
        );
      },
    });
    return cols;
  }, [groups]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, value) => {
      const v = String(value ?? "").toLowerCase();
      if (!v) return true;
      return String(row.original.Ticker ?? "").toLowerCase().includes(v);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter ticker…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 max-w-xs font-mono text-xs"
        />
        <span className="text-xs text-muted-foreground tabular">
          {table.getRowModel().rows.length} rows
        </span>
      </div>
      <div className="overflow-auto rounded border max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      colSpan={h.colSpan}
                      className={cn(
                        "px-2 py-1.5 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap border-r last:border-r-0",
                        canSort && "cursor-pointer select-none hover:text-foreground",
                      )}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort ? (
                          sort === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : sort === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isErr = String(row.original.Status ?? "").startsWith("Error");
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b hover:bg-accent/40 transition-colors",
                    isErr && "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2 py-1 whitespace-nowrap border-r last:border-r-0"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-muted-foreground text-xs">
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
