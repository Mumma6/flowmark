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
import copy from "../../public/landing-page-copy.en.json"

const MotionContext = createContext<{
  hidden: boolean
  enabled: boolean
  toggle: () => void
} | null>(null)
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify)
  return () => document.removeEventListener("visibilitychange", notify)
}
const pageHidden = () => document.hidden
const serverHidden = () => true
const motionPreference = () =>
  window.matchMedia("(prefers-reduced-motion: no-preference)")
const prefersMotion = () => motionPreference().matches
const serverMotion = () => false
const subscribePreference = (notify: () => void) => {
  const query = motionPreference()
  query.addEventListener("change", notify)
  return () => query.removeEventListener("change", notify)
}

export function LandingMotion({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    pageHidden,
    serverHidden,
  )
  const systemMotion = useSyncExternalStore(
    subscribePreference,
    prefersMotion,
    serverMotion,
  )
  const [override, setOverride] = useState<boolean | null>(null)
  const enabled = override ?? systemMotion
  return (
    <MotionContext.Provider
      value={{ hidden, enabled, toggle: () => setOverride(!enabled) }}
    >
      <div
        data-paused={hidden}
        className="[&[data-paused=true]_*]:[animation-play-state:paused]"
      >
        {children}
      </div>
    </MotionContext.Provider>
  )
}

export function MotionToggle() {
  const motion = useContext(MotionContext)
  if (!motion) {
    return null
  }
  const label = motion.enabled
    ? copy.navigation.pauseMotion
    : copy.navigation.playMotion
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={motion.toggle}
      aria-label={label}
      title={label}
      className="size-10 rounded-full p-0 text-muted-foreground hover:text-primary"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d={motion.enabled ? "M10 8.5v7m4-7v7" : "m10 8 6 4-6 4Z"} />
      </svg>
    </Button>
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
  const motion = useContext(MotionContext)
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
      data-playing={Boolean(visible && motion?.enabled && !motion.hidden)}
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
