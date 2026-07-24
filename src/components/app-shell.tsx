import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/run", label: "Run Screen" },
  { to: "/universes", label: "Universes" },
  { to: "/runs", label: "Past Runs" },
  { to: "/brokers", label: "Brokers" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: api.listBrokers,
    refetchInterval: 30_000,
    retry: 1,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-sidebar/60 backdrop-blur">
        <div className="flex h-11 items-center gap-6 px-4">
          <Link to="/run" className="font-semibold tracking-tight text-sm">
            <span className="text-signal">◆</span> Screener
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <BrokerStrip brokers={brokers ?? []} />
            <Link
              to="/settings"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent/60"
            >
              Settings
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}

function BrokerStrip({ brokers }: { brokers: { name: string; authenticated: boolean }[] }) {
  if (brokers.length === 0)
    return <span className="text-[10px] text-muted-foreground uppercase tracking-wide">no broker data</span>;
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      {brokers.map((b) => (
        <span key={b.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/40">
          <span
            className={cn(
              "size-1.5 rounded-full",
              b.authenticated ? "bg-pass" : "bg-fail",
            )}
            aria-label={b.authenticated ? "authenticated" : "not authenticated"}
          />
          <span className="uppercase tracking-wide text-muted-foreground">{b.name}</span>
        </span>
      ))}
    </div>
  );
}
