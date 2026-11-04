import { Button } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { CodeShowcase } from "../../app/components/code-showcase"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "../../app/components/shell"
import { docsUrl, githubUrl } from "../../app/components/site-links"
import { AgentExperience } from "./agent-experience"
import { OrganizationPerspectives } from "./organization-perspectives"
import { PlatformFabric } from "./platform-fabric"
import { PortableEvidence } from "./portable-evidence"

export function ProductDimensions() {
  return (
    <section
      id="product"
      className={`${shellClassName} pb-20 sm:pb-28`}
      aria-label="One Flowmark product"
    >
      <div className="grid border-y border-border md:grid-cols-3">
        {[
          {
            number: "01",
            name: "Platform",
            href: "#platform",
            title: "Instrument once. Build on the evidence.",
            detail:
              "Typed SDK, connected context, historical analysis and programmable access.",
          },
          {
            number: "02",
            name: "Studio",
            href: "#studio",
            title: "A workspace for understanding.",
            detail:
              "Explore connected processes. Save an investigation, share its evidence and pick up where you left off.",
          },
          {
            number: "03",
            name: "Everywhere",
            href: "#everywhere",
            title: "Intelligence, wherever you work.",
            detail:
              "Coding agents, MCP, APIs and portable views. The same context travels with you.",
          },
        ].map((item) => (
          <a
            key={item.name}
            href={item.href}
            className="group relative min-w-0 border-border py-7 transition-colors hover:bg-primary/[0.03] first:pl-0 last:pr-0 max-md:border-b max-md:last:border-b-0 md:px-7 md:not-last:border-r lg:px-9"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-muted-foreground">
                {item.number}
              </span>
              <h2 className="text-sm font-medium transition-colors group-hover:text-primary">
                {item.name}
              </h2>
              <span className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                <Arrow diagonal />
              </span>
            </div>
            <p className="mt-5 max-w-56 text-lg leading-snug tracking-tight">
              {item.title}
            </p>
            <p className="mt-3 max-w-xs text-xs leading-6 text-muted-foreground">
              {item.detail}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}

export function OrganizationSection() {
  return (
    <section
      id="organization"
      className={`${shellClassName} pb-20 sm:pb-28`}
      aria-labelledby="organization-title"
    >
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-end lg:gap-24">
        <div>
          <p className={overlineClassName}>
            Shared evidence. Different questions.
          </p>
          <h2
            id="organization-title"
            className={`${sectionTitleClassName} mt-4`}
          >
            Your software runs.
            <br />
            Your whole team understands.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          From an engineer tracing a regression to a colleague answering a
          customer. Start with the question, keep the context, and reveal the
          detail you need.
        </p>
      </div>
      <OrganizationPerspectives />
      <p className="mt-5 text-[10px] text-muted-foreground">
        Role perspectives on the same synthetic booking. Access follows project
        permissions.
      </p>
    </section>
  )
}

export function EverywhereSection() {
  return (
    <section
      id="everywhere"
      className="relative isolate overflow-hidden border-y border-border bg-secondary/10 py-20 sm:py-28"
      aria-labelledby="everywhere-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,#b9f59712,transparent_55%)]"
      />
      <div className={shellClassName}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className={overlineClassName}>
              Everywhere / AI-native by design
            </p>
            <h2
              id="everywhere-title"
              className={`${sectionTitleClassName} mt-4`}
            >
              Your agent knows the code.
              <br />
              <span className="text-muted-foreground">
                Give it the evidence.
              </span>
            </h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">
              Source code describes what should happen. Flowmark records what
              your application reports actually happened. Bring that missing
              context into the conversation.
            </p>
            <div className="mt-8 space-y-5">
              {[
                [
                  "01",
                  "Instrument with your agent",
                  "Go from application code to meaningful process evidence.",
                ],
                [
                  "02",
                  "Investigate through MCP",
                  "Ask across runs, outcomes and relationships with scoped access.",
                ],
                [
                  "03",
                  "Continue the same investigation",
                  "Move between Studio, your agent and embedded evidence views.",
                ],
              ].map(([n, title, detail]) => (
                <div key={n} className="flex gap-4">
                  <span className="pt-1 font-mono text-[9px] text-primary">
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
          <AgentExperience />
        </div>
        <div className="mt-16 grid items-center gap-8 border-t border-border pt-10 md:grid-cols-2 lg:gap-20">
          <div>
            <p className={overlineClassName}>Portable by design</p>
            <h3 className="mt-4 text-3xl leading-tight font-medium tracking-[-0.04em]">
              The interface travels, too.
            </h3>
            <p className="mt-3 max-w-md text-xs leading-6 text-muted-foreground">
              Open interactive evidence in compatible MCP Apps, embed it in an
              internal tool, or continue in Studio. Useful context doesn’t
              belong to one browser tab.
            </p>
            <div className="mt-6 grid gap-4 border-t border-border pt-5 text-xs sm:grid-cols-2">
              <div>
                <p className="font-medium">MCP Apps</p>
                <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">
                  Explore evidence directly in compatible conversations.
                </p>
              </div>
              <div>
                <p className="font-medium">Embedded interfaces</p>
                <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">
                  Bring the same understanding into the tools your team builds.
                </p>
              </div>
            </div>
          </div>
          <PortableEvidence />
        </div>
      </div>
    </section>
  )
}

export function PlatformSection() {
  return (
    <section
      id="platform"
      className={`${shellClassName} py-20 sm:py-28`}
      aria-labelledby="platform-title"
    >
      <div className="mb-9 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-20">
        <div>
          <p className={overlineClassName}>
            Platform / Built around your application
          </p>
          <h2 id="platform-title" className={`${sectionTitleClassName} mt-4`}>
            From application code.
            <br />
            To shared understanding.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          Keep your functions, infrastructure and execution model. Use the
          TypeScript SDK to report what matters, then enrich it with typed
          outcomes, relationships, reports and expectations.
        </p>
      </div>
      <PlatformFabric />
      <div className="border-t border-border pt-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className={overlineClassName}>
            Start with the code you already own
          </p>
          <span className="font-mono text-[10px] text-muted-foreground">
            TypeScript SDK · Ordinary functions & Promises
          </span>
        </div>
        <CodeShowcase />
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4">
        <code className="text-xs">
          <span className="mr-3 text-muted-foreground" aria-hidden="true">
            $
          </span>
          npm i @flowmarkdev/node
        </code>
        <Button asChild variant="link" className="h-10 px-0 text-xs">
          <a href={docsUrl}>
            Read the quickstart <Arrow />
          </a>
        </Button>
      </div>
      <p className="mt-4 max-w-2xl text-[11px] leading-6 text-muted-foreground">
        Examples use a configured client and your application helpers. Flush
        delivery at the process boundary or use the Next.js lifecycle adapter.
        Flowmark observes your work; your application owns execution.
      </p>
    </section>
  )
}

export function OpenSourceSection() {
  return (
    <section
      className="border-y border-border bg-card/50 py-14 sm:py-20"
      aria-labelledby="open-source-title"
    >
      <div
        className={`${shellClassName} grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr] lg:gap-20`}
      >
        <div>
          <p className={overlineClassName}>Open by design</p>
          <h2
            id="open-source-title"
            className="mt-4 text-3xl leading-tight font-medium tracking-[-0.045em] sm:text-4xl"
          >
            Your evidence.
            <br />
            Your infrastructure. Your possibilities.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
            Inspect the source. Self-host the platform. Build the interface your
            team needs. Flowmark is an open-source foundation for understanding
            the software you own.
          </p>
          <Button asChild variant="link" className="mt-5 h-11 px-0 text-xs">
            <a href={githubUrl}>
              Explore the source <Arrow diagonal />
            </a>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 border-l border-border pl-8 sm:pl-12">
          {[
            ["TypeScript", "From SDK to Studio"],
            ["PostgreSQL", "Evidence with history"],
            ["MIT", "Open-source license"],
            ["Composable", "SDK · API · MCP · UI"],
          ].map(([title, detail]) => (
            <div key={title}>
              <p className="text-lg font-medium tracking-tight">{title}</p>
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
