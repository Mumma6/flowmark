import { FlowmarkMark } from "@flowmark/ui"
import copy from "../../public/landing-page-copy.en.json"
import { MotionScene, SignalPath } from "./motion"
import { ProcessIcon } from "./process-icon"

function ContextLayer({ runtime }: { runtime: boolean }) {
  return (
    <g
      transform={runtime ? "translate(360 43)" : "translate(120 43)"}
      className={runtime ? "text-primary" : "text-highlight"}
    >
      {[24, 16, 8, 0].map((offset) => (
        <g
          key={offset}
          transform={`translate(0 ${offset})`}
          stroke="currentColor"
          strokeLinejoin="round"
        >
          <path
            d="M-75 0 0-35 75 0v5L0 40-75 5Z"
            fill="var(--surface)"
            strokeOpacity=".38"
          />
          <path
            d="M-75 0 0-35 75 0 0 35Z"
            fill={runtime ? "url(#memory-face)" : "currentColor"}
            fillOpacity={runtime ? 1 : 0.08}
            strokeOpacity=".7"
          />
        </g>
      ))}
      <g transform="matrix(1.15 .54 -1.15 .54 0 -17)">
        {runtime ? (
          <FlowmarkMark width="32" height="32" />
        ) : (
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m10 10-6 6 6 6m12-12 6 6-6 6m-4-15-4 18" />
          </svg>
        )}
      </g>
    </g>
  )
}

export function MemoryMap() {
  const { source, runtime, result } = copy.context
  return (
    <figure className="relative isolate mx-auto w-full max-w-lg">
      <MotionScene className="rounded-xl py-4 sm:py-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_0.8px,transparent_0.9px)] bg-size-[14px_14px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
        />
        <dl className="grid grid-cols-2 text-center">
          {[source, runtime].map((input) => (
            <div
              key={input.title}
              className="px-1 text-primary first:text-highlight"
            >
              <dt className="font-medium tracking-tight sm:text-xl">
                {input.title}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {input.detail}
              </dd>
            </div>
          ))}
        </dl>
        <svg aria-hidden="true" viewBox="0 0 480 176" className="mt-3 w-full">
          <defs>
            <radialGradient id="memory-face">
              <stop stopColor="var(--accent)" stopOpacity=".28" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity=".05" />
            </radialGradient>
          </defs>
          <SignalPath
            d="M120 75 V100 Q120 116 136 116 H220 Q240 116 240 135 V165"
            className="text-highlight"
          />
          <SignalPath
            d="M360 75 V100 Q360 116 344 116 H260 Q240 116 240 135 V165"
            delay="[animation-delay:1s]"
          />
          <path
            d="m234 159 6 7 6-7"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M234 48h12m-6-6v12"
            stroke="var(--muted)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <g className="group-data-[playing=true]/scene:animate-context-float">
            <ContextLayer runtime={false} />
          </g>
          <g className="group-data-[playing=true]/scene:animate-context-float [animation-delay:-2.4s]">
            <ContextLayer runtime />
          </g>
        </svg>
      </MotionScene>
      <figcaption className="-mt-3 flex items-center justify-center gap-2.5 text-center text-base font-medium tracking-tight sm:-mt-5 sm:text-xl">
        <ProcessIcon name="branch" className="size-5 text-primary" />
        {result}
      </figcaption>
    </figure>
  )
}
