import { FlowmarkMark } from "@flowmark/ui"
import { shellClassName } from "./shell"
import { WaitlistForm } from "../../features/waitlist/waitlist-form"
import { waitlistEndpoint } from "../../features/waitlist/endpoint"
import { MotionScene, SignalPath } from "../../features/product-landing/motion"

export function ClosingSection() {
  return (
    <section
      id="waitlist"
      className="relative isolate overflow-hidden border-t border-primary/15 py-20 sm:py-28"
      aria-labelledby="closing-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_100%,var(--hero-glow),transparent_70%)]"
      />
      <div className={`${shellClassName} text-center`}>
        <MotionScene className="mx-auto h-28 max-w-lg">
          <svg
            viewBox="0 0 500 100"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <SignalPath d="M0 5 C100 5 150 75 250 75" />
            <SignalPath
              d="M80 0 C130 0 170 75 250 75"
              className="text-highlight"
              delay="[animation-delay:1s]"
            />
            <SignalPath d="M500 5 C400 5 350 75 250 75" />
            <SignalPath
              d="M420 0 C370 0 330 75 250 75"
              className="text-highlight"
              delay="[animation-delay:1s]"
            />
          </svg>
          <div className="absolute top-[75%] left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-primary/30 bg-background shadow-[0_0_40px_-10px_#b9f59735]">
            <FlowmarkMark className="size-8 text-primary" />
          </div>
        </MotionScene>
        <p className="mx-auto mt-7 max-w-lg text-balance text-xs leading-6 text-muted-foreground">
          The faster we build software, the more important it becomes to
          understand what it actually does.
        </p>
        <h2
          id="closing-title"
          className="mx-auto mt-8 max-w-4xl text-balance text-[clamp(2.8rem,6.4vw,5.5rem)] leading-[1.05] font-medium tracking-[-0.06em]"
        >
          Build faster.
          <br />
          <span className="text-primary">Understand deeper.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-muted-foreground">
          A living understanding of your software.
          <br />
          For everyone building it. And everyone depending on it.
        </p>
        <WaitlistForm endpoint={waitlistEndpoint()} />
      </div>
    </section>
  )
}
