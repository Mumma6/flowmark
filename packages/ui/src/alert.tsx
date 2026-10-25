import type { ComponentProps } from "react"
import { cn } from "./utils"

export function Alert({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      data-slot="alert"
      className={cn(
        "relative rounded-lg border border-border bg-card p-4 text-sm",
        variant === "destructive" && "border-destructive/40 text-destructive",
        className,
      )}
      {...props}
    />
  )
}
export function AlertTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("mb-1 font-medium", className)} {...props} />
}
export function AlertDescription({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("text-sm leading-relaxed", className)} {...props} />
}
