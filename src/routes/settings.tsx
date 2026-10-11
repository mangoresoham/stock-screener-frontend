import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getCurrentTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stock Screener" },
      { name: "description", content: "Appearance settings." },
      { property: "og:title", content: "Settings — Stock Screener" },
      { property: "og:description", content: "Appearance settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(getCurrentTheme());
  }, []);

  const chooseTheme = (t: Theme) => {
    setTheme(t); // applies the .light class immediately, no reload needed
    setThemeState(t);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

        </div>

        <Card className="p-4 space-y-3">
          <Label id="theme-label" className="text-xs uppercase tracking-wide text-muted-foreground">Appearance</Label>
          <div role="group" aria-labelledby="theme-label" className="flex gap-2 text-xs">
            {(
              [
                { value: "dark" as const, label: "Dark", icon: Moon },
                { value: "light" as const, label: "Light", icon: Sun },
              ]
            ).map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                aria-pressed={theme === value}
                onClick={() => chooseTheme(value)}
                className={cn(
                  "flex h-9 items-center gap-1.5 px-3 rounded border font-mono sm:h-8",
                  theme === value
                    ? "border-signal bg-signal/15 text-signal"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Applies immediately, stored in this browser only.
          </p>
        </Card>

      </div>
    </AppShell>
  );
}
