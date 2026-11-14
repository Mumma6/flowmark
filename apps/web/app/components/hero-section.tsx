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
          Understand what
          <br className="hidden sm:block" /> your software
          <br className="sm:hidden" />{" "}
          <span className="text-primary">actually does.</span>
        </h1>
        <div className="mt-7 flex flex-col justify-between gap-7 sm:mt-9 lg:flex-row lg:items-end">
          <p className="max-w-lg text-sm leading-7 text-muted-foreground sm:text-[15px]">
            From the first line of code to the final business outcome.
            <br className="hidden sm:block" /> Flowmark makes the whole process
            visible — and keeps
            <br className="hidden sm:block" /> understanding alive as your
            software changes.
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
              <a href="#experience">
                Follow the process <span aria-hidden="true">↓</span>
              </a>
            </Button>
          </div>
        </div>
        <div id="experience" className="mt-12 sm:mt-16">
          <ProcessLandscape />
        </div>
      </div>
    </section>
  )
}
