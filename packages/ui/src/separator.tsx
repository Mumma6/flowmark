import type { ComponentProps } from "react"
import { cn } from "./utils"

export function Separator({ className, ...props }: ComponentProps<"hr">) {
  return (
    <hr
      data-slot="separator"
      className={cn("border-0 border-t border-border", className)}
      {...props}
    />
  )
}
