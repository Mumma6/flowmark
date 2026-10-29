"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Pagination,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@flowmark/ui"
import { ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { runStatusLabel, type RunStatus } from "./run-presentation"

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  )
}

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <Badge
      className="gap-1.5"
      variant={
        status === "Completed"
          ? "success"
          : status === "Failed"
            ? "destructive"
            : "secondary"
      }
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {runStatusLabel(status)}
    </Badge>
  )
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div>
        <h1 className="break-words text-2xl font-semibold leading-9 tracking-tight sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </header>
  )
}

export function DataState({
  pending,
  error,
  retry,
}: {
  pending: boolean
  error: { message: string } | null
  retry?: () => void
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load data</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry} className="mt-3">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        )}
      </Alert>
    )
  }
  return pending ? (
    <div role="status" aria-label="Loading project data" className="space-y-3">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : null
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  const fieldId = `filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  const items = useMemo(
    () =>
      Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options],
  )
  return (
    <div className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-muted-foreground sm:max-w-[260px]">
      <label htmlFor={fieldId}>{label}</label>
      <Select items={items} value={value} onValueChange={onChange}>
        <SelectTrigger id={fieldId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TablePagination({
  page,
  pages,
  total,
  onPageChange,
}: {
  page: number
  pages: number
  total: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-center">
      <p role="status" className="text-xs text-muted-foreground">
        {total} matches · Page {page} of {pages}
      </p>
      <Pagination>
        <PaginationPrevious
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <PaginationNext
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </Pagination>
    </div>
  )
}

export function ViewLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  )
}
