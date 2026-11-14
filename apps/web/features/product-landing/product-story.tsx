import { FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "../../app/components/shell"
import { githubUrl } from "../../app/components/site-links"
import { WorkflowCodeBlock } from "../../app/components/workflow-code-block"
import { DiscoveryExperience } from "./discovery-experience"
import { EvidenceNetwork } from "./evidence-network"
import { EvolutionExperience } from "./evolution-experience"
import { bookingCode } from "./instrumentation-example"
import { SharedUnderstanding } from "./shared-understanding"

export function MeaningSection() {
  return (
    <section
      id="understand"
      className="border-y border-border bg-secondary/10 py-20 sm:py-28"
      aria-labelledby="meaning-title"
    >
      <div
        className={`${shellClassName} grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-24`}
      >
        <div>
          <p className={overlineClassName}>Beyond a successful request</p>
          <h2 id="meaning-title" className={`${sectionTitleClassName} mt-5`}>
            Your code ran.
            <br />
            <span className="text-muted-foreground">
              Did the business move forward?
            </span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
            An import finishes with records skipped. A booking completes without
            a confirmation. A release changes outcomes without raising an error.
          </p>
          <p className="mt-5 max-w-md text-sm leading-7">
            Flowmark connects the technical execution to the business story —
            and shows you where to look next.
          </p>
        </div>
        <div className="relative self-center border-l border-border pl-6 sm:pl-9">
          <div
            className="absolute top-3 -left-px h-10 w-px bg-primary"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-3 border-b border-border pb-6">
            <p className="font-mono text-xs text-muted-foreground">
              POST /appointments
            </p>
            <span className="rounded-full border border-success/25 bg-success/5 px-3 py-1.5 text-[11px] text-success">
              202 Accepted
            </span>
          </div>
          <p className="mt-7 text-[11px] text-muted-foreground">
            The execution tells you one thing.
          </p>
          <p className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            The outcome tells you more.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] text-muted-foreground">Execution</p>
              <p className="mt-2 text-lg text-success">Completed</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Confirmation</p>
              <p className="mt-2 text-lg text-warning">Not recorded</p>
            </div>
          </div>
          <a
            href="#studio"
            className="mt-8 inline-flex min-h-10 items-center gap-3 text-xs text-primary"
          >
            Explore the evidence <Arrow />
          </a>
        </div>
      </div>
    </section>
  )
}

