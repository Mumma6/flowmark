import { cn } from "@flowmark/ui"

// Decorative streaks adapted from Aceternity UI Meteors.
// Source: https://ui.aceternity.com/registry/meteors.json

const meteors = [
  "left-[6%] [animation-delay:0.2s] [animation-duration:6s]",
  "left-[14%] [animation-delay:1.4s] [animation-duration:8s]",
  "left-[22%] [animation-delay:3.1s] [animation-duration:7s]",
  "left-[31%] [animation-delay:0.8s] [animation-duration:9s]",
  "left-[39%] [animation-delay:2.6s] [animation-duration:6s]",
  "left-[47%] [animation-delay:4.2s] [animation-duration:8s]",
  "left-[56%] [animation-delay:1.1s] [animation-duration:7s]",
  "left-[64%] [animation-delay:3.7s] [animation-duration:9s]",
  "left-[73%] [animation-delay:0.5s] [animation-duration:6s]",
  "left-[81%] [animation-delay:2.2s] [animation-duration:8s]",
  "left-[88%] [animation-delay:4.8s] [animation-duration:7s]",
  "left-[94%] [animation-delay:1.8s] [animation-duration:9s]",
] as const

export function Meteors({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden",
        className,
      )}
      aria-hidden="true"
    >
      {meteors.map((meteor) => (
        <span
          key={meteor}
          className={cn(
            "absolute top-0 h-0.5 w-0.5 animate-meteor rounded-full bg-primary shadow-[0_0_0_1px_#b9f59755] before:absolute before:top-1/2 before:h-px before:w-16 before:-translate-y-1/2 before:bg-linear-to-r before:from-primary before:to-transparent before:content-['']",
            meteor,
          )}
        />
      ))}
    </div>
  )
}
