import { Button, FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "./brand"
import { overlineClassName, shellClassName } from "./shell"
import { WaitlistForm } from "../../features/waitlist/waitlist-form"
import { waitlistEndpoint } from "../../features/waitlist/endpoint"
import { docsUrl, githubUrl } from "./site-links"

export function ClosingSection() {
  return (
    <section
      id="waitlist"
      className="relative isolate overflow-hidden border-t border-highlight/20 bg-card py-20 sm:py-28"
      aria-labelledby="closing-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_100%,var(--studio-glow),transparent_65%)]"
      />
      <div className={`${shellClassName} text-center`}>
        <div className="mx-auto mb-8 grid size-16 place-items-center rounded-2xl border border-primary/25 bg-primary/5 shadow-[0_0_60px_-15px_#b9f59745]">
          <FlowmarkMark className="size-8 text-primary" />
        </div>
        <p className={overlineClassName}>Built to be understood</p>
        <h2
          id="closing-title"
          className="mx-auto mt-5 max-w-4xl text-balance text-[clamp(2.6rem,6vw,5rem)] leading-[1.04] font-medium tracking-[-0.055em]"
        >
          You build the software.
          <br />
          <span className="text-primary">Make it understood.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-muted-foreground">
          Connect what runs to what it means. Put that understanding in the
          hands of your team, your agents and the tools you build.
        </p>
        <WaitlistForm endpoint={waitlistEndpoint()} />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6">
            <a href={docsUrl}>
              Build with Flowmark <Arrow />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-6">
            <a href={githubUrl}>
              Explore the source <Arrow diagonal />
            </a>
          </Button>
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">
          Open source · MIT licensed · Self-host on your infrastructure
        </p>
      </div>
    </section>
  )
}
