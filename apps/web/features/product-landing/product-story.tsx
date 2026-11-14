import { FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "../../app/components/shell"
import { githubUrl } from "../../app/components/site-links"
import { WorkflowCodeBlock } from "../../app/components/workflow-code-block"
import { DiscoveryField } from "./discovery-field"
import { EvidenceNetwork } from "./evidence-network"
import { EvolutionExperience } from "./evolution-experience"
import { bookingCode } from "./instrumentation-example"
import { JourneyTimeline } from "./journey-timeline"
import { OutcomeField } from "./outcome-field"
import { SectionTrace } from "./motion"

export function DiscoverSection() {
  return (
    <section
      id="discover"
      className="relative border-y border-border/60 py-20 sm:py-28"
      aria-labelledby="discover-title"
    >
      <div className={shellClassName}>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr] lg:items-end lg:gap-16">
          <div>
            <p className={overlineClassName}>01 / Find the process</p>
            <h2 id="discover-title" className={`${sectionTitleClassName} mt-5`}>
              It’s already in your code.
              <br />
              <span className="text-primary">Bring it into view.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Discover useful technical context automatically. Let your coding
            agent identify meaningful processes and add the business signals
            that explain them.
          </p>
        </div>
        <DiscoveryField
          code={
            <WorkflowCodeBlock
              title="app/book-appointment.ts"
              value={bookingCode}
            />
          }
        />
      </div>
    </section>
  )
}

export function JourneySection() {
  return (
    <section
      id="journey"
      className={`${shellClassName} py-20 sm:py-32`}
      aria-labelledby="journey-title"
    >
      <div className="relative grid gap-14 lg:grid-cols-[.9fr_1.1fr] lg:gap-24">
        <div className="self-start lg:sticky lg:top-36">
          <p className={overlineClassName}>02 / Follow the story</p>
          <h2 id="journey-title" className={`${sectionTitleClassName} mt-5`}>
            Follow the process.
            <br />
            <span className="text-muted-foreground">
              Across services and time.
            </span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
            Connect executions through shared business references. Follow
            imports, payments, background jobs and bookings across services,
            callbacks and time.
          </p>
          <div className="mt-9 border-l border-primary/40 pl-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              One appointment-booking journey
            </p>
            <p className="mt-3 font-mono text-xs text-primary">SYN-REF-2049</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Select a moment to see its evidence.
            </p>
          </div>
          <p className="mt-10 max-w-xs text-xl leading-relaxed tracking-tight">
            Your code ran.
            <br />
            <span className="text-primary">Did the business move forward?</span>
          </p>
        </div>
        <JourneyTimeline />
      </div>
    </section>
  )
}

export function IntelligenceSection() {
  return (
    <section
      id="understand"
      className="relative isolate border-y border-border/60 bg-secondary/10 py-20 sm:py-28"
      aria-labelledby="intelligence-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_35%,hsl(var(--highlight)/0.04),transparent_60%)]"
      />
      <div className={shellClassName}>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-16">
          <div>
            <p className={overlineClassName}>03 / Notice what matters</p>
            <h2
              id="intelligence-title"
              className={`${sectionTitleClassName} mt-5`}
            >
              Spot changes in outcomes.
              <br />
              <span className="text-primary">
                Even when execution looks healthy.
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Flowmark proactively surfaces changing outcomes and connects
            findings to evidence. Compare releases with execution health and
            reporting coverage in view.
          </p>
        </div>
        <OutcomeField />
      </div>
    </section>
  )
}

export function EvolveSection() {
  return (
    <section
      id="evolve"
      className={`${shellClassName} py-20 sm:py-28`}
      aria-labelledby="evolve-title"
    >
      <div className="relative lg:pl-8">
        <SectionTrace />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-16">
          <div>
            <p className={overlineClassName}>04 / Keep understanding alive</p>
            <h2 id="evolve-title" className={`${sectionTitleClassName} mt-5`}>
              Detect instrumentation drift.
              <br />
              <span className="text-muted-foreground">
                Keep process evidence current.
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Detect code changes that leave process evidence incomplete. Your
            coding agent proposes instrumentation updates; your team reviews and
            verifies them.
          </p>
        </div>
      </div>
      <EvolutionExperience />
    </section>
  )
}

export function EverywhereSection() {
  return (
    <section
      id="everywhere"
      className="border-y border-border/60 py-20 sm:py-28"
      aria-labelledby="everywhere-title"
    >
      <div className={shellClassName}>
        <div className="mx-auto max-w-3xl text-center">
          <p className={overlineClassName}>
            Built for people. Native to agents.
          </p>
          <h2 id="everywhere-title" className={`${sectionTitleClassName} mt-5`}>
            For your team and your agents.
            <br />
            <span className="text-primary">One shared source of evidence.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
            Developers, product teams and operations investigate the same
            evidence. Coding agents use that context to explain behavior and
            improve instrumentation.
          </p>
        </div>
        <EvidenceNetwork />
        <div
          id="platform"
          className="mt-16 grid gap-6 border-t border-border pt-8 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="flex items-center gap-4">
            <FlowmarkMark className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm">Intelligence you can build on.</p>
              <p className="mt-2 font-mono text-[9px] leading-6 text-muted-foreground">
                TypeScript SDK <span className="px-2 text-primary">→</span> Rust
                + PostgreSQL <span className="px-2 text-primary">→</span> API +
                MCP
              </p>
            </div>
          </div>
          <a
            href={githubUrl}
            className="inline-flex min-h-10 items-center gap-2 text-xs text-muted-foreground hover:text-primary"
          >
            Explore the source <Arrow diagonal />
          </a>
        </div>
      </div>
    </section>
  )
}
