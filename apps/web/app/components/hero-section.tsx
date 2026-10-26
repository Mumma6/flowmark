import { Button, FlowmarkLockup } from "@flowmark/ui"
import { BackgroundBeams } from "./background-beams"
import { Arrow } from "./brand"
import { DashboardIllustration } from "./dashboard-illustration"
import { Meteors } from "./meteors"
import { overlineClassName, shellClassName } from "./shell"
import { appUrl, docsUrl } from "./site-links"
import { Spotlight } from "./spotlight"
import { SpotlightWash } from "./spotlight-wash"

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 lg:min-h-[calc(100svh-4.5rem)] lg:pt-28 lg:pb-32"
      aria-labelledby="hero-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#b9f59712_1px,transparent_1px)] bg-size-[22px_22px] [mask-image:radial-gradient(ellipse_at_50%_20%,#000_18%,transparent_72%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(#b9f5970c_1px,transparent_1px),linear-gradient(90deg,#b9f5970c_1px,transparent_1px)] bg-size-[72px_72px] [mask-image:radial-gradient(ellipse_at_50%_0%,#000_8%,transparent_70%)]"
        aria-hidden="true"
      />
      <SpotlightWash />
      <BackgroundBeams />
      <Meteors />
      <Spotlight className="top-[-18%] opacity-70" />
      <div
        className="pointer-events-none absolute top-[-10rem] left-1/2 h-[38rem] w-[58rem] -translate-x-1/2 bg-[radial-gradient(ellipse,#b9f59728,transparent_68%)]"
        aria-hidden="true"
      />

      <div className={`${shellClassName} relative z-10`}>
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <FlowmarkLockup className="mb-8 size-28 rounded-3xl sm:size-36" />
          <p className={overlineClassName}>Workflow observability</p>
          <h1
            id="hero-title"
            className="mt-4 text-[clamp(3.4rem,11vw,7.6rem)] leading-[0.88] font-semibold tracking-[-0.06em]"
          >
            flowmark<span className="text-primary">.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-balance text-[clamp(1.35rem,3vw,2.15rem)] leading-snug font-medium tracking-tight text-foreground">
            Understand every execution. Discover what matters across them.
          </p>
          <p className="mt-5 max-w-[36rem] text-pretty text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8">
            Mark a process your TypeScript application already runs. Investigate
            one execution, then see what changed across many — without moving
            that work into an engine.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href={appUrl}>
                Open the dashboard <Arrow />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={docsUrl}>
                Read the docs <Arrow diagonal />
              </a>
            </Button>
          </div>
          <p className="mt-5 font-mono text-[13px] tracking-tight text-muted-foreground">
            npm i @flowmarkdev/node
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl [perspective:1400px] sm:mt-16">
          <div
            className="pointer-events-none absolute inset-x-8 -bottom-10 h-24 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />
          <DashboardIllustration />
          <span
            className="pointer-events-none absolute -top-8 -right-10 z-0 block size-[200px] animate-orbit rounded-full border border-primary/10 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute right-8 -bottom-10 z-0 block size-[138px] animate-orbit rounded-full border border-primary/[0.05] [animation-direction:reverse] [animation-duration:36s] motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
