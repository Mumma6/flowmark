import { Button } from "@flowmark/ui"
import { ProcessLandscape } from "../../features/product-landing/process-landscape"
import { MotionScene } from "../../features/product-landing/motion"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { shellClassName } from "./shell"
import { SpotlightWash } from "./spotlight-wash"

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24"
      aria-labelledby="hero-title"
    >
      <MotionScene className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_20%,transparent_75%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_0%,var(--hero-glow),transparent_60%)]"
        />
        <SpotlightWash className="opacity-35" />
        <BackgroundBeams className="opacity-30" />
      </MotionScene>
      <div className={shellClassName}>
        <p className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground sm:text-[10px] sm:tracking-[.2em]">
          <span className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_12px_#b9f59760]" />
          Process intelligence for people and agents
        </p>
        <h1
          id="hero-title"
          className="mt-7 max-w-5xl text-[clamp(3.1rem,7.4vw,6.25rem)] leading-[1.02] font-medium tracking-[-.065em] motion-safe:animate-arrive"
        >
          See what happened when{" "}
          <span className="text-primary">your app ran a job.</span>
        </h1>
        <div className="mt-7 flex flex-col justify-between gap-7 sm:mt-9 lg:flex-row lg:items-end">
          <p className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-[15px]">
            Record an import, sync or webhook. See how it finished and what the
            application reported. Share published results with your team in
            Studio or investigate the evidence with your coding agent.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="h-12 rounded-lg px-6 text-xs shadow-[0_0_30px_-12px_#b9f59765]"
            >
              <a href="#waitlist">
                Join the Waitlist <Arrow />
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-12 px-4 text-xs text-muted-foreground"
            >
              <a href="#example-run">
                See an example run <span aria-hidden="true">↓</span>
              </a>
            </Button>
          </div>
        </div>
        <section
          id="example-run"
          aria-labelledby="example-run-title"
          className="mt-10 grid gap-3 rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <h2 id="example-run-title" className="text-base font-medium">
            Example run · Invoice import
          </h2>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Execution</dt>
              <dd>Completed in 1.8 seconds</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reported result</dt>
              <dd>988 imported · 12 skipped</dd>
            </div>
          </dl>
        </section>
        <div id="experience" className="mt-12 sm:mt-16">
          <ProcessLandscape />
        </div>
      </div>
    </section>
  )
}
