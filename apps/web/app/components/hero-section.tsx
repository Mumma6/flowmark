import copy from "../../public/landing-page-copy.en.json"
import { Button } from "@flowmark/ui"
import { MemoryMap } from "../../features/product-landing/memory-map"
import { MotionScene } from "../../features/product-landing/motion"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { shellClassName } from "./shell"
import { githubUrl } from "./site-links"
import { SpotlightWash } from "./spotlight-wash"

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden border-b border-border"
    >
      <MotionScene className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <SpotlightWash className="opacity-55" />
        <BackgroundBeams className="opacity-45" />
      </MotionScene>
      <div
        className={`${shellClassName} grid items-center gap-6 py-8 sm:gap-12 sm:py-16 lg:grid-cols-[1.02fr_1fr] lg:gap-9 lg:py-20 xl:py-24`}
      >
        <div>
          <p className="flex items-center gap-2.5 text-xs font-medium tracking-wide text-primary">
            <span aria-hidden="true" className="h-px w-6 bg-primary" />
            {copy.hero.category}
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-[clamp(2.9rem,6.15vw,5.25rem)] leading-[0.99] font-medium tracking-[-.065em] motion-safe:animate-arrive"
          >
            Production memory
            <br />
            for <span className="text-primary">coding agents.</span>
          </h1>
          <p className="mt-6 max-w-[29rem] text-base leading-relaxed text-foreground sm:text-lg">
            {copy.hero.tagline}
          </p>
          <p className="mt-3 max-w-[29rem] text-base leading-relaxed text-muted-foreground">
            {copy.hero.body}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button
              asChild
              className="h-11 rounded-lg px-5 shadow-[0_0_28px_-12px_var(--accent)]"
            >
              <a href="#how-it-works">
                {copy.hero.actions[0]} <Arrow />
              </a>
            </Button>
            <a
              href={githubUrl}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-foreground transition-colors hover:text-primary"
            >
              {copy.hero.actions[1]} <Arrow diagonal />
            </a>
          </div>
        </div>
        <MemoryMap />
      </div>
    </section>
  )
}
