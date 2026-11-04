import { Button } from "@flowmark/ui"
import { StudioExperience } from "../../features/product-landing/studio-experience"
import { Arrow } from "./brand"
import { shellClassName } from "./shell"
import { docsUrl } from "./site-links"

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden pt-12 pb-16 sm:pt-12 sm:pb-24"
      aria-labelledby="hero-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-56 -z-10 h-[780px] bg-[radial-gradient(ellipse_at_50%_50%,var(--hero-glow),transparent_65%)]"
      />
      <div className={shellClassName}>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
          <span className="size-1.5 rounded-full bg-primary" />
          Open-source process intelligence
          <span className="hidden h-3 w-px bg-border sm:block" />
          <span className="text-primary">For people & agents</span>
        </div>
        <h1
          id="hero-title"
          className="mt-6 max-w-[1040px] text-balance text-[clamp(2.8rem,6.2vw,5.5rem)] leading-[1.04] font-medium tracking-[-0.065em] motion-safe:animate-arrive"
        >
          Understand what your
          <br className="hidden sm:block" />{" "}
          <span className="text-muted-foreground">software actually does.</span>
        </h1>
        <div className="mt-6 mb-10 flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <p className="max-w-[550px] text-base leading-7 text-muted-foreground">
            Connect application behavior to business outcomes. Explore the
            evidence in Studio, in your agent, or in the tools you build.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-11 px-5 text-xs">
              <a href={docsUrl}>
                Start building <Arrow />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-border bg-card px-5 text-xs"
            >
              <a href="#studio">
                Explore Studio <span aria-hidden="true">↓</span>
              </a>
            </Button>
          </div>
        </div>
        <StudioExperience />
      </div>
    </section>
  )
}
