import { Badge, Card, CardContent, FlowmarkLockup } from "@flowmark/ui"
import { overlineClassName } from "./layout"

const results = [
  { label: "Processed", value: "5", detail: "checkouts" },
  { label: "Succeeded", value: "3", detail: "paid and shipped" },
  { label: "Failed", value: "2", detail: "shipment missing" },
  { label: "Handled", value: "2", detail: "recorded errors" },
]

const timeline = [
  { event: "payment-captured", kind: "start", status: "5 orders" },
  { event: "shipment-failed", kind: "error", status: "2 handled" },
  { event: "create-shipment", kind: "operation", status: "measured" },
  { event: "checkout-finished", kind: "done", status: "Partial" },
] as const

const markerClassName = {
  start: "border-[#90b77a]/60 bg-[#111a15]",
  error: "border-[#e8bf6b] bg-[#e8bf6b]",
  operation: "border-[#8db8ff] bg-[#8db8ff]",
  done: "border-primary bg-primary shadow-[0_0_10px_#b9f59735]",
} as const

const statusClassName = {
  start: "text-[#89998e]",
  error: "text-[#e8bf6b]",
  operation: "text-[#89998e]",
  done: "text-primary",
} as const

export function DashboardIllustration() {
  return (
    <Card
      className="relative z-10 animate-dashboard overflow-hidden rounded-[10px] border-primary/20 bg-linear-to-br from-[#131a19] to-[#0c1113] shadow-[0_32px_100px_#00000070] motion-reduce:animate-none"
      role="group"
      aria-label="Illustrative Flowmark dashboard"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border bg-white/[0.02] px-3 sm:min-h-[53px] sm:px-5">
        <div className="flex items-center gap-2 text-[10px] font-medium text-[#d5ddd8]">
          <FlowmarkLockup className="size-5 rounded" aria-hidden="true" />
          <span>Flowmark</span>
          <span className="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />
          <span className="max-w-[92px] truncate font-normal text-[#9ca9a2] sm:max-w-none">
            Investigation
          </span>
        </div>
        <span className="font-mono text-[7px] tracking-widest text-[#9aaa9c] sm:text-[8px]">
          EXAMPLE
        </span>
      </div>

      <CardContent className="p-3 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`${overlineClassName} text-[8px] tracking-[0.13em]`}>
              One execution · reported outcome
            </p>
            <h2 className="mt-1 text-lg font-medium tracking-tight sm:text-[19px]">
              Checkout
            </h2>
          </div>
          <Badge
            variant="outline"
            className="border-[#e8bf6b]/30 text-[9px] text-[#efd08d]"
          >
            <span className="size-1.5 rounded-full bg-[#e8bf6b] shadow-[0_0_10px_#e8bf6b40]" />
            Completed · partial
          </Badge>
        </div>

        <div
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Application-reported result"
        >
          {results.map((result) => (
            <article
              className="flex min-h-[82px] min-w-0 flex-col rounded-md border border-white/10 bg-linear-to-br from-white/5 to-white/0 p-2.5 sm:min-h-[102px] sm:p-3"
              key={result.label}
            >
              <span className="truncate text-[9px] text-[#aab6ae]">
                {result.label}
              </span>
              <strong className="mt-2 text-[19px] font-normal leading-none text-[#e4ede5] sm:text-[22px]">
                {result.value}
              </strong>
              <small className="mt-auto pt-2 text-[8px] text-[#87958d]">
                {result.detail}
              </small>
            </article>
          ))}
        </div>

        <div className="mt-2.5 grid gap-2 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="min-w-0 rounded-md border border-white/10 bg-white/[0.02] p-3.5"
            aria-labelledby="outcome-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="outcome-title" className="text-[11px] text-[#dce5df]">
                  What happened
                </h3>
                <p className="mt-1 text-[8px] text-[#8e9c94]">
                  Evidence in this execution
                </p>
              </div>
              <span className="rounded border border-white/15 px-1.5 py-1 font-mono text-[8px] text-[#a7bba2]">
                order · sample-001
              </span>
            </div>
            <div className="mt-4 grid gap-3.5">
              <div className="flex items-start gap-2.5">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded bg-primary/15 text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  +
                </span>
                <span className="grid gap-1">
                  <strong className="text-[10px] font-medium text-[#dce5de]">
                    3 payments captured
                  </strong>
                  <small className="text-[8px] leading-normal text-[#98a69d]">
                    Business step reported by the application
                  </small>
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded bg-[#e8bf6b]/15 text-xs font-bold text-[#e8bf6b]"
                  aria-hidden="true"
                >
                  !
                </span>
                <span className="grid gap-1">
                  <strong className="text-[10px] font-medium text-[#dce5de]">
                    2 shipments missing
                  </strong>
                  <small className="text-[8px] leading-normal text-[#98a69d]">
                    Errors were recorded as handled
                  </small>
                </span>
              </div>
              <div className="flex items-start gap-1.5 border-t border-white/10 pt-2.5 text-[8px] leading-normal text-[#8e9c94]">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_#b9f59740]" />
                Reported by your application—not independently verified
              </div>
            </div>
          </section>

          <section
            className="min-w-0 rounded-md border border-white/10 bg-white/[0.02] p-3.5"
            aria-labelledby="timeline-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="timeline-title" className="text-[11px] text-[#dce5df]">
                  Timeline
                </h3>
                <p className="mt-1 text-[8px] text-[#8e9c94]">
                  Steps, errors, operation, outcome
                </p>
              </div>
              <span className="rounded border border-white/15 px-1.5 py-1 font-mono text-[8px] text-[#a7bba2]">
                checkout.order
              </span>
            </div>
            <ol className="relative my-4 grid gap-0 p-0">
              <span
                className="absolute top-2 bottom-2 left-[5px] w-px bg-primary/30"
                aria-hidden="true"
              />
              {timeline.map((item) => (
                <li
                  className="relative grid min-h-8 grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2"
                  key={item.event}
                >
                  <span
                    className={`relative z-10 size-[11px] rounded-full border ${markerClassName[item.kind]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate font-mono text-[8px] text-[#d2ddd4]">
                    {item.event}
                  </span>
                  <span
                    className={`font-mono text-[7px] whitespace-nowrap ${statusClassName[item.kind]}`}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t border-white/10 pt-2 text-[8px] leading-normal text-[#849187]">
              Static illustration · synthetic example data
            </p>
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
