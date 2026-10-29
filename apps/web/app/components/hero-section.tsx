import { Button } from "@flowmark/ui"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { Meteors } from "./meteors"
import { Spotlight } from "./spotlight"
import { SpotlightWash } from "./spotlight-wash"
import { WorkflowDemo } from "./workflow-demo"
import { overlineClassName, shellClassName } from "./shell"
import { docsUrl } from "./site-links"

export function HeroSection() {
  return (
    <section
      className="relative isolate pt-16 pb-10 sm:pt-24 sm:pb-16"
      aria-labelledby="hero-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50rem] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] sm:h-[54rem]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,var(--hero-glow),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,#b9f59712_1px,transparent_1px)] bg-size-[22px_22px] [mask-image:radial-gradient(ellipse_at_50%_20%,#000_18%,transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(#b9f5970c_1px,transparent_1px),linear-gradient(90deg,#b9f5970c_1px,transparent_1px)] bg-size-[72px_72px] [mask-image:radial-gradient(ellipse_at_50%_0%,#000_8%,transparent_70%)]" />
        <SpotlightWash />
        <BackgroundBeams />
        <Meteors />
        <Spotlight className="top-[-18%] opacity-70" />
      </div>
      <div className={shellClassName}>
        <div className="mx-auto max-w-4xl text-center motion-safe:animate-arrive">
          <a
            href="#positioning"
            className="mb-7 inline-flex min-h-9 items-center gap-2.5 rounded-full border border-border bg-card/70 px-3.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            Your code runs it. Flowmark explains it.
            <Arrow />
          </a>
          <p className={overlineClassName}>Workflow observability</p>
          <h1
            id="hero-title"
            className="mt-5 text-balance text-[clamp(2.65rem,6.3vw,5.25rem)] leading-[1.04] font-medium tracking-[-0.055em]"
          >
            Know what your workflows{" "}
            <span className="text-primary">actually accomplish.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            A completed run is only part of the story. See progress, failures,
            and reported results from the processes your application already
            runs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 px-6">
              <a href={docsUrl}>
                Start with one workflow <Arrow />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6">
              <a href="#product">
                Explore an example <span aria-hidden="true">↓</span>
              </a>
            </Button>
          </div>
          <ul
            className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            aria-label="Integration overview"
          >
            {[
              "TypeScript SDK",
              "Your runtime, your infrastructure",
              "No workflow migration",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  className="size-1 rounded-full bg-primary/50"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div
          id="product"
          className="mt-12 scroll-mt-24 sm:mt-16 motion-safe:animate-arrive [animation-delay:120ms]"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                One import. The whole story.
              </span>{" "}
              <span className="hidden sm:inline">
                Select a milestone to inspect the evidence.
              </span>
            </p>
            <span className="font-mono text-[10px] tracking-wider uppercase">
              Interactive example · sample data
            </span>
          </div>
          <WorkflowDemo />
          <p className="mt-4 text-center text-xs leading-6 text-muted-foreground">
            Illustrative customer import · application-reported data.
          </p>
        </div>
      </div>
    </section>
  )
}