export function DiscoverSection() {
  return (
    <section
      id="discover"
      className={`${shellClassName} py-20 sm:py-28`}
      aria-labelledby="discover-title"
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-20">
        <div>
          <p className={overlineClassName}>01 / Discover &amp; observe</p>
          <h2 id="discover-title" className={`${sectionTitleClassName} mt-5`}>
            Your processes are already
            <br className="hidden sm:block" /> in the code.
            <br />
            <span className="text-muted-foreground">Bring them into view.</span>
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          Connect technical context automatically, let your coding agent
          discover meaningful processes, or define exact business signals with
          the SDK. Start where you are. Add depth where it matters.
        </p>
      </div>
      <DiscoveryExperience
        precision={
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 p-3 sm:p-5">
              <WorkflowCodeBlock
                title="app/book-appointment.ts"
                value={bookingCode}
              />
            </div>
            <div className="p-6 sm:p-8">
              <p className="font-mono text-[10px] text-primary">
                A BUSINESS VOCABULARY FOR YOUR CODE
              </p>
              <h3 className="mt-6 text-2xl font-medium tracking-tight">
                Say what matters.
                <br />
                Keep the details connected.
              </h3>
              <div className="mt-7 space-y-6">
                {[
                  [
                    "Context",
                    "Which customer, integration and business reference?",
                  ],
                  [
                    "Outcomes",
                    "What did the application report accomplishing?",
                  ],
                  [
                    "Expectations",
                    "What should be observed next — and by when?",
                  ],
                ].map(([title, detail]) => (
                  <div key={title}>
                    <h4 className="text-sm">{title}</h4>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-7 border-t border-border pt-5 text-[10px] leading-6 text-muted-foreground">
                Ordinary TypeScript and Promises. Uses a configured client; your
                application owns execution and forwards the confirmation
                reference. Flush at your process boundary or use the Next.js
                adapter.
              </p>
            </div>
          </div>
        }
      />
      <div className="mt-7 grid gap-5 border-l border-highlight/40 pl-5 sm:grid-cols-[0.7fr_1fr] sm:gap-10 sm:pl-7">
        <h3 className="max-w-xs text-xl leading-snug font-medium tracking-tight">
          Your team owns
          <br />
          what “confirmed” means.
        </h3>
        <p className="max-w-xl text-xs leading-7 text-muted-foreground">
          Developers and domain experts refine the same definitions. Preview a
          change against examples, review the new revision, and preserve the
          meaning of historical results.
        </p>
      </div>
    </section>
  )
}

export function EvolveSection() {
  return (
    <section
      id="evolve"
      className="relative isolate overflow-hidden border-y border-border bg-secondary/10 py-20 sm:py-28"
      aria-labelledby="evolve-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_100%_50%,hsl(var(--highlight)/0.06),transparent_70%)]"
      />
      <div
        className={`${shellClassName} grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20`}
      >
        <div>
          <p className={overlineClassName}>02 / Continuously understood</p>
          <h2 id="evolve-title" className={`${sectionTitleClassName} mt-5`}>
            Code changes.
            <br />
            <span className="text-primary">Understanding keeps up.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
            A refactor moves a callback. A new branch changes a result. Flowmark
            identifies the affected processes and helps your agent keep the
            evidence useful.
          </p>
          <div className="mt-8 space-y-5">
            {[
              [
                "01",
                "Find drift",
                "Connect changed code to outcomes and expectations.",
              ],
              [
                "02",
                "Review the improvement",
                "Inspect proposed instrumentation and meaning changes.",
              ],
              [
                "03",
                "Verify what is observed",
                "Exercise the evidence, from emitted signal to persisted read.",
              ],
            ].map(([n, title, detail]) => (
              <div key={n} className="flex gap-4">
                <span className="pt-1 font-mono text-[10px] text-highlight">
                  {n}
                </span>
                <div>
                  <h3 className="text-sm">{title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <EvolutionExperience />
      </div>
    </section>
  )
}

export function EverywhereSection() {
  return (
    <section
      id="everywhere"
      className={`${shellClassName} py-20 sm:py-28`}
      aria-labelledby="everywhere-title"
    >
      <div className="max-w-3xl">
        <p className={overlineClassName}>03 / One shared understanding</p>
        <h2 id="everywhere-title" className={`${sectionTitleClassName} mt-5`}>
          Different questions.
          <br />
          <span className="text-muted-foreground">
            The same connected evidence.
          </span>
        </h2>
        <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">
          Explore visually in Studio. Investigate alongside code in your agent.
          Bring process intelligence into the tools your team builds. The
          context goes with you.
        </p>
      </div>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <SharedUnderstanding />
        <EvidenceNetwork />
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-y border-border py-5 text-[11px] leading-6 text-muted-foreground">
        <p>
          <span className="text-foreground">For your coding agent.</span>{" "}
          Structured evidence through MCP.
        </p>
        <p>
          Codex <span className="mx-3 text-border">/</span> Cursor{" "}
          <span className="mx-3 text-border">/</span> Claude Code{" "}
          <span className="mx-3 text-border">/</span> Your MCP client
        </p>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
        Illustrative perspectives on synthetic Meridian Health evidence. People
        and agents see the evidence their permissions allow.
      </p>
    </section>
  )
}

export function PlatformSection() {
  return (
    <section
      id="platform"
      className="border-y border-border bg-card/50 py-16 sm:py-20"
      aria-labelledby="platform-title"
    >
      <div className={shellClassName}>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <FlowmarkMark className="size-8 shrink-0 text-primary" />
            <h2
              id="platform-title"
              className="text-2xl font-medium tracking-tight sm:text-3xl"
            >
              Intelligence you can build on.
            </h2>
          </div>
          <a
            href={githubUrl}
            className="inline-flex min-h-10 items-center gap-2 text-xs text-muted-foreground hover:text-primary"
          >
            Explore the source <Arrow diagonal />
          </a>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              name: "Precise capture",
              label: "TypeScript SDK",
              text: "Small markers, typed results and explicit expectations. Business meaning lives beside the work.",
            },
            {
              name: "Explainable analysis",
              label: "Rust + PostgreSQL",
              text: "Deterministic comparisons and evidence processing. Inspect the population behind the conclusion.",
            },
            {
              name: "Programmable access",
              label: "APIs + MCP",
              text: "The same authorized evidence in Studio, coding agents, custom tools and portable views.",
            },
          ].map((item) => (
            <div key={item.name} className="border-l border-border pl-5">
              <p className="font-mono text-[10px] text-highlight">
                {item.label}
              </p>
              <h3 className="mt-3 text-base">{item.name}</h3>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
