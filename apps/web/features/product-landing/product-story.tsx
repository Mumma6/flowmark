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
            An AI-native starting point for understanding your application.
            Discover the meaningful work. Capture the signals that explain it.
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
            A request is a moment.
            <br />
            <span className="text-muted-foreground">
              A journey is the story.
            </span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
            Across services, callbacks and time. Flowmark connects separate
            executions through the business references they share.
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
              The code is completing.
              <br />
              <span className="text-primary">The outcome is changing.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Process intelligence sees the difference. Explore what changed after
            a release — while execution and reporting coverage stayed stable.
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
              Code moves forward.
              <br />
              <span className="text-muted-foreground">
                Meaning moves with it.
              </span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Connect code changes to the processes they affect. Let your agent
            help improve the instrumentation. Verify the evidence together.
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
            Different minds.
            <br />
            <span className="text-primary">The same understanding.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
            Your team defines what matters. Flowmark connects the evidence.
            Everyone investigates from a shared, evolving understanding.
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
