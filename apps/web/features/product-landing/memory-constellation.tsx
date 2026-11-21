"use client"

import { Button } from "@flowmark/ui"
import { useState, type PointerEvent } from "react"
import { MotionScene, SignalPath } from "./motion"

// Flowmark's SVG adaptations of Aceternity UI's Card Spotlight and Glowing Stars.
// https://ui.aceternity.com/components/card-spotlight
// https://ui.aceternity.com/components/glowing-stars-effect
const routes = [
  "M52 126 C100 126 114 72 168 72 S235 116 286 116 S348 76 388 76 S454 113 522 100",
  "M168 72 C213 72 222 116 286 116 C354 116 356 29 291 31 C226 33 230 103 286 116",
  "M286 116 C331 116 343 76 388 76 S465 45 518 44 M286 116 C359 116 366 161 420 161 S480 178 520 177",
] as const

const lights = [
  [
    [52, 126],
    [168, 72],
    [286, 116],
    [388, 76],
    [522, 100],
  ],
  [
    [168, 72],
    [286, 116],
    [291, 31],
  ],
  [
    [286, 116],
    [388, 76],
    [518, 44],
    [420, 161],
    [520, 177],
  ],
] as const

const strayPaths = [
  "M24 57 Q67 37 108 62 T168 72",
  "M52 126 Q112 148 158 150 T286 116",
  "M158 150 Q190 188 253 185 T350 171",
  "M388 76 Q428 76 456 126 T548 139",
]
const stars = [
  [38, 40],
  [68, 89],
  [95, 167],
  [123, 26],
  [143, 111],
  [181, 180],
  [210, 50],
  [239, 149],
  [256, 22],
  [294, 190],
  [327, 62],
  [341, 154],
  [374, 34],
  [408, 116],
  [448, 54],
  [468, 181],
  [503, 134],
  [548, 68],
]
const delays = ["", "[animation-delay:-1.7s]", "[animation-delay:-3.4s]"]

function moveSpotlight(event: PointerEvent<HTMLDivElement>) {
  if (
    event.pointerType !== "mouse" ||
    !event.currentTarget.closest("[data-playing=true]")
  ) {
    return
  }
  const card = event.currentTarget
  const bounds = card.getBoundingClientRect()
  card.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`)
  card.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`)
}

type MemoryView = { label: string; detail: string }

export function MemoryConstellation({
  views,
  label,
}: {
  views: MemoryView[]
  label: string
}) {
  const [selected, setSelected] = useState(0)
  const current = views[selected]
  return (
    <MotionScene className="min-w-0">
      <div
        onPointerMove={moveSpotlight}
        className="group/field relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-card p-4 shadow-[inset_0_1px_0_var(--border)] sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_42%,var(--hero-glow),transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--accent)_1px,transparent_1.5px)] bg-size-[12px_12px] opacity-0 [mask-image:radial-gradient(125px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),black,transparent)] group-data-[playing=true]/scene:transition-opacity group-data-[playing=true]/scene:duration-300 group-data-[playing=true]/scene:group-hover/field:opacity-45"
        />
        <div role="group" aria-label={label} className="flex flex-wrap gap-1">
          {views.map((view, index) => (
            <Button
              key={view.label}
              type="button"
              variant="ghost"
              aria-pressed={selected === index}
              className="min-h-10 rounded-full px-3 text-xs text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary"
              onClick={() => setSelected(index)}
            >
              {view.label}
            </Button>
          ))}
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 568 205"
          className="my-2 block w-full overflow-visible"
        >
          <defs>
            <radialGradient id="star-halo">
              <stop stopColor="var(--accent)" stopOpacity=".72" />
              <stop offset=".35" stopColor="var(--accent)" stopOpacity=".23" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <pattern
              id="memory-stars-grid"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="8" cy="8" r=".8" fill="var(--muted)" opacity=".34" />
            </pattern>
          </defs>
          <rect width="568" height="205" fill="url(#memory-stars-grid)" />
          {stars.map(([x, y], i) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r="1.7"
              fill="hsl(var(--highlight))"
              className={`opacity-45 group-data-[playing=true]/scene:animate-starlight ${delays[i % 3]}`}
            />
          ))}
          {[...strayPaths, ...routes].map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="hsl(var(--highlight))"
              strokeOpacity=".21"
              strokeWidth="1.15"
            />
          ))}
          <g key={current.label}>
            <path
              d={routes[selected]}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeOpacity=".14"
              className="blur-[2px]"
            />
            <path
              d={routes[selected]}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeOpacity=".8"
            />
            <SignalPath d={routes[selected]} />
            {lights[selected].map(([x, y], i) => (
              <g key={x}>
                <circle
                  cx={x}
                  cy={y}
                  r="17"
                  fill="url(#star-halo)"
                  className={`group-data-[playing=true]/scene:animate-starlight ${delays[i % 3]}`}
                />
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--surface)"
                  stroke="var(--accent)"
                />
                <circle cx={x} cy={y} r="1.8" fill="var(--accent)" />
              </g>
            ))}
          </g>
        </svg>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="min-h-10 text-sm leading-5 text-muted-foreground sm:min-h-5"
        >
          {current.detail}
        </p>
      </div>
    </MotionScene>
  )
}
