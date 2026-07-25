import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "How to Use — Stock Screener" },
      { name: "description", content: "How to run screens, build Custom-mode conditions, and read results." },
      { property: "og:title", content: "How to Use — Stock Screener" },
      { property: "og:description", content: "How to run screens, build Custom-mode conditions, and read results." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">How to Use</h1>
          <p className="text-xs text-muted-foreground">
            What each screen does and how to drive a run end to end. For what each indicator
            actually measures and its default thresholds, see the backend's README
            ("Indicators &amp; Screening Criteria") — this page is scoped to usage only.
          </p>
        </div>

        <Card className="p-0">
          <Accordion type="multiple" defaultValue={["quick-start"]} className="px-4">
            <AccordionItem value="quick-start">
              <AccordionTrigger>Quick workflow</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    On <strong className="text-foreground">Run Screen</strong>, provide a universe —
                    either pick a saved one or switch to "Paste tickers" and type/paste a list.
                  </li>
                  <li>Pick a broker and a mode.</li>
                  <li>
                    Click <strong className="text-foreground">Queue screen</strong>. You're taken
                    straight to that run's page — it submits instantly, the actual screening
                    happens in the background.
                  </li>
                  <li>
                    The run page updates itself automatically as the run moves from
                    <em> queued</em> → <em>running</em> → <em>completed</em>/<em>failed</em> — no
                    need to refresh.
                  </li>
                  <li>Once completed, review the results table and download the Excel export.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="universes">
              <AccordionTrigger>Providing a universe</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>Two ways to give a screen a ticker list, on the Run Screen page itself:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong className="text-foreground">Saved universe</strong> — pick one you've
                    already uploaded on the Universes page.
                  </li>
                  <li>
                    <strong className="text-foreground">Paste tickers</strong> — type or paste a
                    list directly (comma or newline separated) for a one-off run. This still gets
                    saved automatically, so re-running the exact same list later doesn't create a
                    duplicate.
                  </li>
                </ul>
                <p>
                  On the <strong className="text-foreground">Universes</strong> page, upload a CSV
                  (e.g. an NSE index-constituent export) by dragging it in, or paste a ticker list
                  directly with a name. Uploading the same content twice reuses the existing
                  universe instead of creating a new one.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="modes">
              <AccordionTrigger>Choosing a mode</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>
                  The mode dropdown on Run Screen is populated live from the backend, along with a
                  one-line description of what each mode checks for — read that description before
                  running if you're unsure which one to pick. Outperforming and Chandemo need no
                  further configuration; Custom mode reveals an extra builder (see below).
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="custom-mode">
              <AccordionTrigger>Custom mode: building conditions</AccordionTrigger>
              <AccordionContent className="space-y-3 text-muted-foreground">
                <p>
                  Custom mode lets you combine any registered indicator(s) into your own pass/fail
                  rule, instead of using a fixed built-in strategy:
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Click <strong className="text-foreground">Add indicator</strong> to select an
                    indicator and its period — the options here come straight from the backend, so
                    any indicator it supports shows up automatically.
                  </li>
                  <li>
                    In the condition builder, each side of a comparison is either an indicator's
                    output field (e.g. an RSI value) or a{" "}
                    <strong className="text-foreground">constant</strong> — a fixed number you type
                    in directly. Pick "constant" from the dropdown to compare an indicator against
                    a plain threshold (e.g. RSI &gt; 50) instead of another indicator.
                  </li>
                  <li>
                    Choose an operator: <code className="font-mono">&gt;</code>,{" "}
                    <code className="font-mono">&gt;=</code>, <code className="font-mono">&lt;</code>,{" "}
                    <code className="font-mono">&lt;=</code>, <code className="font-mono">==</code>,{" "}
                    or <code className="font-mono">!=</code>.
                  </li>
                  <li>
                    Use <strong className="text-foreground">Group</strong> to combine conditions
                    with AND/OR, and nest groups within groups for more complex rules. A stock
                    passes only if the whole tree evaluates to true.
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="results">
              <AccordionTrigger>Reading results</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong className="text-foreground">Pass/Fail</strong> — the leading column;
                    green means the stock met the mode's criteria.
                  </li>
                  <li>
                    <strong className="text-foreground">Signal badges</strong> (★ New / ★ Exit) —
                    mean the signal just turned on this period, as opposed to having already been
                    true for a while. Worth a second look — these are the freshest opportunities.
                  </li>
                  <li>
                    <strong className="text-foreground">Status</strong> — rows starting with
                    "Error:" mean that specific ticker failed (e.g. a data fetch problem), not that
                    the whole run failed; every other ticker in the run is still valid.
                  </li>
                  <li>
                    Use the ticker filter box and click any column header to sort — group headers
                    (Price/RSI/ATR/etc.) aren't sortable themselves, only the individual fields
                    beneath them are.
                  </li>
                  <li>
                    <strong className="text-foreground">Download Excel</strong> (once completed)
                    gives you the full results plus a ready-to-paste TradingView watchlist string
                    of everything that passed.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="past-runs">
              <AccordionTrigger>Past Runs</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>
                  Every run ever submitted through this backend, most recent first — not just the
                  ones you personally started in this browser. Click a Run ID to reopen its
                  results, re-download its Excel export, or check on one that's still running.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="brokers">
              <AccordionTrigger>Brokers</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>
                  Shows whether each broker (Breeze/Angel/Yahoo) currently has a valid session.
                  Yahoo needs no authentication at all. If Breeze or Angel shows "Not authed," hit{" "}
                  <strong className="text-foreground">Reauth</strong> — if it fails, the error
                  message already tells you the actual fix (e.g. Breeze's session tokens require a
                  manual login roughly every 24 hours; this isn't something the app can do for
                  you).
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="settings">
              <AccordionTrigger>Settings</AccordionTrigger>
              <AccordionContent className="space-y-2 text-muted-foreground">
                <p>
                  Toggle dark/light appearance, and — only if you need to point this app at a
                  different backend or supply an API key — override the backend URL here. Both are
                  stored in this browser only and apply immediately.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>
    </AppShell>
  );
}
