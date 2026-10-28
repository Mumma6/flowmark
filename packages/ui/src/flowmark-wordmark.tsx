import type { ComponentProps } from "react"
import { FlowmarkMark } from "./flowmark-mark"
import { cn } from "./utils"

export function FlowmarkLockup({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-[10px] border border-primary/30 bg-[#0d1311] text-primary",
        className,
      )}
      {...props}
    >
      <FlowmarkMark className="size-[58%]" />
    </span>
  )
}

export function FlowmarkWordmark({
  className,
  framed = true,
}: {
  className?: string
  framed?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {framed ? (
        <FlowmarkLockup className="size-8 rounded-lg" />
      ) : (
        <FlowmarkMark className="size-7 text-primary" />
      )}
      <span className="text-[1.35rem] font-semibold tracking-tight">
        flowmark<span className="text-primary">.</span>
      </span>
    </span>
  )
}
