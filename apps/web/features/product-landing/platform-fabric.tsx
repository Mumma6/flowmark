import { FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { docsUrl } from "../../app/components/site-links"

export function PlatformFabric() {
  return (
    <figure className="relative isolate mb-12 overflow-hidden rounded-xl border border-primary/20 bg-card shadow-[0_24px_80px_-32px_#000]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,#b9f59712,transparent_65%)]"
      />
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <span className="flex items-center gap-2 text-xs">
          <FlowmarkMark className="size-4 text-primary" />
          Flowmark Platform
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Capture → Connect → Understand
        </span>
      </figcaption>
      <div className="relative grid items-center gap-9 p-5 sm:p-8 lg:grid-cols-[1fr_1.15fr_1fr] lg:gap-14 lg:p-10">
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 260"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 hidden h-full w-full text-primary lg:block"
          fill="none"
        >
          <path
            d="M235 130H500M500 130C645 130 645 70 780 70M500 130H780M500 130C645 130 645 190 780 190"
            stroke="currentColor"
            strokeOpacity="0.18"
          />
          <circle
            cx="500"
            cy="130"
            r="5"
            fill="currentColor"
            fillOpacity="0.3"
          />
        </svg>
        <div className="relative min-w-0">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="mr-2 text-primary">01</span>Your application
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-background/90">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 text-[10px]">
              <span className="font-mono">appointment.book</span>
              <span className="text-primary">SDK</span>
            </div>
            <dl className="space-y-4 p-4 text-[10px]">
              {[
                ["Execution", "SYN-BOOK-RECENT"],
                ["Context", "Cedar Health · Orbit"],
                ["Reported result", "accepted: true"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1.5 break-words font-mono text-foreground/90">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
            Your code owns the work.
            <br />
            The SDK records the evidence.
          </p>
        </div>
        <div className="relative min-w-0 py-3 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-2xl border border-primary/10 bg-primary/[0.02] rotate-[-5deg]"
          />
          <div className="relative rounded-xl border border-primary/25 bg-background px-4 py-7 shadow-[0_0_50px_-16px_#b9f59730]">
            <div className="mx-auto grid size-14 place-items-center rounded-xl border border-primary/30 bg-primary/10 shadow-[0_0_24px_-8px_#b9f59760]">
              <FlowmarkMark className="size-7 text-primary" />
            </div>
            <h3 className="mt-5 text-lg font-medium tracking-tight">
              Process intelligence
            </h3>
            <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
              Evidence with meaning.
              <br />
              Context that stays connected.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-1.5 text-[9px] text-primary/90">
              {["Outcomes", "Relationships", "Expectations", "History"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded border border-primary/15 bg-primary/5 px-2 py-1"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="relative min-w-0">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="mr-2 text-primary">02</span>Every context
          </p>
          <div className="space-y-3">
            {[
              {
                name: "Studio",
                detail: "People explore and investigate",
                href: "#studio",
                mark: "01",
              },
              {
                name: "Agents & MCP",
                detail: "Structured context for your agent",
                href: "#everywhere",
                mark: "02",
              },
              {
                name: "API & your tools",
                detail: "Build on the same intelligence",
                href: docsUrl,
                mark: "03",
              },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="group flex items-center gap-3 rounded-lg border border-border bg-background/90 p-4 transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:border-primary"
              >
                <span className="font-mono text-[9px] text-primary/70">
                  {item.mark}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{item.name}</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
                <span className="ml-auto shrink-0 text-muted-foreground transition-colors group-hover:text-primary">
                  <Arrow diagonal />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-border px-5 py-3 text-[9px] text-muted-foreground sm:px-7">
        <span>One evidence model. Shared analysis. Project-scoped access.</span>
        <span>Illustrative view · synthetic Meridian Health context</span>
      </div>
    </figure>
  )
}
