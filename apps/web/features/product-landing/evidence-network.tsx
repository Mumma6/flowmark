import { FlowmarkMark } from "@flowmark/ui"

export function EvidenceNetwork() {
  return (
    <figure
      className="relative flex min-h-80 flex-col justify-center rounded-xl border border-border bg-card p-6 sm:p-10"
      aria-label="Studio, agents and custom tools share authorized process evidence"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,var(--studio-glow),transparent_70%)]"
      />
      <div className="relative mx-auto flex w-fit items-center gap-4 rounded-xl border border-primary/30 bg-background px-6 py-5 shadow-[0_0_40px_-20px_#b9f59770]">
        <FlowmarkMark className="size-8 text-primary" />
        <div>
          <p className="text-sm font-medium">Appointment booking</p>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            MEANING + HISTORY + EVIDENCE
          </p>
        </div>
      </div>
      <svg
        viewBox="0 0 400 70"
        fill="none"
        aria-hidden="true"
        className="relative mx-auto h-16 w-full max-w-sm"
      >
        <path
          d="M200 0V25M65 70V40Q65 25 80 25H320Q335 25 335 40V70M200 25V70"
          className="stroke-highlight/40"
          strokeWidth="1"
        />
        <path
          d="M200 0V25H320Q335 25 335 40V70"
          className="stroke-primary/60 motion-safe:animate-trace"
          pathLength="1"
        />
      </svg>
      <div className="relative grid grid-cols-3 gap-3 text-center">
        {[
          ["Studio", "Your team"],
          ["MCP", "Your agents"],
          ["API", "Your tools"],
        ].map(([title, detail]) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-background/80 px-2 py-4"
          >
            <p className="font-mono text-xs text-primary">{title}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <figcaption className="relative mt-7 text-center text-[10px] text-muted-foreground">
        Shared context. Consistent meaning. Scoped access.
      </figcaption>
    </figure>
  )
}
