import { cn } from "@flowmark/ui"

// Sweeping light cones adapted from Aceternity UI Spotlight New.
// Source: https://ui.aceternity.com/registry/spotlight-new.json

export function SpotlightWash({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden motion-reduce:opacity-40",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute top-0 left-0 h-full w-full animate-spotlight-pan motion-reduce:animate-none">
        <div className="absolute top-0 left-0 h-[86rem] w-[36rem] origin-top-left -translate-y-[22rem] -rotate-45 bg-[radial-gradient(68%_69%_at_55%_31%,#b9f5973d,transparent_78%)]" />
        <div className="absolute top-0 left-0 h-[86rem] w-[16rem] origin-top-left -rotate-45 bg-[radial-gradient(circle,#b9f59722,transparent_80%)] [translate:-8%_-48%]" />
      </div>
      <div className="absolute top-0 right-0 h-full w-full animate-spotlight-pan-reverse motion-reduce:animate-none">
        <div className="absolute top-0 right-0 h-[86rem] w-[36rem] origin-top-right -translate-y-[22rem] rotate-45 bg-[radial-gradient(68%_69%_at_45%_31%,#b9f59733,transparent_78%)]" />
        <div className="absolute top-0 right-0 h-[86rem] w-[16rem] origin-top-right rotate-45 bg-[radial-gradient(circle,#b9f5971c,transparent_80%)] [translate:8%_-48%]" />
      </div>
    </div>
  )
}
