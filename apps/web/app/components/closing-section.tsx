import { Button, FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "./brand"
import { overlineClassName, shellClassName } from "./shell"
import { docsUrl, githubUrl } from "./site-links"

export function ClosingSection() {
  return (
    <section
      className="relative isolate overflow-hidden border-t border-border bg-card py-16 sm:py-24"
      aria-labelledby="closing-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_100%,var(--hero-glow),transparent_65%)]"
      />
      <div className={`${shellClassName} text-center`}>
        <FlowmarkMark className="mx-auto mb-6 size-10 text-primary" />
        <p className={overlineClassName}>Start with one process</p>
        <h2
          id="closing-title"
          className="mx-auto mt-4 max-w-2xl text-balance text-[clamp(2.3rem,5vw,4rem)] leading-[1.08] font-medium tracking-[-0.05em]"
        >
          Start with the process
          <br />
          you wish you understood.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-muted-foreground">
          Instrument once. Understand together.
          <br />
          For the people building your software — and everyone depending on it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6">
            <a href={docsUrl}>
              Start building with Flowmark <Arrow />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-6">
            <a href={githubUrl}>
              Explore the source <Arrow diagonal />
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
