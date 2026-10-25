import { cn } from "@flowmark/ui"

// Decorative streaks adapted from Aceternity UI Meteors.
// Source: https://ui.aceternity.com/registry/meteors.json

const meteors = [
  { left: "6%", delay: "0.2s", duration: "6s" },
  { left: "14%", delay: "1.4s", duration: "8s" },
  { left: "22%", delay: "3.1s", duration: "7s" },
  { left: "31%", delay: "0.8s", duration: "9s" },
  { left: "39%", delay: "2.6s", duration: "6s" },
  { left: "47%", delay: "4.2s", duration: "8s" },
  { left: "56%", delay: "1.1s", duration: "7s" },
  { left: "64%", delay: "3.7s", duration: "9s" },
  { left: "73%", delay: "0.5s", duration: "6s" },
  { left: "81%", delay: "2.2s", duration: "8s" },
  { left: "88%", delay: "4.8s", duration: "7s" },
  { left: "94%", delay: "1.8s", duration: "9s" },
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
          key={meteor.left}
          className="absolute top-0 h-0.5 w-0.5 animate-meteor rounded-full bg-primary shadow-[0_0_0_1px_#b9f59755] before:absolute before:top-1/2 before:h-px before:w-16 before:-translate-y-1/2 before:bg-linear-to-r before:from-primary before:to-transparent before:content-['']"
          style={{
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
          }}
        />
      ))}
    </div>
  )
}
