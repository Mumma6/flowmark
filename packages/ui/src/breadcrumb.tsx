import type { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight } from "lucide-react"
import { cn } from "./utils"

export function Breadcrumb(props: ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" data-slot="breadcrumb" {...props} />
}
export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}
export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      {...props}
    />
  )
}
export function BreadcrumbLink({
  asChild,
  className,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "a"
  return (
    <Component
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
}
export function BreadcrumbPage({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={cn("font-normal text-foreground break-all", className)}
      {...props}
    />
  )
}
export function BreadcrumbSeparator({
  children,
  ...props
}: ComponentProps<"li">) {
  return (
    <li role="presentation" aria-hidden="true" {...props}>
      {children ?? <ChevronRight className="h-3.5 w-3.5" />}
    </li>
  )
}
