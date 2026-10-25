import type { ComponentProps } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button, type ButtonProps } from "./button"
import { cn } from "./utils"

export function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}
export function PaginationPrevious({ children, ...props }: ButtonProps) {
  return (
    <Button type="button" variant="outline" size="sm" {...props}>
      <ChevronLeft aria-hidden="true" />
      {children ?? "Previous"}
    </Button>
  )
}
export function PaginationNext({ children, ...props }: ButtonProps) {
  return (
    <Button type="button" variant="outline" size="sm" {...props}>
      {children ?? "Next"}
      <ChevronRight aria-hidden="true" />
    </Button>
  )
}
