import { Button, FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { docsUrl } from "../../app/components/site-links"
import { investigations } from "./evidence"

export function AgentExperience() {
  const example = investigations[0]!
  return (
    <figure
      aria-label="Illustrative agent conversation"
      className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-[0_24px_80px_-24px_#000,0_0_70px_-40px_#b9f59750]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-[linear-gradient(110deg,#b9f59710,transparent_70%)] px-5 py-4">
        <div className="flex items-center gap-2 text-xs">
          <FlowmarkMark className="size-4 text-primary" />
          Connect your agent
        </div>
        <span className="rounded border border-highlight/25 bg-highlight/10 px-2 py-1 font-mono text-[9px] text-highlight">
          MCP
        </span>
      </div>
      <div className="p-5 sm:p-7">
        <p className="text-[11px] leading-6 text-muted-foreground">
          Codex · Cursor · Claude Code · Your MCP client
        </p>
        <div className="mt-5 rounded-lg border border-border bg-background/70 p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            You
          </p>
          <p className="text-xs leading-7 text-foreground/90">
            What happened to Cedar Health’s booking? Follow the related runs and
            show me what the evidence says.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-primary/15 bg-[linear-gradient(135deg,#b9f59708,transparent)] p-4">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="flex items-center gap-2">
              <FlowmarkMark className="size-3.5 text-primary" />
              Process evidence
            </span>
            <code className="text-primary/80">get_run</code>
          </div>
          <p className="mt-4 font-mono text-[11px]">
            {example.snapshot.workflow}
          </p>
          <p className="mt-1.5 break-all text-[9px] text-muted-foreground">
            {example.reference} · {example.customer}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-3 text-[10px]">
            <div>
              <dt className="text-muted-foreground">Execution</dt>
              <dd className="mt-1.5 text-success">Completed · 1.8 s</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confirmation</dt>
              <dd className="mt-1.5 text-warning">Not recorded</dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 border-l border-highlight/40 pl-4 text-xs leading-7 text-muted-foreground">
          The booking was accepted. Its separate confirmation isn’t recorded.
          That alone doesn’t establish a provider failure.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[9px] text-muted-foreground">
          {[
            "Project-scoped",
            "Read-only evidence",
            "Explicit authorization",
          ].map((label) => (
            <span
              key={label}
              className="rounded border border-border px-2 py-1"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
          Illustrative agent interaction · synthetic Meridian Health context
        </p>
        <Button asChild variant="link" className="mt-3 h-11 px-0 text-xs">
          <a href={docsUrl}>
            Connect your agent <Arrow />
          </a>
        </Button>
      </div>
    </figure>
  )
}
