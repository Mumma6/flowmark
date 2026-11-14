import { Button } from "@flowmark/ui"
import { ProcessWorkspace } from "../../features/product-landing/process-workspace"
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_40%,transparent_90%)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--hero-glow),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(#b9f59705_1px,transparent_1px),linear-gradient(90deg,#b9f59705_1px,transparent_1px)] bg-size-[80px_80px] [mask-image:radial-gradient(ellipse_at_50%_10%,#000,transparent_60%)]" />
        <SpotlightWash className="opacity-40" />
        <BackgroundBeams className="opacity-25" />
      </div>
      <div className={shellClassName}>
        <div className="mx-auto max-w-5xl text-center">
          <p className="inline-flex items-center gap-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_#b9f59760]" />
            Process intelligence for people and agents
          </p>
          <h1
            id="hero-title"
            className="mt-7 text-balance text-[clamp(2.65rem,6.8vw,5.75rem)] leading-[1.03] font-medium tracking-[-0.065em] motion-safe:animate-arrive"
          >
            Understand what your
            <br className="hidden sm:block" /> software{" "}
            <span className="text-primary">actually does.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-balance text-[15px] leading-7 text-muted-foreground sm:text-base">
            An AI-native platform that discovers the processes in your code,
            connects execution to business outcomes, and keeps understanding
            alive as your software evolves.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
              className="h-12 px-5 text-xs text-muted-foreground"
            >
              <a href="#studio">
                Explore the platform <span aria-hidden="true">↓</span>
              </a>
            </Button>
          </div>
        </div>
        <div className="mt-14 sm:mt-16">
          <ProcessWorkspace />
        </div>
        <div className="mt-9 grid grid-cols-2 gap-5 text-center sm:grid-cols-4">
          {[
            {
              label: "Discover",
              detail: "Find the processes in your code",
              href: "#discover",
            },
            {
              label: "Observe",
              detail: "Capture what matters",
              href: "#discover",
            },
            {
              label: "Understand",
              detail: "See the story behind the signals",
              href: "#understand",
            },
            {
              label: "Evolve",
              detail: "Keep meaning in step with change",
              href: "#evolve",
            },
          ].map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className="group rounded-md py-2"
            >
              <p className="text-xs font-medium transition-colors group-hover:text-primary">
                <span className="mr-2 font-mono text-[9px] text-highlight">
                  0{index + 1}
                </span>
                {item.label}
              </p>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
