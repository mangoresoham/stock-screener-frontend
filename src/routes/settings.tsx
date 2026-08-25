import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { defaults, getApiBaseUrl, getApiKey, setApiBaseUrl, setApiKey } from "@/lib/config";
import { getCurrentTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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
  const [theme, setThemeState] = useState<Theme>("dark");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setBase(getApiBaseUrl());
    const initialKey = getApiKey();
    setKey(initialKey);
    setThemeState(getCurrentTheme());
    // Auto-expand if a key is already set, so it never reads as "did that not save?" on
    // a later visit to this page.
    if (initialKey) setShowAdvanced(true);
  }, []);

  const chooseTheme = (t: Theme) => {
    setTheme(t); // applies the .light class immediately, no reload needed
    setThemeState(t);
  };

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
            <code className="font-mono text-xs mx-1">VITE_API_BASE_URL</code> and
            <code className="font-mono text-xs mx-1">VITE_API_KEY</code>.
          </p>
        </div>

        <Card className="p-4 space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Appearance</Label>
          <div className="flex gap-2 text-xs">
            {(
              [
                { value: "dark" as const, label: "Dark", icon: Moon },
                { value: "light" as const, label: "Light", icon: Sun },
              ]
            ).map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => chooseTheme(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded border font-mono",
                  theme === value
                    ? "border-signal bg-signal/15 text-signal"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Applies immediately, stored in this browser only.
          </p>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Backend URL</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} className="font-mono text-xs" placeholder="http://127.0.0.1:8000" />
            <p className="text-xs text-muted-foreground">
              Default: <span className="font-mono">{defaults.envBase}</span>
            </p>
          </div>

          <div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide" : "Show"} advanced
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">API Key (X-API-Key)</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} type="password" className="font-mono text-xs" placeholder="optional" />
              <p className="text-xs text-muted-foreground">
                Only needed for non-browser access (CLI/scripts) or to point this browser at a
                differently-keyed backend — being logged in already authenticates the app itself.
                Sent unconditionally when set; harmless if the backend has no key configured.
              </p>
            </div>
          )}

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
