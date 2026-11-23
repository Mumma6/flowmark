import { FlowmarkMark } from "@flowmark/ui"
import { Arrow } from "../../app/components/brand"
import { docsUrl } from "../../app/components/site-links"
import {
  overlineClassName,
  sectionTitleClassName,
  shellClassName,
} from "../../app/components/shell"
import copy from "../../public/landing-page-copy.en.json"
import { MotionScene, SignalPath } from "./motion"
import { MemoryConstellation } from "./memory-constellation"
import { ProcessIcon } from "./process-icon"
import { StepIllustration } from "./step-illustrations"

export function HowSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className={`${shellClassName} py-14 sm:py-20`}
    >
      <h2 id="how-title" className={sectionTitleClassName}>
        {copy.how.heading}
      </h2>
      <ol className="mt-7 grid gap-x-4 gap-y-7 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {copy.how.steps.map((step, index) => (
          <li key={step.title}>
            <StepIllustration index={index} />
            <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
            <p className="mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const loopIcons = [
  <ProcessIcon key="connect" name="person" />,
  <ProcessIcon key="understand" name="request" />,
  <FlowmarkMark key="memory" className="size-6" />,
  <ProcessIcon key="verify" name="branch" />,
]

export function FactorySection() {
  return (
    <section
      id="loop"
      aria-labelledby="loop-title"
      className="border-y border-border bg-card/50"
    >
      <div className={`${shellClassName} py-14 sm:py-20`}>
        <p className={overlineClassName}>{copy.loop.eyebrow}</p>
        <h2
          id="loop-title"
          className={`mt-3 max-w-3xl ${sectionTitleClassName}`}
        >
          {copy.loop.heading}
        </h2>
        <MotionScene className="mt-8 sm:mt-12">
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 52"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 top-0 hidden h-12 w-full md:block"
          >
            <SignalPath d="M100 26 H900" />
            {[200, 400, 600, 800].map((x) => (
              <path
                key={x}
                d={`M${x - 4} 21l5 5-5 5`}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity=".65"
              />
            ))}
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-y-0 left-5 h-full w-[calc(100%-1.5rem)] md:hidden"
          >
            <SignalPath d="M1 9 V90" />
            <SignalPath
              d="M5 90 H91 Q97 90 97 85 V35 Q97 30 91 30 H5"
              delay="[animation-delay:3s]"
            />
            <path
              d="m8 29-3 1 3 1"
              fill="none"
              stroke="var(--accent)"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ol className="relative grid gap-5 md:grid-cols-4 md:gap-0">
            {copy.loop.steps.map((step, i) => (
              <li
                key={step.title}
                className="flex min-h-14 items-center gap-4 pr-5 md:flex-col md:px-2 md:text-center"
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-card text-primary md:size-12">
                  {i === 2 && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 48 48"
                      className="pointer-events-none absolute inset-0 size-full"
                    >
                      <rect
                        x="1"
                        y="1"
                        width="46"
                        height="46"
                        rx="11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        pathLength="100"
                        strokeDasharray="18 82"
                        strokeLinecap="round"
                        className="group-data-[playing=true]/scene:animate-memory-border"
                      />
                    </svg>
                  )}
                  {loopIcons[i]}
                </span>
                <div>
                  <h3 className="text-base font-medium">{step.title}</h3>
                  <p className="mt-1 max-w-[15rem] text-sm leading-5 text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <svg
            aria-hidden="true"
            className="mt-2 hidden h-9 w-full md:block"
            viewBox="0 0 1000 36"
            preserveAspectRatio="none"
          >
            <SignalPath
              d="M875 2 V12 Q875 28 858 28 H142 Q125 28 125 12 V3"
              delay="[animation-delay:3s]"
            />
            <path
              d="m120 9 5-6 5 6"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.25"
            />
          </svg>
          <p className="mt-4 pl-[3.75rem] font-mono text-xs text-primary md:mt-1 md:pl-0 md:text-center">
            <span aria-hidden="true">↺ </span>
            {copy.loop.returnLabel}
          </p>
        </MotionScene>
      </div>
    </section>
  )
}

export function AgentsSection() {
  return (
    <section
      id="for-agents"
      aria-labelledby="agents-title"
      className={`${shellClassName} grid gap-8 py-14 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:gap-x-14 lg:gap-y-10`}
    >
      <div>
        <h2 id="agents-title" className={sectionTitleClassName}>
          {copy.agents.heading}
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
          {copy.agents.body}
        </p>
        <a
          href={docsUrl}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline"
        >
          {copy.agents.link} <Arrow />
        </a>
      </div>
      <MemoryConstellation
        views={copy.agents.views}
        label={copy.agents.viewLabel}
      />
      <div className="grid gap-y-2 border-t border-border pt-6 lg:col-span-2 lg:grid-cols-[.85fr_1.15fr] lg:gap-x-14">
        <h3 className="text-xl font-medium tracking-tight">
          {copy.coverage.heading}
        </h3>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {copy.coverage.body}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground lg:col-start-2">
          {copy.coverage.states.map((state) => (
            <li key={state}>{state}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
