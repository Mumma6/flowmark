import { Button, FlowmarkLockup } from "@flowmark/ui"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { overlineClassName, shellClassName } from "./shell"
import { appUrl, docsUrl } from "./site-links"
import { SpotlightWash } from "./spotlight-wash"

export function ClosingSection() {
  return (
    <section
      className="relative isolate overflow-hidden border-t border-border bg-[#0d1112] py-16 text-center sm:py-24"
      aria-labelledby="closing-title"
    >
      <SpotlightWash className="opacity-70" />
      <BackgroundBeams id="closing" className="opacity-40" />
      <div className={`${shellClassName} relative z-10`}>
        <FlowmarkLockup className="mx-auto mb-6 size-12 rounded-xl" />
        <p className={overlineClassName}>Start with one process</p>
        <h2
          id="closing-title"
          className="mt-4 text-[clamp(2.25rem,5vw,3.6rem)] font-medium tracking-tight"
        >
          Understand the execution. Then see what changed.
        </h2>
        <p className="mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-muted-foreground">
          Mark a process in the TypeScript you already have. Open one run. When
          something changes across runs, see what changed, where, and which
          executions to open next.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={appUrl}>
              Open the dashboard <Arrow />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={docsUrl}>
              Read the introduction <Arrow diagonal />
            </a>
          </Button>
        </div>
        <p className="mt-5 font-mono text-[13px] tracking-tight text-muted-foreground">
          npm i @flowmarkdev/node
        </p>
      </div>
    </section>
  )
}
