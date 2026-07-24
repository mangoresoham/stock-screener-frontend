import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/universes")({
  head: () => ({
    meta: [
      { title: "Universes — Stock Screener" },
      { name: "description", content: "Manage saved ticker universes for screening." },
      { property: "og:title", content: "Universes — Stock Screener" },
      { property: "og:description", content: "Manage saved ticker universes for screening." },
    ],
  }),
  component: UniversesPage,
});

function UniversesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["universes"], queryFn: api.listUniverses });

  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["universes"] });

  const createPaste = useMutation({
    mutationFn: async () => {
      const tickers = raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      if (!name.trim()) throw new Error("Name required");
      if (tickers.length === 0) throw new Error("At least one ticker");
      return api.createUniverse({ name: name.trim(), tickers });
    },
    onSuccess: (u) => {
      toast.success("Universe created", { description: `${u.name} · ${u.member_count} tickers` });
      setRaw("");
      setName("");
      invalidate();
    },
    onError: (e) => toast.error("Create failed", { description: e instanceof ApiError ? e.detail : (e as Error).message }),
  });

  const uploadCsv = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick a CSV file");
      return api.uploadUniverseCsv(file, name.trim() || undefined);
    },
    onSuccess: (u) => {
      toast.success("Uploaded", { description: `${u.name} · ${u.member_count} tickers` });
      setFile(null);
      setName("");
      invalidate();
    },
    onError: (e) => toast.error("Upload failed", { description: e instanceof ApiError ? e.detail : (e as Error).message }),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <h1 className="text-lg font-semibold tracking-tight">Universes</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Upload CSV</div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              className={`rounded border-2 border-dashed p-6 text-center text-xs transition-colors ${
                dragOver ? "border-signal bg-signal/10" : "border-border text-muted-foreground"
              }`}
            >
              <Upload className="mx-auto mb-2 size-5" />
              {file ? (
                <div className="font-mono">{file.name}</div>
              ) : (
                <div>
                  Drop CSV here, or{" "}
                  <label className="cursor-pointer text-signal underline">
                    browse
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}
            </div>
            <Input placeholder="Name (optional — inferred from file)" value={name} onChange={(e) => setName(e.target.value)} className="h-9 font-mono text-xs" />
            <Button disabled={!file || uploadCsv.isPending} onClick={() => uploadCsv.mutate()} className="w-full">
              {uploadCsv.isPending ? "Uploading…" : "Upload"}
            </Button>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Paste tickers</div>
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 font-mono text-xs" />
            <Textarea
              placeholder="RELIANCE, TCS, INFY, HDFCBANK…"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono text-xs min-h-28"
            />
            <Button disabled={createPaste.isPending} onClick={() => createPaste.mutate()} className="w-full">
              {createPaste.isPending ? "Saving…" : "Save universe"}
            </Button>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="border-b px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            Saved universes
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Name</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Members</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Created</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Hash</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {q.error && (
                <tr><td colSpan={4} className="p-6 text-center text-fail">{(q.error as Error).message}</td></tr>
              )}
              {(q.data ?? []).map((u) => (
                <tr key={String(u.id)} className="border-t hover:bg-accent/40">
                  <td className="px-3 py-1.5 font-mono">{u.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular">{u.member_count}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{fmtDateTime(u.created_at)}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground truncate max-w-40">{u.content_hash?.slice(0, 12)}</td>
                </tr>
              ))}
              {q.data?.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No universes yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
