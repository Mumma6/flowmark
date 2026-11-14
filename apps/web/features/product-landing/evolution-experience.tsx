"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flowmark/ui"

const checks = [
  ["Accepted booking", "Outcome and reference persisted"],
  ["Provider rejection", "Negative result preserved"],
  ["Delayed confirmation", "Independent expectation retained"],
  ["Application exception", "Original error preserved"],
] as const

export function EvolutionExperience() {
  return (
    <div className="overflow-hidden rounded-xl border border-highlight/25 bg-card shadow-[0_20px_80px_-40px_#b7a3ff30]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <span className="font-mono text-[10px] text-muted-foreground">
          booking-service / change review
        </span>
        <span className="rounded-full bg-highlight/10 px-2.5 py-1 text-[9px] text-highlight">
          Process-aware
        </span>
      </div>
      <Tabs defaultValue="change" className="gap-0">
        <TabsList
          aria-label="Explore continuous verification"
          variant="line"
          className="w-full justify-start gap-0 border-b border-border px-1 py-0 sm:gap-4 sm:px-5"
        >
          <TabsTrigger
            value="change"
            className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-[10px] whitespace-normal after:bottom-0 sm:h-12 sm:flex-row sm:gap-1 sm:px-2"
          >
            <span className="font-mono text-[9px] text-muted-foreground">
              01
            </span>{" "}
            Detect change
          </TabsTrigger>
          <TabsTrigger
            value="proposal"
            className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-[10px] whitespace-normal after:bottom-0 sm:h-12 sm:flex-row sm:gap-1 sm:px-2"
          >
            <span className="font-mono text-[9px] text-muted-foreground">
              02
            </span>{" "}
            Review patch
          </TabsTrigger>
          <TabsTrigger
            value="verify"
            className="h-14 min-w-0 flex-1 flex-col gap-0.5 px-1 text-[10px] whitespace-normal after:bottom-0 sm:h-12 sm:flex-row sm:gap-1 sm:px-2"
          >
            <span className="font-mono text-[9px] text-muted-foreground">
              03
            </span>{" "}
            Verify evidence
          </TabsTrigger>
        </TabsList>
        <TabsContent value="change" className="min-h-[340px] p-5 sm:p-7">
          <p className="text-xs text-warning">Instrumentation drift detected</p>
          <h3 className="mt-5 text-xl leading-snug font-medium tracking-tight">
            The callback moved.
            <br />
            Your process meaning shouldn’t.
          </h3>
          <div className="mt-6 rounded-lg border border-border bg-background/60 p-4 font-mono text-[11px] leading-7">
            <p className="break-all text-muted-foreground">
              webhooks/confirmation.ts
            </p>
            <p className="my-1 text-highlight" aria-hidden="true">
              ↓
            </p>
            <p className="break-all text-foreground">
              events/booking-confirmed.ts
            </p>
          </div>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            The new handler no longer records the confirmation. Flowmark
            connects the changed code to the expectation it affects.
          </p>
        </TabsContent>
        <TabsContent value="proposal" className="min-h-[340px] p-5 sm:p-7">
          <p className="text-xs text-highlight">
            Agent-prepared · ready for review
          </p>
          <h3 className="mt-5 text-xl font-medium tracking-tight">
            A small patch. Meaning preserved.
          </h3>
          <pre
            tabIndex={0}
            aria-label="Illustrative confirmation instrumentation patch"
            className="mt-6 overflow-x-auto rounded-lg border border-border bg-background/70 p-4 font-mono text-[11px] leading-7"
          >
            <code>
              <span className="text-muted-foreground">
                {"  await persistConfirmation(event)\n"}
              </span>
              <span className="text-primary">
                {
                  "+ flowmark.resolveExpectation(\n+   event.confirmationReference\n+ )"
                }
              </span>
            </code>
          </pre>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            Restore the existing expectation reference in the new handler.
            Review the patch in your development environment; your team owns the
            change.
          </p>
        </TabsContent>
        <TabsContent value="verify" className="min-h-[340px] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-success">Evidence checks passed</p>
            <span className="font-mono text-[9px] text-muted-foreground">
              LOCAL FIXTURE · 4/4
            </span>
          </div>
          <ul className="mt-5 divide-y divide-border">
            {checks.map(([label, detail]) => (
              <li key={label} className="flex gap-3 py-3">
                <span aria-hidden="true" className="text-success">
                  ✓
                </span>
                <div>
                  <p className="text-xs">{label}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
            Illustrative local verification record. Deployed behavior is
            assessed separately from observed evidence.
          </p>
        </TabsContent>
      </Tabs>
      <div className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">
        Synthetic change review · no repository is connected
      </div>
    </div>
  )
}
