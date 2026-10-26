import { Button, FlowmarkLockup } from "@flowmark/ui"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { overlineClassName, shellClassName } from "./shell"
import { docsUrl } from "./site-links"
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
          Turn one process into insight.
        </h2>
        <p className="mx-auto mt-4 max-w-[32rem] text-sm leading-7 text-muted-foreground">
          A checkout, a sync, a scheduled job. Mark the business logic. Then
          open the outcome in Flowmark.
        </p>
        <Button asChild className="mt-7" size="lg">
          <a href={docsUrl}>
            Read the introduction <Arrow />
          </a>
        </Button>
      </div>
    </section>
  )
}
