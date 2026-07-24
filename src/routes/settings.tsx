import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { defaults, getApiBaseUrl, getApiKey, setApiBaseUrl, setApiKey } from "@/lib/config";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stock Screener" },
      { name: "description", content: "Configure the backend API URL and API key." },
      { property: "og:title", content: "Settings — Stock Screener" },
      { property: "og:description", content: "Configure the backend API URL and API key." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");

  useEffect(() => {
    setBase(getApiBaseUrl());
    setKey(getApiKey());
  }, []);

  const save = () => {
    setApiBaseUrl(base.trim());
    setApiKey(key);
    toast.success("Saved");
    // Force queries to refetch against new config.
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Overrides are stored in this browser's localStorage. Build-time defaults come from
            <code className="font-mono text-[11px] mx-1">VITE_API_BASE_URL</code> and
            <code className="font-mono text-[11px] mx-1">VITE_API_KEY</code>.
          </p>
        </div>

        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Backend URL</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} className="font-mono text-xs" placeholder="http://127.0.0.1:8000" />
            <p className="text-[11px] text-muted-foreground">
              Default: <span className="font-mono">{defaults.envBase}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">API Key (X-API-Key)</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} type="password" className="font-mono text-xs" placeholder="optional" />
            <p className="text-[11px] text-muted-foreground">
              Sent unconditionally. Harmless if backend has no key configured.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button
              variant="outline"
              onClick={() => {
                setApiBaseUrl("");
                setApiKey("");
                setBase(defaults.envBase);
                setKey(defaults.envKey);
                toast.success("Reset to defaults");
                setTimeout(() => window.location.reload(), 300);
              }}
            >
              Reset
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
