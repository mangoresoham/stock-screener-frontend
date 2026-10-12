import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { api, type Broker } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AUTH_DOT_CLASS, brokerAuthState, brokerStatusText } from "@/lib/broker-status";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { StockSearch } from "@/components/stock-search";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/run", label: "Run Screen" },
  { to: "/universes", label: "Universes" },
  { to: "/runs", label: "Past Runs" },
  { to: "/brokers", label: "Brokers" },
  { to: "/help", label: "How to Use" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, refresh } = useAuth();

  // Every page that renders <AppShell> is a protected page (/run, /runs, /universes,
  // /brokers) -- this one check gates all of them uniformly instead of repeating a guard
  // in each route. The landing page and auth pages (/login, /forgot-password,
  // /reset-password) render their own chrome-less layout and never reach here.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: api.listBrokers,
    refetchInterval: 30_000,
    retry: 1,
    // No point hitting a protected endpoint before the session check has even resolved --
    // it would just 401 and retry pointlessly while the redirect above is about to fire.
    enabled: isAuthenticated,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      // Always clears local auth state and redirects, even if the network call itself
      // failed (e.g. session already expired server-side) -- "log me out" should never
      // leave the UI stuck showing protected content.
      await refresh();
      navigate({ to: "/login" });
    }
  };

  if (isLoading || !isAuthenticated) {
    // Covers both the brief real loading state and the moment right before the redirect
    // above fires -- never flashes real app chrome/data to an unauthenticated visitor.
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div role="status" className="text-xs text-muted-foreground">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-sidebar/80 backdrop-blur">
        <div className="flex h-11 items-center gap-3 px-3 sm:gap-6 sm:px-4">
          <Link to="/dashboard" className="font-semibold tracking-tight text-sm shrink-0">
            <span className="text-signal">◆</span> Screener
          </Link>

          {/* Full nav -- desktop/tablet only. Below md, everything (links, broker
              status, settings) lives in the hamburger sheet instead, since there's no
              room to lay 5 links + broker pills + a settings link out horizontally on
              a phone-width screen without either overflowing or shrinking to
              unreadable/untappable sizes. */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-1 text-xs">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors",
                  isActive(item.to)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden md:flex items-center gap-3">
            <StockSearch />
            <BrokerStrip brokers={brokers ?? []} />
            <Link
              to="/settings"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent/60"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent/60"
            >
              <LogOut className="size-3" />
              Log out
            </button>
          </div>

          {/* Compact broker dots + hamburger -- mobile/small-tablet only. */}
          <div className="ml-auto flex md:hidden items-center gap-1">
            <BrokerStrip brokers={brokers ?? []} compact />
            <StockSearch compact />
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="-mr-2 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-[80vw] max-w-xs p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle className="text-sm font-semibold tracking-tight">
              <span className="text-signal">◆</span> Screener
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="Main" className="flex flex-col px-2 text-sm">
            {nav.map((item) => (
              <SheetClose asChild key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "px-3 py-2.5 rounded-md transition-colors",
                    isActive(item.to)
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  )}
                >
                  {item.label}
                </Link>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Link
                to="/settings"
                className={cn(
                  "px-3 py-2.5 rounded-md transition-colors",
                  isActive("/settings")
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                Settings
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-md text-left text-muted-foreground hover:text-foreground hover:bg-accent/60"
              >
                <LogOut className="size-3.5" />
                Log out
              </button>
            </SheetClose>
          </nav>
          <div className="mt-auto border-t px-4 py-3 pb-safe">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Brokers</div>
            <BrokerStrip brokers={brokers ?? []} stacked />
          </div>
        </SheetContent>
      </Sheet>

      <main id="main" tabIndex={-1} className="flex-1 min-h-0 focus:outline-none">
        {children}
      </main>
    </div>
  );
}

function BrokerStrip({
  brokers,
  compact,
  stacked,
}: {
  brokers: Broker[];
  /** Header, mobile: dots only, no labels/pills -- there's no room for text next to
      the hamburger button. Still readable via aria-label + native title tooltip. */
  compact?: boolean;
  /** Inside the mobile nav sheet: full-width rows instead of an inline pill strip. */
  stacked?: boolean;
}) {
  if (brokers.length === 0)
    return (
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {compact ? "—" : "no broker data"}
      </span>
    );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {brokers.map((b) => (
          <span
            key={b.name}
            role="img"
            title={brokerStatusText(b)}
            className={cn("size-2 rounded-full", AUTH_DOT_CLASS[brokerAuthState(b)])}
            aria-label={brokerStatusText(b)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex text-xs", stacked ? "flex-col gap-1" : "items-center gap-2")}>
      {brokers.map((b) => (
        <span
          key={b.name}
          title={brokerStatusText(b)}
          className={cn(
            "flex items-center gap-1.5 rounded bg-accent/40",
            stacked ? "px-2 py-1.5" : "px-2 py-0.5",
          )}
        >
          <span
            role="img"
            className={cn("size-1.5 rounded-full", AUTH_DOT_CLASS[brokerAuthState(b)])}
            aria-label={brokerStatusText(b)}
          />
          <span className="uppercase tracking-wide text-muted-foreground">{b.name}</span>
        </span>
      ))}
    </div>
  );
}
