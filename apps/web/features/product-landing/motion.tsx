"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Button, cn } from "@flowmark/ui"

const MotionContext = createContext({
  paused: true,
  hidden: true,
  toggle: () => {},
})
const subscribeMotion = (notify: () => void) => {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
  preference.addEventListener("change", notify)
  document.addEventListener("visibilitychange", notify)
  return () => {
    preference.removeEventListener("change", notify)
    document.removeEventListener("visibilitychange", notify)
  }
}
const motionPolicy = () =>
  (document.hidden ? 1 : 0) |
  (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 0)
const serverMotionPolicy = () => 3

export function LandingMotion({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<boolean | null>(null)
  const policy = useSyncExternalStore(
    subscribeMotion,
    motionPolicy,
    serverMotionPolicy,
  )
  const reduced = (policy & 2) !== 0
  const hidden = (policy & 1) !== 0
  const paused = override ?? reduced
  return (
    <MotionContext.Provider
      value={{ paused, hidden, toggle: () => setOverride(!paused) }}
    >
      <div
        data-paused={paused || hidden}
        className="[&[data-paused=true]_*]:[animation-play-state:paused]"
      >
        {children}
      </div>
    </MotionContext.Provider>
  )
}

/** CSS does the drawing. Observers only suspend work outside the viewport. */
export function MotionScene({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const { paused, hidden } = useContext(MotionContext)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "60px" },
    )
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      role={label ? "region" : undefined}
      aria-label={label}
      data-playing={visible && !paused && !hidden}
      data-visible={visible}
      className={cn(
        "group/scene relative [&[data-playing=false]_*]:[animation-play-state:paused]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function MotionControl() {
  const { paused, toggle } = useContext(MotionContext)
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      className="h-9 px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
    >
      <span aria-hidden="true" className="text-primary">
        {paused ? "▷" : "Ⅱ"}
      </span>
      {paused ? "Play motion" : "Pause motion"}
    </Button>
  )
}

export function SignalPath({
  d,
  className,
  delay,
  active = true,
}: {
  d: string
  className?: string
  delay?: string
  active?: boolean
}) {
  return (
    <g fill="none" className={cn("text-primary", className)}>
      <path
        d={d}
        stroke="currentColor"
        strokeOpacity={active ? ".24" : ".12"}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {active && (
        <>
          <path
            d={d}
            pathLength="1"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray=".035 .965"
            vectorEffect="non-scaling-stroke"
            className={cn(
              "opacity-0 blur-[2px] group-data-[playing=true]/scene:animate-signal",
              delay,
            )}
          />
          <path
            d={d}
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray=".035 .965"
            vectorEffect="non-scaling-stroke"
            className={cn(
              "opacity-0 group-data-[playing=true]/scene:animate-signal",
              delay,
            )}
          />
          <path
            d={d}
            pathLength="1"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray=".001 .999"
            vectorEffect="non-scaling-stroke"
            className={cn(
              "opacity-0 drop-shadow-[0_0_5px_currentColor] group-data-[playing=true]/scene:animate-signal",
              delay,
            )}
          />
        </>
      )}
    </g>
  )
}

export function SectionTrace() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-border/40 lg:block"
    >
      <div className="h-full w-px origin-top bg-linear-to-b from-primary/0 via-primary/70 to-highlight/10 motion-safe:supports-[animation-timeline:view()]:animate-scroll-trace motion-safe:supports-[animation-timeline:view()]:[animation-timeline:view()] motion-safe:supports-[animation-timeline:view()]:[animation-range:entry_20%_exit_20%]" />
    </div>
  )
}
