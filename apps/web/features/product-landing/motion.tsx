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
import { cn } from "@flowmark/ui"

const PageHiddenContext = createContext(true)
const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify)
  return () => document.removeEventListener("visibilitychange", notify)
}
const pageHidden = () => document.hidden
const serverHidden = () => true

export function LandingMotion({ children }: { children: ReactNode }) {
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    pageHidden,
    serverHidden,
  )
  return (
    <PageHiddenContext.Provider value={hidden}>
      <div
        data-paused={hidden}
        className="[&[data-paused=true]_*]:[animation-play-state:paused]"
      >
        {children}
      </div>
    </PageHiddenContext.Provider>
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
  const hidden = useContext(PageHiddenContext)
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
      data-playing={visible && !hidden}
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
